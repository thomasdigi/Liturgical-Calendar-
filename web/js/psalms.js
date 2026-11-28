// Psalm numbering: the Vulgate's (the traditional books, Divinum Officium) or the Hebrew one used
// by most modern Bibles (Settings → Typography). Mostly the Hebrew number is one higher (Vulgate 50
// is Hebrew 51), but some psalms are divided differently:
//   Vulgate 9 = Hebrew 9 (verses 1–21) + 10 (22–39);  Vulgate 113 = Hebrew 114 (1–8) + 115 (9–26);
//   Vulgate 114 + 115 = Hebrew 116 (115 from verse 10);  Vulgate 146 + 147 = Hebrew 147 (147 from verse 12).
// The texts keep the Vulgate's numbers; with the Hebrew setting they are shown converted:
// psalm headings ("Psalmus 109" → 110), citations ("Ps 84:2" → "Ps 85:2") and verse numbers.
import { store } from './util.js';

let hebrew = store.get('psalmNumbering', 'vulgate') === 'hebrew';
export const hebrewNumbering = () => hebrew;

/** A Vulgate psalm (and verse) in Hebrew numbering. */
export function toHebrew(ps, verse) {
  const v = verse;
  if (ps <= 8 || ps >= 148) return { ps, verse: v };
  if (ps === 9) return v != null && v >= 22 ? { ps: 10, verse: v - 21 } : { ps: v == null ? '9–10' : 9, verse: v };
  if (ps <= 112) return { ps: ps + 1, verse: v };
  if (ps === 113) return v != null && v >= 9 ? { ps: 115, verse: v - 8 } : { ps: v == null ? '114–115' : 114, verse: v };
  if (ps === 114) return { ps: 116, verse: v };
  if (ps === 115) return { ps: 116, verse: v == null ? v : v + 9 };
  if (ps <= 145) return { ps: ps + 1, verse: v };
  if (ps === 146) return { ps: 147, verse: v };
  return { ps: 147, verse: v == null ? v : v + 11 }; // 147
}

/** A Hebrew psalm number as the Vulgate number(s) it may be (for finding a psalm by number). */
export function fromHebrew(h) {
  if (h <= 8 || h >= 148) return [h];
  if (h === 9 || h === 10) return [9];
  if (h <= 113) return [h - 1];
  if (h === 114 || h === 115) return [113];
  if (h === 116) return [114, 115];
  if (h <= 146) return [h - 1];
  return [146, 147];
}

// "Psalmus 109", "Psalm 50", "Ps 84:2", "Psaume 22", "Salmo 109:1-3", "Žalm 4"…
const WORD = '(?:Psalmus|Psalmi|Psalm|Psaume|Salmo|Salmos|Psalmo|Žalm|Zsoltár|Ps\\.?)';
const REF = new RegExp(`(\\b${WORD}\\s+)(\\d{1,3})(?::(\\d{1,3})([a-z]?)(?:\\s*[-–]\\s*(\\d{1,3}))?)?`, 'g');
const VERSE = /^(\s*)(\d{1,3}):(\d{1,3})([a-z]?)(\s*)$/; // a verse number on its own ("109:1")

function convertRef(_, word, ps, v1, letter, v2) {
  const p = +ps;
  if (p < 1 || p > 150) return _;
  if (v1 == null) return `${word}${toHebrew(p).ps}`;
  const a = toHebrew(p, +v1);
  const b = v2 != null ? toHebrew(p, +v2) : null;
  return `${word}${a.ps}:${a.verse}${letter ?? ''}${b ? `-${b.verse}` : ''}`;
}

const done = new WeakSet(); // text already converted (converting twice would add 1 again)

/** Show the psalm numbers under `root` in Hebrew numbering (when chosen). */
export function convertPsalms(root) {
  if (!hebrew || !root) return;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (done.has(n) || n.parentElement?.closest('.GABC, .GCHANT, script, style, input, textarea') ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  const nodes = [];
  while (walker.nextNode()) nodes.push(walker.currentNode);
  for (const n of nodes) {
    let s = n.data;
    if (n.parentElement?.classList.contains('verse')) {
      const m = VERSE.exec(s);
      if (m) { const h = toHebrew(+m[2], +m[3]); s = `${m[1]}${h.ps}:${h.verse}${m[4]}${m[5]}`; }
    } else if (/\d/.test(s)) {
      s = s.replace(REF, convertRef);
    }
    done.add(n);
    if (s !== n.data) n.data = s;
  }
}

/** Where psalm numbers appear: the texts, search results, booklets, feast pages. */
const AREAS = '#text, #results, #booklet-print, #feast-body';

export function initPsalms(rerender) {
  const sel = document.getElementById('psalm-numbering');
  sel.value = hebrew ? 'hebrew' : 'vulgate';
  sel.onchange = () => {
    hebrew = sel.value === 'hebrew';
    store.set('psalmNumbering', sel.value);
    rerender(); // drawn again from the original (Vulgate) numbers
  };
  new MutationObserver((records) => {
    if (!hebrew) return;
    for (const r of records) {
      const el = r.type === 'characterData' ? r.target.parentElement : r.target;
      const area = el?.closest?.(AREAS);
      if (area) for (const n of r.type === 'characterData' ? [r.target.parentElement] : [...r.addedNodes].map((x) => (x.nodeType === 1 ? x : x.parentElement))) convertPsalms(n);
    }
  }).observe(document.body, { childList: true, subtree: true, characterData: true });
}
