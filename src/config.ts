import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Everything the app offers, in one place. To add a version, calendar or language,
 * add an entry here; the builder, server and viewer pick it up automatically.
 */

/** Rubrical versions. `office`/`mass` are DO's own version names (see Tabulae/data.txt). */
export const VERSIONS = [
  {
    id: '1962',
    label: '1962 (Rubrics 1960)',
    office: 'Rubrics 1960 - 1960',
    mass: 'Rubrics 1960 - 1960',
  },
  {
    id: '1954',
    label: 'Divino Afflatu 1954',
    office: 'Divino Afflatu - 1954',
    mass: 'Divino Afflatu - 1954',
  },
  {
    id: '1906',
    label: 'Tridentine 1906',
    office: 'Tridentine - 1906',
    // DO's missal has no separate 1906 setting; its nearest is the 1910 missal.
    mass: 'Tridentine - 1910',
  },
] as const;

/**
 * Calendars (which local feasts are kept). `dioecesis` is DO's calendar setting.
 * A calendar may replace DO's version names for some versions, and if it lists
 * `versions`, it exists only for those.
 */
export const CALENDARS = [
  { id: 'general', label: 'General Roman', dioecesis: 'Generale' },
  {
    id: 'usa',
    label: 'USA',
    dioecesis: 'Generale',
    // In DO the USA calendar is its own version of the 1960 rubrics, with later saints added.
    // The missal reports it as "Rubrics 1960 Newcalendar".
    versions: { '1962': { office: 'Rubrics 1960 - 2020 USA', mass: 'Rubrics 1960 Newcalendar' } },
  },
  { id: 'brazil', label: 'Brazil', dioecesis: 'Brasilia' },
  { id: 'rome', label: 'Diocese of Rome', dioecesis: 'Urbis' },
] as const;

/**
 * Second languages shown beside the Latin: every translation DO offers for the Office
 * or the Mass. `do` is DO's folder name under web/www/horas and web/www/missa.
 * Where DO lacks a text in a language, it shows the English instead
 * (for the Bea psalter, the standard Latin).
 */
export const LANGUAGES = [
  { id: 'en', label: 'English', do: 'English' },
  { id: 'la-bea', label: 'Latina (Bea psalter)', do: 'Latin-Bea' },
  { id: 'cs', label: 'Čeština', do: 'Bohemice' },
  { id: 'da', label: 'Dansk', do: 'Dansk' },
  { id: 'de', label: 'Deutsch', do: 'Deutsch' },
  { id: 'es', label: 'Español', do: 'Espanol' },
  { id: 'fr', label: 'Français', do: 'Francais' },
  { id: 'it', label: 'Italiano', do: 'Italiano' },
  { id: 'hu', label: 'Magyar', do: 'Magyar' },
  { id: 'hu-kaldi', label: 'Magyar (Káldi)', do: 'Magyar-Kaldi' },
  { id: 'nl', label: 'Nederlands', do: 'Nederlands' },
  { id: 'pl', label: 'Polski', do: 'Polski' },
  { id: 'pl-newer', label: 'Polski (newer)', do: 'Polski-Newer' },
  { id: 'pt', label: 'Português', do: 'Portugues' },
  { id: 'vi', label: 'Tiếng Việt', do: 'Vietnamice' },
  { id: 'uk', label: 'Українська', do: 'Ukrainian' },
  { id: 'he', label: 'עברית', do: 'Hebrew', rtl: true },
] as const;

/** Languages whose gaps DO fills with English; these get "not fully translated" notes. */
export const FALLBACK_LANGUAGE = 'en';

const DO_WWW = resolve(import.meta.dirname, '../vendor/divinum-officium/web/www');

/**
 * The languages DO itself offers for the Office ('horas') or the Mass ('missa'),
 * read from its own menu files.
 */
export function doOffers(kind: 'horas' | 'missa'): Set<string> {
  const dialog = readFileSync(resolve(DO_WWW, kind, `${kind}.dialog`), 'utf8');
  const block = /^\[languages\]\s*\n([^\n]*)/m.exec(dialog)?.[1] ?? '';
  // Entries look like "Français/Francais" (label/folder) or just "Deutsch".
  return new Set(block.split(',').map((e) => e.split('/').pop()!.trim()).filter(Boolean));
}

