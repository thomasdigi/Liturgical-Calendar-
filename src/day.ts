/**
 * Builds (and caches) one day for one calendar, version and language:
 * the Mass propers, the full Mass and every Hour of the Office.
 * Stored as data/<calendar>/<version>/<lang>/<YYYY>/<MM-DD>.json
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  doSettings,
  FALLBACK_LANGUAGE,
  getCalendar,
  getHour,
  getLanguage,
  HOURS,
  PARTS,
  type CalendarId,
  type LanguageId,
  type PartId,
  type VersionId,
} from './config.ts';
import { parsePage, splitLines, type DayHeader, type Section } from './parse.ts';
import { renderPart } from './render.ts';

export interface PartData {
  id: PartId;
  title: { latin: string; label: string }; // "Ad Laudes" / "Lauds"
  header: DayHeader; // as DO shows it for this part (Vespers may already show tomorrow)
  sections: Section[];
}

export interface DayData {
  date: string; // YYYY-MM-DD
  calendar: CalendarId;
  version: VersionId;
  versionName: { office: string; mass: string }; // DO's names
  lang: LanguageId;
  header: DayHeader; // the day's office (from Lauds)
  parts: PartData[];
  source: string;
}

export const DATA_DIR = resolve(import.meta.dirname, '../data');

export function dayPath(date: string, calendar: CalendarId, version: VersionId, lang: LanguageId): string {
  return resolve(DATA_DIR, calendar, version, lang, date.slice(0, 4), `${date.slice(5)}.json`);
}

export async function buildPart(
  date: string,
  part: PartId,
  version: VersionId,
  lang: LanguageId,
  calendar: CalendarId = 'general',
): Promise<PartData> {
  const page = parsePage(await renderPart(date, part, version, lang, calendar));
  const title =
    part === 'mass' || part === 'massFull'
      ? { latin: page.title || 'Sancta Missa', label: part === 'mass' ? 'Mass · Propers' : 'Mass' }
      : { latin: page.title || getHour(part).latin, label: getHour(part).label };
  return { id: part, title, header: page.header, sections: page.sections };
}

/** Plain text of one line, for comparing languages. Short lines ("Amen.") are ignored. */
const plain = (line: string) => line.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
const MIN_LINE = 25;

/**
 * Marks, in each section, the lines DO filled with English because the language
 * has no translation of them (`fallback` = their line numbers).
 */
export function markFallback(day: DayData, english: DayData): void {
  for (const part of day.parts) {
    const en = english.parts.find((p) => p.id === part.id);
    if (!en) continue;
    const enLines = new Set(en.sections.flatMap((s) => splitLines(s.vernacular).map(plain)).filter((l) => l.length >= MIN_LINE));
    for (const s of part.sections) {
      const lines = splitLines(s.vernacular).map(plain);
      const fallback = lines.flatMap((l, i) => (l.length >= MIN_LINE && enLines.has(l) ? [i] : []));
      if (fallback.length) s.fallback = fallback;
      else delete s.fallback;
    }
  }
}

export async function buildDay(date: string, calendar: CalendarId, version: VersionId, lang: LanguageId): Promise<DayData> {
  getLanguage(lang); // validate early
  getCalendar(calendar);
  const v = doSettings(calendar, version);
  if (!v) throw Object.assign(new Error(`The ${calendar} calendar has no ${version} version`), { code: 'ENOENT' });
  const parts = await Promise.all(PARTS.map((p) => buildPart(date, p, version, lang, calendar)));
  const lauds = parts.find((p) => p.id === 'lauds') ?? parts.find((p) => HOURS.some((h) => h.id === p.id))!;
  const day: DayData = {
    date,
    calendar,
    version,
    versionName: { office: v.office, mass: v.mass },
    lang,
    header: lauds.header,
    parts,
    source: 'Divinum Officium (divinumofficium.com), MIT License',
  };
  if (lang !== FALLBACK_LANGUAGE) markFallback(day, await getDay(date, calendar, version, FALLBACK_LANGUAGE as LanguageId));
  return day;
}

/** Cached: returns stored JSON if present, otherwise builds and stores it. */
export async function getDay(
  date: string,
  calendar: CalendarId,
  version: VersionId,
  lang: LanguageId,
  { refresh = false } = {},
): Promise<DayData> {
  const p = dayPath(date, calendar, version, lang);
  if (!refresh) {
    try {
      return JSON.parse(await readFile(p, 'utf8')) as DayData;
    } catch {
      /* not cached yet */
    }
  }
  const day = await buildDay(date, calendar, version, lang);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(day));
  return day;
}
