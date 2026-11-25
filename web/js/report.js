// Reporting a mistake: by email (opens the reader's mail app) or as a GitHub issue (needs a
// GitHub account; the issue list is public, so everyone can see what's been reported and fixed).
// Both come filled in with what was on screen: the date, calendar, version, language and part.
import { config, currentPartId, day, lang, shownLangId, state } from './state.js';
import { t } from './ui.js';

export const REPORT_EMAIL = 'thomasdigi2@gmail.com';
export const ISSUES_URL = 'https://github.com/thomasdigi/Liturgical-Calendar-/issues';

/** The facts of the page on screen, in English (for whoever reads the report). */
function details() {
  const cal = config.calendars.find((c) => c.id === state.calendar)?.label ?? state.calendar;
  const ver = config.versions.find((v) => v.id === state.version)?.label ?? state.version;
  const hour = config.hours.find((h) => h.id === state.hour)?.label ?? state.hour;
  const section = state.page === 'day' ? (state.view === 'mass' ? `Mass (${currentPartId()})` : `${hour}${state.office !== 'day' ? ` (${state.office})` : ''}`) : `${state.page} page`;
  return [
    `Date: ${state.date}${day?.header?.title ? ` (${day.header.title})` : ''}`,
    `Calendar: ${cal}, ${ver}`,
    `Language: ${lang(shownLangId()).label}`,
    `Section: ${section}`,
    `Link: ${location.href}`,
  ].join('\n');
}

const subject = () => `Error report: ${state.date}`;
// The request is in the reader's language; the details below it stay in English.
const body = () => `${t('Please describe the error:')}\n\n\n\n--\n${details()}\n`;

export const mailLink = () =>
  `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(subject())}&body=${encodeURIComponent(body())}`;

export const issueLink = () =>
  `${ISSUES_URL}/new?labels=mistake&title=${encodeURIComponent(subject())}&body=${encodeURIComponent(body())}`;

/** Keep the report links filled in with what's on screen (called before they're shown). */
export function syncReportLinks() {
  document.querySelectorAll('a[data-report="mail"]').forEach((a) => (a.href = mailLink()));
  document.querySelectorAll('a[data-report="issue"]').forEach((a) => (a.href = issueLink()));
}

export function initReport() {
  // Fill the links in at the moment they're used, so they describe the current page.
  document.addEventListener('pointerdown', (e) => { if (e.target.closest?.('a[data-report]')) syncReportLinks(); }, true);
  document.addEventListener('focusin', (e) => { if (e.target.closest?.('a[data-report]')) syncReportLinks(); });
}
