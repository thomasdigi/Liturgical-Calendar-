// The week strip, the month view, and fasting marks.
import { fetchMonth, summariesFor } from './data.js';
import { RANGE, day, inRange, state } from './state.js';
import { $, COLORS, COLOR_NAMES, esc, isoToday, monthOf, shift } from './util.js';

/** Fast without full abstinence: meat at the principal meal only (older summaries lack the field). */
export const isPartial = (f) => !!f && (f.partial ?? (f.fast && !f.abstinence));

export function fastText(f) {
  if (!f || (!f.fast && !f.abstinence)) return '';
  const what = f.fast && f.abstinence ? 'Fast and abstinence' : isPartial(f) ? 'Fast and partial abstinence' : f.fast ? 'Fast' : 'Abstinence';
  return `${what}${f.note ? ` ${f.note}` : ''}${f.reasons.length ? ` · ${f.reasons.join(', ')}` : ''}`;
}

/**
 * The F and A marks. Tapping one opens a small pop-up (see fastTipHtml): fasting or
 * abstinence, and whether current Church law requires it or it's only suggested.
 * Summaries built before `required` existed show the marks without that detail.
 */
export function fastMarks(f) {
  if (!f) return '';
  const mark = (kind, letter, label) => {
    // Partial abstinence is no longer required by current law anywhere.
    const req = kind === 'partial' ? (f.required ? false : undefined) : f.required?.[kind === 'fast' ? 'fast' : 'abstinence'];
    const status = req === undefined ? '' : req ? ', mandatory' : ', suggested';
    return `<span class="fastmark ${kind}${req === false ? ' suggested' : ''}" role="button" tabindex="0"
      data-kind="${kind}" data-req="${req === undefined ? '' : req ? '1' : '0'}"
      data-reasons="${esc(f.reasons.join(', '))}" data-note="${esc(f.note ?? '')}"
      aria-label="${label}${status}. Tap for details">${letter}</span>`;
  };
  return (f.fast ? mark('fast', 'F', 'Day of fasting') : '') + (f.abstinence ? mark('abst', 'A', 'Day of abstinence') : '') +
    (isPartial(f) ? mark('partial', 'P', 'Partial abstinence: meat at the principal meal only') : '');
}

/** The pop-up for a tapped mark. */
export function fastTipHtml(el) {
  const fast = el.dataset.kind === 'fast';
  const req = el.dataset.req;
  if (el.dataset.kind === 'partial') {
    return `<p class="tip-title">Partial abstinence</p><p>Meat may be eaten at the principal meal only.</p>` +
      (req === '0' ? `<p class="tip-status suggested">Suggested</p><p>Kept by the traditional discipline of this calendar (1917 Code); no longer required.</p>` : '') +
      (el.dataset.reasons ? `<p class="tip-small">${esc(el.dataset.reasons)}</p>` : '');
  }
  const reasons = el.dataset.reasons;
  let status = '';
  if (req === '1') {
    status = `<p class="tip-status mandatory">Mandatory</p><p>Required by current Church law.</p>` +
      (!fast && !/Lent|Ash Wednesday/.test(reasons)
        ? '<p class="tip-small">Outside Lent, bishops may allow another penance instead of abstinence (as in the USA).</p>' : '');
  } else if (req === '0') {
    status = `<p class="tip-status suggested">Suggested</p><p>Kept by the traditional discipline of this calendar (1917 Code); no longer required.</p>`;
  }
  return `<p class="tip-title">${fast ? 'Day of fasting' : 'Day of abstinence'}${el.dataset.note && fast ? ` (${esc(el.dataset.note)})` : ''}</p>` +
    status + (reasons ? `<p class="tip-small">${esc(reasons)}</p>` : '');
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
    const today = date === isoToday() ? ' today' : '';
    return `<button type="button" class="wday${date === state.date ? ' current' : ''}${today}" data-date="${date}"${usable ? '' : ' disabled'}
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
    return `<li class="mrow${sunday ? ' sunday' : ''}${s.date === state.date ? ' current' : ''}${s.date === isoToday() ? ' today' : ''}">
      <button type="button" data-date="${s.date}"${ok ? '' : ' disabled'}>
        <span class="md"><b>${dt.getUTCDate()}</b> ${dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}</span>
        <span class="mc"><span class="swatch" style="background:${COLORS[s.color]}" title="${COLOR_NAMES[s.color]}"></span></span>
        <span class="mt">${esc(s.title)}${s.commemorations.length ? `<small>Com. ${esc(s.commemorations.join('; '))}</small>` : ''}</span>
        <span class="mr">${esc(s.rank)}</span>
        <span class="mf">${fastMarks(s.fasting)}</span>
      </button></li>`;
  }).join('');
}
