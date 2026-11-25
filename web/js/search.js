// Search across the texts.
import { getJson } from './data.js';
import { findFeasts } from './feasts.js';
import { avail, built, config, lang, state } from './state.js';
import { $, addMonths, esc, monthLabel, monthOf } from './util.js';

/** The search language: the chosen one if it was built, else English. */
export const searchLangId = () => (built(state.lang) ? state.lang : config.fallbackLanguage);

export function syncSearchOptions() {
  const m = monthOf(state.date);
  const opts = [['1', monthLabel(m)], ['3', `${monthLabel(m)} and the next two months`]];
  if (avail) opts.push(['all', `All dates on this site (${avail.first} to ${avail.last})`]);
  const scope = $('scope').value || '1';
  $('scope').innerHTML = opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
  $('scope').value = opts.some(([v]) => v === scope) ? scope : '1';
  const L = lang(searchLangId());
  const within = $('searchin').value || 'both';
  $('searchin').innerHTML = [['both', `Latin and ${L.label}`], ['latin', 'Latin only'], ['vernacular', `${L.label} only`]]
    .map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
  $('searchin').value = within;
  setTimeout(() => $('q').focus(), 0);
}

export function scopeMonths() {
  const v = $('scope').value;
  if (v === 'all' && avail) {
    const out = [];
    for (let m = monthOf(avail.first); m <= monthOf(avail.last); m = addMonths(m, 1)) out.push(m);
    return out;
  }
  return Array.from({ length: Number(v) || 1 }, (_, i) => addMonths(monthOf(state.date), i));
}

/** Lower case, no accents, æ→ae, œ→oe, j→i; with a map back to positions in the original. */
export function normalize(text) {
  let out = '';
  const map = [];
  for (let i = 0; i < text.length; i++) {
    let c = text[i].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    c = c.replace(/æ/g, 'ae').replace(/œ/g, 'oe').replace(/j/g, 'i');
    for (const ch of c) { out += ch; map.push(i); }
  }
  return { out, map };
}

/** Words to find; a "quoted phrase" counts as one term. */
export function parseQuery(q) {
  const terms = [];
  q.replace(/"([^"]+)"|(\S+)/g, (_, phrase, word) => { terms.push(normalize(phrase || word).out.trim()); return ''; });
  return terms.filter(Boolean);
}

/** A short extract around the first match, with every match marked. */
export function snippet(text, terms) {
  const { out, map } = normalize(text);
  const spans = [];
  for (const t of terms) {
    let i = out.indexOf(t);
    while (i >= 0) { spans.push([map[i], map[i + t.length - 1] + 1]); i = out.indexOf(t, i + t.length); }
  }
  if (!spans.length) return '';
  spans.sort((a, b) => a[0] - b[0]);
  const from = Math.max(0, spans[0][0] - 70);
  const to = Math.min(text.length, spans[0][1] + 140);
  let html = '';
  let pos = from;
  for (const [a, b] of spans) {
    if (a < pos || b > to) continue;
    html += esc(text.slice(pos, a)) + `<mark>${esc(text.slice(a, b))}</mark>`;
    pos = b;
  }
  html += esc(text.slice(pos, to));
  return (from > 0 ? '…' : '') + html + (to < text.length ? '…' : '');
}

export const partLabel = (id) => {
  if (id === 'mass') return 'Mass';
  const m = /^mass-(\d+)$/.exec(id);
  if (m) return `Mass ${m[1]}`;
  return config.hours.find((h) => h.id === id)?.label ?? id;
};

export let searchSeq = 0;

export const MAX_HITS = 300;

