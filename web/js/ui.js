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
import PT from './ui/pt.js';

const DICTS = { de: DE, fr: FR, es: ES, la: LA, pt: PT };

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
  // Mexico: green, white and red, with the eagle on the cactus, holding the serpent, in an oak and laurel wreath.
  mx: `<svg viewBox="0 0 28 16" aria-hidden="true"><rect width="9.34" height="16" fill="#006847"/><rect x="9.33" width="9.34" height="16" fill="#fff"/><rect x="18.66" width="9.34" height="16" fill="#ce1126"/>
    <path d="M10.8 8.2Q10.9 12.5 14 12.8Q17.1 12.5 17.2 8.2" fill="none" stroke="#3a7d32" stroke-width=".7"/>
    <path d="M13 12.4Q14 13 15 12.4" fill="none" stroke="#3b6fb6" stroke-width=".55"/>
    <path d="M13.3 10.2h1.6v1.7h-1.6zM12.6 10.6q-.6-.8 0-1.3q.5.4 .6 1.1zM15.6 10.6q.6-.8 0-1.3q-.5.4-.6 1.1z" fill="#4c8c2b"/>
    <path d="M14.5 6.5L15.3 2.9L15.9 3.9L16.5 3.1L16.8 4.4L17.5 4L17.1 6L16.2 7.6Z" fill="#5c3416"/>
    <path d="M12.3 4.9Q11.5 4.9 11.2 5.6L11.9 5.9Q12.3 7.3 13.1 8.3L13.6 9.2L13.2 10.2H14.9L14.6 9.3L15.9 9.7L15.3 8.7Q16.3 7.2 15.4 6Q14 4.4 12.3 4.9Z" fill="#7b4a22"/>
    <circle cx="12.3" cy="5.5" r=".28" fill="#fff"/>
    <path d="M11.3 5.8Q10.5 6.6 11.3 7.2Q12 7.7 11.3 8.4Q10.9 8.8 11.4 9.1" fill="none" stroke="#3a7d32" stroke-width=".4" stroke-linecap="round"/></svg>`,
  // The Vatican: yellow and white, with the crossed keys (gold over silver, tied with a red cord) under the papal tiara.
  va: (() => {
    const key = (fill, stroke) => `<g fill="${fill}" stroke="${stroke}" stroke-width="1">
      <rect x="-2" y="-25" width="4" height="40"/><path d="M2-25h10v4h-3.5v3h3.5v4H2z"/><rect x="-3.6" y="13.5" width="7.2" height="3.4" rx=".8"/>
      <circle cx="0" cy="24.5" r="7" fill="none" stroke="${stroke}" stroke-width="4.6"/><circle cx="0" cy="24.5" r="7" fill="none" stroke="${fill}" stroke-width="2.8"/></g>`;
    return `<svg viewBox="0 0 120 120" aria-hidden="true"><rect width="60" height="120" fill="#ffe000"/><rect x="60" width="60" height="120" fill="#fff"/>
      <g transform="translate(90 74)">
        <g transform="rotate(38)">${key('#cfd2d6', '#7a7f86')}</g>
        <g transform="rotate(-38) scale(-1 1)">${key('#e0b22e', '#8c6a12')}</g>
        <path d="M-16.8 24Q-8 40 0 32Q8 40 16.8 24" fill="none" stroke="#c8102e" stroke-width="1.8"/>
        <path d="M-1.6 32l-1.4 8M1.6 32l1.4 8" stroke="#c8102e" stroke-width="1.6" stroke-linecap="round"/>
      </g>
      <g stroke="#8c6a12" stroke-width="1">
        <path d="M84 47v7M96 47v7" stroke="#c8102e" stroke-width="3"/>
        <path d="M78.5 47.5V34Q78.5 21 90 19Q101.5 21 101.5 34V47.5Z" fill="#fff"/>
        <path d="M79.5 42.6l1.3-2.6l1.3 2.6z" fill="#e0b22e" stroke-width=".6"/><path d="M84.1 42.6l1.3-2.6l1.3 2.6z" fill="#e0b22e" stroke-width=".6"/><path d="M88.7 42.6l1.3-2.6l1.3 2.6z" fill="#e0b22e" stroke-width=".6"/><path d="M93.3 42.6l1.3-2.6l1.3 2.6z" fill="#e0b22e" stroke-width=".6"/><path d="M97.9 42.6l1.3-2.6l1.3 2.6z" fill="#e0b22e" stroke-width=".6"/><rect x="78" y="42.6" width="24" height="5" fill="#e0b22e"/>
        <path d="M80.6 34.4l1.3-2.6l1.3 2.6z" fill="#e0b22e" stroke-width=".6"/><path d="M86.0 34.4l1.3-2.6l1.3 2.6z" fill="#e0b22e" stroke-width=".6"/><path d="M91.4 34.4l1.3-2.6l1.3 2.6z" fill="#e0b22e" stroke-width=".6"/><path d="M96.8 34.4l1.3-2.6l1.3 2.6z" fill="#e0b22e" stroke-width=".6"/><rect x="78.8" y="34.4" width="22.4" height="3.8" fill="#e0b22e"/>
        <path d="M83.4 26.6l1.3-2.6l1.3 2.6z" fill="#e0b22e" stroke-width=".6"/><path d="M88.7 26.6l1.3-2.6l1.3 2.6z" fill="#e0b22e" stroke-width=".6"/><path d="M94.0 26.6l1.3-2.6l1.3 2.6z" fill="#e0b22e" stroke-width=".6"/><rect x="81.8" y="26.6" width="16.4" height="3.3" fill="#e0b22e"/>
        <circle cx="90" cy="17.5" r="2.6" fill="#e0b22e"/><path d="M90 6v10M86.4 10h7.2" stroke="#e0b22e" stroke-width="2.2"/>
      </g></svg>`;
  })(),
};

