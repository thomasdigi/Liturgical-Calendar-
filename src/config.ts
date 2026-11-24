import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Everything the app offers, in one place. To add a version or a language,
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
 * Second languages shown beside the Latin: every translation DO offers for the Office
 * or the Mass. `do` is DO's folder name under web/www/horas and web/www/missa.
 * Where DO lacks a text in a language, it shows the English instead.
 */
export const LANGUAGES = [
  { id: 'en', label: 'English', do: 'English' },
  { id: 'cs', label: 'Čeština', do: 'Bohemice' },
  { id: 'cs-schaller', label: 'Čeština (Schaller)', do: 'Cesky-Schaller' },
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

const DO_WWW = resolve(import.meta.dirname, '../vendor/divinum-officium/web/www');

/**
 * The languages DO itself offers for the Office ('horas') or the Mass ('missa'),
 * read from its own menu files. Others fall back to English there.
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
export const getLanguage = (id: string) => find(LANGUAGES, id, 'language');
export const getHour = (id: string) => find(HOURS, id, 'hour');

/** What the viewer needs to know (served as data/config.json). */
export function publicConfig() {
  return {
    versions: VERSIONS.map(({ id, label }) => ({ id, label })),
    languages: LANGUAGES.map((l) => ({
      id: l.id,
      label: l.label,
      htmlLang: l.id.split('-')[0],
      rtl: 'rtl' in l && l.rtl,
      office: doOffers('horas').has(l.do), // false: DO shows English for the Office
      mass: doOffers('missa').has(l.do), // false: DO shows English for the Mass
      fullMass: hasOrdinary(l.do),
    })),
    hours: HOURS.map(({ id, label, latin }) => ({ id, label, latin })),
  };
}
