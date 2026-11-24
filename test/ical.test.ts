import { describe, expect, it } from 'vitest';
import { buildIcs, fastingLine } from '../src/ical.ts';
import { fasting } from '../src/fasting.ts';
import type { DaySummary } from '../src/summary.ts';

const day = (date: string, title: string, ember = false): DaySummary => ({
  date, title, rank: 'II. classis', color: 'violet', commemorations: ['S. Eusebii Episcopi et Martyris'], fasting: fasting(date, ember),
});
const days = [
  day('2026-12-17', 'Feria V infra Hebdomadam III Adventus'),
  day('2026-12-18', 'Feria VI Quattuor Temporum Adventus, cum commemoratione longissima Sanctæ Mariæ et omnium Sanctórum', true),
];

describe('calendar files (iCalendar)', () => {
  const ics = buildIcs(days, { calendar: 'general', version: '1962', kind: 'calendar', siteUrl: 'https://example.org/site/' });
  const lines = ics.split('\r\n');

  it('is a calendar with one all-day event per day', () => {
    expect(lines[0]).toBe('BEGIN:VCALENDAR');
    expect(ics.match(/BEGIN:VEVENT/g)).toHaveLength(2);
    expect(ics).toContain('DTSTART;VALUE=DATE:20261218');
    expect(ics).toContain('DTEND;VALUE=DATE:20261219');
    expect(ics.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });
  it('folds long lines at 75 bytes without breaking characters', () => {
    for (const l of lines) expect(Buffer.byteLength(l)).toBeLessThanOrEqual(75);
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain('Sanctæ Mariæ et omnium Sanctórum');
  });
  it('escapes commas and links back to the day', () => {
    const unfolded = ics.replace(/\r\n /g, '');
    expect(unfolded).toContain('SUMMARY:Feria VI Quattuor Temporum Adventus\\, cum');
    expect(unfolded).toContain('URL:https://example.org/site/?date=2026-12-18&calendar=general&version=1962');
  });
  it('describes fasting, mandatory or suggested', () => {
    expect(fastingLine(days[1])).toBe('Fast and abstinence (Ember day): fasting suggested, abstinence mandatory under current Church law.');
  });
  it('the fast-days file has only days of fasting or abstinence', () => {
    const f = buildIcs(days, { calendar: 'general', version: '1962', kind: 'fasting' });
    expect(f.match(/BEGIN:VEVENT/g)).toHaveLength(1);
    expect(f).toContain('SUMMARY:Fast & Abstinence · Ember day');
  });
});
