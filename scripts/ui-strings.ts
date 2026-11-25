/**
 * Every piece of English the app shows (for its translations in web/js/ui/*.js):
 *   - the page's own text (web/index.html), found the way web/js/ui.js records it;
 *   - the literal texts the scripts pass to t('…');
 *   - texts that reach t() from data (season names, ranks, colours, Hours, prefaces…), listed below.
 *   npx tsx scripts/ui-strings.ts            lists what each dictionary lacks
 */
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as cheerio from 'cheerio';

const WEB = resolve(import.meta.dirname, '../web');

/** Texts that come from data or are built from parts, and reach t() as variables. */
export const DYNAMIC = [
  // colours, Hours, parts, calendars, versions, votive offices (data/config.json)
  'White', 'Red', 'Green', 'Violet', 'Rose', 'Black',
  'Matins', 'Lauds', 'Prime', 'Terce', 'Sext', 'None', 'Vespers', 'Compline', 'Mass', 'Mass · Propers',
  'General Roman', 'USA', 'Brazil', 'Diocese of Rome', '1962 (Rubrics 1960)', 'Divino Afflatu 1954', 'Tridentine 1906',
  'Office of the Dead', 'Little Office of Our Lady', 'Our Lady on Saturday',
  // fasting (src/fasting.ts)
  'Friday', 'Lent', 'Ash Wednesday', 'Ember day', 'Vigil of Christmas', 'Vigil of the Assumption', 'Vigil of All Saints',
  'Vigil of Pentecost', 'until noon', 'Day of fasting', 'Day of abstinence', 'Partial abstinence: meat at the principal meal only',
  // the year wheel (web/js/wheel.js)
  'Advent', 'Christmas', 'Epiphany', 'Septuagesima', 'Eastertide', 'Pentecost', 'Time after Pentecost',
  'Christmastide', 'Time after Epiphany', 'Octave of Pentecost', 'Holy Week', 'Passiontide',
  // Sacristan page (src/ordo.ts, web/js/sacristan.js)
  'First class', 'Second class', 'Third class', 'Fourth class', 'Double of the first class', 'Double of the second class',
  'Greater double', 'Double', 'Semidouble', 'Simple', 'Greater Sunday', 'Lesser Sunday', 'Feria', 'Semidouble (lesser Sunday)',
  'Common', 'of the Most Holy Trinity', 'of Advent', 'of the Nativity', 'of the Epiphany', 'of Lent', 'of the Holy Cross',
  'of Easter', 'of the Ascension', 'of the Holy Ghost', 'of the Sacred Heart', 'of Christ the King',
  'of the Blessed Virgin Mary', 'of St Joseph', 'of the Apostles', 'of the Dead',
  'Gradual and Tract', 'Tract', 'Gradual and Alleluia', 'Alleluia', 'Gradual',
  'Permitted', 'Restricted', 'Not permitted', 'I or II class day.', 'III class day: only votive Masses of the II class.',
  'IV class day.', 'Double of the I or II class.', 'Double or semidouble: only privileged votive Masses.', 'Simple or feria.',
  'Proper of the Saints', 'Proper of the Season', 'Psalter of the day',
  'No nocturns, {lessons} lessons', 'One nocturn, {lessons} lessons', 'Two nocturns, {lessons} lessons', 'Three nocturns, {lessons} lessons',
  'Rank', 'Liturgical colour', 'Gloria', 'Credo', 'Preface', 'After the Epistle', 'Sequence', 'Commemorations', 'Votive Masses',
  'Masses today', 'Mass of', 'Psalms', 'Te Deum', 'Commemorations at Lauds', 'Preces', 'Suffrage',
  // outline and messages built from parts
  'Lessons', 'Martyrology', 'Fast', 'Abstinence', 'mandatory', 'suggested',
  'Divine Office and Mass',
];

/** The page's text, recorded as web/js/ui.js does (keep SKIP in step with it). */
export function pageStrings(): string[] {
  const SKIP = '#text, #month-list, #week, #results, #feastlist, #sacristan-body, #hours, #masschoice, #outline, #jump, #wheel-svg, #info, select:not([data-t]), [lang="la"], .fp-sample, .initials-demo, .flagmenu-list, script, style, svg';
  const $ = cheerio.load(readFileSync(resolve(WEB, 'index.html'), 'utf8'));
  const out = new Set<string>();
  const squash = (s: string) => s.replace(/\s+/g, ' ').trim();
  const walk = (el: cheerio.Cheerio<any>) => {
    el.contents().each((_, n) => {
      if (n.type === 'text') { if (/\p{L}/u.test(n.data)) out.add(squash(n.data)); return; }
      if (n.type !== 'tag') return;
      const e = $(n);
      if (e.is(SKIP)) return;
      for (const a of ['aria-label', 'title', 'placeholder']) { const v = e.attr(a); if (v && /\p{L}/u.test(v)) out.add(squash(v)); }
      walk(e);
    });
  };
  walk($('body'));
  return [...out];
}

/** Literal texts passed to t() in the scripts. */
export function scriptStrings(): string[] {
  const out = new Set<string>();
  for (const f of readdirSync(resolve(WEB, 'js')).filter((f) => f.endsWith('.js'))) {
    const src = readFileSync(resolve(WEB, 'js', f), 'utf8');
    for (let i = src.indexOf('t('); i >= 0; i = src.indexOf('t(', i + 2)) {
      if (/[\w$.]/.test(src[i - 1] ?? '')) continue; // e.g. split(, set(
      // the call's arguments, up to the matching bracket
      let depth = 0, j = i + 1;
      for (; j < src.length; j++) {
        if (src[j] === '(') depth++;
        else if (src[j] === ')' && --depth === 0) break;
      }
      const args = src.slice(i + 2, j);
      const firstArg = args.split(/,\s*\{\s+/)[0]; // not the { name: value } object ("{name}" in a text has no space)
      for (const m of firstArg.matchAll(/'((?:[^'\\]|\\.)*)'|"((?:[^"\\]|\\.)*)"/g)) {
        const s = (m[1] ?? m[2]).replace(/\\'/g, "'");
        if (/\p{L}/u.test(s)) out.add(s);
      }
    }
  }
  return [...out];
}

/** Picked up by the scan but not text to translate (marks, symbols, values compared in code). */
const NOT_TEXT = new Set(['A', 'F', 'P', 'A+', 'A−', 'English', 'English text', 'Divinum Officium', 'day', 'mass', 'office', 'suffrage']);

export const allStrings = () => [...new Set([...pageStrings(), ...scriptStrings(), ...DYNAMIC])].filter((s) => !NOT_TEXT.has(s)).sort();

if (process.argv[1]?.endsWith('ui-strings.ts')) {
  const all = allStrings();
  console.log(`${all.length} texts.`);
  for (const lang of ['de', 'fr', 'es', 'la']) {
    const dict = (await import(resolve(WEB, 'js/ui', `${lang}.js`))).default as Record<string, string>;
    const missing = all.filter((s) => !(s in dict));
    const extra = Object.keys(dict).filter((k) => !all.includes(k));
    console.log(`${lang}: ${missing.length} missing, ${extra.length} unused`);
    if (process.argv.includes('--list')) { for (const m of missing) console.log('  -', JSON.stringify(m)); for (const x of extra) console.log('  +', JSON.stringify(x)); }
  }
  if (process.argv.includes('--dump')) console.log(JSON.stringify(all, null, 1));
}
