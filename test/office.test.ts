// Runs DO's real Perl engine, so these are integration tests (~0.3s per page).
import { describe, expect, it } from 'vitest';
import { HOURS, LANGUAGES, VERSIONS, type LanguageId, type PartId, type VersionId } from '../src/config.ts';
import { parsePage } from '../src/parse.ts';
import { renderPart, toDoDate } from '../src/render.ts';

const page = async (date: string, part: PartId, version: VersionId = '1962', lang: LanguageId = 'en') =>
  parsePage(await renderPart(date, part, version, lang));
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

  it('works for every version', async () => {
    for (const v of VERSIONS) {
      const m = await page('2026-12-08', 'mass', v.id);
      expect(m.sections.some((s) => s.heading.latin === 'Evangelium')).toBe(true);
    }
  });
});

describe('versions', () => {
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
  it('French Mass collect is in French', async () => {
    expect(text(await page('2026-12-08', 'mass', '1962', 'fr'), 'vernacular')).toMatch(/Prions/);
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