/** True when DO has this language's own translation of the Ordinary of the Mass. */
export function hasOrdinary(doName: string): boolean {
  return doOffers('missa').has(doName) && existsSync(resolve(DO_WWW, 'missa', doName, 'Ordo/Ordo.txt'));
}

/** The Hours of the Office, in order. `command` is DO's officium.pl command. */
export const HOURS = [
  { id: 'matins', command: 'prayMatutinum', latin: 'Ad Matutinum', label: 'Matins' },
  { id: 'lauds', command: 'prayLaudes', latin: 'Ad Laudes', label: 'Lauds' },
  { id: 'prime', command: 'prayPrima', latin: 'Ad Primam', label: 'Prime' },
  { id: 'terce', command: 'prayTertia', latin: 'Ad Tertiam', label: 'Terce' },
  { id: 'sext', command: 'praySexta', latin: 'Ad Sextam', label: 'Sext' },
  { id: 'none', command: 'prayNona', latin: 'Ad Nonam', label: 'None' },
  { id: 'vespers', command: 'prayVespera', latin: 'Ad Vesperas', label: 'Vespers' },
  { id: 'compline', command: 'prayCompletorium', latin: 'Ad Completorium', label: 'Compline' },
] as const;

export type VersionId = (typeof VERSIONS)[number]['id'];
export type CalendarId = (typeof CALENDARS)[number]['id'];
export type LanguageId = (typeof LANGUAGES)[number]['id'];
export type HourId = (typeof HOURS)[number]['id'];
/** A "part" of a day: the Mass propers, the full Mass (with the Ordinary), or one Hour. */
export type PartId = 'mass' | 'massFull' | HourId;
export const PARTS: PartId[] = ['mass', 'massFull', ...HOURS.map((h) => h.id)];

function find<T extends { id: string }>(list: readonly T[], id: string, what: string): T {
  const x = list.find((i) => i.id === id);
  if (!x) throw new Error(`Unknown ${what} "${id}". Known: ${list.map((i) => i.id).join(', ')}`);
  return x;
}
export const getVersion = (id: string) => find(VERSIONS, id, 'version');
export const getCalendar = (id: string) => find(CALENDARS, id, 'calendar');
export const getLanguage = (id: string) => find(LANGUAGES, id, 'language');
export const getHour = (id: string) => find(HOURS, id, 'hour');

/** DO's settings for a calendar + version, or null if that calendar has no such version. */
export function doSettings(calendar: string, version: string): { office: string; mass: string; dioecesis: string } | null {
  const c = getCalendar(calendar);
  const v = getVersion(version);
  if ('versions' in c) {
    const o = (c.versions as Record<string, { office: string; mass: string }>)[v.id];
    return o ? { ...o, dioecesis: c.dioecesis } : null;
  }
  return { office: v.office, mass: v.mass, dioecesis: c.dioecesis };
}

/** Is this language offered by DO for the Office / the Mass? */
export function languageOffers(id: string) {
  const l = getLanguage(id);
  return { office: doOffers('horas').has(l.do), mass: doOffers('missa').has(l.do), fullMass: hasOrdinary(l.do) };
}

/** What the viewer needs to know (served as data/config.json). */
export function publicConfig() {
  return {
    versions: VERSIONS.map(({ id, label }) => ({ id, label })),
    calendars: CALENDARS.map((c) => ({
      id: c.id,
      label: c.label,
      versions: VERSIONS.filter((v) => doSettings(c.id, v.id)).map((v) => v.id),
    })),
    languages: LANGUAGES.map((l) => ({
      id: l.id,
      label: l.label,
      htmlLang: l.id.split('-')[0],
      rtl: 'rtl' in l && l.rtl,
      ...languageOffers(l.id), // office / mass false: greyed out there
    })),
    fallbackLanguage: FALLBACK_LANGUAGE,
    hours: HOURS.map(({ id, label, latin }) => ({ id, label, latin })),
  };
}
