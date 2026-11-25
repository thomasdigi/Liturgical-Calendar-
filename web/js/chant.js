// Gregorian chant: draws the GABC chant notation in a part as musical notation (SVG), using
// exsurge (MIT License; shipped with Divinum Officium), loaded only when chant is shown.

let loading = null;
function loadExsurge() {
  if (window.exsurge) return Promise.resolve(window.exsurge);
  loading ??= new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'vendor/exsurge.js';
    s.onload = () => (window.exsurge ? resolve(window.exsurge) : reject(new Error('exsurge did not load')));
    s.onerror = () => reject(new Error('Could not load the chant notation (vendor/exsurge.js)'));
    document.head.append(s);
  });
  return loading;
}

/** Header lines of a GABC source ("name:…;", "initial-style:0;"), before "%%". */
function header(src) {
  const out = {};
  const head = src.includes('%%') ? src.split('%%')[0] : '';
  for (const line of head.split('\n')) {
    const m = /^\s*([\w-]+)\s*:\s*(.*?);?\s*$/.exec(line);
    if (m) out[m[1]] = m[2];
  }
  return out;
}

function draw(ex, source, target) {
  const src = source.textContent;
  const h = header(src);
  const ctxt = new ex.ChantContext();
  // Single quotes only: the font goes into SVG attributes.
  ctxt.lyricTextFont = (getComputedStyle(document.body).fontFamily || 'Georgia, serif').replace(/"/g, "'");
  ctxt.lyricTextSize *= 1.15;
  ctxt.dropCapTextFont = ctxt.lyricTextFont;
  ctxt.annotationTextFont = ctxt.lyricTextFont;
  ctxt.spaceBetweenSystems = 0;
  const dropCap = h['initial-style'] !== '0';
  const mapping = ex.Gabc.createMappingsFromSource(ctxt, src);
  const score = new ex.ChantScore(ctxt, mapping, dropCap);
  if (dropCap && h.annotation) score.annotation = new ex.Annotation(ctxt, h.annotation);
  return new Promise((resolve) => {
    score.performLayoutAsync(ctxt, () => {
      // The column's width (the target may be empty or still narrow from an earlier layout).
      const width = source.parentElement.clientWidth || target.clientWidth;
      lastWidth = width;
      score.layoutChantLines(ctxt, Math.max(200, width), () => {
        target.innerHTML = score.createSvg(ctxt);
        resolve();
      });
    });
  });
}

/** Draw every chant inside `root`. Returns false if the notation couldn't be loaded. */
export async function renderChant(root) {
  const sources = [...root.querySelectorAll('.GABC')];
  if (!sources.length) return true;
  let ex;
  try {
    ex = await loadExsurge();
  } catch {
    return false;
  }
  for (const source of sources) {
    let target = source.nextElementSibling;
    if (!target?.classList.contains('GCHANT')) {
      target = document.createElement('div');
      target.className = 'GCHANT';
      source.after(target);
    }
    try {
      await draw(ex, source, target);
      source.hidden = true; // the notation replaces the GABC text
    } catch {
      source.hidden = false; // couldn't draw this one: leave the text
    }
  }
  return true;
}

/**
 * Redraw the chant whenever the room for it changes: turning the phone, resizing the window,
 * or a change of layout. (It is drawn to fit the width it has when drawn.)
 */
let resizeTimer = null;
let lastWidth = 0;
function watchWidth() {
  const text = document.getElementById('text');
  if (!text || !window.ResizeObserver) return;
  new ResizeObserver(() => {
    const col = text.querySelector('.GCHANT')?.parentElement;
    const w = col ? col.clientWidth : 0;
    if (!w || Math.abs(w - lastWidth) < 20) return;
    lastWidth = w;
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => renderChant(text), 200);
  }).observe(text);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', watchWidth);
else watchWidth();
