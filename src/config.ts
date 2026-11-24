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
    id: '1906',
    label: 'Tridentine 1906',
    office: 'Tridentine - 1906',
    // DO's missal has no separate 1906 setting; its nearest is the 1910 missal.
    mass: 'Tridentine - 1910',
  },
] as const;

/** Second languages shown beside the Latin. `do` is DO's folder name under web/www/horas and web/www/missa. */
export const LANGUAGES = [
  { id: 'en', label: 'English', do: 'English' },
  { id: 'fr', label: 'Français', do: 'Francais' },
  { id: 'de', label: 'Deutsch', do: 'Deutsch' },
] as const;

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
/** A "part" of a day: the Mass, or one Hour. */
export type PartId = 'mass' | HourId;
export const PARTS: PartId[] = ['mass', ...HOURS.map((h) => h.id)];

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
    languages: LANGUAGES.map(({ id, label }) => ({ id, label })),
    hours: HOURS.map(({ id, label, latin }) => ({ id, label, latin })),
  };
}
