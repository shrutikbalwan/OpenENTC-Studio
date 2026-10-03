import test from 'node:test';
import assert from 'node:assert/strict';
import { chat, executeTool, PROVIDERS, systemPrompt, TOOL_DEFINITIONS, validateBaseUrl } from '../packages/assistant/src/index.mjs';

// A fake OpenAI-compatible endpoint: replays scripted assistant messages and records requests.
function mockApi(script) {
  const requests = [];
  const fetchImpl = async (url, init) => {
    requests.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    const next = script.shift();
    if (next.status) return { ok: false, status: next.status, statusText: 'Bad', json: async () => ({ error: { message: next.error } }) };
    return { ok: true, status: 200, json: async () => ({ choices: [{ message: next }] }) };
  };
  return { fetchImpl, requests };
}
const toolCall = (id, name, args) => ({ id, type: 'function', function: { name, arguments: JSON.stringify(args) } });

test('tools compute with the real engines', () => {
  assert.match(executeTool('calculate', { code: 'R = parallel(1k, 2.2k)\nfc = 1/(2*pi*R*100n)' }), /R = 687\.5[\s\S]*fc = 2314\.9/);
  const circuit = executeTool('solve_circuit', { netlist: 'V1 1 0 12\nR1 1 2 1k\nR2 2 0 2k', thevenin_a: '2' });
  assert.match(circuit, /V\(2\) = 8 V/); assert.match(circuit, /Zth = 666\.667 Ω/);
  assert.match(executeTool('solve_circuit', { netlist: 'R1 1 2' }), /^error:/);
  assert.match(executeTool('calculate', { code: '1/' }), /error/);
  assert.match(executeTool('current_lab', {}, { lab: () => ({ module: 'Circuit Lab', components: 3 }) }), /Circuit Lab/);
  const lessons = [{ title: 'Voltage divider', summary: ['Vout = Vin R2/(R1+R2)'], formulas: ['Vout = Vin·R2/(R1 + R2)'], lab: { label: 'Circuit Lab' } }];
  assert.match(executeTool('find_lesson', { query: 'voltage divider' }, { lessons, viva: [] }), /Voltage divider/);
  assert.equal(executeTool('nope', {}), 'error: unknown tool "nope"');
  assert.equal(TOOL_DEFINITIONS.length, 4);
});

test('the chat loop runs tool calls locally and returns the final answer', async () => {
  const { fetchImpl, requests } = mockApi([
    { role: 'assistant', content: null, tool_calls: [toolCall('c1', 'calculate', { code: 'Xc = 1/(2*pi*50*10u)' })] },
    { role: 'assistant', content: 'Xc is about 318.3 Ω.' },
  ]);
  const result = await chat({ settings: { provider: 'openai', apiKey: 'sk-test', mode: 'explain', language: 'en' }, messages: [{ role: 'user', content: 'Xc of 10 µF at 50 Hz?' }], fetchImpl });
  assert.equal(result.reply, 'Xc is about 318.3 Ω.');
  assert.equal(result.trace.length, 1); assert.match(result.trace[0].output, /Xc = 318\.3/);
  assert.equal(requests[0].url, 'https://api.openai.com/v1/chat/completions');
  assert.equal(requests[0].headers.Authorization, 'Bearer sk-test');
  assert.equal(requests[0].body.model, 'gpt-4o-mini');
  assert.equal(requests[0].body.tools.length, 4);
  assert.equal(requests[0].body.messages[0].role, 'system');
  // Second request carries the tool result back with the matching id.
  const toolMessage = requests[1].body.messages.find((m) => m.role === 'tool');
  assert.equal(toolMessage.tool_call_id, 'c1'); assert.match(toolMessage.content, /318\.3/);
});

test('provider settings, local Ollama without a key, errors and limits', async () => {
  const ollama = mockApi([{ role: 'assistant', content: 'Hello' }]);
  await chat({ settings: { provider: 'ollama' }, messages: [{ role: 'user', content: 'hi' }], fetchImpl: ollama.fetchImpl });
  assert.equal(ollama.requests[0].url, 'http://localhost:11434/v1/chat/completions');
  assert.equal(ollama.requests[0].headers.Authorization, undefined);
  await assert.rejects(chat({ settings: { provider: 'openai' }, messages: [], fetchImpl: async () => { throw new Error('x'); } }), /API key/);
  const failing = mockApi([{ status: 401, error: 'Incorrect API key' }]);
  await assert.rejects(chat({ settings: { provider: 'openai', apiKey: 'bad' }, messages: [], fetchImpl: failing.fetchImpl }), /401: Incorrect API key/);
  const looping = mockApi(Array.from({ length: 3 }, (_, k) => ({ role: 'assistant', content: null, tool_calls: [toolCall(`t${k}`, 'calculate', { code: '1+1' })] })));
  const stopped = await chat({ settings: { provider: 'ollama' }, messages: [], fetchImpl: looping.fetchImpl, maxSteps: 3 });
  assert.match(stopped.reply, /narrower/);
  assert.throws(() => validateBaseUrl('http://api.example.com/v1'), /https/);
  assert.throws(() => validateBaseUrl('https://user:pw@api.example.com'), /credentials/);
  assert.equal(validateBaseUrl('http://localhost:11434/v1/'), 'http://localhost:11434/v1');
  assert.ok(Object.keys(PROVIDERS).includes('gemini'));
});

test('system prompt carries the grounding rules, mode and language', () => {
  const prompt = systemPrompt({ mode: 'hint', language: 'mr', labName: 'Circuit Lab' });
  assert.match(prompt, /Never compute numbers in your head/);
  assert.match(prompt, /Do NOT give the final answer/);
  assert.match(prompt, /Marathi/); assert.match(prompt, /Circuit Lab/);
  assert.match(systemPrompt({ mode: 'viva' }), /viva examiner/);
});
