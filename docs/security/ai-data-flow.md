# AI assistant data flow

The AI lab partner is **optional and off by default**. Nothing is sent anywhere until the user
chooses a provider and ticks the consent box.

## What leaves the computer

| Data | Sent? | When |
|---|---|---|
| The user's questions and the conversation so far | Yes | Every request, after consent |
| A system prompt (mode, language, current lab name) | Yes | Every request |
| Current lab inputs, saved experiment inputs, the circuit as a SPICE netlist (titled "OpenENTC circuit", not the project name), and the last simulation result (truncated to 3000 characters) | Only if **"Let the AI read my current lab's inputs and results"** is ticked | When the model calls the `current_lab` tool |
| Tool results from local calculators (`calculate`, `solve_circuit`, `find_lesson`) | Yes | When the model calls the tool |
| API key | Yes, as the `Authorization` header, to the configured host only | Every request |
| Project name, notes, other labs, files, device data, other settings | No | — |
| Cookies, referrer | No | Requests use `credentials: 'omit'`, no referrer and `redirect: 'error'` |

## Where it goes

Only to the base URL the user configures (OpenAI-compatible API). It must be `https://`, or
`http://localhost` / `http://127.0.0.1` for a local model server. The Content Security Policy's
`connect-src` list must allow the host.

## What comes back, and how it is treated

Model replies are **untrusted**:

- Replies are escaped before display; the limited formatting (bold, code) is applied after escaping.
- Tool calls are limited to the built-in, side-effect-free tools above. The model cannot run code, open files, start processes, change the project or reach devices.
- There are at most 8 tool calls per step and 6 steps per question. Oversized tool arguments are refused, and a 60-second timeout applies.
- Replies larger than the response size limit are refused.
- A malformed reply shows "The AI service returned no message.", not raw data.

## Storage

- Settings (provider, model, mode, language, consent, sharing choice) are kept in `localStorage`.
- The API key is kept in memory, or in `sessionStorage` if the user opts in. See `SECURITY.md`.
- The conversation lives in memory only and is lost on reload.

## Diagnostics

A diagnostic report records only the provider name, whether a key is set (true/false) and the consent flag. It never contains the key, the base URL or the conversation.
