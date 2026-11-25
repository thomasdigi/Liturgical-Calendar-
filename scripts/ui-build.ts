/**
 * Turns the translation table (translations/app.tsv: one row per English text, a column per
 * language) into the files the app reads (web/js/ui/de.js, fr.js, es.js, la.js).
 *   npm run translations
 * Edit the table (any spreadsheet can open it), then run this. scripts/ui-strings.ts lists
 * texts the table lacks; test/ui.test.ts fails if any is missing.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const ROOT = resolve(import.meta.dirname, '..');
export function readTable(): { langs: string[]; rows: string[][] } {
  const [head, ...lines] = readFileSync(resolve(ROOT, 'translations/app.tsv'), 'utf8').split('\n').filter(Boolean);
  return { langs: head.split('\t'), rows: lines.map((l) => l.split('\t')) };
}

if (process.argv[1]?.endsWith('ui-build.ts')) {
  const { langs, rows } = readTable();
  for (const [i, lang] of langs.entries()) {
    if (lang === 'en') continue;
    const dict = Object.fromEntries(rows.filter((r) => r[i]).map((r) => [r[0], r[i]]));
    writeFileSync(resolve(ROOT, `web/js/ui/${lang}.js`),
      `// Made by scripts/ui-build.ts from translations/app.tsv: edit the table, not this file.\nexport default ${JSON.stringify(dict, null, 1)};\n`);
    console.log(`web/js/ui/${lang}.js: ${Object.keys(dict).length} texts`);
  }
}
