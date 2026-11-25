/**
 * Calendar files (iCalendar, .ics) for phone and computer calendars:
 *   data/<cal>/<ver>/calendar.ics   every day: the feast, class, colour, commemorations, fasting
 *   data/<cal>/<ver>/fasting.ics    only the days of fasting or abstinence
 * Built from the month summaries, so they cover the same dates as the site. Calendar apps
 * that subscribe to the address refresh them, picking up new months as the site rebuilds.
 */
import { getCalendar, getVersion, type CalendarId, type VersionId } from './config.ts';
import type { DaySummary } from './summary.ts';

export type IcsKind = 'calendar' | 'fasting';

const COLOURS: Record<string, string> = { white: 'White', red: 'Red', green: 'Green', violet: 'Violet', rose: 'Rose', black: 'Black' };

/** Escape text for an iCalendar value. */
const text = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');

/** Lines longer than 75 bytes are folded (continued on the next line after a space), never mid-character. */
function fold(line: string): string {
  const out: string[] = [];
  let cur = '';
  let bytes = 0;
  for (const ch of line) {
    const b = Buffer.byteLength(ch);
    if (bytes + b > (out.length ? 74 : 75)) {
      out.push(cur);
      cur = '';
      bytes = 0;
    }
    cur += ch;
    bytes += b;
  }
  out.push(cur);
  return out.join('\r\n ');
}

const ymd = (iso: string) => iso.replace(/-/g, '');
function nextDay(iso: string) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

/** "Fast and abstinence (Ember day): fasting suggested, abstinence mandatory under current Church law." */
export function fastingLine(d: DaySummary): string {
  const f = d.fasting;
  if (!f.fast && !f.abstinence) return '';
  const partial = f.partial ?? (f.fast && !f.abstinence);
  const what = f.fast && f.abstinence ? 'Fast and abstinence' : partial ? 'Fast and partial abstinence (meat at the principal meal only)' : f.fast ? 'Fast' : 'Abstinence';
  const why = f.reasons.length ? ` (${f.reasons.join(', ')}${f.note ? `, ${f.note}` : ''})` : '';
  const status = (kind: 'fast' | 'abstinence', name: string) =>
    f[kind] ? `${name} ${f.required?.[kind] ? 'mandatory' : 'suggested'}` : '';
  const parts = [status('fast', 'fasting'), status('abstinence', 'abstinence'), partial ? 'partial abstinence suggested' : ''].filter(Boolean).join(', ');
  return `${what}${why}: ${parts} under current Church law.`;
}

export function buildIcs(
  days: DaySummary[],
  { calendar, version, kind, siteUrl }: { calendar: CalendarId; version: VersionId; kind: IcsKind; siteUrl?: string },
): string {
  const cal = getCalendar(calendar);
  const ver = getVersion(version);
  const name = kind === 'fasting' ? `Fast days · ${cal.label} ${ver.label}` : `Liturgical calendar · ${cal.label} ${ver.label}`;
  const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, 'Z');
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Liturgical Calendar//Divinum Officium//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${text(name)}`,
    `X-WR-CALDESC:${text('Texts and calendar from Divinum Officium. Fasting: traditional discipline (1917 Code), marked mandatory or suggested under current law.')}`,
    'REFRESH-INTERVAL;VALUE=DURATION:P1D',
    'X-PUBLISHED-TTL:P1D',
  ];
  for (const d of [...days].sort((a, b) => a.date.localeCompare(b.date))) {
    const fast = fastingLine(d);
    if (kind === 'fasting' && !fast) continue;
    const partial = d.fasting.partial ?? (d.fasting.fast && !d.fasting.abstinence);
    const marks = [d.fasting.fast ? 'Fast' : '', d.fasting.abstinence ? 'Abstinence' : '', partial ? 'Partial abstinence' : ''].filter(Boolean).join(' & ');
    const summary = kind === 'fasting' ? `${marks}${d.fasting.reasons.length ? ` · ${d.fasting.reasons.join(', ')}` : ''}` : d.title;
    const description = [
      kind === 'fasting' ? d.title : '',
      [d.rank, COLOURS[d.color]].filter(Boolean).join(' · '),
      d.commemorations.length ? `Commemoration: ${d.commemorations.join('; ')}` : '',
      fast,
    ].filter(Boolean).join('\n');
    const link = siteUrl ? `${siteUrl.replace(/\/?$/, '/')}?date=${d.date}&calendar=${calendar}&version=${version}` : '';
    lines.push(
      'BEGIN:VEVENT',
      `UID:${d.date}-${calendar}-${version}-${kind}@liturgical-calendar`,
      `DTSTAMP:${stamp}`,
      `DTSTART;VALUE=DATE:${ymd(d.date)}`,
      `DTEND;VALUE=DATE:${ymd(nextDay(d.date))}`,
      `SUMMARY:${text(summary)}`,
      `DESCRIPTION:${text(description + (link ? `\n${link}` : ''))}`,
      ...(link ? [`URL:${link}`] : []),
      'TRANSP:TRANSPARENT',
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
