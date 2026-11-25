// Fetching and caching the JSON files (see scripts/site.ts for their layout).
import { state } from './state.js';
import { $, monthOf } from './util.js';
import { unpack } from './packed.js';

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

/** One part (an Hour or a Mass) of the day on screen, with its Latin merged in. */
export const fetchPart = (langId, id, cal = state.calendar, ver = state.version) => readPart(langId, id, state.date, cal, ver);

/** A folder's pack of shared texts (see packed.js); null for files that aren't packed. */
const packOf = (folder, file) => (file.pack ? getJson(`${folder}/${file.pack}`) : null);

/**
 * One part of any day: its own file and the shared Latin, with texts stored once put back
 * together (the published site), or as they are (the local server).
 */
export async function readPart(langId, id, date, cal = state.calendar, ver = state.version) {
  const dir = (l) => `data/${cal}/${ver}/${l}/${date.slice(0, 4)}/${date.slice(5)}`;
  const folder = (l) => `data/${cal}/${ver}/${l}`;
  const own = await getJson(`${dir(langId)}/${id}.json`);
  const ownPack = await packOf(folder(langId), own);
  let latin;
  let latinPack;
  if (own.latin) {
    latin = own.latin;
    latinPack = ownPack;
  } else {
    const shared = await getJson(`${dir('latin')}/${id}.json`);
    latin = shared.sections;
    latinPack = await packOf(folder('latin'), shared);
  }
  return own.sections.map((s, i) => ({
    heading: { latin: latin[i]?.heading ?? '', vernacular: s.heading },
    latin: unpack(latin[i]?.latin, latinPack),
    vernacular: unpack(s.vernacular, ownPack),
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
