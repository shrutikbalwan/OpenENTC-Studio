import { buildSpiceNetlist } from '../../schematic/src/spice.mjs';
import { assertAbsoluteExecutable, probeExecutable } from './discovery.mjs';
import { createDiagnostic } from '../../diagnostics/src/index.mjs';

const OPERATIONS = ['operating-point', 'dc-sweep', 'ac-analysis', 'transient'];
const MAX_ENGINE_OUTPUT_BYTES = 2 * 1024 * 1024;
const MAX_TITLE_BYTES = 200;
const MAX_COMPONENTS = 10_000;
const MAX_WIRES = 100_000;
const MAX_OUTPUT_VECTORS = 126;
const utf8Bytes = (value) => typeof TextEncoder === 'function' ? new TextEncoder().encode(value).byteLength : unescape(encodeURIComponent(value)).length;

export function parseNgspiceVersion(text) {
  if (typeof text !== 'string' || utf8Bytes(text) > 64 * 1024) throw new TypeError('ngspice version output is missing or exceeds the parser limit.');
  const match = text.match(/\bngspice[-\s]+(\d+(?:\.\d+){0,2})\b/i);
  if (!match) throw new TypeError('ngspice version output is not recognized.');
  return match[1];
}

export function parseNgspiceDiagnostics(text) {
  if (typeof text !== 'string' || utf8Bytes(text) > MAX_ENGINE_OUTPUT_BYTES) throw new TypeError('ngspice diagnostic output is missing or exceeds the parser limit.');
  const diagnostics = [];
  const significant = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  for (const line of significant) {
    if (!/(?:error|warning|fatal|singular matrix|timestep too small|converg)/i.test(line)) continue;
    const lower = line.toLowerCase();
    const severity = /warning/i.test(line) && !/(?:error|fatal|singular|timestep|converg)/i.test(line) ? 'warning' : 'error';
    const code = lower.includes('singular matrix') ? 'NGSPICE_SINGULAR_MATRIX' : lower.includes('timestep too small') ? 'NGSPICE_TIMESTEP' : lower.includes('converg') ? 'NGSPICE_NONCONVERGENCE' : severity === 'warning' ? 'NGSPICE_WARNING' : 'NGSPICE_ERROR';
    const location = line.match(/\bline\s+(\d+)\b/i);
    const sourceMatch = line.match(/\btrouble with\s+([A-Za-z][A-Za-z0-9_.:+-]*?)(?:-instance)?(?:\s|$)/i) || line.match(/\bdevice\s*[:=]\s*([A-Za-z][A-Za-z0-9_.:+-]*)/i);
    const source = sourceMatch?.[1] || null;
    const message = line.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 1000).trim();
    if (!diagnostics.some((diagnostic) => diagnostic.code === code && diagnostic.message === message)) diagnostics.push(createDiagnostic({ severity, code, message, source, line: location ? Number(location[1]) : null }));
    if (diagnostics.length >= 256) break;
  }
  if (!diagnostics.length && significant.length) diagnostics.push(createDiagnostic({ code: 'NGSPICE_ENGINE_FAILURE', message: significant.at(-1).replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 1000) }));
  return Object.freeze(diagnostics);
}

export function parseNgspiceMeasurements(text) {
  if (typeof text !== 'string' || utf8Bytes(text) > MAX_ENGINE_OUTPUT_BYTES) throw new TypeError('ngspice output is missing or exceeds the parser limit.');
  const measurements = {};
  for (const line of text.split(/\r?\n/)) {
    const match = line.match(/^\s*([VI]\([^\)]+\))\s*=\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:[Ee][-+]?\d+)?)\s*$/i);
    if (match) measurements[match[1]] = Number(match[2]);
  }
  return Object.freeze({ kind: 'scalar-table', units: 'SI', measurements });
}

export function parseNgspiceOutput(text) {
  const scalar = parseNgspiceMeasurements(text);
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const headerIndex = lines.findIndex((line) => /^index\s+/i.test(line));
  if (headerIndex < 0) return scalar;
  const columns = lines[headerIndex].split(/\s+/).slice(1);
  if (!columns.length || columns.length > 128) throw new TypeError('ngspice table has an invalid column count.');
  const rows = [];
  for (const line of lines.slice(headerIndex + 1)) {
    if (/^[-+]?(?:\d+\.?\d*|\.\d+)(?:[Ee][-+]?\d+)?(?:\s|$)/.test(line)) {
      const values = line.split(/\s+/).map(Number);
      if (values.length !== columns.length + 1 || values.some((value) => !Number.isFinite(value))) throw new TypeError('ngspice table contains a malformed row.');
      rows.push(values.slice(1));
      if (rows.length > 100_000) throw new TypeError('ngspice table exceeds the row limit.');
    }
  }
  return Object.freeze({ kind: 'table', columns: Object.freeze(columns), rows: Object.freeze(rows.map((row) => Object.freeze(row))), units: 'SI' });
}

