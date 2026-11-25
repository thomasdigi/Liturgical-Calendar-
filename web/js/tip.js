// A small pop-up next to something tapped (used for the fasting marks).
let tip = null;
let tipAnchor = null;

export function hideTip() {
  tip?.remove();
  tip = null;
  tipAnchor = null;
}

/** Tap a mark: open its bubble, or close it if it's already open. */
export function toggleTip(anchor, html) {
  if (tip && tipAnchor === anchor) hideTip();
  else showTip(anchor, html);
}

/** Show `html` in a small bubble below (or above) `anchor`. */
export function showTip(anchor, html) {
  hideTip();
  tip = document.createElement('div');
  tip.className = 'tip';
  tip.setAttribute('role', 'tooltip');
  tip.innerHTML = html;
  tip.title = 'Tap to close';
  document.body.append(tip);
  tipAnchor = anchor;
  const r = anchor.getBoundingClientRect();
  const w = tip.offsetWidth;
  const h = tip.offsetHeight;
  const margin = 8;
  let left = r.left + r.width / 2 - w / 2;
  left = Math.max(margin, Math.min(left, document.documentElement.clientWidth - w - margin));
  const below = r.bottom + 8 + h < window.innerHeight;
  const top = below ? r.bottom + 8 : r.top - h - 8;
  tip.style.left = `${left + window.scrollX}px`;
  tip.style.top = `${top + window.scrollY}px`;
}

/** Bubbles close on any tap (the bubble itself, its mark again, or elsewhere), on Escape, or on resize. */
export function initTips() {
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(); });
  window.addEventListener('resize', hideTip);
}

/**
 * Hold a button for a second: a small note says what it does (its description, translated).
 * The press that opened the note doesn't also press the button; the next tap anywhere closes it.
 * `describe(button)` gives the text, or '' for none. Not announced anywhere: found by holding.
 */
export function initLongPress(describe) {
  const AREAS = '.appbar, .top, #view, .massmode, .officebar, .hours, .toolbar, .outline, .comparebar, .wheel-wrap, .month-head, .month-today';
  let timer = null;
  let start = null;
  let swallow = false; // the click that ends a long press
  const cancel = () => { clearTimeout(timer); timer = null; start = null; };
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest?.('button');
    if (!b || !b.closest(AREAS)) return;
    const text = describe(b);
    if (!text) return;
    start = { x: e.clientX, y: e.clientY };
    clearTimeout(timer);
    timer = setTimeout(() => {
      timer = null;
      showTip(b, `<p>${text.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]))}</p>`);
      tip?.classList.add('tip-small-note');
      swallow = true;
    }, 1000);
  }, { passive: true });
  document.addEventListener('pointermove', (e) => {
    if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 10) cancel();
  }, { passive: true });
  for (const ev of ['pointerup', 'pointercancel']) document.addEventListener(ev, () => { clearTimeout(timer); timer = null; }, { passive: true });
  window.addEventListener('scroll', cancel, { passive: true });
  // On the window, so it runs before the page's other click handlers (which close notes).
  window.addEventListener('click', (e) => {
    if (!swallow) return;
    swallow = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);
  // Holding a button on a phone shouldn't open the system menu or select text.
  document.addEventListener('contextmenu', (e) => { if (e.target.closest?.('button')?.closest(AREAS)) e.preventDefault(); });
}
