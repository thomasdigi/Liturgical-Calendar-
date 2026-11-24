// The week strip, the month view, and fasting marks.
import { fetchMonth, summariesFor } from './data.js';
import { RANGE, day, inRange, state } from './state.js';
import { $, COLORS, COLOR_NAMES, esc, monthOf, shift } from './util.js';

export function fastText(f) {
  if (!f || (!f.fast && !f.abstinence)) return '';
  const what = f.fast && f.abstinence ? 'Fast and abstinence' : f.fast ? 'Fast' : 'Abstinence';
  return `${what}${f.note ? ` ${f.note}` : ''}${f.reasons.length ? ` · ${f.reasons.join(', ')}` : ''}`;
}

export function fastMarks(f) {
  if (!f) return '';
  return (f.fast ? '<span class="fastmark fast" title="Fast">F</span>' : '') +
    (f.abstinence ? '<span class="fastmark abst" title="Abstinence">A</span>' : '');
}

export let weekSeq = 0;

/** The week (Sunday to Saturday) around the current date, plus today's fasting line. */
export async function renderWeek() {
  const seq = ++weekSeq;
  const d = new Date(`${state.date}T12:00:00Z`);
  const start = shift(state.date, -d.getUTCDay());
  const dates = Array.from({ length: 7 }, (_, i) => shift(start, i));
  const sums = await summariesFor(dates);
  if (seq !== weekSeq) return;
  $('week').innerHTML = dates.map((date, i) => {
    const s = sums[i];
    const wd = new Date(`${date}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
    const usable = s && inRange(date);
    return `<button type="button" class="wday${date === state.date ? ' current' : ''}" data-date="${date}"${usable ? '' : ' disabled'}
      ${date === state.date ? 'aria-current="date"' : ''} title="${esc(s ? `${s.title} · ${s.rank}` : date)}">
      <span class="wd">${wd} ${+date.slice(8)}</span>
      <span class="wt"><span class="dot" style="background:${s ? COLORS[s.color] : 'transparent'}"></span>${esc(s ? s.title : '—')}</span>
      <span class="wf">${fastMarks(s?.fasting)}</span>
    </button>`;
  }).join('');
  // On narrow screens the strip scrolls: bring the current day into view.
  const cur = $('week').querySelector('.current');
  if (cur && $('week').scrollWidth > $('week').clientWidth) {
    const w = $('week'), r = cur.getBoundingClientRect(), wr = w.getBoundingClientRect();
    w.scrollLeft += r.left - wr.left - (w.clientWidth - r.width) / 2;
  }
  const today = sums[dates.indexOf(state.date)];
  const ft = fastText(today?.fasting);
  $('fastline').hidden = !ft;
  $('fastline').innerHTML = ft ? `${fastMarks(today.fasting)} <span>${esc(ft)}</span>` : '';
}

export let monthSeq = 0;

export async function renderMonth() {
  const seq = ++monthSeq;
  const month = monthOf(state.date);
  const [y, m] = month.split('-').map(Number);
  $('month-title').textContent = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  $('month-list').innerHTML = '<li class="msg">Loading…</li>';
  let data;
  try { data = await fetchMonth(month); } catch { data = null; }
  if (seq !== monthSeq) return;
  if (!data) {
    $('month-list').innerHTML = `<li class="msg">No calendar for this month${RANGE ? ' on this site' : ' yet'}.</li>`;
    return;
  }
  $('month-list').innerHTML = data.days.map((s) => {
    const dt = new Date(`${s.date}T12:00:00Z`);
    const sunday = dt.getUTCDay() === 0;
    const ok = inRange(s.date);
    return `<li class="mrow${sunday ? ' sunday' : ''}${s.date === state.date ? ' current' : ''}">
      <button type="button" data-date="${s.date}"${ok ? '' : ' disabled'}>
        <span class="md"><b>${dt.getUTCDate()}</b> ${dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}</span>
        <span class="mc"><span class="swatch" style="background:${COLORS[s.color]}" title="${COLOR_NAMES[s.color]}"></span></span>
        <span class="mt">${esc(s.title)}${s.commemorations.length ? `<small>Com. ${esc(s.commemorations.join('; '))}</small>` : ''}</span>
        <span class="mr">${esc(s.rank)}</span>
        <span class="mf">${fastMarks(s.fasting)}</span>
      </button></li>`;
  }).join('');
}
