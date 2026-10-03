// Modal dialog: renders into the shell's .modal-layer, traps focus while open and restores it on close.

export function showModal(title, content) {
  const layer = document.querySelector('.modal-layer');
  const previousFocus = document.activeElement;
  layer.hidden = false;
  layer.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-labelledby="modal-title"><button class="modal-close" aria-label="Close">×</button><span class="eyebrow">OPENENTC STUDIO</span><h2 id="modal-title">${title}</h2>${content}<button class="button primary wide modal-done">Got it</button></div>`;
  const modal = layer.querySelector('.modal');
  const focusable = () => [...modal.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter((element) => !element.disabled && element.offsetParent !== null);
  const close = () => { layer.hidden = true; layer.innerHTML = ''; layer.removeEventListener('click', onBackdrop); layer.removeEventListener('keydown', onKeyDown); if (previousFocus && typeof previousFocus.focus === 'function') previousFocus.focus(); };
  const onBackdrop = (event) => { if (event.target === layer) close(); };
  const onKeyDown = (event) => {
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key !== 'Tab') return;
    const elements = focusable(); if (!elements.length) return;
    const first = elements[0]; const last = elements.at(-1);
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  layer.addEventListener('click', onBackdrop); layer.addEventListener('keydown', onKeyDown);
  layer.querySelector('.modal-close').addEventListener('click', close); layer.querySelector('.modal-done').addEventListener('click', close);
  layer.querySelector('.modal-close').focus();
}
