// Texts stored once (web/js/packed.js, scripts/site.ts): nothing may change in the round trip.
import { describe, expect, it } from 'vitest';
import { splitPieces, unpack } from '../web/js/packed.js';
import { buildDay } from '../src/day.ts';

describe('texts stored once', () => {
  it('cuts a text into pieces that join back to exactly the same text', async () => {
    const day = await buildDay('2026-12-08', 'general', '1962', 'en');
    let pieces = 0;
    for (const part of day.parts) for (const s of part.sections) for (const html of [s.latin, s.vernacular]) {
      const p = splitPieces(html);
      pieces += p.length;
      expect(p.join('')).toBe(html);
    }
    expect(pieces).toBeGreaterThan(200);
  });
  it('starts a new piece at a psalm, an antiphon or a ℣.', () => {
    const html = '<span class="rubric">Ant.</span> A<br>\n<span class="rubric">Psalmus 92</span><br>\nv1<br>\nv2<br>\n<span class="rubric">℣.</span> Gloria';
    expect(splitPieces(html)).toEqual([
      '<span class="rubric">Ant.</span> A<br>\n',
      '<span class="rubric">Psalmus 92</span><br>\nv1<br>\nv2<br>\n',
      '<span class="rubric">℣.</span> Gloria',
    ]);
  });
  it('puts a packed text back together', () => {
    expect(unpack(['a', 0, 'b', 1], ['X', 'Y'])).toBe('aXbY');
    expect(unpack('plain', null)).toBe('plain');
    expect(unpack(undefined, null)).toBe('');
  });
});
