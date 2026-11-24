/** Builds (and caches) the full JSON for one day: header + each Hour. */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { HOURS, VERSION, type HourId } from './hours.ts';
import { parseOffice, type DayHeader, type OfficeSection } from './parse.ts';
import { renderHour } from './render.ts';

export interface HourData {
  id: HourId;
  title: { latin: string; english: string };
  sections: OfficeSection[];
}

export interface DayData {
  date: string; // YYYY-MM-DD
  version: string;
  header: DayHeader;
  hours: HourData[];
  source: string;
}

export const DATA_DIR = resolve(import.meta.dirname, '../data');

export function dayPath(date: string): string {
  return resolve(DATA_DIR, date.slice(0, 4), `${date.slice(5)}.json`);
}

export async function buildDay(date: string): Promise<DayData> {
  const hours: HourData[] = [];
  let header: DayHeader | undefined;
  for (const h of HOURS) {
    const parsed = parseOffice(await renderHour(date, h.id));
    // Lauds' header is the day's office; Vespers/Compline may already show tomorrow's 1st Vespers.
    header ??= parsed.header;
    hours.push({ id: h.id, title: { latin: parsed.hourTitle || h.latin, english: h.english }, sections: parsed.sections });
  }
  return {
    date,
    version: VERSION,
    header: header!,
    hours,
    source: 'Divinum Officium (divinumofficium.com), MIT License',
  };
}

/** Cached: returns stored JSON if present, otherwise builds and stores it. */
export async function getDay(date: string, { refresh = false } = {}): Promise<DayData> {
  const p = dayPath(date);
  if (!refresh) {
    try {
      return JSON.parse(await readFile(p, 'utf8')) as DayData;
    } catch {
      /* not cached yet */
    }
  }
  const day = await buildDay(date);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(day));
  return day;
}