// Brazil: a simple placeholder until the image is supplied.
FLAGS.br = '<svg viewBox="0 0 20 14" aria-hidden="true"><rect width="20" height="14" fill="#009c3b"/><path d="M10 1.7 18.3 7 10 12.3 1.7 7Z" fill="#ffdf00"/><circle cx="10" cy="7" r="3.5" fill="#002776"/></svg>';

export const UI_LANGS = [
  { id: 'en', label: 'English', flag: 'us', locale: 'en-US', flagName: 'United States' },
  { id: 'de', label: 'Deutsch', flag: 'de', locale: 'de-DE', flagName: 'Deutschland' },
  { id: 'fr', label: 'Français', flag: 'qc', locale: 'fr-CA', flagName: 'Québec' },
  { id: 'es', label: 'Español', flag: 'mx', locale: 'es-MX', flagName: 'México' },
  { id: 'pt', label: 'Português', flag: 'br', locale: 'pt-BR', flagName: 'Brasil' },
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
/** A number in the app's language (1.5 → "1,5" in French). */
export const fmtNum = (n, digits = 1) =>
  new Intl.NumberFormat(current === 'la' ? 'en-US' : info().locale, { maximumFractionDigits: digits }).format(n);

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
const SKIP = '#text, #month-list, #week, #results, #feastlist, #sacristan-body, #devotion-body, #dv-days, #hours, #masschoice, #outline, #jump, #wheel-svg, #info, select:not([data-t]), [lang="la"], .fp-sample, .initials-demo, .flagmenu-list, script, style, svg';
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
  document.querySelectorAll('#flagmenu-list button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.ui === current)));
}

/** `onChange` redraws whatever the scripts wrote (the day, the month, the menus). */
export function initUi(onChange) {
  recordPage();
  const list = document.getElementById('flagmenu-list');
  list.innerHTML = UI_LANGS.map((l) =>
    `<li><button type="button" data-ui="${l.id}" aria-pressed="false" lang="${l.id}">
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
