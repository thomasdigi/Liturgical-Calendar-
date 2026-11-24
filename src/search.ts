/**
 * Search index: the plain text of each section, a month per file.
 *   data/<cal>/<ver>/<lang>/search/YYYY-MM.json    second-language text
 *   data/<cal>/<ver>/latin/search/YYYY-MM.json     Latin (shared by every language)
 * Shape: { month, days: { "25": { "lauds": [[heading, text], …], "mass-2": … } } }
 * The section number (position in the list) matches the day's part file, so a hit can
 * open the right place. Indexed: the Mass propers (each Mass on days with several) and the
 * Hours of the day. Not the Ordinary or the votive offices, which repeat every day.
 */
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { FALLBACK_LANGUAGE, HOURS, type CalendarId, type LanguageId, type VersionId } from './config.ts';
import { DATA_DIR, getDay, readDay, type DayData } from './day.ts';

type Entries = [heading: string, text: string][];
export interface SearchMonth {
  month: string;
  days: Record<string, Record<string, Entries>>;
}

const HOUR_IDS = new Set<string>(HOURS.map((h) => h.id));
const indexed = (id: string) => HOUR_IDS.has(id) || id === 'mass' || /^mass-\d+$/.test(id);

/** Readable plain text: no markup, verse numbers or DO's {notes}. */
export function plainText(html: string): string {
  return html
    .replace(/<span class="verse">[^<]*<\/span>/g, '')
    .replace(/<p class="note">[^<]*<\/p>/g, '')
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

export const searchPath = (calendar: CalendarId, version: VersionId, lang: string, month: string) =>
  resolve(DATA_DIR, calendar, version, lang, 'search', `${month}.json`);

async function writeJson(path: string, data: unknown) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = `${path}.${process.pid}.${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(tmp, JSON.stringify(data));
  await rename(tmp, path);
}

/**
 * Builds the month's search files for a language (and the shared Latin one).
 * With `onlyBuilt`, uses the days already in data/ and skips the rest (static site);
 * otherwise builds missing days first (local server).
 */
export async function buildSearchMonth(
  calendar: CalendarId,
  version: VersionId,
  lang: LanguageId,
  month: string,
  { onlyBuilt = false } = {},
): Promise<{ vernacular: SearchMonth; latin: SearchMonth }> {
  const [y, m] = month.split('-').map(Number);
  const count = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const vernacular: SearchMonth = { month, days: {} };
  const latin: SearchMonth = { month, days: {} };
  // Load (or build) the days, a few at a time.
  const days: (DayData | null)[] = new Array(count).fill(null);
  const queue = Array.from({ length: count }, (_, i) => i);
  await Promise.all(
    Array.from({ length: onlyBuilt ? 8 : 4 }, async () => {
      for (let i = queue.shift(); i !== undefined; i = queue.shift()) {
        const date = `${month}-${String(i + 1).padStart(2, '0')}`;
        try {
          days[i] = onlyBuilt ? await readDay(date, calendar, version, lang) : await getDay(date, calendar, version, lang);
        } catch {
          days[i] = null; // not built (static site) or not available
        }
      }
    }),
  );
  for (let d = 1; d <= count; d++) {
    const day = days[d - 1];
    if (!day) continue;
    const key = String(d).padStart(2, '0');
    vernacular.days[key] = {};
    latin.days[key] = {};
    for (const part of day.parts) {
      if (!indexed(part.id)) continue;
      vernacular.days[key][part.id] = part.sections.map((s) => [s.heading.vernacular, plainText(s.vernacular)]);
      latin.days[key][part.id] = part.sections.map((s) => [s.heading.latin, plainText(s.latin)]);
    }
  }
  await writeJson(searchPath(calendar, version, lang, month), vernacular);
  // The Latin is the same for every language; English (built first) writes it, others fill a gap.
  const latinPath = searchPath(calendar, version, 'latin', month);
  let haveLatin = false;
  try {
    const existing = JSON.parse(await readFile(latinPath, 'utf8')) as SearchMonth;
    haveLatin = lang !== FALLBACK_LANGUAGE && Object.keys(existing.days).length >= Object.keys(latin.days).length;
  } catch {
    /* none yet */
  }
  if (!haveLatin) await writeJson(latinPath, latin);
  return { vernacular, latin };
}

/** Cached: the month's search file for a language, or 'latin'. Builds it if missing. */
export async function getSearchMonth(
  calendar: CalendarId,
  version: VersionId,
  lang: LanguageId | 'latin',
  month: string,
): Promise<SearchMonth> {
  try {
    return JSON.parse(await readFile(searchPath(calendar, version, lang, month), 'utf8'));
  } catch {
    const built = await buildSearchMonth(calendar, version, lang === 'latin' ? (FALLBACK_LANGUAGE as LanguageId) : lang, month);
    return lang === 'latin' ? built.latin : built.vernacular;
  }
}
