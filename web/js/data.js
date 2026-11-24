// Fetching and caching the JSON files (see scripts/site.ts for their layout).
import { state } from './state.js';
import { $, monthOf } from './util.js';

export const cache = new Map();

export async function getJson(path) {
  if (!cache.has(path)) {
    const p = fetch(path).then((res) => {
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    });
    cache.set(path, p);
    p.catch(() => cache.delete(path)); // let a failed request be retried later
  }
  return cache.get(path);
}

export const dayDir = (langId, cal = state.calendar, ver = state.version) =>
  `data/${cal}/${ver}/${langId}/${state.date.slice(0, 4)}/${state.date.slice(5)}`;

/** The day's index: header, the list of parts, and the Masses if there are several. */
export const fetchDay = (langId, cal, ver) => getJson(`${dayDir(langId, cal, ver)}/index.json`);

/** One part (an Hour or a Mass), with its Latin from the shared folder merged in. */
export async function fetchPart(langId, id, cal, ver) {
  const own = await getJson(`${dayDir(langId, cal, ver)}/${id}.json`);
  const latin = own.latin ?? (await getJson(`${dayDir('latin', cal, ver)}/${id}.json`)).sections;
  return own.sections.map((s, i) => ({
    heading: { latin: latin[i]?.heading ?? '', vernacular: s.heading },
    latin: latin[i]?.latin ?? '',
    vernacular: s.vernacular,
    fallback: s.fallback,
  }));
}

export async function fetchMonth(month) {
  const key = `${state.calendar}/${state.version}/summary/${month}`;
  if (!cache.has(key)) {
    const res = await fetch(`data/${key}.json`);
    if (!res.ok) throw new Error(String(res.status));
    cache.set(key, await res.json());
  }
  return cache.get(key);
}

/** Summaries for these dates (null where unavailable). */
export async function summariesFor(dates) {
  const months = [...new Set(dates.map(monthOf))];
  const loaded = await Promise.all(months.map((m) => fetchMonth(m).catch(() => null)));
  const byDate = new Map();
  for (const m of loaded) if (m) for (const d of m.days) byDate.set(d.date, d);
  return dates.map((d) => byDate.get(d) || null);
}
