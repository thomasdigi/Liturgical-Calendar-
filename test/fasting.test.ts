import { describe, expect, it } from 'vitest';
import { easter, fasting } from '../src/fasting.ts';

const f = (date: string, ember = false) => {
  const r = fasting(date, ember);
  return `${r.fast ? 'F' : '-'}${r.abstinence ? 'A' : '-'}`;
};

describe('easter', () => {
  it.each([
    [2024, '2024-03-31'],
    [2025, '2025-04-20'],
    [2026, '2026-04-05'],
    [2027, '2027-03-28'],
    [2038, '2038-04-25'],
  ])('%i', (y, d) => expect(easter(y)).toBe(d));
});

describe('fasting and abstinence (1917 Code)', () => {
  it('Fridays: abstinence only', () => expect(f('2026-12-04')).toBe('-A'));
  it('ordinary weekdays: nothing', () => expect(f('2026-12-03')).toBe('--'));
  it('Ash Wednesday: fast and abstinence', () => expect(f('2027-02-10')).toBe('FA'));
  it('Lent Monday–Thursday: fast only', () => expect(f('2027-02-11')).toBe('F-'));
  it('Lent Fridays and Saturdays: fast and abstinence', () => {
    expect(f('2027-02-12')).toBe('FA');
    expect(f('2027-02-13')).toBe('FA');
  });
  it('Sundays of Lent: nothing', () => expect(f('2027-02-14')).toBe('--'));
  it('a holy day in Lent keeps the fast (St Joseph on a Friday, 2027)', () => expect(f('2027-03-19')).toBe('FA'));
  it('Holy Saturday ends at noon', () => {
    const r = fasting('2027-03-27', false);
    expect(r.fast && r.abstinence).toBe(true);
    expect(r.note).toBe('until noon');
  });
  it('Ember days: fast and abstinence', () => expect(f('2026-12-16', true)).toBe('FA'));
  it('vigils of Christmas, the Assumption, All Saints and Pentecost', () => {
    expect(f('2026-12-24')).toBe('FA');
    expect(f('2026-08-14')).toBe('FA');
    expect(f('2025-10-31')).toBe('FA');
    expect(f('2026-05-23')).toBe('FA'); // Saturday before Pentecost 2026 (May 24)
  });
  it('a vigil on a Sunday is not kept or moved', () => {
    expect(f('2026-10-31')).toBe('FA'); // Saturday — kept
    expect(f('2027-10-31')).toBe('--'); // Sunday — lapses
    expect(f('2027-10-30')).toBe('--'); // not anticipated
  });
  it('a holy day of obligation on a Friday lifts abstinence (Christmas 2026)', () => expect(f('2026-12-25')).toBe('--'));
});
