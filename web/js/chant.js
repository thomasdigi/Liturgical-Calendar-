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
      score.layoutChantLines(ctxt, Math.max(200, target.clientWidth || source.parentElement.clientWidth), () => {
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

/** Redraw chants when the width changes (rotate the phone, resize the window). */
let resizeTimer = null;
let lastWidth = window.innerWidth;
window.addEventListener('resize', () => {
  if (Math.abs(window.innerWidth - lastWidth) < 40) return;
  lastWidth = window.innerWidth;
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => renderChant(document.getElementById('text')), 300);
});
