// Counting visits, privately. Which pages are opened and which features are used, so the next
// improvements can be chosen from facts. Sent to GoatCounter (goatcounter.com): no cookies, nothing
// stored on the device, no personal data, no IP addresses kept. Only names like "page/month" or
// "feature/chant": never the date read, a search's words, or anything about the person.
//
// Off unless the site has a GoatCounter code (config.json "analytics", set when the site is built:
// see .github/workflows/pages.yml), off for browsers that ask not to be tracked (Do Not Track,
// Global Privacy Control), off on a computer's own copy (localhost), and the reader can turn it off
// in Settings → About.
import { store } from './util.js';

let code = '';

const allowed = () =>
  !!code &&
  store.get('analytics', 'on') === 'on' &&
  navigator.doNotTrack !== '1' && !navigator.globalPrivacyControl &&
  !/^(localhost|127\.|\[::1\])/.test(location.hostname) &&
  navigator.onLine;

function send(path, event) {
  if (!allowed()) return;
  const q = new URLSearchParams({ p: path, t: event ? '' : document.title, e: event ? 'true' : 'false', rnd: String(Math.random()).slice(2, 10) });
  // A tiny image request: the simplest way GoatCounter counts, with no script of theirs on the page.
  new Image().src = `https://${code}.goatcounter.com/count?${q}`;
}

let lastPage = '';
/** A page was shown ("day/office/lauds", "month", "devotion/angelus"…). */
export function trackPage(path) {
  if (path === lastPage) return;
  lastPage = path;
  send(`/${path}`, false);
}

const once = new Set();
/** A feature was used ("feature/chant", "print/ordo"…). `perSession`: count it once a visit (settings). */
export function trackEvent(name, { perSession = false } = {}) {
  if (perSession) {
    if (once.has(name)) return;
    once.add(name);
  }
  send(name, true);
}

export function initAnalytics(config) {
  code = /^[a-z0-9-]{2,50}$/.test(config?.analytics?.goatcounter ?? '') ? config.analytics.goatcounter : '';
  const box = document.getElementById('analytics-on');
  box.checked = store.get('analytics', 'on') === 'on';
  box.onchange = () => store.set('analytics', box.checked ? 'on' : 'off');
  // Settings the reader uses, once a visit: what's worth improving.
  if (code) {
    trackEvent(`setting/app-language/${document.documentElement.lang}`, { perSession: true });
  }
}
