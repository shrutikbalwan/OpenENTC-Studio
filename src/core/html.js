// The browser UI builds markup from template strings. Every value that is not a literal must pass
// through one of these helpers before it reaches innerHTML: esc() for text and quoted attribute
// values, safeUrl() for href/src, and formatAssistantText() for model replies (escape first, then
// add a fixed set of tags). Keep this module free of DOM access so it can be tested in Node.

const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;', '`': '&#96;' };

/** Escape text for an HTML text node or a quoted attribute value. */
export const esc = (value) => String(value ?? '').replace(/[&<>'"`]/g, (char) => ENTITIES[char]);

/**
 * Return url only if it uses an allowed scheme; otherwise an empty string. Relative URLs are
 * allowed (they resolve against the app). Control characters and whitespace that browsers strip
 * (as in "java\nscript:") are removed before the scheme is checked.
 */
export function safeUrl(url, { schemes = ['https:', 'http:', 'blob:'] } = {}) {
  const text = String(url ?? '').trim();
  if (!text) return '';
  const compact = text.replace(/[\u0000- \u007f-\u009f]/g, '');
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(compact)?.[1];
  if (!scheme) return compact.startsWith('//') ? '' : text;
  return schemes.includes(`${scheme.toLowerCase()}:`) ? text : '';
}

/** Model replies: escape everything, then turn a little Markdown into <pre>, <code>, <b> and <br>. */
export function formatAssistantText(text) {
  const blocks = String(text ?? '').split(/```(?:\w+)?\n?/);
  return blocks.map((block, index) => (index % 2 ? `<pre class="ai-code">${esc(block.trim())}</pre>` : esc(block)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<b>$1</b>')
    .replace(/^#{1,4}\s*(.+)$/gm, '<b>$1</b>')
    .replace(/^\s*[-*]\s+(.+)$/gm, '• $1')
    .replace(/\n/g, '<br>'))).join('');
}
