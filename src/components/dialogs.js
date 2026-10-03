// @ts-check
// Modal dialog: renders into the shell's .modal-layer, traps focus while open and restores it on close.

/**
 * @param {string} title trusted HTML from code (callers escape any user data)
 * @param {string} content trusted HTML from code (callers escape any user data)
 */
export function showModal(title, content) {
  const layer = /** @type {HTMLElement} */ (document.querySelector('.modal-layer'));
  const previousFocus = /** @type {HTMLElement | null} */ (document.activeElement);
  layer.hidden = false;
  layer.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close" aria-label="Close">×</button><span class="eyebrow">OPENENTC STUDIO</span><h2 id="modal-title">${title}</h2>${content}<button class="button primary wide modal-done">Got it</button></div>`;
  const modal = /** @type {HTMLElement} */ (layer.querySelector('.modal'));
  const focusable = () => /** @type {HTMLElement[]} */ ([...modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')]).filter((element) => !(/** @type {HTMLButtonElement} */ (element)).disabled && element.offsetParent !== null);
  const close = () => { layer.hidden = true; layer.innerHTML = ''; layer.removeEventListener('click', onBackdrop); layer.removeEventListener('keydown', onKeyDown); if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus(); };
  /** @param {MouseEvent} event */
  const onBackdrop = (event) => { if (event.target === layer) close(); };
  /** @param {KeyboardEvent} event */
  const onKeyDown = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key !== 'Tab') return;
    const elements = focusable(); if (!elements.length) return;
    const first = elements[0]; const last = /** @type {HTMLElement} */ (elements.at(-1));
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  layer.addEventListener('click', onBackdrop); layer.addEventListener('keydown', onKeyDown);
  const closeButton = /** @type {HTMLElement} */ (layer.querySelector('.modal-close'));
  closeButton.addEventListener('click', close); /** @type {HTMLElement} */ (layer.querySelector('.modal-done')).addEventListener('click', close);
  closeButton.focus();
}
