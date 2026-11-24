// Clergy mode, chant, Holy Week and the USA texts. Runs DO's real engine (integration tests).
import { describe, expect, it } from 'vitest';
import { buildDay, buildPart, supplyNames } from '../src/day.ts';
import { parsePage } from '../src/parse.ts';
import { renderPart } from '../src/render.ts';

describe('clergy summary (ordo)', () => {
  it('St Josaphat, 2026-11-14, 1962: as in the request', async () => {
    const { ordo } = await buildDay('2026-11-14', 'general', '1962', 'en');
    expect(ordo?.mass).toMatchObject({
      rank: 'III. classis', color: 'red', gloria: true, credo: false, preface: 'Common',
      between: 'Gradual and Alleluia', votive: { status: 'restricted' },
    });
    expect(ordo?.office).toMatchObject({
      rank: 'III. classis', laudsScheme: 'I',
      matins: { nocturns: 1, teDeum: true },
      vespers: { kind: 'first' },
    });
    expect(ordo?.office?.vespers.of).toMatch(/Dominica/);
  });
  it('a Sunday has the Credo; an Advent feria no Gloria; Immaculate Conception no votive Masses', async () => {
    expect((await buildDay('2026-11-15', 'general', '1962', 'en')).ordo?.mass?.credo).toBe(true);
    const feria = (await buildDay('2026-12-09', 'general', '1962', 'en')).ordo!;
    expect(feria.mass?.gloria).toBe(false);
    expect(feria.mass?.preface).toBe('of Advent');
    expect((await buildDay('2026-12-08', 'general', '1962', 'en')).ordo?.mass?.votive.status).toBe('not permitted');
  });
});

describe('chant edition', () => {
  it('has the Hours only, with GABC notation in sections matching the plain Office', async () => {
    const day = await buildDay('2026-11-14', 'general', '1962', 'la-gabc');
    expect(day.parts.map((p) => p.id)).not.toContain('mass');
    expect(day.votives ?? []).toEqual([]);
    const lauds = day.parts.find((p) => p.id === 'lauds')!;
    const plain = await buildPart('2026-11-14', 'lauds', '1962', 'en');
    expect(lauds.sections.length).toBe(plain.sections.length);
    expect(lauds.sections.some((s) => /class="GABC"/.test(s.vernacular))).toBe(true);
  });
});

describe('Holy Week', () => {
  it('Good Friday and the Easter Vigil sections have their headings', async () => {
    const gf = parsePage(await renderPart('2027-03-26', 'mass', '1962', 'en'));
    expect(gf.sections.filter((s) => s.heading.latin).length).toBeGreaterThan(3);
    const vigil = parsePage(await renderPart('2027-03-27', 'mass', '1962', 'en'));
    expect(vigil.sections.map((s) => s.heading.latin).join('|')).toMatch(/ignis/i);
  });
});

describe('USA texts: names for "N."', () => {
  it('fills in the saint, once for a pair, but not "our Pope N."', () => {
    const sec = {
      heading: { latin: '', vernacular: '' },
      latin: 'beáti N. Confessóris<br>pro Papa nostro N.',
      vernacular: 'Saints <span class="rubric">N.</span> and <span class="rubric">N.</span> pray',
    };
    supplyNames(sec, 'Ss. John Fisher and Thomas More, Martyrs');
    expect(sec.latin).toMatch(/beáti N\. <span class="supplied"[^>]*>\[John Fisher and Thomas More\]/);
    expect(sec.latin).toMatch(/Papa nostro N\.$/);
    expect(sec.vernacular.match(/class="supplied"/g)?.length).toBe(1);
  });
});
