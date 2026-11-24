/**
 * Pre-builds days into data/<version>/<lang>/YYYY/MM-DD.json, plus data/config.json.
 *   npm run build -- 2026                              whole year, every version and language
 *   npm run build -- 2026-12-01 2026-12-31
 *   npm run build -- 2026 --version 1962 --lang en,fr
 *   add --refresh to rebuild days that are already cached
 */
import { mkdir, writeFile } from 'node:fs/promises';
import { availableParallelism } from 'node:os';
import { resolve } from 'node:path';
import { getLanguage, getVersion, LANGUAGES, publicConfig, VERSIONS, type LanguageId, type VersionId } from '../src/config.ts';
import { DATA_DIR, getDay } from '../src/day.ts';

const args = process.argv.slice(2);
const flag = (name: string) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 ? args[i + 1] : undefined;
};
const refresh = args.includes('--refresh');
const pos = args.filter((a, i) => !a.startsWith('--') && !['--version', '--lang'].includes(args[i - 1]));

let [from, to] = pos;
if (!from) {
  console.error('Usage: npm run build -- <year> | <from YYYY-MM-DD> <to YYYY-MM-DD> [--version 1962,1906] [--lang en,fr,de] [--refresh]');
  process.exit(1);
}
if (/^\d{4}$/.test(from)) [from, to] = [`${from}-01-01`, `${from}-12-31`];
to ??= from;

const versions = (flag('version')?.split(',') ?? VERSIONS.map((v) => v.id)).map((id) => getVersion(id).id) as VersionId[];
const langs = (flag('lang')?.split(',') ?? LANGUAGES.map((l) => l.id)).map((id) => getLanguage(id).id) as LanguageId[];

await mkdir(DATA_DIR, { recursive: true });
await writeFile(resolve(DATA_DIR, 'config.json'), JSON.stringify(publicConfig()));

const jobs: { date: string; version: VersionId; lang: LanguageId }[] = [];
for (let d = new Date(`${from}T12:00:00Z`); d <= new Date(`${to}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
  const date = d.toISOString().slice(0, 10);
  for (const version of versions) for (const lang of langs) jobs.push({ date, version, lang });
}

let done = 0;
let failed = 0;
const started = Date.now();
// Each job runs the 9 parts in parallel, so keep the job count modest.
const workers = Math.max(1, Math.min(4, Math.ceil(availableParallelism() / 2)));
const queue = [...jobs];
await Promise.all(
  Array.from({ length: workers }, async () => {
    for (let job = queue.shift(); job; job = queue.shift()) {
      try {
        const day = await getDay(job.date, job.version, job.lang, { refresh });
        done++;
        if (done % 25 === 0 || jobs.length <= 30) {
          console.log(`[${done}/${jobs.length}] ${job.date} ${job.version} ${job.lang}  ${day.header.title}`);
        }
      } catch (e) {
        failed++;
        console.error(`FAILED ${job.date} ${job.version} ${job.lang}: ${(e as Error).message}`);
      }
    }
  }),
);
const secs = Math.round((Date.now() - started) / 1000);
console.log(`Built ${done}/${jobs.length} day files in ${secs}s${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed ? 1 : 0);
