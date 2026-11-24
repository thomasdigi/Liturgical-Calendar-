/**
 * Pre-builds days into data/<calendar>/<version>/<lang>/YYYY/MM-DD.json, plus data/config.json.
 *   npm run build -- 2026                                   whole year, everything
 *   npm run build -- 2026-12-01 2026-12-31
 *   npm run build -- 2026 --calendar general,usa --version 1962 --lang en,fr
 *   add --refresh to rebuild days that are already cached
 * Calendar/version pairs that don't exist (e.g. USA 1906) are skipped.
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { resolve } from 'node:path';
import {
  CALENDARS,
  doSettings,
  FALLBACK_LANGUAGE,
  getCalendar,
  getLanguage,
  getVersion,
  LANGUAGES,
  publicConfig,
  VERSIONS,
  type CalendarId,
  type LanguageId,
  type VersionId,
} from '../src/config.ts';
import { DATA_DIR, getDay } from '../src/day.ts';

const args = process.argv.slice(2);
const FLAGS = ['--calendar', '--version', '--lang'];
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const refresh = args.includes('--refresh');
const pos = args.filter((a, i) => !a.startsWith('--') && !FLAGS.includes(args[i - 1]));

let [from, to] = pos;
if (!from) {
  console.error(
    'Usage: npm run build -- <year> | <from YYYY-MM-DD> <to YYYY-MM-DD> [--calendar general,usa,brazil,rome] [--version 1962,1954,1906] [--lang en,fr,...] [--refresh]',
  );
  process.exit(1);
}
if (/^\d{4}$/.test(from)) [from, to] = [`${from}-01-01`, `${from}-12-31`];
to ??= from;

const list = <T extends { id: string }>(name: string, all: readonly T[], get: (id: string) => T) =>
  (flag(name)?.split(',') ?? all.map((x) => x.id)).map((id) => get(id).id);
const calendars = list('calendar', CALENDARS, getCalendar) as CalendarId[];
const versions = list('version', VERSIONS, getVersion) as VersionId[];
const langs = list('lang', LANGUAGES, getLanguage) as LanguageId[];

await mkdir(DATA_DIR, { recursive: true });
await writeFile(resolve(DATA_DIR, 'config.json'), JSON.stringify(publicConfig()));

type Job = { date: string; calendar: CalendarId; version: VersionId; lang: LanguageId };
// English first for each day: the other languages are compared against it.
const first: Job[] = [];
const rest: Job[] = [];
for (let d = new Date(`${from}T12:00:00Z`); d <= new Date(`${to}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
  const date = d.toISOString().slice(0, 10);
  for (const calendar of calendars)
    for (const version of versions) {
      if (!doSettings(calendar, version)) continue;
      for (const lang of langs) (lang === FALLBACK_LANGUAGE ? first : rest).push({ date, calendar, version, lang });
    }
}

let done = 0;
let failed = 0;
const total = first.length + rest.length;
const started = Date.now();
// Each job runs ~10 pages in parallel, so keep the job count modest.
const workers = Math.max(1, Math.min(4, Math.ceil(availableParallelism() / 2)));
async function runAll(jobs: Job[]) {
  const queue = [...jobs];
  await Promise.all(
    Array.from({ length: workers }, async () => {
      for (let job = queue.shift(); job; job = queue.shift()) {
        try {
          const day = await getDay(job.date, job.calendar, job.version, job.lang, { refresh });
          done++;
          if (done % 25 === 0 || total <= 30) {
            console.log(`[${done}/${total}] ${job.date} ${job.calendar} ${job.version} ${job.lang}  ${day.header.title}`);
          }
        } catch (e) {
          failed++;
          console.error(`FAILED ${job.date} ${job.calendar} ${job.version} ${job.lang}: ${(e as Error).message}`);
        }
      }
    }),
  );
}
await runAll(first);
await runAll(rest);
const secs = Math.round((Date.now() - started) / 1000);
console.log(`Built ${done}/${total} day files in ${secs}s${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed ? 1 : 0);
