// Typography (Settings → Typography): the typeface, and two ways to simplify the Latin
// (no accents: "Dóminus" → "Dominus"; no ligatures: "æternum" → "aeternum"; u as v: "Dominus" →
// "Dominvs"; j as i: "Jesus" → "Iesus").
// The Latin changes apply to Latin text only (the Latin column, headings and feast titles),
// never to the other languages, and not to chant notation.
import { store } from './util.js';

export const FONTS = ['classic', 'alegreya', 'sans', 'gothic'];
export const INITIALS = ['off', 'normal', 'fancy'];

const opts = {
  font: ((f) => (f === 'garamond' ? 'alegreya' : f))(store.get('font', 'classic')), // Garamond became Alegreya
  initials: store.get('initials', 'normal'), // drop caps: off, as now, or medieval
  accents: store.get('latinAccents', 'on') === 'on',
  ligatures: store.get('latinLigatures', 'on') === 'on',
  uAsV: store.get('latinUV', 'off') === 'on', // every u written v (U → V)
  jAsI: store.get('latinJI', 'off') === 'on', // every j written i (J → I)
};

/** Where Latin appears: the Latin column and Latin headings, and the feast titles from DO. */
const LATIN = '[lang="la"], .la, #title, #comm, .mt, .wt, .cmp-title, .cmp-comm, #sacristan-title, .rlatin';
const SKIP = '.GABC, .GCHANT, svg, script, style';

/** "Dóminus" → "Dominus" (acute accents only; "Israël" keeps its diaeresis). */
const noAccents = (s) => s.normalize('NFD').replace(/́/g, '').normalize('NFC');
/** "æternum" → "aeternum", "ÆTERNE" → "AETERNE", "Cœli" → "Coeli". */
const noLigatures = (s) => s
  .replace(/[ÆŒ](?=\p{Lu})/gu, (c) => (c === 'Æ' ? 'AE' : 'OE'))
  .replace(/Æ/g, 'Ae').replace(/Œ/g, 'Oe').replace(/æ/g, 'ae').replace(/œ/g, 'oe');

export function latinText(s) {
  let t = s;
  if (!opts.accents) t = noAccents(t);
  if (!opts.ligatures) t = noLigatures(t);
  if (opts.uAsV) t = t.normalize('NFD').replace(/u/g, 'v').replace(/U/g, 'V').normalize('NFC'); // ú → v́
  if (opts.jAsI) t = t.replace(/j/g, 'i').replace(/J/g, 'I');
  return t;
}

const active = () => !opts.accents || !opts.ligatures || opts.uAsV || opts.jAsI;

/** Apply the Latin options to the text nodes under `root`. */
export function simplifyLatin(root) {
  if (!active() || !root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      const el = n.parentElement;
      if (!el || el.closest(SKIP)) return NodeFilter.FILTER_REJECT;
      // Latin if the nearest marker is a Latin one (a translation inside a Latin title stays as it is).
      const la = el.closest(LATIN);
      const vn = el.closest('.vn');
      return la && (!vn || vn.contains(la)) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
    },
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    const t = latinText(n.data);
    if (t !== n.data) n.data = t;
  }
}

function applyFont() {
  const root = document.documentElement.dataset;
  if (opts.font === 'classic') delete root.font;
  else root.font = opts.font;
  if (opts.initials === 'normal') delete root.initials;
  else root.initials = opts.initials;
}

function sync() {
  document.getElementById('font-select').value = opts.font;
  document.querySelectorAll('#initials button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.initials === opts.initials)));
  document.getElementById('latin-accents').checked = !opts.accents;
  document.getElementById('latin-ligatures').checked = !opts.ligatures;
  document.getElementById('latin-uv').checked = opts.uAsV;
  document.getElementById('latin-ji').checked = opts.jAsI;
}

/** `rerender` redraws the page from the original texts (needed to turn an option back off). */
export function initTypography(rerender) {
  applyFont();
  // Whatever is drawn later (a new day, the month list, the week strip) gets the same treatment.
  new MutationObserver((records) => {
    if (!active()) return;
    for (const r of records) {
      if (r.type === 'characterData') simplifyLatin(r.target.parentElement);
      else for (const n of r.addedNodes) simplifyLatin(n.nodeType === 1 ? n : n.parentElement);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
  document.getElementById('font-select').onchange = (e) => {
    opts.font = e.target.value;
    store.set('font', opts.font);
    applyFont();
    sync();
  };
  document.querySelectorAll('#initials button').forEach((b) => (b.onclick = () => {
    opts.initials = b.dataset.initials;
    store.set('initials', opts.initials);
    applyFont();
    sync();
  }));
  document.getElementById('latin-accents').onchange = (e) => {
    opts.accents = !e.target.checked;
    store.set('latinAccents', opts.accents ? 'on' : 'off');
    rerender();
  };
  document.getElementById('latin-uv').onchange = (e) => {
    opts.uAsV = e.target.checked;
    store.set('latinUV', opts.uAsV ? 'on' : 'off');
    rerender();
  };
  document.getElementById('latin-ji').onchange = (e) => {
    opts.jAsI = e.target.checked;
    store.set('latinJI', opts.jAsI ? 'on' : 'off');
    rerender();
  };
  document.getElementById('latin-ligatures').onchange = (e) => {
    opts.ligatures = !e.target.checked;
    store.set('latinLigatures', opts.ligatures ? 'on' : 'off');
    rerender();
  };
  sync();
}
