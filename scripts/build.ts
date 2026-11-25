/**
 * Pre-builds days into data/<calendar>/<version>/<lang>/YYYY/MM-DD.json, plus data/config.json.
 *   npm run build -- 2026                                   whole year, everything
 *   npm run build -- 2026-12-01 2026-12-31
 *   npm run build -- 2026 --calendar general,usa --version 1962 --lang en,fr
 *   add --refresh to rebuild days that are already cached
 * Calendar/version pairs that don't exist (e.g. USA 1906) are skipped.
 * Days already in data/ are kept, not built again (unless --refresh).
 *   add --prune to delete everything else from data/ afterwards: days outside the dates, and
 *   calendars, versions and languages not asked for (the publishing workflow keeps data/
 *   between runs, so only new days are built; --prune stops it from growing).
 */
import { mkdir, readdir, rm, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { availableParallelism } from 'node:os';
import { resolve } from 'node:path';
import {
  CALENDARS,
  doSettings,
  FALLBACK_LANGUAGE,
  getCalendar,
  getLanguage,
  getVersion,
  isChant,
  LANGUAGES,
  publicConfig,
  VERSIONS,
  type CalendarId,
  type LanguageId,
  type VersionId,
} from '../src/config.ts';
import { DATA_DIR, getDay, indexPath } from '../src/day.ts';
import { getMonth } from '../src/summary.ts';
import { buildSearchMonth } from '../src/search.ts';
import { buildIcs } from '../src/ical.ts';

const args = process.argv.slice(2);
const FLAGS = ['--calendar', '--version', '--lang', '--votive'];
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const refresh = args.includes('--refresh');
const prune = args.includes('--prune');
// Votive offices to build with each day (default all): --votive dead,parvum,sabbato | none
if (flag('votive')) process.env.VOTIVES = flag('votive');
const pos = args.filter((a, i) => !a.startsWith('--') && !FLAGS.includes(args[i - 1]));

let [from, to] = pos;
if (!from) {
  console.error(
    'Usage: npm run build -- <year> | <from YYYY-MM-DD> <to YYYY-MM-DD> [--calendar general,usa,brazil] [--version 1962,1954,1906] [--lang en,fr,...] [--votive dead,parvum,sabbato|none] [--refresh]',
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
let reused = 0; // days already in data/ (kept from an earlier build)
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
          if (!refresh && existsSync(indexPath(job.date, job.calendar, job.version, job.lang))) reused++;
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

// Month summaries (for the month view and week strip), one per calendar/version/month.
// The week strip can reach into the next or previous month, so include those too.
const months = new Set<string>();
for (let d = new Date(`${from}T12:00:00Z`); d <= new Date(`${to}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
  for (const k of [-6, 0, 6]) {
    const x = new Date(d);
    x.setUTCDate(x.getUTCDate() + k);
    months.add(x.toISOString().slice(0, 7));
  }
}
for (const calendar of calendars)
  for (const version of versions) {
    if (!doSettings(calendar, version)) continue;
    for (const month of [...months].sort()) {
      try {
        await getMonth(calendar, version, month, { refresh });
      } catch (e) {
        failed++;
        console.error(`FAILED summary ${calendar} ${version} ${month}: ${(e as Error).message}`);
      }
    }
  }
console.log(`Month summaries: ${months.size} month(s) per calendar/version.`);

// Search index: for each month in the range, from the days just built (English first: it writes the Latin).
const rangeMonths = new Set<string>();
for (let d = new Date(`${from}T12:00:00Z`); d <= new Date(`${to}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
  rangeMonths.add(d.toISOString().slice(0, 7));
}
// (Not the chant edition: its text is musical notation.)
const searchLangs = [...new Set([FALLBACK_LANGUAGE as LanguageId, ...langs])].filter((l) => !isChant(l));
for (const calendar of calendars)
  for (const version of versions) {
    if (!doSettings(calendar, version)) continue;
    for (const month of rangeMonths)
      for (const lang of searchLangs) {
        try {
          await buildSearchMonth(calendar, version, lang, month, { onlyBuilt: true });
        } catch (e) {
          failed++;
          console.error(`FAILED search ${calendar} ${version} ${lang} ${month}: ${(e as Error).message}`);
        }
      }
  }
console.log(`Search index: ${rangeMonths.size} month(s) × ${searchLangs.length} language(s) per calendar/version.`);

// Calendar files for phone/computer calendars (all days, and fast days only), for the built months.
// SITE_URL (set by the publishing workflow) lets each event link back to its day.
for (const calendar of calendars)
  for (const version of versions) {
    if (!doSettings(calendar, version)) continue;
    const days = [];
    for (const month of [...rangeMonths].sort()) {
      try {
        days.push(...(await getMonth(calendar, version, month)).days);
      } catch (e) {
        failed++;
        console.error(`FAILED calendar file ${calendar} ${version} ${month}: ${(e as Error).message}`);
      }
    }
    for (const kind of ['calendar', 'fasting'] as const) {
      await writeFile(resolve(DATA_DIR, calendar, version, `${kind}.ics`), buildIcs(days, { calendar, version, kind, siteUrl: process.env.SITE_URL }));
    }
  }
console.log('Calendar files: calendar.ics and fasting.ics per calendar/version.');
// --prune: keep only what this build asked for (see the top of this file).
if (prune) {
  const dirs = async (p: string) => (existsSync(p) ? (await readdir(p, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name) : []);
  const keepMonths = new Set([...months, ...rangeMonths]);
  let removed = 0;
  const remove = async (p: string) => { await rm(p, { recursive: true, force: true }); removed++; };
  for (const cal of await dirs(DATA_DIR)) {
    for (const ver of await dirs(resolve(DATA_DIR, cal))) {
      const base = resolve(DATA_DIR, cal, ver);
      if (!calendars.includes(cal as CalendarId) || !versions.includes(ver as VersionId)) { await remove(base); continue; }
      for (const folder of await dirs(base)) {
        const dir = resolve(base, folder);
        if (folder === 'summary') continue;
        if (folder !== 'latin' && !langs.includes(folder as LanguageId)) { await remove(dir); continue; }
        for (const year of (await dirs(dir)).filter((y) => /^\d{4}$/.test(y)))
          for (const md of await dirs(resolve(dir, year))) {
            const date = `${year}-${md}`;
            if (date < from || date > to) await remove(resolve(dir, year, md));
          }
        for (const f of existsSync(resolve(dir, 'search')) ? await readdir(resolve(dir, 'search')) : [])
          if (!keepMonths.has(f.replace(/\.json$/, ''))) await remove(resolve(dir, 'search', f));
      }
      for (const f of existsSync(resolve(base, 'summary')) ? await readdir(resolve(base, 'summary')) : [])
        if (!keepMonths.has(f.replace(/\.json$/, ''))) await remove(resolve(base, 'summary', f));
    }
  }
  console.log(`Pruned: ${removed} old day folder(s) or file(s) removed from data/.`);
}

const secs = Math.round((Date.now() - started) / 1000);
console.log(`Built ${done}/${total} day files in ${secs}s (${reused} kept from before, ${done - reused} new)${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed ? 1 : 0);
