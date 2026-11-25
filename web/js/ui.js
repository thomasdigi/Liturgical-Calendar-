// The language of the app itself (buttons, menus, notes, dates): English, German, French,
// Spanish or Latin, chosen with the flags in Settings. It never changes the texts of the Mass
// and Office (their language is the "Language" menu) nor any Latin.
//
//  - t('English text', { name: value }) gives the text in the app's language ({name} filled in);
//    the dictionaries are in web/js/ui/*.js, keyed by the English. Anything missing stays English.
//  - The page's own text (index.html) is translated by recording each piece of English once at
//    start-up (see recordPage), so switching back to English restores it.
//  - fmtDate() writes dates in the app's language (Latin by hand: browsers don't know it).
import { store } from './util.js';
import DE from './ui/de.js';
import FR from './ui/fr.js';
import ES from './ui/es.js';
import LA from './ui/la.js';

const DICTS = { de: DE, fr: FR, es: ES, la: LA };

/** Small flags (SVG), drawn simply so they stay clear at icon size. */
const FLAGS = {
  us: `<svg viewBox="0 0 38 20" aria-hidden="true"><rect width="38" height="20" fill="#fff"/>${
    Array.from({ length: 7 }, (_, i) => `<rect y="${(i * 20) / 6.5}" width="38" height="${20 / 13}" fill="#b22234"/>`).join('')
  }<rect width="16" height="${(20 * 7) / 13}" fill="#3c3b6e"/>${
    Array.from({ length: 20 }, (_, i) => `<circle cx="${1.6 + (i % 5) * 3.2}" cy="${1.4 + Math.floor(i / 5) * 2.6}" r=".55" fill="#fff"/>`).join('')
  }</svg>`,
  de: '<svg viewBox="0 0 5 3" aria-hidden="true"><rect width="5" height="1" fill="#000"/><rect y="1" width="5" height="1" fill="#dd0000"/><rect y="2" width="5" height="1" fill="#ffce00"/></svg>',
  qc: (() => {
    const fleur = (x, y) => `<g transform="translate(${x} ${y})" fill="#fff"><path d="M0-3.2C.9-2.2 1-1.1.45-.1L.45 1.2-.45 1.2-.45-.1C-1-1.1-.9-2.2 0-3.2Z"/><path d="M.5 0C1.2-1.4 2.6-1.2 2.6-.2 2.6.6 1.8.9 1.2.6 1.7.2 1.4-.4.9-.1Z"/><path d="M-.5 0C-1.2-1.4-2.6-1.2-2.6-.2-2.6.6-1.8.9-1.2.6-1.7.2-1.4-.4-.9-.1Z"/><rect x="-1.5" y=".9" width="3" height=".5"/><path d="M-.3 1.4h.6L0 2.6Z"/></g>`;
    return `<svg viewBox="0 0 30 20" aria-hidden="true"><rect width="30" height="20" fill="#003da5"/><rect x="13" width="4" height="20" fill="#fff"/><rect y="8" width="30" height="4" fill="#fff"/>${fleur(6.5, 4)}${fleur(23.5, 4)}${fleur(6.5, 15.2)}${fleur(23.5, 15.2)}</svg>`;
  })(),
  es: '<svg viewBox="0 0 6 4" aria-hidden="true"><rect width="6" height="4" fill="#aa151b"/><rect y="1" width="6" height="2" fill="#f1bf00"/></svg>',
  va: '<svg viewBox="0 0 20 20" aria-hidden="true"><rect width="10" height="20" fill="#ffe000"/><rect x="10" width="10" height="20" fill="#fff"/><g stroke-width="1.1" stroke-linecap="round" fill="none"><path d="M11.6 6.2 18 14.4" stroke="#c9a227"/><path d="M18 6.2 11.6 14.4" stroke="#a7a9ac"/><circle cx="11.4" cy="5.8" r="1" stroke="#a7a9ac"/><circle cx="18.2" cy="5.8" r="1" stroke="#c9a227"/></g><path d="M12.6 3.4h4.4l-.5 1.6h-3.4z" fill="#c9a227"/></svg>',
};

export const UI_LANGS = [
  { id: 'en', label: 'English', flag: 'us', locale: 'en-US', flagName: 'United States' },
  { id: 'de', label: 'Deutsch', flag: 'de', locale: 'de-DE', flagName: 'Deutschland' },
  { id: 'fr', label: 'Français', flag: 'qc', locale: 'fr-CA', flagName: 'Québec' },
  { id: 'es', label: 'Español', flag: 'es', locale: 'es-ES', flagName: 'España' },
  { id: 'la', label: 'Latina', flag: 'va', locale: 'la', flagName: 'Civitas Vaticana' },
];
export const flagSvg = (id) => FLAGS[UI_LANGS.find((l) => l.id === id)?.flag ?? 'us'];

let current = store.get('uiLang', 'en');
if (!UI_LANGS.some((l) => l.id === current)) current = 'en';
export const uiLang = () => current;
const info = () => UI_LANGS.find((l) => l.id === current);

/** The app's text in its language. `vars` fill in {name} places. */
export function t(key, vars) {
  let s = DICTS[current]?.[key] ?? key;
  if (vars) s = s.replace(/\{(\w+)\}/g, (m, k) => (k in vars ? String(vars[k]) : m));
  return s;
}

