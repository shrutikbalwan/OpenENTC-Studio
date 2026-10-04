// AI lab partner panel: provider settings (API key kept in memory or sessionStorage only),
// chat with engine-backed tools, and redacted error reporting. See SECURITY.md.
import { buildSpiceNetlist } from '../../packages/schematic/src/spice.mjs';
import { chat as assistantChat, LANGUAGES, MODES, PROVIDERS, validateBaseUrl } from '../../packages/assistant/src/index.mjs';
import { lessonIndex, TRACKS } from '../../packages/learning/src/courseware.mjs';
import { modules } from '../data/modules.js';
import { esc, formatAssistantText } from '../shared/escaping.js';
import { forgetApiKey, loadAssistantSettings, redactSecrets, saveAssistantSettings as storeAssistantSettings } from '../core/credentials.js';
import { getState, notify } from '../core/store.js';
import { rerender } from '../services/render.js';
import { EXPERIMENT_MODULES } from '../shared/experiments.js';
import { reportError } from '../services/errors.js';

const assistant = { open: false, view: 'chat', draft: '', history: [], shown: [], busy: false, status: '', error: '', controller: null, focus: false };
export const assistantStartup = (() => { try { return loadAssistantSettings(localStorage, sessionStorage); } catch { return { removedLegacyKey: false }; } })();
function assistantSettings() {
  try { const { settings, apiKey } = loadAssistantSettings(localStorage, sessionStorage); return { ...settings, apiKey }; } catch { return { provider: 'openai', baseUrl: '', model: '', apiKey: '', mode: 'explain', language: 'en', shareLab: true, consented: false, rememberKey: false }; }
}
function saveAssistantSettings(patch) {
  try { const { settings, apiKey } = storeAssistantSettings(localStorage, sessionStorage, patch); return { ...settings, apiKey }; } catch { notify('Could not save assistant settings in this browser.', 'error'); return assistantSettings(); }
}
function assistantLabContext(state) {
  const active = modules.find((item) => item.id === state.activeModule) ?? modules[0];
  const context = { lab: active.name, labPurpose: active.description, savedInputs: state.project.experiments.filter((e) => EXPERIMENT_MODULES[e?.id] === active.id).map((e) => ({ experiment: e.id, inputs: e.inputs })) };
  if (['circuit', 'bench', 'record'].includes(active.id) && state.project.circuit.components.length) {
    try { context.circuitSpiceNetlist = buildSpiceNetlist(state.project.circuit.components, state.project.circuit.wires, { title: 'OpenENTC circuit', netLabels: state.project.circuit.netLabels }); } catch (error) { context.circuitProblem = error.message; }
  }
  if (state.simulation?.kind) {
    const text = JSON.stringify(state.simulation, (key, value) => (Array.isArray(value) && value.length > 40 ? `[${value.length} values]` : value));
    context.lastSimulation = text.length > 3000 ? `${text.slice(0, 3000)}…` : text;
  }
  return context;
}
/** Minimal, escape-first formatting: code blocks, inline code, bold, bullets and line breaks. */
export function renderAssistant(state) {
  const settings = assistantSettings();
  if (!assistant.open) return `<button class="ai-fab" data-ai-open title="Ask the AI lab partner">✦ Ask AI</button>`;
  const provider = PROVIDERS[settings.provider] ?? PROVIDERS.custom;
  const active = modules.find((item) => item.id === state.activeModule) ?? modules[0];
  const ready = settings.consented && (!provider.needsKey || settings.apiKey);
  const settingsView = `<div class="ai-settings">
      <label>Provider<select data-ai-setting="provider">${Object.entries(PROVIDERS).map(([id, p]) => `<option value="${id}" ${id === settings.provider ? 'selected' : ''}>${esc(p.label)}</option>`).join('')}</select></label>
      <label>API base URL<input type="text" spellcheck="false" data-ai-setting="baseUrl" value="${esc(settings.baseUrl)}" placeholder="${esc(provider.baseUrl || 'https://your-server/v1')}"></label>
      <label>Model<input type="text" spellcheck="false" data-ai-setting="model" value="${esc(settings.model)}" placeholder="${esc(provider.model || 'model name')}"></label>
      <label>API key${provider.needsKey ? '' : ' (optional)'}<input type="password" autocomplete="off" data-ai-setting="apiKey" value="${esc(settings.apiKey)}" placeholder="${provider.needsKey ? 'sk-…' : 'not needed'}"></label>
      <label>How should it help?<select data-ai-setting="mode">${Object.entries(MODES).map(([id, label]) => `<option value="${id}" ${id === settings.mode ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
      <label>Reply language<select data-ai-setting="language">${Object.entries(LANGUAGES).map(([id, label]) => `<option value="${id}" ${id === settings.language ? 'selected' : ''}>${esc(label)}</option>`).join('')}</select></label>
      <label class="ai-check"><input type="checkbox" data-ai-setting="shareLab" ${settings.shareLab ? 'checked' : ''}> Let the AI read my current lab's inputs and results</label>
      <label class="ai-check"><input type="checkbox" data-ai-setting="consented" ${settings.consented ? 'checked' : ''}> I understand my questions${settings.shareLab ? ' and lab inputs' : ''} are sent to ${esc(provider.label)}</label>
      <label class="ai-check"><input type="checkbox" data-ai-setting="rememberKey" ${settings.rememberKey ? 'checked' : ''}> Keep the key until this tab closes (sessionStorage); otherwise it is forgotten on reload</label>${settings.apiKey ? '<button class="button subtle" data-ai-forget>Forget the key now</button>' : ''}
      ${assistantStartup.removedLegacyKey ? '<p class="field-help ai-notice">An API key saved by an older version of OpenENTC was deleted from this browser\'s storage. Enter it again; it is no longer saved permanently.</p>' : ''}
      <p class="field-help">The API key is never saved permanently and never goes into your project file or exports; it is sent only to the provider above. Free option: install Ollama, run <code>OLLAMA_ORIGINS=* ollama serve</code> and pull a model such as llama3.1. Every number the AI states is meant to come from OpenENTC's own tested engines — open "Checked with" under a reply to see the calculations.</p>
      <button class="button primary" data-ai-view="chat">Done</button></div>`;
  const messages = assistant.shown.map((m) => `<div class="ai-msg ${m.role}">${m.role === 'user' ? esc(m.text).replace(/\n/g, '<br>') : formatAssistantText(m.text)}${m.trace?.length ? `<details class="ai-trace"><summary>Checked with ${m.trace.length} tool call${m.trace.length > 1 ? 's' : ''}</summary>${m.trace.map((t) => `<div><b>${esc(t.tool)}</b><pre>${esc(t.args.code ?? t.args.netlist ?? t.args.query ?? JSON.stringify(t.args))}</pre><pre class="out">${esc(t.output)}</pre></div>`).join('')}</details>` : ''}</div>`).join('');
  const suggestions = [`Explain what this ${active.name} page does`, 'Why is my result like this?', settings.mode === 'viva' ? 'Start my viva' : 'Quiz me on this topic'];
  const chatView = `<div class="ai-messages" data-ai-messages>${messages || `<div class="ai-empty"><b>Hi! I am your lab partner.</b><p>Ask about ${esc(active.name)} or any ENTC topic. I calculate with OpenENTC's simulators before I answer.</p></div>`}${assistant.busy ? `<div class="ai-msg assistant busy">${esc(assistant.status || 'Thinking…')}</div>` : ''}${assistant.error ? `<div class="ai-msg error">${esc(assistant.error)}</div>` : ''}</div>
    ${ready ? '' : `<div class="ai-setup">${settings.consented ? `Add your ${esc(provider.label)} API key` : 'Set up a provider'} to start. <button class="button subtle" data-ai-view="settings">Open settings</button></div>`}
    <div class="ai-suggestions">${suggestions.map((s) => `<button data-ai-suggest="${esc(s)}" ${assistant.busy || !ready ? 'disabled' : ''}>${esc(s)}</button>`).join('')}</div>
    <div class="ai-input"><textarea rows="2" aria-label="Message to the AI lab partner" placeholder="Ask anything… (Enter to send, Shift+Enter for a new line)" data-ai-draft ${assistant.busy || !ready ? 'disabled' : ''}>${esc(assistant.draft)}</textarea>${assistant.busy ? '<button class="button" data-ai-stop>Stop</button>' : `<button class="button primary" data-ai-send ${ready ? '' : 'disabled'}>Send</button>`}</div>`;
  return `<aside class="ai-panel" aria-label="AI lab partner"><header><b>✦ AI lab partner</b><span>${esc(provider.label)} · ${esc(MODES[settings.mode] ?? '')}</span><div><button class="icon-button" data-ai-view="${assistant.view === 'settings' ? 'chat' : 'settings'}" title="Settings">⚙</button><button class="icon-button" data-ai-clear title="New conversation">⟲</button><button class="icon-button" data-ai-close title="Close">✕</button></div></header>${assistant.view === 'settings' ? settingsView : chatView}</aside>`;
}
async function sendToAssistant(text) {
  const question = String(text).trim();
  if (!question || assistant.busy) return;
  const settings = assistantSettings(), state = getState();
  const active = modules.find((item) => item.id === state.activeModule) ?? modules[0];
  assistant.draft = ''; assistant.error = ''; assistant.busy = true; assistant.status = 'Thinking…';
  assistant.shown.push({ role: 'user', text: question });
  assistant.history.push({ role: 'user', content: question });
  assistant.controller = new AbortController();
  rerender();
  const vivaBank = TRACKS.flatMap((track) => track.viva);
  try {
    const result = await assistantChat({ settings, messages: assistant.history, signal: assistant.controller.signal, context: { labName: active.name, lab: () => (settings.shareLab ? assistantLabContext(getState()) : { note: 'The student chose not to share lab inputs.' }), lessons: lessonIndex(), viva: vivaBank } });
    // Keep the history compact: user/assistant text turns only (tool steps are re-derived each time).
    assistant.history.push({ role: 'assistant', content: result.reply });
    if (assistant.history.length > 24) assistant.history = assistant.history.slice(-24);
    assistant.shown.push({ role: 'assistant', text: result.reply, trace: result.trace });
  } catch (error) {
    assistant.history.pop();
    assistant.error = assistant.controller?.signal.aborted ? 'Stopped.' : redactSecrets(error.message, [settings.apiKey]);
  } finally {
    assistant.busy = false; assistant.status = ''; assistant.controller = null; assistant.focus = true;
    rerender();
  }
}
export function bindAssistantEvents() {
  document.querySelector('[data-ai-open]')?.addEventListener('click', () => { assistant.open = true; assistant.focus = true; if (!assistantSettings().consented) assistant.view = 'settings'; rerender(); });
  document.querySelector('[data-ai-close]')?.addEventListener('click', () => { assistant.open = false; rerender(); });
  document.querySelector('[data-ai-clear]')?.addEventListener('click', () => { assistant.history = []; assistant.shown = []; assistant.error = ''; rerender(); });
  document.querySelectorAll('[data-ai-view]').forEach((b) => b.addEventListener('click', () => { assistant.view = b.dataset.aiView; rerender(); }));
  document.querySelector('[data-ai-forget]')?.addEventListener('click', () => { forgetApiKey(sessionStorage); notify('API key forgotten.', 'success'); rerender(); });
  document.querySelectorAll('[data-ai-setting]').forEach((input) => input.addEventListener('change', () => {
    const key = input.dataset.aiSetting;
    const value = input.type === 'checkbox' ? input.checked : input.value.trim();
    if (key === 'baseUrl' && value) { try { validateBaseUrl(value); } catch (error) { reportError(error); return; } }
    saveAssistantSettings(key === 'provider' ? { provider: value, baseUrl: '', model: '' } : { [key]: value });
    rerender();
  }));
  const draft = document.querySelector('[data-ai-draft]');
  draft?.addEventListener('input', () => { assistant.draft = draft.value; });
  draft?.addEventListener('keydown', (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); sendToAssistant(draft.value); } });
  document.querySelector('[data-ai-send]')?.addEventListener('click', () => sendToAssistant(draft?.value ?? assistant.draft));
  document.querySelector('[data-ai-stop]')?.addEventListener('click', () => assistant.controller?.abort());
  document.querySelectorAll('[data-ai-suggest]').forEach((b) => b.addEventListener('click', () => sendToAssistant(b.dataset.aiSuggest)));
  const list = document.querySelector('[data-ai-messages]');
  if (list) list.scrollTop = list.scrollHeight;
  if (assistant.focus && assistant.view === 'chat' && !assistant.busy && draft) { assistant.focus = false; draft.focus({ preventScroll: true }); }
}

// ---------------------------------------------------------------------------
// Microcontroller Lab: Arduino Uno (ATmega328P) simulator running compiled HEX files.

// ---------------------------------------------------------------------------
// Logic analyser panel (shared by the 8051 and Arduino simulators).
