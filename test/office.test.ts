// Runs DO's real Perl engine, so these are integration tests (~0.3s per page).
import { describe, expect, it } from 'vitest';
import { CALENDARS, doSettings, HOURS, LANGUAGES, publicConfig, VERSIONS, type CalendarId, type LanguageId, type PartId, type VersionId } from '../src/config.ts';
import { parsePage } from '../src/parse.ts';
import { renderPart, toDoDate } from '../src/render.ts';

const page = async (date: string, part: PartId, version: VersionId = '1962', lang: LanguageId = 'en', calendar: CalendarId = 'general') =>
  parsePage(await renderPart(date, part, version, lang, calendar));
const text = (p: Awaited<ReturnType<typeof page>>, col: 'latin' | 'vernacular' = 'latin') =>
  p.sections.map((s) => s[col].replace(/<[^>]+>/g, '')).join(' '); // plain text

describe('toDoDate', () => {
  it('converts ISO to MM-DD-YYYY', () => expect(toDoDate('2026-12-08')).toBe('12-08-2026'));
  it('rejects bad input', () => expect(() => toDoDate('12/08/2026')).toThrow());
});

describe('Immaculate Conception, 2026-12-08, 1962', () => {
  it('has the right header', async () => {
    const o = await page('2026-12-08', 'lauds');
    expect(o.header.title).toMatch(/Conceptione Immaculata/);
    expect(o.header.rank).toBe('I. classis');
    expect(o.header.color).toBe('white');
    expect(o.header.commemorations.join()).toMatch(/Adventus/);
  });

  it.each(HOURS.map((h) => [h.id, h.latin] as const))('%s renders with Latin and English', async (id, latin) => {
    const o = await page('2026-12-08', id);
    expect(o.title).toBe(latin);
    expect(o.sections.length).toBeGreaterThan(4);
    for (const s of o.sections) {
      expect(s.latin.length).toBeGreaterThan(0);
      expect(s.vernacular.length).toBeGreaterThan(0);
      expect(s.latin).not.toMatch(/<font|style=/i);
      expect(s.latin).not.toMatch(/\{omittitur\}/);
    }
  });

  it('Lauds has the proper antiphon and the Benedictus', async () => {
    const o = await page('2026-12-08', 'lauds');
    expect(text(o)).toMatch(/Tota pulchra/);
    expect(o.sections.some((s) => /Benedictus/.test(s.heading.latin))).toBe(true);
  });

  it('Vespers has the Magnificat, Compline the Nunc dimittis', async () => {
    expect((await page('2026-12-08', 'vespers')).sections.some((s) => /Magnificat/.test(s.heading.latin))).toBe(true);
    expect((await page('2026-12-08', 'compline')).sections.some((s) => /Nunc dimittis/.test(s.heading.latin))).toBe(true);
  });

  it('Matins has the invitatory and lessons', async () => {
    const o = await page('2026-12-08', 'matins');
    expect(o.sections.some((s) => /Invitatorium/.test(s.heading.latin))).toBe(true);
    expect(text(o)).toMatch(/Lectio/);
  });
});

describe('Mass propers', () => {
  it('gives only the propers, in order', async () => {
    const m = await page('2026-12-08', 'mass');
    expect(m.title).toBe('Sancta Missa');
    const heads = m.sections.map((s) => s.heading.latin).filter(Boolean);
    for (const h of ['Introitus', 'Oratio', 'Lectio', 'Graduale', 'Evangelium', 'Offertorium', 'Secreta', 'Communio', 'Postcommunio']) {
      expect(heads).toContain(h);
    }
    expect(heads.indexOf('Introitus')).toBeLessThan(heads.indexOf('Evangelium'));
    expect(heads).not.toContain('Canon');
    expect(heads).not.toContain('Kyrie');
    expect(text(m)).toMatch(/Gaudens gaudébo/);
  });

  it('works for every version that has a Mass', async () => {
    for (const v of VERSIONS.filter((x) => x.mass)) {
      const m = await page('2026-12-08', 'mass', v.id);
      expect(m.sections.some((s) => s.heading.latin === 'Evangelium')).toBe(true);
    }
  });
});

