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
