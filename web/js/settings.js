// The Settings panel (slides in from the side): appearance, offline and install, print.
// New settings go here as sections in index.html (#settings-panel).
import { syncOfflinePanel } from './offline.js';
import { comboBuilt, comboLabel, state } from './state.js';
import { $ } from './util.js';
import { fmtNum, t } from './ui.js';
import { trackEvent } from './analytics.js';

/** The address of a calendar file for the calendar and version on screen. */
const feedUrl = (kind) => new URL(`data/${state.calendar}/${state.version}/${kind}.ics`, location.href).href;

function syncCalendarExport() {
  const ok = comboBuilt(state.calendar, state.version);
  $('ical-what').textContent = ok
    ? t('For {combo}, for the dates on this site.', { combo: comboLabel(state.calendar, state.version) })
    : t('Not available for this calendar and version on this site.');
  for (const [kind, sub, dl] of [['calendar', 'ical-sub-all', 'ical-dl-all'], ['fasting', 'ical-sub-fast', 'ical-dl-fast']]) {
    const url = feedUrl(kind);
    // webcal:// asks the device's calendar app to subscribe (iPhone, Mac, Outlook).
    $(sub).href = url.replace(/^https?:/, 'webcal:');
    $(dl).href = url;
    $(dl).setAttribute('download', `${kind === 'fasting' ? 'fast-days' : 'liturgical-calendar'}-${state.calendar}-${state.version}.ics`);
    for (const el of [$(sub), $(dl)]) el.classList.toggle('disabled', !ok);
  }
  $('ical-status').textContent = '';
}

/** Re-write the panel's own changing text (after a change of the app's language). */
export function syncSettingsText() {
  syncOfflinePanel();
  syncCalendarExport();
  syncPrint();
}

/** Print is offered on the day page and the month page only. */
function syncPrint() {
  $('print-section').hidden = state.page !== 'day' && state.page !== 'month';
  $('print-day').hidden = state.page !== 'day';
  $('print-month').hidden = state.page !== 'month';
  syncPrintChoice();
}

/** "This page" prints what's on screen; a booklet also asks which texts. */
function syncPrintChoice() {
  const page = $('print-what').value === 'page';
  $('print-contents').disabled = page;
  $('print-day').querySelector('.print-go').textContent = t(page ? 'Print this page' : 'Print the booklet');
}

export function initSettings() {
  const panel = $('settings-panel');
  $('settings-btn').onclick = () => {
    syncOfflinePanel();
    syncCalendarExport();
    syncPrint();
    if (panel.showModal) panel.showModal(); else panel.setAttribute('open', '');
  };
  const close = () => (panel.close ? panel.close() : panel.removeAttribute('open'));
  // The menu (left panel): empty for now.
  const menu = $('menu-panel');
  const closeMenu = () => (menu.close ? menu.close() : menu.removeAttribute('open'));
  $('menu-btn').onclick = () => (menu.showModal ? menu.showModal() : menu.setAttribute('open', ''));
  $('menu-close').onclick = closeMenu;
  menu.addEventListener('click', (e) => { if (e.target === menu) closeMenu(); });
  // Menu items open a page: the Sacristan page, or a devotion.
  menu.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-menu-page], button[data-devotion]');
    if (!b) return;
    closeMenu();
    window.dispatchEvent(new CustomEvent('open-page', { detail: b.dataset.devotion ? { page: 'devotion', devotion: b.dataset.devotion } : { page: b.dataset.menuPage } }));
  });
  $('settings-close').onclick = close;
  // Tapping the dimmed area outside the panel closes it.
  panel.addEventListener('click', (e) => { if (e.target === panel) close(); });
  panel.querySelectorAll('.copy-link').forEach((b) => (b.onclick = async () => {
    const url = feedUrl(b.dataset.feed);
    try {
      await navigator.clipboard.writeText(url);
      $('ical-status').textContent = t('Link copied.');
    } catch {
      $('ical-status').textContent = url; // couldn't copy: show it to copy by hand
    }
  }));
  $('epub-btn').onclick = async () => {
    const btn = $('epub-btn');
    btn.disabled = true;
    $('epub-status').textContent = t('Gathering the texts…');
    try {
      trackEvent(`feature/ebook-${$('epub-range').value}`);
      const { makeEpub } = await import('./epub.js');
      const book = await makeEpub({ range: $('epub-range').value, contents: $('epub-contents').value },
        (done, total) => { $('epub-status').textContent = t('Gathering the texts: day {done} of {total}…', { done, total }); });
      const url = URL.createObjectURL(book.blob);
      const a = Object.assign(document.createElement('a'), { href: url, download: book.filename });
      document.body.append(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
      $('epub-status').textContent = t(book.days === 1 ? 'Done: {file} (1 day, {mb} MB).' : 'Done: {file} ({days} days, {mb} MB).', { file: book.filename, days: book.days, mb: fmtNum(book.blob.size / 1e6) }) +
        (book.missing ? ` ${t(book.missing === 1 ? '1 day was not available and was left out.' : '{n} days were not available and were left out.', { n: book.missing })}` : '');
    } catch (e) {
      $('epub-status').textContent = t("Couldn't make the e-book: {error}", { error: t(e.message) });
    } finally {
      btn.disabled = false;
    }
  };
  $('print-what').onchange = syncPrintChoice;
  document.querySelectorAll('.print-go').forEach((b) => (b.onclick = async () => {
    close();
    // The month page prints the month's Ordo; the day page, what's on screen.
    trackEvent(state.page === 'month' ? 'print/ordo' : $('print-what').value === 'page' ? 'print/page' : `print/booklet-${$('print-what').value}`);
    if (state.page === 'month') {
      const { printOrdo } = await import('./ordoprint.js');
      printOrdo();
    } else if ($('print-what').value !== 'page') {
      // A booklet: the coming Sunday, or a week.
      const { printBooklet } = await import('./booklet.js');
      try {
        await printBooklet({ what: $('print-what').value, contents: $('print-contents').value });
      } catch (e) {
        if (panel.showModal) panel.showModal();
        $('print-status').textContent = e.message;
      }
    } else {
      // Let the panel disappear before the print preview is taken.
      setTimeout(() => window.print(), 150);
    }
  }));
}
