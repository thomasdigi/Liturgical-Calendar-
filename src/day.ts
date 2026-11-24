/**
 * Builds (and caches) one day for one calendar, version and language:
 * the Mass propers, the full Mass and every Hour of the Office, and on days with
 * several Masses (Christmas, All Souls, …) each of them.
 *
 * Stored split up, so the viewer loads only what it shows:
 *   data/<cal>/<ver>/<lang>/YYYY/MM-DD/index.json     the day: header, parts, Masses
 *   data/<cal>/<ver>/<lang>/YYYY/MM-DD/<part>.json    one part: second-language text
 *   data/<cal>/<ver>/latin/YYYY/MM-DD/<part>.json     the Latin, shared by every language
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import {
  doSettings,
  FALLBACK_LANGUAGE,
  getCalendar,
  getHour,
  getLanguage,
  HOURS,
  PARTS,
  VOTIVES,
  getVotive,
  votiveHours,
  type HourId,
  type VotiveId,
  type CalendarId,
  type LanguageId,
  type PartId,
  type VersionId,
} from './config.ts';
import { parsePage, splitLines, type DayHeader, type Section } from './parse.ts';
import { renderPart } from './render.ts';

/** A part of the day: 'mass', 'massFull', an Hour, or another Mass of the day: 'mass-2', 'massFull-3'. */
export type PartKey = PartId | `mass-${number}` | `massFull-${number}` | `${VotiveId}-${HourId}`;

/**
 * Which votive offices to build with each day: all by default; the build script's
 * --votive option sets VOTIVES=dead,parvum or VOTIVES=none.
 */
function votivesToBuild(): VotiveId[] {
  const env = process.env.VOTIVES;
  if (!env) return VOTIVES.map((v) => v.id);
  if (env === 'none') return [];
  return env.split(',').map((id) => getVotive(id.trim()).id);
}

export interface PartData {
  id: PartKey;
  title: { latin: string; label: string }; // "Ad Laudes" / "Lauds"
  header: DayHeader; // as DO shows it for this part (Vespers may already show tomorrow)
  sections: Section[];
}

/** One of several Masses on a day. Its parts are `mass`/`massFull` (n = 1) or `mass-n`/`massFull-n`. */
export interface MassChoice {
  n: number;
  label: string; // DO's name: "Missa prima", "Forma brevior", …
  title: string; // the Mass's own title: "In Nativitate Domini in nocte"
}

export interface DayData {
  date: string; // YYYY-MM-DD
  calendar: CalendarId;
  version: VersionId;
  versionName: { office: string; mass: string }; // DO's names
  lang: LanguageId;
  header: DayHeader; // the day's office (from Lauds)
  masses: MassChoice[]; // empty on ordinary days
  votives: { id: VotiveId; hours: HourId[] }[]; // votive offices built for this day
  parts: PartData[];
  source: string;
}

export const DATA_DIR = resolve(import.meta.dirname, '../data');

const dayDir = (date: string, calendar: string, version: string, lang: string) =>
  resolve(DATA_DIR, calendar, version, lang, date.slice(0, 4), date.slice(5));
export const indexPath = (date: string, calendar: CalendarId, version: VersionId, lang: LanguageId) =>
  resolve(dayDir(date, calendar, version, lang), 'index.json');
export const partKey = (base: 'mass' | 'massFull', n: number): PartKey => (n === 1 ? base : `${base}-${n}`);

export async function buildPart(
  date: string,
  part: PartId,
  version: VersionId,
  lang: LanguageId,
  calendar: CalendarId = 'general',
  missanumber = 1,
  votive?: VotiveId,
): Promise<PartData & { masses: string[] }> {
  const page = parsePage(await renderPart(date, part, version, lang, calendar, missanumber, votive));
  const isMass = part === 'mass' || part === 'massFull';
  const title = isMass
    ? { latin: page.title || 'Sancta Missa', label: part === 'mass' ? 'Mass · Propers' : 'Mass' }
    : votive
      ? { latin: page.title || getHour(part).latin, label: `${getVotive(votive).label} · ${getHour(part).label}` }
      : { latin: page.title || getHour(part).latin, label: getHour(part).label };
  const id: PartKey = isMass ? partKey(part, missanumber) : votive ? `${votive}-${part as HourId}` : part;
  return { id, title, header: page.header, sections: page.sections, masses: page.masses };
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

  const first = await Promise.all(PARTS.map((p) => buildPart(date, p, version, lang, calendar)));
  // Several Masses today? DO lists them on the Mass page; build the 2nd, 3rd, … too.
  const names = first.find((p) => p.id === 'mass')!.masses;
  const more = await Promise.all(
    names.slice(1).flatMap((_, i) =>
      (['mass', 'massFull'] as const).map((p) => buildPart(date, p, version, lang, calendar, i + 2)),
    ),
  );
  const votives = votivesToBuild()
    .map((id) => ({ id, hours: votiveHours(id, date) }))
    .filter((v) => v.hours.length);
  const votiveParts = await Promise.all(
    votives.flatMap((v) => v.hours.map((h) => buildPart(date, h, version, lang, calendar, 1, v.id))),
  );
  const parts: PartData[] = [...first, ...more, ...votiveParts].map(({ masses: _m, ...p }) => p);
  const masses: MassChoice[] = names.map((label, i) => ({
    n: i + 1,
    label,
    title: parts.find((p) => p.id === partKey('mass', i + 1))!.header.title,
  }));

  const lauds = parts.find((p) => p.id === 'lauds') ?? parts.find((p) => HOURS.some((h) => h.id === p.id))!;
  const day: DayData = {
    date,
    calendar,
    version,
    versionName: { office: v.office, mass: v.mass },
    lang,
    header: lauds.header,
    masses,
    votives,
    parts,
    source: 'Divinum Officium (divinumofficium.com), MIT License',
  };
  if (lang !== FALLBACK_LANGUAGE) markFallback(day, await getDay(date, calendar, version, FALLBACK_LANGUAGE as LanguageId));
  return day;
}

