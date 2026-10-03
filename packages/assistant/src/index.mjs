// AI lab partner over any OpenAI-compatible chat-completions API (OpenAI, Ollama, OpenRouter,
// Groq, Gemini's OpenAI endpoint …). The model is given tools backed by OpenENTC's own tested
// engines and is told to compute every number with them, so explanations stay grounded in the
// simulators instead of the model's memory. The API key is supplied by the user per call and is
// never stored in a project.
import { createSession, run as runConsole } from '../../mathconsole/src/index.mjs';
import { parseNetlist, solveNetwork, thevenin } from '../../network/src/index.mjs';

export const PROVIDERS = Object.freeze({
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', needsKey: true },
  ollama: { label: 'Ollama (free, runs on your computer)', baseUrl: 'http://localhost:11434/v1', model: 'llama3.1', needsKey: false },
  openrouter: { label: 'OpenRouter', baseUrl: 'https://openrouter.ai/api/v1', model: 'openai/gpt-4o-mini', needsKey: true },
  groq: { label: 'Groq', baseUrl: 'https://api.groq.com/openai/v1', model: 'llama-3.3-70b-versatile', needsKey: true },
  gemini: { label: 'Google Gemini (OpenAI-compatible)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash', needsKey: true },
  custom: { label: 'Custom OpenAI-compatible server', baseUrl: '', model: '', needsKey: false },
});

export const MODES = Object.freeze({
  explain: 'Explain fully, step by step',
  hint: 'Give hints only — let me solve it',
  viva: 'Act as my viva examiner',
});
export const LANGUAGES = Object.freeze({ en: 'English', hi: 'Hindi (हिन्दी)', mr: 'Marathi (मराठी)' });

/** Only https endpoints, or plain http to this computer (for Ollama and local servers). */
export function validateBaseUrl(text) {
  let url;
  try { url = new URL(String(text).trim()); } catch { throw new RangeError('Enter a valid API base URL, e.g. https://api.openai.com/v1'); }
  const local = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && local)) throw new RangeError('The API URL must use https (plain http is allowed only for localhost).');
  if (url.username || url.password) throw new RangeError('Do not put credentials in the URL — use the API key field.');
  return url.toString().replace(/\/+$/, '');
}

// ---------------------------------------------------------------------------
// Tools.

const clip = (text, limit = 4000) => (text.length > limit ? `${text.slice(0, limit)}\n… (truncated)` : text);
const complexText = ([re, im]) => (Math.abs(im) < 1e-12 ? `${Number(re.toPrecision(6))}` : `${Number(re.toPrecision(6))} ${im < 0 ? '-' : '+'} j${Number(Math.abs(im).toPrecision(6))} (|${Number(Math.hypot(re, im).toPrecision(6))}| ∠ ${Number((Math.atan2(im, re) * 180 / Math.PI).toFixed(3))}°)`);

export const TOOL_DEFINITIONS = Object.freeze([
  {
    name: 'calculate',
    description: 'Run OpenENTC Math Console code (MATLAB-like). Supports complex numbers with j, matrices [1 2; 3 4], A\\b, engineering suffixes (4.7k, 100n), and functions such as sqrt, exp, log10, db, deg, polar, parallel, roots, poly, conv, polyval, det, inv, mean, std, linspace, sum, abs, angle. Constants: pi, e, c0, kB, q. Use it for EVERY numeric value you state.',
    parameters: { type: 'object', properties: { code: { type: 'string', description: 'One or more statements, e.g. "R = parallel(1k, 2.2k)\\nfc = 1/(2*pi*R*100n)"' } }, required: ['code'] },
  },
  {
    name: 'solve_circuit',
    description: 'Solve a linear circuit with modified nodal analysis (DC or AC phasor). Netlist lines: "R1 n1 n2 1k", "C1 n1 0 100n", "L1 n1 n2 10m", "V1 n+ n- 12 [phase°]", "I1 n+ n- 2m", dependent sources E/G/H/F as in SPICE. Node 0 is ground. Optionally returns the Thevenin equivalent between two nodes.',
    parameters: { type: 'object', properties: { netlist: { type: 'string' }, frequency: { type: 'number', description: 'Hz; 0 for DC' }, thevenin_a: { type: 'string' }, thevenin_b: { type: 'string' } }, required: ['netlist'] },
  },
  {
    name: 'current_lab',
    description: 'Return which OpenENTC lab the student has open and its current inputs/settings, so you can talk about their actual experiment.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'find_lesson',
    description: 'Search the Learning Hub lessons and viva bank by keyword; returns summaries and key formulas from the course.',
    parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] },
  },
]);