// ---------- dates ----------
const LATIN = {
  weekdays: ['Dominica', 'Feria secunda', 'Feria tertia', 'Feria quarta', 'Feria quinta', 'Feria sexta', 'Sabbatum'],
  weekdaysShort: ['Dom.', 'Fer. II', 'Fer. III', 'Fer. IV', 'Fer. V', 'Fer. VI', 'Sab.'],
  months: ['Ianuarius', 'Februarius', 'Martius', 'Aprilis', 'Maius', 'Iunius', 'Iulius', 'Augustus', 'September', 'October', 'November', 'December'],
  monthsOf: ['Ianuarii', 'Februarii', 'Martii', 'Aprilis', 'Maii', 'Iunii', 'Iulii', 'Augusti', 'Septembris', 'Octobris', 'Novembris', 'Decembris'],
  monthsShort: ['Ian.', 'Feb.', 'Mart.', 'Apr.', 'Mai.', 'Iun.', 'Iul.', 'Aug.', 'Sept.', 'Oct.', 'Nov.', 'Dec.'],
};
const STYLES = {
  long: { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }, // Saturday, November 14, 2026
  medium: { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' }, // Sat, Nov 14, 2026
  weekday: { weekday: 'long' },
  weekdayShort: { weekday: 'short' },
  monthYear: { month: 'long', year: 'numeric' }, // November 2026
};
/** A date (YYYY-MM-DD) in the app's language. Styles: long, medium, weekday, weekdayShort, monthYear. */
export function fmtDate(iso, style = 'long') {
  const d = new Date(`${iso.length === 7 ? `${iso}-01` : iso}T12:00:00Z`);
  if (current === 'la') {
    const wd = d.getUTCDay(), day = d.getUTCDate(), m = d.getUTCMonth(), y = d.getUTCFullYear();
    switch (style) {
      case 'weekday': return LATIN.weekdays[wd];
      case 'weekdayShort': return LATIN.weekdaysShort[wd];
      case 'monthYear': return `${LATIN.months[m]} ${y}`;
      case 'medium': return `${LATIN.weekdaysShort[wd]}, ${day} ${LATIN.monthsShort[m]} ${y}`;
      default: return `${LATIN.weekdays[wd]}, ${day} ${LATIN.monthsOf[m]} ${y}`;
    }
  }
  const s = d.toLocaleDateString(info().locale, { ...STYLES[style], timeZone: 'UTC' });
  // German, French and Spanish write weekdays and months in small letters mid-sentence; a heading starts with a capital.
  return style === 'long' || style === 'weekday' || style === 'monthYear' ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

// ---------- the page's own text ----------
/** Not translated (fixed menus marked data-t are): the texts, Latin samples, and lists the scripts fill in themselves. */
const SKIP = '#text, #month-list, #week, #results, #feastlist, #sacristan-body, #hours, #masschoice, #outline, #jump, #wheel-svg, #info, select:not([data-t]), [lang="la"], .fp-sample, .initials-demo, .flagmenu-list, script, style, svg';
const ATTRS = ['aria-label', 'title', 'placeholder'];
const recorded = []; // [node, attribute or null, English]

const squash = (s) => s.replace(/\s+/g, ' ').trim();
function translateKeep(en) {
  const lead = /^\s/.test(en) ? ' ' : '';
  const trail = /\s$/.test(en) ? ' ' : '';
  return lead + t(squash(en)) + trail;
}

/** Note every piece of English in the page (call once, before anything else fills it in). */
export function recordPage(root = document.body) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode(n) {
      if (n.nodeType === 1) return n.matches(SKIP) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
      return /\p{L}/u.test(n.data) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_SKIP;
    },
  });
  while (walker.nextNode()) {
    const n = walker.currentNode;
    if (n.nodeType === 3) recorded.push([n, null, n.data]);
    else for (const a of ATTRS) if (n.hasAttribute(a) && /\p{L}/u.test(n.getAttribute(a))) recorded.push([n, a, n.getAttribute(a)]);
  }
}

/** Every piece of the page's English (for checking the dictionaries: scripts/ui-strings.mjs). */
export const pageStrings = () => [...new Set(recorded.map(([, , en]) => squash(en)))];

/** Put the page's own text into the app's language. */
export function applyPage() {
  for (const [node, attr, en] of recorded) {
    if (!node) continue;
    if (attr) node.setAttribute(attr, translateKeep(en));
    else node.data = translateKeep(en);
  }
  document.documentElement.lang = current === 'la' ? 'la' : current;
  document.title = t('Divine Office and Mass');
}

// ---------- the flag menu (Settings) ----------
function syncFlagMenu() {
  const cur = info();
  document.getElementById('flagmenu-current').innerHTML = `<span class="flag">${flagSvg(cur.id)}</span><span>${cur.label}</span>`;
  document.querySelectorAll('#flagmenu-list button').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.ui === current)));
}

/** `onChange` redraws whatever the scripts wrote (the day, the month, the menus). */
export function initUi(onChange) {
  recordPage();
  const list = document.getElementById('flagmenu-list');
  list.innerHTML = UI_LANGS.map((l) =>
    `<li><button type="button" role="menuitemradio" data-ui="${l.id}" aria-checked="false" lang="${l.id}">
      <span class="flag" title="${l.flagName}">${flagSvg(l.id)}</span><span>${l.label}</span></button></li>`).join('');
  list.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-ui]');
    if (!b) return;
    current = b.dataset.ui;
    store.set('uiLang', current);
    document.getElementById('flagmenu').open = false;
    applyPage();
    syncFlagMenu();
    onChange();
  });
  if (current !== 'en') applyPage();
  syncFlagMenu();
}
