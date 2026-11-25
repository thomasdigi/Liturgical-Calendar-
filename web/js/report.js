// Reporting a mistake: by email (opens the reader's mail app) or as a GitHub issue (needs a
// GitHub account; the issue list is public, so everyone can see what's been reported and fixed).
// Both come filled in with what was on screen: the date, calendar, version, language and part.
import { comboLabel, config, currentPartId, day, lang, shownLangId, state } from './state.js';

export const REPORT_EMAIL = 'thomasdigi2@gmail.com';
export const ISSUES_URL = 'https://github.com/thomasdigi/Liturgical-Calendar-/issues';

function details() {
  const part = state.page !== 'day' ? `${state.page} page`
    : state.view === 'mass' ? `Mass (${currentPartId()})`
    : `${config.hours.find((h) => h.id === state.hour)?.label ?? state.hour}${state.office !== 'day' ? ` (${state.office})` : ''}`;
  return [
    `Page: ${location.href}`,
    `Date: ${state.date}${day?.header?.title ? ` (${day.header.title})` : ''}`,
    `Calendar and version: ${comboLabel(state.calendar, state.version)}`,
    `Language: ${lang(shownLangId()).label}`,
    `Part: ${part}`,
    `Device: ${navigator.userAgent}`,
  ].join('\n');
}

const subject = () => `Mistake on ${state.date}`;
const intro = 'What is wrong (and, if you know, what it should be):\n\n\n\n---\n';

export const mailLink = () =>
  `mailto:${REPORT_EMAIL}?subject=${encodeURIComponent(subject())}&body=${encodeURIComponent(`${intro}${details()}\n`)}`;

export const issueLink = () =>
  `${ISSUES_URL}/new?labels=mistake&title=${encodeURIComponent(subject())}&body=${encodeURIComponent(`${intro}\`\`\`\n${details()}\n\`\`\`\n`)}`;

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
