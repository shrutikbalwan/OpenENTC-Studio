// Static analysis of Arduino sketch source (setup/loop, pins, serial use) before compilation.
const MAX_SOURCE = 1_000_000;

export function analyzeSketchSource(source) {
  if (typeof source !== 'string' || source.length > MAX_SOURCE) throw new TypeError('Firmware source is missing or exceeds the size limit.');
  const diagnostics = [];
  const lineOf = (pattern) => { const index = source.search(pattern); return index < 0 ? null : source.slice(0, index).split(/\r?\n/).length; };
  const setupLine = lineOf(/\bvoid\s+setup\s*\(/);
  const loopLine = lineOf(/\bvoid\s+loop\s*\(/);
  if (!setupLine) diagnostics.push({ severity: 'error', code: 'FIRMWARE_SETUP_MISSING', message: 'setup() is missing.', line: 1, column: 1 });
  if (!loopLine) diagnostics.push({ severity: 'error', code: 'FIRMWARE_LOOP_MISSING', message: 'loop() is missing.', line: 1, column: 1 });
  let depth = 0; let line = 1;
  for (const character of source) { if (character === '\n') line += 1; if (character === '{') depth += 1; if (character === '}') depth -= 1; if (depth < 0) { diagnostics.push({ severity: 'error', code: 'FIRMWARE_BRACE_UNBALANCED', message: 'Closing brace has no matching opening brace.', line, column: 1 }); break; } }
  if (depth > 0) diagnostics.push({ severity: 'error', code: 'FIRMWARE_BRACE_UNBALANCED', message: 'One or more opening braces are not closed.', line, column: 1 });
  return Object.freeze({ kind: 'firmware-structure-report', diagnostics: Object.freeze(diagnostics) });
}
