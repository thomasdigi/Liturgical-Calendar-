// The viewer's state: settings (from the URL and saved choices) and what has been loaded.
import { $, isoToday, store } from './util.js';

export let avail = null;

export let RANGE = null;

export let config = null;

export let day = null; // the day's index (header, parts, Masses) in the language actually shown

export const params = new URLSearchParams(location.search);

export const state = {
  date: clampDate(params.get('date') || isoToday()),
  view: params.get('view') || store.get('view', 'office'),
  hour: params.get('hour') || defaultHour(),
  calendar: params.get('calendar') || store.get('calendar', 'general'),
  version: params.get('version') || store.get('version', '1962'),
  lang: params.get('lang') || store.get('lang', 'en'), // English unless the reader chose another (see DEFAULT_LANGUAGE)
  altLang: store.get('altLang', 'en'), // shown where the chosen language has no translation
  display: store.get('display', 'both'),
  layout: store.get('layout', 'interlinear'), // 'interlinear' | 'side'
  massMode: params.get('mass') || store.get('massMode', 'propers'), // 'propers' | 'full'
  massN: Number(params.get('n')) || 1, // which Mass, on days with several
  page: ['month', 'search'].includes(params.get('page')) ? params.get('page') : 'day',
  office: params.get('office') || 'day', // 'day' or a votive office id (dead, parvum, sabbato)
  compare: !!params.get('cmp'), // show another calendar/version beside this one
  cmpCalendar: (params.get('cmp') || '').split('/')[0] || null,
  cmpVersion: (params.get('cmp') || '').split('/')[1] || null,
  size: Number(store.get('textSize', '0')) || 0, // steps from normal, see SIZES
  reading: store.get('reading', 'off') === 'on',
};

export const SIZES = [0.85, 0.92, 1, 1.12, 1.25, 1.4, 1.6]; // text scale; index 2 is normal

export const sizeIndex = () => Math.min(SIZES.length - 1, Math.max(0, 2 + state.size));

export function clampDate(d) {
  if (!RANGE) return d;
  return d < RANGE.first ? RANGE.first : d > RANGE.last ? RANGE.last : d;
}

export function defaultHour() {
  const h = new Date().getHours();
  if (h < 5) return 'matins';
  if (h < 7) return 'lauds';
  if (h < 9) return 'prime';
  if (h < 11) return 'terce';
  if (h < 14) return 'sext';
  if (h < 16) return 'none';
  if (h < 20) return 'vespers';
  return 'compline';
}

export const lang = (id) => config.languages.find((l) => l.id === id) || config.languages.find((l) => l.id === config.defaultLanguage) || config.languages[0];

export const viewKey = () => (state.view === 'mass' ? 'mass' : 'office');

/** Was this language built for the current calendar/version (static site)? */
export const built = (id, cal = state.calendar, ver = state.version) =>
  !avail || (avail.combos[`${cal}/${ver}`] ?? []).includes(id);

export const comboBuilt = (cal, ver) => !avail || !!avail.combos[`${cal}/${ver}`];

export const offers = (id) => lang(id)[viewKey()] && built(id);

/** The alternative language for gaps: the user's choice, if it covers this view. */
export function altLangId() {
  if (state.altLang !== state.lang && offers(state.altLang)) return state.altLang;
  if (offers(config.fallbackLanguage)) return config.fallbackLanguage;
  return config.languages.find((l) => offers(l.id))?.id ?? config.fallbackLanguage;
}

/** The language whose data is loaded: the chosen one, or the alternative if it isn't offered here. */
export const shownLangId = () => (offers(state.lang) ? state.lang : altLangId());

export const fullAvailable = () => lang(shownLangId()).fullMass;

export const showFull = () => state.massMode === 'full' && fullAvailable();

export const viewName = () => (state.view === 'mass' ? 'the Mass' : 'the Divine Office');

export const calendarHas = (cal, version) => (config.calendars.find((c) => c.id === cal)?.versions ?? []).includes(version);

export const inRange = (d) => !RANGE || (d >= RANGE.first && d <= RANGE.last);

/** The Hours of the office being shown. */
export function officeHours() {
  if (state.office === 'day') return config.hours.map((h) => h.id);
  return day?.votives?.find((v) => v.id === state.office)?.hours ?? [];
}

export const comboLabel = (cal, ver) =>
  `${config.calendars.find((c) => c.id === cal)?.label} · ${config.versions.find((v) => v.id === ver)?.label}`;

export function currentPartId() {
  if (state.view !== 'mass') return state.office === 'day' ? state.hour : `${state.office}-${state.hour}`;
  const base = showFull() ? 'massFull' : 'mass';
  return state.massN > 1 ? `${base}-${state.massN}` : base;
}
export function setConfig(value) { config = value; }
export function setDay(value) { day = value; }
export function setAvail(value) { avail = value; }
export function setRANGE(value) { RANGE = value; }
