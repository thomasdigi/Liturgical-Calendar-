/**
 * The Scripture readings of the devotions (Via Petri), in each language of the app, taken from
 * public-domain Bibles (the scrollmapper "bible_databases" collection on GitHub):
 *   Latin: Clementine Vulgate · English: Douay-Rheims (Challoner) · German: Grünewald Bible (1924)
 *   French: Crampon (1923) · Spanish: Straubinger (Biblia Platense) · Portuguese: Bíblia Livre
 *
 *   npm run scripture        writes web/js/devotions/readings.js (committed; run again only to change passages)
 *
 * The Bibles are downloaded once into data/bibles/ (not committed).
 */
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
const CACHE = resolve(ROOT, 'data/bibles');
const SOURCE = 'https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json';

export const BIBLES = {
  la: { file: 'VulgClementine', name: 'Biblia Sacra Vulgatae editionis (Clementina)' },
  en: { file: 'DRC', name: 'Douay-Rheims Bible (Challoner)' },
  de: { file: 'GerGruenewald', name: 'Grünewald-Bibel (1924)' },
  fr: { file: 'FreCrampon', name: 'Bible Crampon (1923)' },
  es: { file: 'SpaPlatense', name: 'Biblia Platense (Straubinger)' },
  pt: { file: 'PorBLivre', name: 'Bíblia Livre' },
} as const;

/** The passages: [id, book, chapter, first verse, last verse]. */
export const PASSAGES = [
  ['vp1', 'Matthew', 4, 18, 20],
  ['vp2', 'Matthew', 14, 28, 31],
  ['vp3', 'Matthew', 16, 15, 19],
  ['vp4', 'John', 13, 6, 9],
  ['vp5', 'Matthew', 26, 40, 41],
  ['vp6', 'Luke', 22, 56, 62],
  ['vp7', 'John', 20, 3, 8],
  ['vp8', 'John', 21, 15, 17],
  ['vp9', 'Acts', 2, 36, 41],
  ['vp10', 'Acts', 3, 1, 8],
  ['vp11', 'Acts', 12, 5, 11],
  ['vp12', 'John', 21, 18, 19],
] as const;

type Bible = { books: { name: string; chapters: { chapter: number; verses: { verse: number; text: string }[] }[] }[] };

function bible(file: string): Bible {
  const path = resolve(CACHE, `${file}.json`);
  if (!existsSync(path)) {
    mkdirSync(CACHE, { recursive: true });
    execFileSync('curl', ['-sSfL', '-m', '180', '-o', path, `${SOURCE}/${file}.json`], { stdio: 'inherit' });
  }
  return JSON.parse(readFileSync(path, 'utf8'));
}

/** Small clean-ups of the digitised texts (a missing space after a full stop, stray spaces in quotes). */
const tidy = (s: string) =>
  s.replace(/\s+/g, ' ').replace(/([.,;:!?])(?=[A-ZÀ-ÖØ-Þ])/g, '$1 ').replace(/« /g, '« ').replace(/^" /, '"').trim();

if (import.meta.url === `file://${process.argv[1]}`) {
  const out: Record<string, Record<string, [number, string][]>> = {};
  for (const [lang, { file }] of Object.entries(BIBLES)) {
    const b = bible(file);
    for (const [id, book, ch, v1, v2] of PASSAGES) {
      const chapter = b.books.find((x) => x.name === book)?.chapters.find((c) => c.chapter === ch);
      const verses = chapter?.verses.filter((v) => v.verse >= v1 && v.verse <= v2) ?? [];
      if (verses.length !== v2 - v1 + 1) throw new Error(`${file}: ${book} ${ch}:${v1}-${v2} has ${verses.length} verses`);
      // Crampon's straight quotes as French guillemets: after a full stop, comma, question… it closes
      // a speech (which may have begun before the passage); otherwise it opens one.
      const quotes = (t: string) =>
        lang === 'fr' ? t.replace(/(^|.)\s*"\s*/g, (_q, before: string) => (/[.,;!?]/.test(before) ? `${before} » ` : `${before}${before ? ' ' : ''}« `)).trim() : t;
      (out[id] ??= {})[lang] = verses.map((v) => [v.verse, quotes(tidy(v.text))]);
    }
  }
  const refs = Object.fromEntries(PASSAGES.map(([id, book, ch, v1, v2]) => [id, { book, ch, v1, v2 }]));
  const sources = Object.fromEntries(Object.entries(BIBLES).map(([l, b]) => [l, b.name]));
  const js = `// Written by scripts/scripture.ts (npm run scripture): the devotions' Scripture readings.
// Public-domain Bibles, from github.com/scrollmapper/bible_databases.
export const SOURCES = ${JSON.stringify(sources, null, 2)};
export const REFS = ${JSON.stringify(refs)};
export const READINGS = {
${Object.entries(out).map(([id, l]) => ` ${id}: {\n${Object.entries(l).map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`).join('\n')}\n },`).join('\n')}
};
`;
  mkdirSync(resolve(ROOT, 'web/js/devotions'), { recursive: true });
  writeFileSync(resolve(ROOT, 'web/js/devotions/readings.js'), js);
  console.log(`web/js/devotions/readings.js: ${PASSAGES.length} passages in ${Object.keys(BIBLES).length} languages`);
}
