/**
 * Fasting and abstinence under the general law of the 1917 Code of Canon Law
 * (canons 1250–1254), the discipline traditional Ordos print. Local law, indults
 * and later dispensations may differ; the viewer says so.
 *
 *  - Abstinence: every Friday.
 *  - Fast and abstinence: Ash Wednesday, the Fridays and Saturdays of Lent, the Ember days,
 *    and the vigils of Pentecost, the Assumption, All Saints and Christmas.
 *  - Fast only: the other weekdays of Lent.
 *  - Neither on Sundays or holy days of obligation, except in Lent; a vigil that falls
 *    on a Sunday is not moved earlier. On Holy Saturday both end at noon.
 */

export interface Fasting {
  fast: boolean;
  abstinence: boolean;
  /** Why, in short English phrases, e.g. ["Lent"], ["Ember day"], ["Vigil of Christmas"]. */
  reasons: string[];
  /** e.g. "until noon" on Holy Saturday. */
  note?: string;
}

/** Easter Sunday (Gregorian), as YYYY-MM-DD. */
export function easter(year: number): string {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

const toUTC = (iso: string) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const daysBetween = (a: string, b: string) => Math.round((toUTC(b) - toUTC(a)) / 86_400_000);

/**
 * @param date YYYY-MM-DD
 * @param isEmberDay whether the day is an Ember day in the calendar being shown
 *   (taken from Divinum Officium's own title or commemorations: "Quattuor Temporum").
 */
export function fasting(date: string, isEmberDay: boolean): Fasting {
  const year = +date.slice(0, 4);
  const md = date.slice(5);
  const weekday = new Date(toUTC(date)).getUTCDay(); // 0 = Sunday
  const fromEaster = daysBetween(easter(year), date);

  const lent = fromEaster >= -46 && fromEaster <= -1; // Ash Wednesday .. Holy Saturday
  const ashWednesday = fromEaster === -46;
  const holySaturday = fromEaster === -1;
  const holyDay =
    ['01-01', '01-06', '03-19', '06-29', '08-15', '11-01', '12-08', '12-25'].includes(md) ||
    fromEaster === 39 || // Ascension
    fromEaster === 60; // Corpus Christi

  const vigil =
    md === '12-24' ? 'Vigil of Christmas'
    : md === '08-14' ? 'Vigil of the Assumption'
    : md === '10-31' ? 'Vigil of All Saints'
    : fromEaster === 48 ? 'Vigil of Pentecost'
    : null;

  const reasons: string[] = [];
  let fast = false;
  let abstinence = false;

  if (lent && weekday !== 0) {
    fast = true;
    reasons.push(ashWednesday ? 'Ash Wednesday' : 'Lent');
    if (ashWednesday || weekday === 5 || weekday === 6) abstinence = true;
  }
  if (isEmberDay && weekday !== 0) {
    fast = abstinence = true;
    reasons.push('Ember day');
  }
  if (vigil && weekday !== 0) {
    fast = abstinence = true;
    reasons.push(vigil);
  }
  if (weekday === 5) {
    abstinence = true;
    if (!reasons.length) reasons.push('Friday');
  }

  // Sundays and holy days of obligation lift both, except in Lent.
  if (!lent && (weekday === 0 || holyDay)) {
    return { fast: false, abstinence: false, reasons: [] };
  }
  return { fast, abstinence, reasons, note: holySaturday ? 'until noon' : undefined };
}
