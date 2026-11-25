/**
 * Assembles a static site in dist/: the viewer (web/) plus everything built in data/,
 * and data/available.json describing what's there so the viewer can grey out the rest.
 *   npm run build -- 2026-12-01 2027-02-28 --calendar general --version 1962 --lang en,fr
 *   npm run site
 * Any static host works (GitHub Pages: see .github/workflows/pages.yml).
 */
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { publicConfig } from '../src/config.ts';
import { DATA_DIR } from '../src/day.ts';
import { splitPieces } from '../web/js/packed.js';

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

// ---------- texts stored once (see web/js/packed.js) ----------
// In each language folder (and the shared Latin), every piece of text that occurs more than once
// goes into one pack file; the day files then hold numbers in its place.
const MIN_PIECE = 24; // shorter pieces cost more as a reference than as text
type Part = { pack?: string; latin?: { heading: string; latin: unknown }[]; sections: Record<string, unknown>[] };
/** Every text field of a part file, as [object, key]. */
function* textFields(part: Part): Generator<[Record<string, unknown>, string]> {
  for (const s of part.sections ?? []) for (const k of ['latin', 'vernacular']) if (typeof s[k] === 'string') yield [s, k];
  for (const s of part.latin ?? []) if (typeof s.latin === 'string') yield [s as Record<string, unknown>, 'latin'];
}
async function partFiles(folder: string): Promise<string[]> {
  const out: string[] = [];
  for (const year of await ls(folder)) {
    if (!/^\d{4}$/.test(year)) continue;
    for (const md of await ls(resolve(folder, year))) {
      for (const f of await readdir(resolve(folder, year, md))) if (f.endsWith('.json') && f !== 'index.json') out.push(resolve(folder, year, md, f));
    }
  }
  return out;
}
async function packFolder(folder: string): Promise<{ name: string; before: number; after: number } | null> {
  const files = await partFiles(folder);
  if (!files.length) return null;
  const counts = new Map<string, number>();
  let before = 0;
  for (const f of files) {
    const text = await readFile(f, 'utf8');
    before += text.length;
    for (const [o, k] of textFields(JSON.parse(text))) for (const p of splitPieces(o[k] as string)) counts.set(p, (counts.get(p) ?? 0) + 1);
  }
  // The most used pieces first: they get the shortest numbers.
  const pack = [...counts].filter(([p, n]) => n > 1 && p.length >= MIN_PIECE).sort((a, b) => b[1] - a[1]).map(([p]) => p);
  const index = new Map(pack.map((p, i) => [p, i]));
  const packJson = JSON.stringify(pack);
  const name = `pack-${createHash('sha1').update(packJson).digest('hex').slice(0, 10)}.json`;
  await writeFile(resolve(folder, name), packJson);
  let after = packJson.length;
  for (const f of files) {
    const part = JSON.parse(await readFile(f, 'utf8')) as Part;
    for (const [o, k] of textFields(part)) {
      const items: (string | number)[] = [];
      for (const p of splitPieces(o[k] as string)) {
        const i = index.get(p);
        if (i !== undefined) items.push(i);
        else if (typeof items.at(-1) === 'string') items[items.length - 1] += p; // join neighbouring own text
        else items.push(p);
      }
      o[k] = items.length === 1 && typeof items[0] === 'string' ? items[0] : items;
    }
    part.pack = name;
    const out = JSON.stringify(part);
    after += out.length;
    await writeFile(f, out);
  }
  return { name, before, after };
}

const packs: Record<string, Record<string, string>> = {};
let packedBefore = 0;
let packedAfter = 0;
for (const combo of Object.keys(combos)) {
  const [cal, ver] = combo.split('/');
  packs[combo] = {};
  for (const folder of await ls(resolve(DIST, 'data', cal, ver))) {
    if (folder === 'summary') continue;
    const r = await packFolder(resolve(DIST, 'data', cal, ver, folder));
    if (!r) continue;
    packs[combo][folder] = r.name;
    packedBefore += r.before;
    packedAfter += r.after;
  }
}
console.log(`Texts stored once: ${(packedBefore / 1e6).toFixed(1)} MB of day files became ${(packedAfter / 1e6).toFixed(1)} MB.`);

await writeFile(resolve(DIST, 'data/available.json'), JSON.stringify({ first, last, combos, packs }));

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
