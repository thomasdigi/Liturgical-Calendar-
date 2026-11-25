/**
 * Assembles a static site in dist/: the viewer (web/) plus everything built in data/,
 * and data/available.json describing what's there so the viewer can grey out the rest.
 *   npm run build -- 2026-12-01 2027-02-28 --calendar general --version 1962 --lang en,fr
 *   npm run site
 * Any static host works (GitHub Pages: see .github/workflows/pages.yml).
 */
import { cp, mkdir, readdir, rm, stat, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { publicConfig } from '../src/config.ts';
import { DATA_DIR } from '../src/day.ts';

const ROOT = resolve(import.meta.dirname, '..');
const DIST = resolve(ROOT, 'dist');
const ls = async (p: string) => (existsSync(p) ? (await readdir(p, { withFileTypes: true })).filter((d) => d.isDirectory()).map((d) => d.name) : []);

await rm(DIST, { recursive: true, force: true });
await mkdir(resolve(DIST, 'data'), { recursive: true });
await cp(resolve(ROOT, 'web'), DIST, { recursive: true });
// Chant notation (exsurge, MIT License), from Divinum Officium's copy.
await mkdir(resolve(DIST, 'vendor'), { recursive: true });
await cp(resolve(ROOT, 'vendor/divinum-officium/web/www/js/exsurge.js'), resolve(DIST, 'vendor/exsurge.js'));

// What was built: per calendar/version, the languages and dates that have a day index.
const combos: Record<string, string[]> = {};
let first = '';
let last = '';
for (const cal of await ls(DATA_DIR))
  for (const ver of await ls(resolve(DATA_DIR, cal))) {
    const langs: string[] = [];
    for (const lang of await ls(resolve(DATA_DIR, cal, ver))) {
      if (lang === 'latin' || lang === 'summary') continue;
      let any = false;
      for (const year of await ls(resolve(DATA_DIR, cal, ver, lang)))
        for (const md of await ls(resolve(DATA_DIR, cal, ver, lang, year))) {
          if (!existsSync(resolve(DATA_DIR, cal, ver, lang, year, md, 'index.json'))) continue;
          const date = `${year}-${md}`;
          any = true;
          if (!first || date < first) first = date;
          if (!last || date > last) last = date;
        }
      if (any) langs.push(lang);
    }
    if (langs.length) combos[`${cal}/${ver}`] = langs.sort();
  }
if (!first) {
  console.error('Nothing built yet. Run `npm run build -- <dates> …` first.');
  process.exit(1);
}

await cp(DATA_DIR, resolve(DIST, 'data'), {
  recursive: true,
  filter: (src) => !src.endsWith('.tmp'),
});
await writeFile(resolve(DIST, 'data/config.json'), JSON.stringify(publicConfig()));
await writeFile(resolve(DIST, 'data/available.json'), JSON.stringify({ first, last, combos }));

let bytes = 0;
let files = 0;
async function du(p: string) {
  for (const d of await readdir(p, { withFileTypes: true })) {
    const q = resolve(p, d.name);
    if (d.isDirectory()) await du(q);
    else {
      files++;
      bytes += (await stat(q)).size;
    }
  }
}
await du(DIST);
console.log(`dist/: ${files} files, ${(bytes / 1e6).toFixed(1)} MB; dates ${first} to ${last}; ${Object.keys(combos).length} calendar/version pair(s).`);