/** Execute one tool call. `context` supplies { lab(): object, lessons: [...], viva: [...] }. */
export function executeTool(name, args, context = {}) {
  try {
    if (name === 'calculate') {
      const result = runConsole(String(args.code ?? ''), createSession());
      return clip(result.outputs.map((o) => (o.error ? `error: ${o.error}` : o.plot ? `[plot with ${o.plot.length} series]` : `${o.name ? `${o.name} = ` : ''}${o.text}`)).join('\n') || '(no output — remove trailing semicolons to show values)');
    }
    if (name === 'solve_circuit') {
      const elements = parseNetlist(String(args.netlist ?? ''));
      const frequency = Number(args.frequency) || 0;
      const solution = solveNetwork(elements, { frequency });
      const lines = [`Analysis: ${frequency ? `AC at ${frequency} Hz (phasors)` : 'DC'}`, 'Node voltages:', ...Object.entries(solution.voltages).filter(([node]) => node !== '0').map(([node, v]) => `  V(${node}) = ${complexText(v)} V`), 'Element currents:', ...Object.entries(solution.currents).map(([element, i]) => `  I(${element}) = ${complexText(i)} A`), 'Power absorbed:', ...Object.entries(solution.power).map(([element, p]) => `  P(${element}) = ${complexText(p)} ${frequency ? 'VA' : 'W'}`)];
      if (args.thevenin_a) {
        const th = thevenin(elements, String(args.thevenin_a), String(args.thevenin_b ?? '0'), { frequency });
        lines.push(`Thevenin between ${args.thevenin_a} and ${args.thevenin_b ?? '0'}: Vth = ${complexText(th.vth)} V, Zth = ${complexText(th.zth)} Ω, Isc = ${complexText(th.shortCircuit)} A, Pmax = ${Number(th.maxPower.toPrecision(6))} W`);
      }
      return clip(lines.join('\n'));
    }
    if (name === 'current_lab') return clip(JSON.stringify(context.lab ? context.lab() : { module: 'unknown' }, null, 1), 6000);
    if (name === 'find_lesson') {
      const words = String(args.query ?? '').toLowerCase().split(/\W+/).filter((w) => w.length > 2);
      const score = (text) => words.reduce((s, w) => s + (text.toLowerCase().includes(w) ? 1 : 0), 0);
      const lessons = (context.lessons ?? []).map((l) => ({ l, s: score(`${l.title} ${l.summary.join(' ')} ${l.formulas.join(' ')}`) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 3);
      const viva = (context.viva ?? []).map(([q, a]) => ({ q, a, s: score(`${q} ${a}`) })).filter((x) => x.s > 0).sort((a, b) => b.s - a.s).slice(0, 3);
      if (!lessons.length && !viva.length) return 'No matching lesson.';
      return clip([...lessons.map(({ l }) => `Lesson "${l.title}" (lab: ${l.lab?.label}):\n${l.summary.join(' ')}\nFormulas: ${l.formulas.join('; ')}`), ...viva.map((v) => `Viva: ${v.q}\nModel answer: ${v.a}`)].join('\n\n'));
    }
    return `error: unknown tool "${name}"`;
  } catch (error) {
    return `error: ${error.message}`;
  }
}

// ---------------------------------------------------------------------------
// Prompting.

export function systemPrompt({ mode = 'explain', language = 'en', labName = '' } = {}) {
  const style = {
    explain: 'Explain clearly and step by step, then give the final answer.',
    hint: 'Do NOT give the final answer or a full solution. Give one small hint or a guiding question at a time, and check the student\'s attempts with the tools.',
    viva: 'Act as a fair university viva examiner. Ask one question at a time about the student\'s current lab, wait for their answer, then say what was right, what was missing, and give a mark out of 10 before the next question.',
  }[mode] ?? '';
  return [
    'You are the OpenENTC lab partner, a patient tutor for Electronics & Telecommunication engineering students (Indian university syllabus level).',
    `The student is ${labName ? `in the "${labName}" lab` : 'using OpenENTC Studio'}.`,
    'Rules:',
    '1. Never compute numbers in your head. Use the calculate tool (or solve_circuit for circuits) for every numeric result you state, and quote the tool output.',
    '2. If a question is about the student\'s experiment, call current_lab first and use their real values.',
    '3. Use find_lesson to stay consistent with the course\'s formulas and notation.',
    '4. Use simple English sentences; students may not be native speakers. Use SI units and engineering prefixes (kΩ, µF, MHz).',
    `5. Reply in ${LANGUAGES[language] ?? 'English'}${language !== 'en' ? ' (keep formulas, units and technical terms in English)' : ''}.`,
    '6. If you are not sure, say so. Do not invent datasheet values or syllabus facts.',
    `Style: ${style}`,
  ].join('\n');
}

// ---------------------------------------------------------------------------
// Conversation loop.

/**
 * Send the conversation, run any tool calls locally, feed the results back, and repeat until the
 * model answers in text (at most maxSteps rounds). Returns { reply, messages, trace }.
 */
export async function chat({ settings, messages, context = {}, fetchImpl = globalThis.fetch, maxSteps = 6, timeoutMs = 60_000, signal = null }) {
  const provider = PROVIDERS[settings.provider] ?? PROVIDERS.custom;
  const baseUrl = validateBaseUrl(settings.baseUrl || provider.baseUrl);
  const model = String(settings.model || provider.model).trim();
  if (!model) throw new RangeError('Choose a model name.');
  if (provider.needsKey && !settings.apiKey) throw new RangeError(`Enter your ${provider.label} API key in the assistant settings.`);
  const tools = TOOL_DEFINITIONS.map((t) => ({ type: 'function', function: t }));
  const conversation = [{ role: 'system', content: systemPrompt({ mode: settings.mode, language: settings.language, labName: context.labName }) }, ...messages];
  const trace = [];
  for (let step = 0; step < maxSteps; step += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    signal?.addEventListener('abort', () => controller.abort(), { once: true });
    let response;
    try {
      response = await fetchImpl(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(settings.apiKey ? { Authorization: `Bearer ${settings.apiKey}` } : {}) },
        body: JSON.stringify({ model, messages: conversation, tools, tool_choice: 'auto', temperature: 0.2 }),
        signal: controller.signal,
      });
    } catch (error) {
      throw new Error(error.name === 'AbortError' ? 'The AI service did not answer in time.' : `Could not reach ${new URL(baseUrl).host}: ${error.message}. For Ollama, start it with OLLAMA_ORIGINS=* so the browser may call it.`);
    } finally { clearTimeout(timer); }
    let data;
    try { data = await response.json(); } catch { data = null; }
    if (!response.ok) throw new Error(`AI service error ${response.status}: ${data?.error?.message ?? response.statusText ?? 'request failed'}`);
    const message = data?.choices?.[0]?.message;
    if (!message) throw new Error('The AI service returned no message.');
    const calls = message.tool_calls ?? [];
    conversation.push({ role: 'assistant', content: message.content ?? null, ...(calls.length ? { tool_calls: calls } : {}) });
    if (!calls.length) return { reply: message.content ?? '', messages: conversation.slice(1), trace };
    for (const call of calls) {
      let args = {};
      try { args = JSON.parse(call.function?.arguments || '{}'); } catch { args = {}; }
      const output = executeTool(call.function?.name, args, context);
      trace.push({ tool: call.function?.name, args, output });
      conversation.push({ role: 'tool', tool_call_id: call.id, content: output });
    }
  }
  return { reply: 'I used many tool steps without finishing. Please ask a narrower question.', messages: conversation.slice(1), trace };
}
