// The devotions' texts: every prayer and reading in Latin and each language of the app.
import { describe, expect, it } from 'vitest';
// @ts-expect-error plain JavaScript module of the viewer
import * as T from '../web/js/devotions/texts.js';
// @ts-expect-error plain JavaScript module of the viewer
import { READINGS, REFS } from '../web/js/devotions/readings.js';

const LANGS = ['la', 'en', 'de', 'fr', 'es', 'pt'];
const texts = (blocks: any[]) => blocks.flatMap((b) => [b.h, b.rubric, b.prayer].filter(Boolean));

describe('devotions', () => {
  it('has every text in every language', () => {
    const all = [...texts(T.VIA_PETRI), ...texts(T.ANGELUS), ...texts(T.REGINA_CAELI), T.ANGELUS_RUBRIC, T.EASTERTIDE_NOW,
      ...T.mercySteps().flatMap((s: any) => [s.name, s.text, s.label[0]])];
    for (const t of all) for (const l of LANGS) expect(t[l], JSON.stringify(t).slice(0, 80)).toBeTruthy();
  });
  it('has the twelve Via Petri readings, verse for verse', () => {
    const ids = T.VIA_PETRI.filter((b: any) => b.reading).map((b: any) => b.reading);
    expect(ids).toHaveLength(12);
    for (const id of ids) {
      const n = REFS[id].v2 - REFS[id].v1 + 1;
      for (const l of LANGS) expect(READINGS[id][l]).toHaveLength(n);
    }
  });
  it('counts the Chaplet: opening, five decades of 1 + 10, Holy God three times', () => {
    const s = T.mercySteps();
    expect(s).toHaveLength(4 + 5 * 11 + 3 + 1);
    expect(s.filter((x: any) => x.text === T.MERCY.passion)).toHaveLength(50);
  });
});
