/**
 * Builds (and caches) one day for one version and language:
 * the Mass propers plus every Hour of the Office.
 * Stored as data/<version>/<lang>/<YYYY>/<MM-DD>.json
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { getHour, getLanguage, getVersion, HOURS, PARTS, type LanguageId, type PartId, type VersionId } from './config.ts';
import { parsePage, type DayHeader, type Section } from './parse.ts';
import { renderPart } from './render.ts';

export interface PartData {
  id: PartId;
  title: { latin: string; label: string }; // "Ad Laudes" / "Lauds"
  header: DayHeader; // as DO shows it for this part (Vespers may already show tomorrow)
  sections: Section[];
}

export interface DayData {
  date: string; // YYYY-MM-DD
  version: VersionId;
  versionName: { office: string; mass: string }; // DO's names
  lang: LanguageId;
  header: DayHeader; // the day's office (from Lauds)
  parts: PartData[];
  source: string;
}

export const DATA_DIR = resolve(import.meta.dirname, '../data');

export function dayPath(date: string, version: VersionId, lang: LanguageId): string {
  return resolve(DATA_DIR, version, lang, date.slice(0, 4), `${date.slice(5)}.json`);
}

export async function buildPart(date: string, part: PartId, version: VersionId, lang: LanguageId): Promise<PartData> {
  const page = parsePage(await renderPart(date, part, version, lang));
  const title =
    part === 'mass' || part === 'massFull'
      ? { latin: page.title || 'Sancta Missa', label: part === 'mass' ? 'Mass · Propers' : 'Mass' }
      : { latin: page.title || getHour(part).latin, label: getHour(part).label };
  return { id: part, title, header: page.header, sections: page.sections };
}

export async function buildDay(date: string, version: VersionId, lang: LanguageId): Promise<DayData> {
  getLanguage(lang); // validate early
  const v = getVersion(version);
  const parts = await Promise.all(PARTS.map((p) => buildPart(date, p, version, lang)));
  const lauds = parts.find((p) => p.id === 'lauds') ?? parts.find((p) => HOURS.some((h) => h.id === p.id))!;
  return {
    date,
    version,
    versionName: { office: v.office, mass: v.mass },
    lang,
    header: lauds.header,
    parts,
    source: 'Divinum Officium (divinumofficium.com), MIT License',
  };
}

/** Cached: returns stored JSON if present, otherwise builds and stores it. */
export async function getDay(
  date: string,
  version: VersionId,
  lang: LanguageId,
  { refresh = false } = {},
): Promise<DayData> {
  const p = dayPath(date, version, lang);
  if (!refresh) {
    try {
      return JSON.parse(await readFile(p, 'utf8')) as DayData;
    } catch {
      /* not cached yet */
    }
  }
  const day = await buildDay(date, version, lang);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(day));
  return day;
}
