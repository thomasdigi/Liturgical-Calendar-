/** The Hours we build, in display order. `command` is DO's officium.pl command. */
export const HOURS = [
  { id: 'lauds', command: 'prayLaudes', latin: 'Ad Laudes', english: 'Lauds' },
  { id: 'sext', command: 'praySexta', latin: 'Ad Sextam', english: 'Sext' },
  { id: 'vespers', command: 'prayVespera', latin: 'Ad Vesperas', english: 'Vespers' },
  { id: 'compline', command: 'prayCompletorium', latin: 'Ad Completorium', english: 'Compline' },
] as const;

export type HourId = (typeof HOURS)[number]['id'];

export function getHour(id: string) {
  const h = HOURS.find((h) => h.id === id);
  if (!h) throw new Error(`Unknown hour "${id}". Known: ${HOURS.map((h) => h.id).join(', ')}`);
  return h;
}

/** 1962 books = DO version "Rubrics 1960 - 1960". */
export const VERSION = 'Rubrics 1960 - 1960';
