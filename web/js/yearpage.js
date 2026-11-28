// The Year page: the whole liturgical year as a wheel with the moveable feasts marked, and an
// Easter calculator: pick any year and see when Easter, Ash Wednesday, Pentecost… fall.
// Computed (Gregorian Easter), so it works for any year from 1583, not only the dates on the site.
import { state } from './state.js';
import { $, esc } from './util.js';
import { adventStart, easter, ringSvg, tapToDate } from './wheel.js';
import { fmtDate, t } from './ui.js';

const DAY = 86_400_000;
const add = (iso, n) => new Date(Date.parse(`${iso}T12:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/** The last Sunday of October (Christ the King, from 1925). */
function lastSundayOfOctober(year) {
  const d = new Date(Date.UTC(year, 9, 31, 12));
  d.setUTCDate(31 - d.getUTCDay());
  return d.toISOString().slice(0, 10);
}

/**
 * The moveable feasts of a (civil) year. `mark`: shown as a number on the wheel.
 * Some feasts only exist in the later calendars: Christ the King (1925), the Sacred Heart (1856).
 */
export function moveableFeasts(year, version = state.version) {
  const E = easter(year);
  const old = version === '1570' || version === '1906';
  const list = [
    { key: 'Septuagesima Sunday', date: add(E, -63), mark: true },
    { key: 'Ash Wednesday', date: add(E, -46), mark: true },
    { key: 'Passion Sunday', date: add(E, -14) },
    { key: 'Palm Sunday', date: add(E, -7) },
    { key: 'Easter Sunday', date: E, mark: true },
    { key: 'Ascension', date: add(E, 39), mark: true },
    { key: 'Pentecost', date: add(E, 49), mark: true },
    { key: 'Trinity Sunday', date: add(E, 56) },
    { key: 'Corpus Christi', date: add(E, 60), mark: true },
    version === '1570' ? null : { key: 'Sacred Heart', date: add(E, 68) },
    old ? null : { key: 'Christ the King', date: lastSundayOfOctober(year), mark: true },
    { key: 'First Sunday of Advent', date: adventStart(year), mark: true },
  ].filter(Boolean);
  let n = 0;
  for (const f of list) if (f.mark) f.n = ++n;
  // How many Sundays after Epiphany and after Pentecost this year has.
  const sundaysBetween = (from, to) => { // Sundays strictly after `from` and before `to`
    let n = 0;
    for (let d = add(from, 1); d < to; d = add(d, 1)) if (new Date(`${d}T12:00:00Z`).getUTCDay() === 0) n++;
    return n;
  };
  const epiphanySundays = sundaysBetween(`${year}-01-06`, add(E, -63));
  const pentecostSundays = sundaysBetween(add(E, 49), adventStart(year));
  return { list, epiphanySundays, pentecostSundays };
}

let shownYear = null;

export function renderYear(onOpen) {
  const year = shownYear ?? +state.date.slice(0, 4);
  shownYear = year;
  $('year-input').value = String(year);
  const { list, epiphanySundays, pentecostSundays } = moveableFeasts(year);
  // The liturgical year whose Easter is in this year: from Advent of the year before.
  const ring = ringSvg(easter(year), { prefix: 'y', arrow: false, marks: list.filter((f) => f.mark).map((f) => ({ date: f.date, n: f.n })) });
  $('year-svg').innerHTML = ring.svg;
  $('year-num').textContent = String(year);
  $('year-easter').textContent = `${t('Easter Sunday')}: ${fmtDate(easter(year), 'medium')}`;
  $('moveable').innerHTML = list.map((f) => `<li><button type="button" data-date="${f.date}">
      <span class="mv-n">${f.n ?? ''}</span><span class="mv-name">${esc(t(f.key))}</span><span class="mv-date">${esc(fmtDate(f.date, 'medium'))}</span></button></li>`).join('');
  $('year-sundays').textContent = t('{e} Sundays after Epiphany · {p} Sundays after Pentecost', { e: epiphanySundays, p: pentecostSundays });
  $('year-wheel').onclick = (e) => {
    const d = tapToDate(e, $('year-svg'), ring);
    if (d) onOpen(d);
  };
}

export function initYear(onOpen) {
  const set = (y) => {
    if (!(y >= 1583 && y <= 4099)) return;
    shownYear = y;
    renderYear(onOpen);
  };
  $('year-prev').onclick = () => set(shownYear - 1);
  $('year-next').onclick = () => set(shownYear + 1);
  $('year-input').onchange = (e) => set(Number(e.target.value));
  $('moveable').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-date]');
    if (b) onOpen(b.dataset.date);
  });
}
