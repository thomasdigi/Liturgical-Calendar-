// The app's own languages (web/js/ui.js): every text the app shows has its translation.
import { describe, expect, it } from 'vitest';
import { allStrings } from '../scripts/ui-strings.ts';
import { readTable } from '../scripts/ui-build.ts';

describe('translations of the app', () => {
  const { langs, rows } = readTable();
  const table = new Map(rows.map((r) => [r[0], r]));
  it.each(langs.filter((l) => l !== 'en'))('%s has every text', (lang) => {
    const i = langs.indexOf(lang);
    const missing = allStrings().filter((s) => !table.get(s)?.[i]);
    expect(missing).toEqual([]);
  });
  it('keeps the {placeholders} of the English', () => {
    for (const r of rows) {
      const want = (r[0].match(/\{\w+\}/g) ?? []).sort();
      for (const x of r.slice(1)) expect((x.match(/\{\w+\}/g) ?? []).sort(), `${r[0]} → ${x}`).toEqual(want);
    }
  });
  it('the app files are up to date with the table (npm run translations)', async () => {
    for (const lang of langs.filter((l) => l !== 'en')) {
      const dict = (await import(`../web/js/ui/${lang}.js`)).default;
      const i = langs.indexOf(lang);
      expect(Object.keys(dict).length).toBe(rows.filter((r) => r[i]).length);
    }
  });
});