// ---------- storage ----------

async function writeJson(path: string, data: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(tmp, JSON.stringify(data));
  await rename(tmp, path); // atomic: a reader never sees half a file
}
const readJson = async (path: string) => JSON.parse(await readFile(path, 'utf8'));

/** Splits a day into its files. The Latin goes to the shared folder unless it's already there and the same. */
export async function writeDay(day: DayData): Promise<void> {
  const dir = dayDir(day.date, day.calendar, day.version, day.lang);
  const latinDir = dayDir(day.date, day.calendar, day.version, 'latin');
  for (const part of day.parts) {
    const latin = { sections: part.sections.map((s) => ({ heading: s.heading.latin, latin: s.latin })) };
    let shared: typeof latin | null = null;
    try {
      // English is built first for every day, so it (re)writes the shared Latin.
      if (day.lang === FALLBACK_LANGUAGE) throw new Error('rewrite');
      shared = await readJson(resolve(latinDir, `${part.id}.json`));
    } catch {
      await writeJson(resolve(latinDir, `${part.id}.json`), latin);
      shared = latin;
    }
    const same = JSON.stringify(shared) === JSON.stringify(latin);
    await writeJson(resolve(dir, `${part.id}.json`), {
      id: part.id,
      // If this language's Latin differs from the shared copy, keep its own.
      ...(same ? {} : { latin: latin.sections }),
      sections: part.sections.map((s) => ({
        heading: s.heading.vernacular,
        vernacular: s.vernacular,
        ...(s.fallback ? { fallback: s.fallback } : {}),
      })),
    });
  }
  const { parts, ...meta } = day;
  await writeJson(resolve(dir, 'index.json'), {
    ...meta,
    parts: parts.map(({ id, title, header }) => ({ id, title, header })),
  });
}

/** Reads a stored day back into one object. */
export async function readDay(date: string, calendar: CalendarId, version: VersionId, lang: LanguageId): Promise<DayData> {
  const dir = dayDir(date, calendar, version, lang);
  const latinDir = dayDir(date, calendar, version, 'latin');
  const index = await readJson(resolve(dir, 'index.json'));
  const parts: PartData[] = await Promise.all(
    index.parts.map(async (p: Omit<PartData, 'sections'>) => {
      const own = await readJson(resolve(dir, `${p.id}.json`));
      const latin = own.latin ?? (await readJson(resolve(latinDir, `${p.id}.json`))).sections;
      return {
        ...p,
        sections: own.sections.map((s: { heading: string; vernacular: string; fallback?: number[] }, i: number) => ({
          heading: { latin: latin[i]?.heading ?? '', vernacular: s.heading },
          latin: latin[i]?.latin ?? '',
          vernacular: s.vernacular,
          ...(s.fallback ? { fallback: s.fallback } : {}),
        })),
      };
    }),
  );
  return { ...index, parts };
}

/** Cached: returns the stored day if present, otherwise builds and stores it. */
const building = new Map<string, Promise<DayData>>();
export async function getDay(
  date: string,
  calendar: CalendarId,
  version: VersionId,
  lang: LanguageId,
  { refresh = false } = {},
): Promise<DayData> {
  if (!refresh) {
    try {
      return await readDay(date, calendar, version, lang);
    } catch {
      /* not cached yet */
    }
  }
  // Don't build the same day twice at once (e.g. several languages all needing the English).
  const key = `${date}|${calendar}|${version}|${lang}|${refresh}`;
  if (!building.has(key)) {
    building.set(
      key,
      buildDay(date, calendar, version, lang)
        .then(async (day) => (await writeDay(day), day))
        .finally(() => building.delete(key)),
    );
  }
  return building.get(key)!;
}