function validateJob(job) {
  if (!job || !OPERATIONS.includes(job.operation)) throw new TypeError(`ngspice operation is unsupported: ${job?.operation || 'missing'}.`);
  if (!Array.isArray(job.components) || job.components.length > MAX_COMPONENTS) throw new TypeError('ngspice jobs require a bounded canonical component list.');
  if (job.wires !== undefined && (!Array.isArray(job.wires) || job.wires.length > MAX_WIRES)) throw new TypeError('ngspice job wires must be a bounded array.');
  if (job.title !== undefined && (typeof job.title !== 'string' || job.title.length > MAX_TITLE_BYTES || /[\u0000-\u001f\u007f]/.test(job.title))) throw new TypeError('ngspice job title is invalid or oversized.');
  if (job.outputs !== undefined && (!Array.isArray(job.outputs) || job.outputs.length > MAX_OUTPUT_VECTORS || job.outputs.some((output) => typeof output !== 'string' || !/^[A-Za-z0-9_.:+-]{1,100}$/.test(output) || output.includes('..')))) throw new TypeError('ngspice output vectors are invalid or oversized.');
  const positive = (value) => Number.isFinite(value) && value > 0 && value <= 1e12;
  if (job.operation === 'ac-analysis' && ((job.points !== undefined && (!Number.isInteger(job.points) || job.points < 1 || job.points > 100_000)) || (job.startHz !== undefined && !positive(job.startHz)) || (job.stopHz !== undefined && !positive(job.stopHz)) || (job.startHz !== undefined && job.stopHz !== undefined && job.stopHz <= job.startHz))) throw new TypeError('ngspice AC sweep parameters are invalid.');
  if (job.operation === 'transient' && ((job.stepTime !== undefined && !positive(job.stepTime)) || (job.stopTime !== undefined && !positive(job.stopTime)) || (job.stepTime !== undefined && job.stopTime !== undefined && job.stopTime < job.stepTime))) throw new TypeError('ngspice transient parameters are invalid.');
  if (job.operation === 'dc-sweep' && ((job.start !== undefined && !Number.isFinite(job.start)) || (job.stop !== undefined && !Number.isFinite(job.stop)) || (job.step !== undefined && !positive(Math.abs(job.step))))) throw new TypeError('ngspice DC sweep parameters are invalid.');
  return true;
}

function outputVectors(job) {
  if (job.outputs?.length) return job.outputs;
  return [...new Set(job.components.flatMap((component) => [component.n1, component.n2]).filter((node) => typeof node === 'string' && node !== '0' && node.toUpperCase() !== 'GND'))].sort().slice(0, MAX_OUTPUT_VECTORS);
}

function spiceNumber(value) {
  return Number(value).toPrecision(12).replace(/\.0+(?=e|$)/i, '').replace(/(\.\d*?[1-9])0+(?=e|$)/i, '$1');
}

function sourceReference(job) {
  const requested = job.source || job.components.find((component) => ['voltage', 'current'].includes(component.type))?.id;
  const component = job.components.find((candidate) => candidate.id === requested || candidate.label === requested);
  if (!component || !['voltage', 'current'].includes(component.type)) throw new TypeError(`ngspice ${job.operation === 'dc-sweep' ? 'DC sweep' : 'AC analysis'} requires an existing independent source reference.`);
  const prefix = component?.type === 'voltage' ? 'V' : component?.type === 'current' ? 'I' : '';
  const source = component ? (component.id.toUpperCase().startsWith(prefix) ? component.id : `${prefix}${component.id}`) : requested;
  if (typeof source !== 'string' || !/^[A-Za-z][A-Za-z0-9_.:+-]{0,99}$/.test(source)) throw new TypeError(`ngspice ${job.operation === 'dc-sweep' ? 'DC sweep' : 'AC analysis'} requires a bounded source reference.`);
  return source;
}

