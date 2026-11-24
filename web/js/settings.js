// The Settings panel (slides in from the side): appearance, offline and install, print.
// New settings go here as sections in index.html (#settings-panel).
import { syncOfflinePanel } from './offline.js';
import { comboBuilt, comboLabel, state } from './state.js';
import { $ } from './util.js';

/** The address of a calendar file for the calendar and version on screen. */
const feedUrl = (kind) => new URL(`data/${state.calendar}/${state.version}/${kind}.ics`, location.href).href;

function syncCalendarExport() {
  const ok = comboBuilt(state.calendar, state.version);
  $('ical-what').textContent = ok
    ? `For ${comboLabel(state.calendar, state.version)}, for the dates on this site.`
    : 'Not available for this calendar and version on this site.';
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

export function initSettings() {
  const panel = $('settings-panel');
  $('settings-btn').onclick = () => {
    syncOfflinePanel();
    syncCalendarExport();
    if (panel.showModal) panel.showModal(); else panel.setAttribute('open', '');
  };
  const close = () => (panel.close ? panel.close() : panel.removeAttribute('open'));
  $('settings-close').onclick = close;
  // Tapping the dimmed area outside the panel closes it.
  panel.addEventListener('click', (e) => { if (e.target === panel) close(); });
  panel.querySelectorAll('.copy-link').forEach((b) => (b.onclick = async () => {
    const url = feedUrl(b.dataset.feed);
    try {
      await navigator.clipboard.writeText(url);
      $('ical-status').textContent = 'Link copied.';
    } catch {
      $('ical-status').textContent = url; // couldn't copy: show it to copy by hand
    }
  }));
  $('print-btn').onclick = () => {
    close();
    // Let the panel disappear before the print preview is taken.
    setTimeout(() => window.print(), 150);
  };
}
