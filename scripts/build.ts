/**
 * Pre-builds days into data/YYYY/MM-DD.json.
 *   npm run build -- 2026              whole year
 *   npm run build -- 2026-12-01 2026-12-31
 *   add --refresh to rebuild cached days
 */
import { availableParallelism } from 'node:os';
import { getDay } from '../src/day.ts';

const args = process.argv.slice(2);
const refresh = args.includes('--refresh');
const pos = args.filter((a) => !a.startsWith('--'));

let [from, to] = pos;
if (!from) {
  console.error('Usage: npm run build -- <year> | <from YYYY-MM-DD> <to YYYY-MM-DD> [--refresh]');
  process.exit(1);
}
if (/^\d{4}$/.test(from)) [from, to] = [`${from}-01-01`, `${from}-12-31`];
to ??= from;

const dates: string[] = [];
for (let d = new Date(`${from}T12:00:00Z`); d <= new Date(`${to}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + 1)) {
  dates.push(d.toISOString().slice(0, 10));
}

let done = 0;
let failed = 0;
const workers = Math.max(1, Math.min(8, availableParallelism()));
const queue = [...dates];
await Promise.all(
  Array.from({ length: workers }, async () => {
    for (let date = queue.shift(); date; date = queue.shift()) {
      try {
        const day = await getDay(date, { refresh });
        done++;
        if (done % 30 === 0 || dates.length < 40) console.log(`${date}  ${day.header.title}`);
      } catch (e) {
        failed++;
        console.error(`FAILED ${date}: ${(e as Error).message}`);
      }
    }
  }),
);
console.log(`Built ${done}/${dates.length} days${failed ? `, ${failed} failed` : ''}.`);
process.exit(failed ? 1 : 0);