function analysisLines(job) {
  const nodes = outputVectors(job);
  const vectors = (job.operation === 'ac-analysis' ? nodes.flatMap((node) => [`vm(${node})`, `vp(${node})`]).slice(0, MAX_OUTPUT_VECTORS) : nodes.map((node) => `v(${node})`)).join(' ');
  if (job.operation === 'operating-point') return ['.op', '.control', 'run', ...(vectors ? [`print ${vectors}`] : []), '.endc'];
  if (job.operation === 'ac-analysis') {
    const points = job.points ?? 20; const start = job.startHz ?? 1; const stop = job.stopHz ?? 1_000_000;
    return [`.ac dec ${points} ${spiceNumber(start)} ${spiceNumber(stop)}`, ...(vectors ? [`.print ac ${vectors}`] : [])];
  }
  if (job.operation === 'transient') {
    const step = job.stepTime ?? 1e-6; const stop = job.stopTime ?? 1e-3;
    return [`.tran ${spiceNumber(step)} ${spiceNumber(stop)}`, ...(vectors ? [`.print tran ${vectors}`] : [])];
  }
  const source = sourceReference(job);
  const start = job.start ?? 0; const stop = job.stop ?? 5; const step = job.step ?? 0.1;
  return [`.dc ${source} ${spiceNumber(start)} ${spiceNumber(stop)} ${spiceNumber(step)}`, ...(vectors ? [`.print dc ${vectors}`] : [])];
}

function addAnalysis(netlist, job) {
  let prepared = netlist;
  if (job.operation === 'ac-analysis') {
    const source = sourceReference(job);
    const escaped = source.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const sourceLine = new RegExp(`^(${escaped}\\s+[^\\r\\n]+)$`, 'mi');
    if (!sourceLine.test(prepared)) throw new TypeError('ngspice AC analysis source is not present in the exported netlist.');
    prepared = prepared.replace(sourceLine, '$1 AC 1');
  }
  return prepared.replace(/\.end\s*$/i, `${analysisLines(job).join('\n')}\n.end\n`);
}

export function createNgspiceAdapter({ executable = null, runner = null } = {}) {
  let prepared = null;
  let lastRun = null;
  let cancelRequested = false;
  let activeController = null;
  let running = false;
  return {
    metadata: () => ({ id: 'ngspice', name: 'ngspice', license: 'BSD-3-Clause', integration: 'process', sourceUrl: 'https://sourceforge.net/projects/ngspice/' }),
    detect: async () => probeExecutable({ id: 'ngspice', candidates: executable ? [executable] : [] }),
    selfTest: async () => { const parserOk = parseNgspiceMeasurements('V(out) = 6\n').measurements['V(out)'] === 6; const configured = Boolean(executable && runner); return { ok: parserOk && configured, available: configured, evidence: 'parser-voltage-fixture', ...(configured ? {} : { reason: 'engine-not-configured' }) }; },
    capabilities: () => [...OPERATIONS],
    validate: validateJob,
    prepare: async (job) => { validateJob(job); prepared = { netlist: addAnalysis(buildSpiceNetlist(job.components, job.wires || [], { title: job.title || 'OpenENTC ngspice job' }), job), arguments: ['-b'] }; return prepared; },
    run: async (_job, eventSink = () => {}) => {
      if (!runner || !executable) throw new Error('ngspice is unavailable: configure an absolute executable path before running.');
      assertAbsoluteExecutable(executable);
      if (running) throw Object.assign(new Error('ngspice adapter is already running a job.'), { code: 'ENGINE_BUSY' });
      running = true;
      cancelRequested = false;
      activeController = new AbortController();
      eventSink({ phase: 'running' });
      try {
        lastRun = await runner({ executable, args: prepared?.arguments || ['-b'], shell: false, netlist: prepared?.netlist || '', signal: activeController.signal });
      } catch (error) {
        if (cancelRequested) throw Object.assign(new Error('ngspice job cancelled.'), { code: 'PROCESS_CANCELLED', cause: error });
        throw error;
      } finally {
        activeController = null;
        running = false;
      }
      if (cancelRequested) throw Object.assign(new Error('ngspice job cancelled.'), { code: 'PROCESS_CANCELLED' });
      if (!lastRun?.ok) throw Object.assign(new Error(lastRun?.stderr || 'ngspice failed.'), { code: lastRun?.error || 'ENGINE_FAILURE' });
      return lastRun;
    },
    parse: async () => parseNgspiceOutput(lastRun?.stdout || ''),
    cancel: async () => { cancelRequested = true; activeController?.abort(); },
    clean: async () => { prepared = null; lastRun = null; }
  };
}
