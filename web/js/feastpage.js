// A feast's page (tap the feast's name on the day page): its dates this year and next, its date,
// rank and colour in each version (1570, 1906, 1954, 1962…), and the days it is commemorated.
// Read from the year indexes (data/<cal>/<ver>/year/YYYY.json, see src/summary.ts). A feast is
// recognised by its title, the same way in every version.
import { getJson } from './data.js';
import { config, state } from './state.js';
import { $, COLOR_NAMES, COLORS, esc } from './util.js';
import { norm } from './feasts.js';
import { fmtDate, t } from './ui.js';

const yearFile = (ver, year) => getJson(`data/${state.calendar}/${ver}/year/${year}.json`).catch(() => null);
const same = (a, b) => norm(a) === norm(b);
/** A commemoration of this feast ("S. Melchiadis Papæ et Martyris" in a day's commemorations). */
const commemorates = (c, title) => {
  const a = norm(c);
  const b = norm(title);
  return a === b || (b.length > 10 && (a.includes(b) || b.includes(a)));
};
/** Words that tell feasts apart ("Conceptione", "Josaphat"), not the common ones ("Beatæ", "Martyris"). */
const GENERIC = new Set(['beate', 'beati', 'marie', 'virginis', 'sancti', 'sancte', 'sanctorum', 'episcopi', 'martiris', 'martirum',
  'confessoris', 'doctoris', 'ecclesie', 'abbatis', 'pape', 'vidue', 'apostoli', 'apostolorum', 'evangeliste', 'dominica', 'feria',
  'hebdomadam', 'infra', 'octavam', 'domini', 'nostri', 'iesu', 'christi', 'sabbato', 'classis', 'commemoratione', 'vigilia']);
const keyWords = (title) => new Set(norm(title).split(' ').filter((w) => w.length >= 5 && !GENERIC.has(w)));
/** Probably the same feast under another title (same date, a distinctive word in common). */
const similar = (a, b) => [...keyWords(a)].some((w) => keyWords(b).has(w));

const swatch = (c) => `<span class="swatch" style="background:${COLORS[c] || 'transparent'}"></span> ${esc(COLOR_NAMES[c] ? t(COLOR_NAMES[c]) : c)}`;

let seq = 0;

export async function renderFeast() {
  const mine = ++seq;
  const date = state.feastDate || state.date;
  const year = +date.slice(0, 4);
  const years = [year, year + 1];
  const versions = (config.calendars.find((c) => c.id === state.calendar)?.versions ?? [state.version]);
  $('feast-body').innerHTML = `<p class="msg">${t('Loading…')}</p>`;
  const files = {};
  await Promise.all(versions.flatMap((v) => years.map(async (y) => { files[`${v}/${y}`] = await yearFile(v, y); })));
  if (mine !== seq) return;
  const entry = files[`${state.version}/${year}`]?.days[date.slice(5)];
  if (!entry) {
    $('feast-title').textContent = '';
    $('feast-meta').textContent = '';
    $('feast-body').innerHTML = `<p class="msg">${t('This feast’s page isn’t on this site yet. It appears after the site’s next rebuild.')}</p>`;
    return;
  }
  const [title, rank, color] = entry;
  $('feast-date').textContent = fmtDate(date, 'long');
  $('feast-title').textContent = title;
  $('feast-meta').innerHTML = `${swatch(color)} · ${esc(rank)}`;

  /** The dates of this feast in a version and year. */
  const datesIn = (v, y) => Object.entries(files[`${v}/${y}`]?.days ?? {}).filter(([, e]) => same(e[0], title)).map(([md]) => `${y}-${md}`);
  const dateButton = (d) => `<button type="button" class="feast-date" data-date="${d}">${esc(fmtDate(d, 'medium'))}</button>`;

  // When: this year and next, in the version shown.
  const when = years.map((y) => {
    const ds = datesIn(state.version, y);
    return `<div class="crow"><dt>${y}</dt><dd>${ds.length ? ds.map(dateButton).join(' ') : `<span class="cnote">${t('Not kept this year (outranked, or not in this calendar)')}</span>`}</dd></div>`;
  }).join('');

  // In each version: its date, rank and colour there; or what that version keeps on this day.
  const label = (v) => t(config.versions.find((x) => x.id === v)?.label ?? v);
  const rows = versions.map((v) => {
    const file = files[`${v}/${year}`];
    if (!file) return `<tr><th scope="row">${esc(label(v))}</th><td colspan="3" class="cnote">${t('Not on this site')}</td></tr>`;
    const ds = datesIn(v, year);
    if (ds.length) {
      const e = file.days[ds[0].slice(5)];
      return `<tr${v === state.version ? ' class="current"' : ''}><th scope="row">${esc(label(v))}</th><td>${dateButton(ds[0])}</td><td>${esc(e[1])}</td><td>${swatch(e[2])}</td></tr>`;
    }
    const other = file.days[date.slice(5)];
    if (other && similar(other[0], title)) {
      // The same feast under that version's own title (e.g. "Conceptione Beatæ Mariæ Virginis" in 1570).
      return `<tr${v === state.version ? ' class="current"' : ''}><th scope="row">${esc(label(v))}</th><td>${dateButton(date)}<br><span class="cnote" lang="la">${esc(other[0])}</span></td><td>${esc(other[1])}</td><td>${swatch(other[2])}</td></tr>`;
    }
    return `<tr><th scope="row">${esc(label(v))}</th><td colspan="3"><span class="cnote">${t('Not kept. On this day:')}</span> <span lang="la">${esc(other?.[0] ?? '—')}</span>${other ? ` <span class="cnote">(${esc(other[1])})</span>` : ''}</td></tr>`;
  }).join('');

  // Commemorated: the days whose commemorations include this feast.
  const comms = years.flatMap((y) => Object.entries(files[`${state.version}/${y}`]?.days ?? {})
    .filter(([, e]) => e[3]?.some((c) => commemorates(c, title)))
    .map(([md, e]) => `<li>${dateButton(`${y}-${md}`)} <span lang="la">${esc(e[0])}</span></li>`));

  $('feast-body').innerHTML = `
    <section class="ccard"><h2>${t('When it falls')}</h2><dl>${when}</dl></section>
    <section class="ccard"><h2>${t('In each version')}</h2>
      <div class="table-scroll"><table class="versions-table">
        <thead><tr><th scope="col">${t('Version')}</th><th scope="col">${t('Date')}</th><th scope="col">${t('Rank')}</th><th scope="col">${t('Liturgical colour')}</th></tr></thead>
        <tbody>${rows}</tbody></table></div>
      <p class="cnote">${t('The same feast in another version is recognised by its title, {year}.', { year })}</p></section>
    <section class="ccard"><h2>${t('Commemorated')}</h2>
      ${comms.length ? `<ul class="comm-list">${comms.join('')}</ul>` : `<p class="cnote">${t('Not commemorated on other days in {years}.', { years: years.join('–') })}</p>`}</section>`;
}