export async function runSearch() {
  const seq = ++searchSeq;
  const terms = parseQuery($('q').value);
  if (!terms.length) { $('searchstatus').textContent = 'Type a word or phrase to find.'; return; }
  const within = $('searchin').value;
  const langId = searchLangId();
  const hits = [];
  $('results').innerHTML = '';
  const months = scopeMonths();
  for (const month of months) {
    $('searchstatus').textContent = `Searching ${monthLabel(month)}…${avail ? '' : ' (the first search of a month builds its index, which can take a minute)'}`;
    const base = `data/${state.calendar}/${state.version}`;
    const [la, vn] = await Promise.all([
      within === 'vernacular' ? null : getJson(`${base}/latin/search/${month}.json`).catch(() => null),
      within === 'latin' ? null : getJson(`${base}/${langId}/search/${month}.json`).catch(() => null),
    ]);
    if (seq !== searchSeq) return;
    const days = new Set([...Object.keys(la?.days ?? {}), ...Object.keys(vn?.days ?? {})]);
    for (const dd of [...days].sort()) {
      const parts = new Set([...Object.keys(la?.days[dd] ?? {}), ...Object.keys(vn?.days[dd] ?? {})]);
      for (const pid of parts) {
        const laS = la?.days[dd]?.[pid] ?? [];
        const vnS = vn?.days[dd]?.[pid] ?? [];
        for (let i = 0; i < Math.max(laS.length, vnS.length); i++) {
          const texts = [laS[i]?.[1] ?? '', vnS[i]?.[1] ?? ''];
          const n = normalize(texts.join(' \n ')).out;
          if (!terms.every((t) => n.includes(t))) continue;
          const which = snippet(texts[0], terms) ? 0 : 1;
          hits.push({
            date: `${month}-${dd}`,
            part: pid,
            section: i,
            heading: laS[i]?.[0] || vnS[i]?.[0] || '',
            html: snippet(texts[which], terms) || snippet(texts[1 - which], terms),
            lang: which === 0 ? 'la' : lang(langId).htmlLang,
          });
          if (hits.length >= MAX_HITS) break;
        }
        if (hits.length >= MAX_HITS) break;
      }
      if (hits.length >= MAX_HITS) break;
    }
    renderHits(hits, terms);
    if (hits.length >= MAX_HITS) break;
  }
  if (seq !== searchSeq) return;
  $('searchstatus').textContent = hits.length
    ? `${hits.length >= MAX_HITS ? `First ${MAX_HITS}` : hits.length} result${hits.length === 1 ? '' : 's'} in ${months.length === 1 ? monthLabel(months[0]) : `${monthLabel(months[0])} to ${monthLabel(months.at(-1))}`}.`
    : 'Nothing found. Try fewer words, or a longer period.';
}

/** Feasts and saints matching what's typed: shown as you type, above the text results. */
let feastSeq = 0;
export async function runFeastSearch() {
  const mine = ++feastSeq;
  const q = $('q').value.trim();
  const found = q.length >= 3 ? await findFeasts(q) : [];
  if (mine !== feastSeq) return;
  $('feasthits').hidden = !found.length;
  $('feastlist').innerHTML = found.map((f) => {
    const dt = new Date(`${f.date}T12:00:00Z`);
    return `<li><button type="button" data-date="${f.date}">
      <span class="fdate">${esc(dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' }))}</span>
      <span class="ftitle rlatin">${esc(f.title)}</span>
      ${f.also ? `<span class="falso rlatin">Com. ${esc(f.also)}</span>` : ''}
      <span class="frank">${esc(f.rank)}</span></button></li>`;
  }).join('');
}

export function renderHits(hits) {
  let lastDate = '';
  $('results').innerHTML = hits.map((h) => {
    const dt = new Date(`${h.date}T12:00:00Z`);
    const dateHead = h.date !== lastDate
      ? `<li class="rdate">${esc(dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }))}</li>` : '';
    lastDate = h.date;
    return `${dateHead}<li><button type="button" data-hit='${esc(JSON.stringify({ date: h.date, part: h.part, section: h.section }))}'>
      <span class="rwhere">${esc(partLabel(h.part))}${h.heading ? ` · ${esc(h.heading)}` : ''}</span>
      <span class="rtext" lang="${h.lang}">${h.html}</span></button></li>`;
  }).join('');
}