describe('versions', () => {
  // DO silently uses its default version for a name it doesn't know, so check each one took.
  it.each(VERSIONS.map((v) => [v.id, v.office, v.mass] as const))('%s renders as itself', async (id, office, mass) => {
    expect((await page('2026-12-08', 'lauds', id)).versionShown).toBe(office);
    if (!mass) return; // the Office only (Dominican, Monastic)
    expect((await page('2026-12-08', 'mass', id)).versionShown).toBe(mass);
    expect((await page('2026-12-08', 'massFull', id)).versionShown).toBe(mass);
  });
  it('the Dominican and Monastic versions have the Office only (DO has no Missal for them)', async () => {
    const { buildDay } = await import('../src/day.ts');
    for (const v of ['op1962', 'm1963'] as const) {
      const day = await buildDay('2026-11-14', 'general', v, 'en');
      expect(day.parts.some((p) => p.id.startsWith('mass'))).toBe(false);
      expect(day.parts.some((p) => p.id === 'lauds')).toBe(true);
    }
  });
  it('Monastic Matins on a Sunday: three Nocturns, twelve lessons, canticles in the third', async () => {
    const o = await page('2026-11-15', 'matins', 'm1963');
    const rubrics = o.sections.flatMap((s) => [...s.latin.matchAll(/<span class="rubric[^"]*">([^<]*)<\/span>/g)].map((m) => m[1].trim()));
    expect(rubrics.filter((r) => /^Nocturnus [IV]+$/.test(r))).toEqual(['Nocturnus I', 'Nocturnus II', 'Nocturnus III']);
    expect(rubrics.filter((r) => /^Lectio \d+$/.test(r)).length).toBe(12);
    expect(rubrics.some((r) => /^Canticum/.test(r))).toBe(true);
  });
  it('1954 uses Divino Afflatu ranks', async () => {
    expect((await page('2026-12-08', 'lauds', '1954')).header.rank).toBe('Duplex I. classis');
  });
  it('1906 uses the old ranks', async () => {
    const o = await page('2026-12-08', 'lauds', '1906');
    expect(o.header.rank).toBe('Duplex I. classis');
  });
  it('1906 and 1962 differ on an ordinary Sunday', async () => {
    // 1906 still has Prime's long form, different ranks, etc. Compare raw sections.
    const [a, b] = await Promise.all([page('2026-11-22', 'prime', '1962'), page('2026-11-22', 'prime', '1906')]);
    expect(text(a)).not.toBe(text(b));
  });
});

describe('languages', () => {
  it.each(LANGUAGES.map((l) => [l.id] as const))('%s: Office has text in the second column', async (lang) => {
    const o = await page('2026-12-08', 'lauds', '1962', lang);
    expect(text(o, 'vernacular').length).toBeGreaterThan(500);
  });
  it('French and German Office are really translated', async () => {
    expect(text(await page('2026-12-08', 'lauds', '1962', 'fr'), 'vernacular')).toMatch(/Marie/);
    expect(text(await page('2026-12-08', 'lauds', '1962', 'de'), 'vernacular')).toMatch(/Maria/);
  });
  it('Hebrew is marked right-to-left, and full Mass availability follows DO', () => {
    const langs = publicConfig().languages;
    expect(langs.find((l) => l.id === 'he')?.rtl).toBe(true);
    expect(langs.find((l) => l.id === 'en')?.fullMass).toBe(true);
    expect(langs.find((l) => l.id === 'fr')?.fullMass).toBe(true);
    expect(langs.find((l) => l.id === 'he')?.fullMass).toBe(false);
    expect(langs.find((l) => l.id === 'da')?.fullMass).toBe(false);
  });
  it('French Mass collect is in French', async () => {
    expect(text(await page('2026-12-08', 'mass', '1962', 'fr'), 'vernacular')).toMatch(/Prions/);
  });
});

describe('full Mass', () => {
  it('includes the Ordinary around the propers', async () => {
    const m = await page('2026-12-08', 'massFull');
    const heads = m.sections.map((s) => s.heading.latin.trim()).filter(Boolean);
    for (const h of ['Incipit', 'Introitus', 'Kyrie', 'Evangelium', 'Canon', 'Communio', 'Postcommunio']) expect(heads).toContain(h);
    expect(text(m)).toMatch(/Te ígitur/);
    expect(text(m)).toMatch(/Gaudens gaudébo/);
  });
});

describe('liturgical colours', () => {
  it.each([
    ['2026-12-13', 'rose'], // Gaudete Sunday
    ['2027-03-26', 'black'], // Good Friday
    ['2026-12-26', 'red'], // St Stephen
    ['2026-11-22', 'green'], // Sunday after Pentecost
    ['2026-12-01', 'violet'], // Advent feria
  ] as const)('%s is %s', async (date, color) => {
    expect((await page(date, 'lauds')).header.color).toBe(color);
  });
});

describe('heading detection', () => {
  it('does not mistake initials or "N." for headings', async () => {
    for (const [date, part] of [['2026-04-03', 'compline'], ['2026-04-25', 'lauds'], ['2026-12-08', 'mass']] as const) {
      const o = await page(date, part);
      for (const s of o.sections) expect(s.heading.latin.length === 0 || s.heading.latin.length > 2).toBe(true);
    }
  });
});

describe('Gloria and Credo markers', () => {
  it('appear on a feast, not on an Advent feria', async () => {
    const heads = async (d: string) => (await page(d, 'mass')).sections.map((s) => s.heading.latin.trim());
    expect(await heads('2026-12-08')).toEqual(expect.arrayContaining(['Gloria', 'Credo']));
    const feria = await heads('2026-12-01');
    expect(feria).not.toContain('Gloria');
    expect(feria).not.toContain('Credo');
  });
});

describe('calendars', () => {
  it('USA exists only for 1962 and renders as DO\'s USA version', async () => {
    expect(doSettings('usa', '1954')).toBeNull();
    expect(doSettings('usa', '1906')).toBeNull();
    expect(publicConfig().calendars.find((c) => c.id === 'usa')?.versions).toEqual(['1962']);
    const o = await page('2026-12-12', 'lauds', '1962', 'en', 'usa');
    expect(o.versionShown).toBe('Rubrics 1960 - 2020 USA');
    expect(o.header.title).toMatch(/Guadalupe/);
    expect((await page('2026-12-12', 'mass', '1962', 'en', 'usa')).versionShown).toBe('Rubrics 1960 Newcalendar');
  });
  it('General calendar keeps the Advent feria on Dec 12', async () => {
    expect((await page('2026-12-12', 'lauds')).header.title).toMatch(/Adventus/);
  });
  it.each(['1962', '1954', '1906'] as const)('Brazil keeps Our Lady of Aparecida on Oct 12 (%s)', async (v) => {
    expect((await page('2026-10-12', 'lauds', v, 'en', 'brazil')).header.title).toMatch(/Apparecida/);
    expect((await page('2026-10-12', 'mass', v, 'en', 'brazil')).header.title).toMatch(/Apparecida/);
  });
  it('every calendar/version pair that exists renders', async () => {
    for (const c of CALENDARS) for (const v of VERSIONS) {
      if (!doSettings(c.id, v.id)) continue;
      const o = await page('2026-12-09', 'vespers', v.id, 'en', c.id);
      expect(o.sections.length, `${c.id} ${v.id}`).toBeGreaterThan(4);
    }
  });
});

describe('Bea psalter', () => {
  it('is offered for the Office only', () => {
    const bea = publicConfig().languages.find((l) => l.id === 'la-bea')!;
    expect(bea.office).toBe(true);
    expect(bea.mass).toBe(false);
  });
  it('uses the Bea psalms, and the standard Latin elsewhere', async () => {
    const o = await page('2026-12-08', 'lauds', '1962', 'la-bea');
    const psalm = o.sections.find((s) => /Psalmus 99/.test(s.latin))!;
    expect(psalm.vernacular.replace(/<[^>]+>/g, '')).not.toBe(psalm.latin.replace(/<[^>]+>/g, '')); // Bea text differs
    const prayer = o.sections.find((s) => s.heading.latin === 'Oratio')!;
    expect(prayer.vernacular).toBe(prayer.latin); // no Bea text: standard Latin
  });
});

describe('fallback marking', () => {
  it('flags English lines in a partial translation, and nothing in English itself', async () => {
    const { getDay } = await import('../src/day.ts');
    const de = await getDay('2026-12-08', 'general', '1962', 'de', { refresh: true });
    const mass = de.parts.find((p) => p.id === 'mass')!;
    expect(mass.sections.some((s) => s.fallback?.length)).toBe(true); // German Mass propers are mostly English
    const fr = await getDay('2026-12-08', 'general', '1962', 'fr', { refresh: true });
    expect(fr.parts.find((p) => p.id === 'lauds')!.sections.filter((s) => s.fallback).length).toBe(0);
    const en = await getDay('2026-12-08', 'general', '1962', 'en');
    expect(en.parts.every((p) => p.sections.every((s) => !s.fallback))).toBe(true);
  });
});

describe('month summary', () => {
  it('lists every day with its feast and fasting', async () => {
    const { getMonth } = await import('../src/summary.ts');
    const m = await getMonth('general', '1962', '2026-12', { refresh: true });
    expect(m.days).toHaveLength(31);
    const d = (n: number) => m.days[n - 1];
    expect(d(8).title).toMatch(/Conceptione Immaculata/);
    expect(d(18).fasting.reasons).toContain('Ember day'); // Ember Friday, found from DO's own title
    expect(d(4).fasting).toMatchObject({ fast: false, abstinence: true });
    expect(d(25).fasting).toMatchObject({ fast: false, abstinence: false });
  });
});

describe('days with several Masses', () => {
  const intro = (d: { parts: { id: string; sections: { heading: { latin: string }; latin: string }[] }[] }, id: string) =>
    d.parts.find((p) => p.id === id)!.sections.find((s) => s.heading.latin === 'Introitus')!.latin.replace(/<[^>]+>/g, '');
  it('Christmas has its three Masses, each with its own propers', async () => {
    const { getDay } = await import('../src/day.ts');
    const d = await getDay('2026-12-25', 'general', '1962', 'en', { refresh: true });
    expect(d.masses.map((m) => m.label)).toEqual(['Missa prima', 'Missa secunda', 'Missa tertia']);
    expect(d.masses[0].title).toMatch(/nocte/);
    expect(intro(d, 'mass')).toMatch(/Dóminus dixit ad me/);
    expect(intro(d, 'mass-2')).toMatch(/Lux fulgébit/);
    expect(intro(d, 'mass-3')).toMatch(/Puer natus est/);
    expect(d.parts.some((p) => p.id === 'massFull-3')).toBe(true);
  });
  it('All Souls has three Masses', async () => {
    const { buildPart } = await import('../src/day.ts');
    expect((await buildPart('2026-11-02', 'mass', '1962', 'en')).masses).toHaveLength(3);
  });
  it('Holy Thursday offers the Chrism Mass or the Mass of the Lord\'s Supper', async () => {
    const { buildPart } = await import('../src/day.ts');
    const names = (await buildPart('2027-03-25', 'mass', '1962', 'en')).masses.join(' | ');
    expect(names).toMatch(/chrismatis/i);
    expect(names).toMatch(/coena/i);
  });
  it('an ordinary day has no choice', async () => {
    const { buildPart } = await import('../src/day.ts');
    expect((await buildPart('2026-12-09', 'mass', '1962', 'en')).masses).toEqual([]);
  });
});

describe('storage', () => {
  it('splits a day into parts with shared Latin, and reads it back unchanged', async () => {
    const { buildDay, writeDay, readDay } = await import('../src/day.ts');
    const { existsSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const built = await buildDay('2026-12-08', 'general', '1962', 'fr');
    await writeDay(built);
    const read = await readDay('2026-12-08', 'general', '1962', 'fr');
    expect(read).toEqual(JSON.parse(JSON.stringify(built)));
    const dir = resolve(import.meta.dirname, '../data/general/1962');
    expect(existsSync(resolve(dir, 'fr/2026/12-08/lauds.json'))).toBe(true);
    expect(existsSync(resolve(dir, 'latin/2026/12-08/lauds.json'))).toBe(true);
  });
});

describe('commemorations and suffrages', () => {
  it('labels a commemoration in the Office and the Mass, in both columns', async () => {
    for (const part of ['lauds', 'mass'] as const) {
      const o = await page('2026-12-10', part, '1962', 'de');
      const la = o.sections.flatMap((s) => [...s.latin.matchAll(/data-kind="commemoration">([^<]*)/g)].map((m) => m[1]));
      const vn = o.sections.flatMap((s) => [...s.vernacular.matchAll(/data-kind="commemoration">([^<]*)/g)].map((m) => m[1]));
      expect(la[0]).toMatch(/Commemoratio S\. Melchiadis/);
      expect(vn[0]).toMatch(/Melchiades/);
    }
  });
  it('labels each suffrage (1906 Vespers)', async () => {
    const o = await page('2026-10-26', 'vespers', '1906', 'en');
    const labels = o.sections.flatMap((s) => [...s.latin.matchAll(/data-kind="suffrage">([^<]*)/g)].map((m) => m[1]));
    expect(labels).toEqual(expect.arrayContaining(['De cruce', 'De Beata Maria', 'De Pace']));
  });
  it('does not label instructions that merely mention a commemoration', async () => {
    const o = await page('2026-10-26', 'lauds', '1954', 'en');
    expect(o.sections.some((s) => /data-kind/.test(s.latin))).toBe(false);
  });
});

describe('votive offices', () => {
  it('Office of the Dead has Matins, Lauds and Vespers', async () => {
    const { votiveHours } = await import('../src/config.ts');
    expect(votiveHours('dead', '2026-12-10')).toEqual(['matins', 'lauds', 'vespers']);
    const { buildPart } = await import('../src/day.ts');
    const p = await buildPart('2026-12-10', 'lauds', '1962', 'en', 'general', 1, 'dead');
    expect(p.id).toBe('dead-lauds');
    expect(p.header.title).toMatch(/Defunctorum/);
  });
  it('Little Office follows the season', async () => {
    const { buildPart } = await import('../src/day.ts');
    expect((await buildPart('2026-12-10', 'vespers', '1962', 'en', 'general', 1, 'parvum')).header.title).toMatch(/Parvum.*Adventus/);
  });
  it('Our Lady on Saturday only on Saturdays', async () => {
    const { votiveHours } = await import('../src/config.ts');
    expect(votiveHours('sabbato', '2026-12-10')).toEqual([]);
    expect(votiveHours('sabbato', '2026-12-12')).toHaveLength(8);
    const { buildPart } = await import('../src/day.ts');
    expect((await buildPart('2026-12-12', 'lauds', '1962', 'en', 'general', 1, 'sabbato')).header.title).toMatch(/Mariæ Sabbato/);
  });
});

describe('search index', () => {
  it('plain text drops markup, verse numbers and notes', async () => {
    const { plainText } = await import('../src/search.ts');
    expect(plainText('<p class="note">{x}</p><span class="verse">92:1</span> Dóminus <span class="rubric">℣.</span> regnávit<br>est'))
      .toBe('Dóminus ℣. regnávit est');
  });
  it('indexes the Mass and the Hours of each built day, not the Ordinary or votive offices', async () => {
    const { buildSearchMonth, entryText } = await import('../src/search.ts');
    const { getDay } = await import('../src/day.ts');
    await getDay('2026-12-10', 'general', '1962', 'en');
    const { latin, vernacular } = await buildSearchMonth('general', '1962', 'en', '2026-12', { onlyBuilt: true });
    const parts = Object.keys(latin.days['10']);
    expect(parts).toContain('mass');
    expect(parts).toContain('lauds');
    expect(parts).not.toContain('massFull');
    expect(parts.some((p) => p.startsWith('dead-'))).toBe(false);
    expect(latin.days['10'].lauds.map((e) => entryText(latin, e)).join(' ')).toMatch(/Melchiadis/);
    expect(vernacular.days['10'].lauds.map((e) => entryText(vernacular, e)).join(' ')).toMatch(/Melchiades/);
    // Pieces that recur (psalms, the Gloria Patri) are stored once in the month's texts.
    expect(new Set(latin.texts).size).toBe(latin.texts.length);
  });
});
