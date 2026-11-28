// Printable booklets (Settings → Print, on the day page): the coming Sunday's or a week's texts,
// one day after another, with page numbers; "Save as PDF" in the print dialog makes a PDF.
// The days are laid out like the e-book's chapters (web/js/epub.js): the Latin, then the translation.
import { dayChapter, rangeDates } from './epub.js';
import { comboLabel, inRange, lang, shownLangId, state } from './state.js';
import { esc, shift } from './util.js';
import { fmtDate, t } from './ui.js';

/** The coming Sunday (today, if it's Sunday). */
const comingSunday = (date) => shift(date, (7 - new Date(`${date}T12:00:00Z`).getUTCDay()) % 7);

/** Build the booklet into the page (hidden on screen) and open the print dialog. */
export async function printBooklet({ what, contents }, onProgress = () => {}) {
  const dates = what === 'sunday' ? [comingSunday(state.date)].filter((d) => inRange(d)) : rangeDates('week');
  if (!dates.length) throw new Error(t('No dates on this site for that range.'));
  const langId = shownLangId();
  const display = state.display;
  const days = [];
  for (const [i, date] of dates.entries()) {
    try { days.push({ date, ...(await dayChapter(date, i + 1, { langId, contents, display })) }); } catch { /* not on the site */ }
    onProgress(i + 1, dates.length);
  }
  if (!days.length) throw new Error(t('None of these days could be loaded (are you offline?).'));
  const span = dates.length === 1 ? fmtDate(dates[0], 'long') : t('{from} to {to}', { from: fmtDate(dates[0], 'medium'), to: fmtDate(dates.at(-1), 'medium') });
  const whatTitle = t(contents === 'mass' ? 'The Mass' : contents === 'office' ? 'The Divine Office' : 'The Mass and Divine Office');
  const langs = display === 'latin' ? t('Latin') : display === 'vernacular' ? lang(langId).label : t('Latin and {lang}', { lang: lang(langId).label });
  let el = document.getElementById('booklet-print');
  if (!el) {
    el = document.createElement('div');
    el.id = 'booklet-print';
    document.body.append(el);
  }
  el.innerHTML = `<div class="bk-cover"><h1>${esc(whatTitle)}</h1><p>${esc(span)}</p>
      <p>${esc(comboLabel(state.calendar, state.version))} · ${esc(langs)}</p>
      <p class="bk-small">${t('Texts from Divinum Officium (MIT License).')}</p></div>
    ${days.map((d) => `<article class="bk-day">${d.html}</article>`).join('')}`;
  // Crosses upright, as on screen.
  el.querySelectorAll('.rubric').forEach((r) => { if (/^\s*(✠|✙︎?|\+|‡|†)\s*$/.test(r.textContent)) r.classList.add('cross'); });
  document.body.classList.add('printing-booklet');
  const done = () => { document.body.classList.remove('printing-booklet'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 150);
  return days.length;
}
