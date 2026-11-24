// Runs DO's real Perl engine, so these are integration tests (~0.3s per Hour).
import { describe, expect, it } from 'vitest';
import { HOURS } from '../src/hours.ts';
import { parseOffice } from '../src/parse.ts';
import { renderHour, toDoDate } from '../src/render.ts';

const office = async (date: string, hour: (typeof HOURS)[number]['id']) => parseOffice(await renderHour(date, hour));

describe('toDoDate', () => {
  it('converts ISO to MM-DD-YYYY', () => expect(toDoDate('2026-12-08')).toBe('12-08-2026'));
  it('rejects bad input', () => expect(() => toDoDate('12/08/2026')).toThrow());
});

describe('Immaculate Conception, 2026-12-08', () => {
  it('has the right header', async () => {
    const o = await office('2026-12-08', 'lauds');
    expect(o.header.title).toMatch(/Conceptione Immaculata/);
    expect(o.header.rank).toBe('I. classis');
    expect(o.header.color).toBe('white');
    expect(o.header.commemorations.join()).toMatch(/Adventus/);
  });

  it.each(HOURS.map((h) => [h.id, h.latin] as const))('%s renders with Latin and English', async (id, latin) => {
    const o = await office('2026-12-08', id);
    expect(o.hourTitle).toBe(latin);
    expect(o.sections.length).toBeGreaterThan(4);
    for (const s of o.sections) {
      expect(s.latin.length).toBeGreaterThan(0);
      expect(s.english.length).toBeGreaterThan(0);
      expect(s.latin).not.toMatch(/<font|style=/i);
      expect(s.latin).not.toMatch(/\{omittitur\}/);
    }
  });

  it('Lauds has the proper antiphon and the Benedictus', async () => {
    const o = await office('2026-12-08', 'lauds');
    const text = o.sections.map((s) => s.latin).join(' ');
    expect(text).toMatch(/Tota pulchra/);
    expect(o.sections.some((s) => /Benedictus/.test(s.heading.latin))).toBe(true);
  });

  it('Vespers has the Magnificat, Compline the Nunc dimittis', async () => {
    const v = await office('2026-12-08', 'vespers');
    expect(v.sections.some((s) => /Magnificat/.test(s.heading.latin))).toBe(true);
    const c = await office('2026-12-08', 'compline');
    expect(c.sections.some((s) => /Nunc dimittis/.test(s.heading.latin))).toBe(true);
  });
});

describe('liturgical colours', () => {
  it.each([
    ['2026-12-13', 'rose'], // Gaudete Sunday
    ['2027-03-26', 'black'], // Good Friday
    ['2026-12-26', 'red'], // St Stephen
    ['2026-11-22', 'green'], // last Sunday after Pentecost
    ['2026-12-01', 'violet'], // Advent feria
  ] as const)('%s is %s', async (date, color) => {
    expect((await office(date, 'lauds')).header.color).toBe(color);
  });
});

describe('heading detection', () => {
  it('does not mistake initials or "N." for headings', async () => {
    for (const [date, hour] of [['2026-04-03', 'compline'], ['2026-04-25', 'lauds']] as const) {
      const o = await office(date, hour);
      for (const s of o.sections) expect(s.heading.latin.length === 0 || s.heading.latin.length > 2).toBe(true);
    }
  });
});
