// A small pop-up next to something tapped (used for the fasting marks).
let tip = null;

export function hideTip() {
  tip?.remove();
  tip = null;
}

/** Show `html` in a small bubble below (or above) `anchor`. */
export function showTip(anchor, html) {
  hideTip();
  tip = document.createElement('div');
  tip.className = 'tip';
  tip.setAttribute('role', 'tooltip');
  tip.innerHTML = html;
  document.body.append(tip);
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

/** Bubbles close on any other tap, on Escape, or when the page scrolls a lot. */
export function initTips() {
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') hideTip(); });
  window.addEventListener('resize', hideTip);
}
