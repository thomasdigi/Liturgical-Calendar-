/**
 * A month at a glance for one calendar and version: each day's feast, class,
 * colour, commemorations, and fasting. Small enough for the month view and the
 * week strip. Stored as data/<calendar>/<version>/summary/YYYY-MM.json.
 * The titles are DO's own (Latin), so one file serves every language.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { doSettings, getCalendar, getVersion, type CalendarId, type VersionId } from './config.ts';
import { DATA_DIR, dayPath } from './day.ts';
import { fasting, type Fasting } from './fasting.ts';
import { parsePage, type DayHeader } from './parse.ts';
import { renderPart } from './render.ts';

export interface DaySummary extends DayHeader {
  date: string;
  fasting: Fasting;
}

export interface MonthSummary {
  calendar: CalendarId;
  version: VersionId;
  month: string; // YYYY-MM
  days: DaySummary[];
}

export function summaryPath(calendar: CalendarId, version: VersionId, month: string): string {
  return resolve(DATA_DIR, calendar, version, 'summary', `${month}.json`);
}

/** The day's header: from an already-built day file if there is one, else from DO's Lauds. */
async function headerFor(date: string, calendar: CalendarId, version: VersionId): Promise<DayHeader> {
  try {
    const day = JSON.parse(await readFile(dayPath(date, calendar, version, 'en'), 'utf8'));
    return day.header;
  } catch {
    return parsePage(await renderPart(date, 'lauds', version, 'en', calendar)).header;
  }
}

const EMBER = /Quattuor Temporum/i;

export async function buildMonth(calendar: CalendarId, version: VersionId, month: string): Promise<MonthSummary> {
  getCalendar(calendar);
  getVersion(version);
  if (!doSettings(calendar, version)) {
    throw Object.assign(new Error(`The ${calendar} calendar has no ${version} version`), { code: 'ENOENT' });
  }
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error(`Bad month "${month}", expected YYYY-MM`);
  const [y, m] = month.split('-').map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const dates = Array.from({ length: count }, (_, i) => `${month}-${String(i + 1).padStart(2, '0')}`);

  const days: DaySummary[] = new Array(count);
  const queue = dates.map((d, i) => [d, i] as const);
  await Promise.all(
    Array.from({ length: 6 }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        const [date, i] = job;
        const h = await headerFor(date, calendar, version);
        const ember = EMBER.test(h.title) || h.commemorations.some((c) => EMBER.test(c));
        days[i] = { date, ...h, fasting: fasting(date, ember) };
      }
    }),
  );
  return { calendar, version, month, days };
}

/** Cached: returns the stored month if present, otherwise builds and stores it. */
export async function getMonth(
  calendar: CalendarId,
  version: VersionId,
  month: string,
  { refresh = false } = {},
): Promise<MonthSummary> {
  const p = summaryPath(calendar, version, month);
  if (!refresh) {
    try {
      return JSON.parse(await readFile(p, 'utf8')) as MonthSummary;
    } catch {
      /* not cached yet */
    }
  }
  const s = await buildMonth(calendar, version, month);
  await mkdir(dirname(p), { recursive: true });
  await writeFile(p, JSON.stringify(s));
  return s;
}
