// Remembers, for each day, what you were reading (Mass or which Hour) and how far down,
// and opens the day there again next time. Kept in this browser for the last 60 days visited.
import { state } from './state.js';
import { setPendingScroll } from './text.js';
import { store } from './util.js';

const KEY = 'lastRead';
const MAX = 60;

function all() {
  try { return JSON.parse(store.get(KEY, '{}')) || {}; } catch { return {}; }
}
function save(map) {
  const dates = Object.keys(map);
  for (const d of dates.slice(0, Math.max(0, dates.length - MAX))) delete map[d]; // oldest first
  store.set(KEY, JSON.stringify(map));
}

/** What's on screen, as a place to come back to. */
const place = () => ({ view: state.view, hour: state.hour, office: state.office, massN: state.massN, massMode: state.massMode });
const samePart = (a, b) => a && b && a.view === b.view && (a.view === 'mass'
  ? a.massN === b.massN && a.massMode === b.massMode
  : a.hour === b.hour && a.office === b.office);

/**
 * Note the part being read. `at` is the section at the top of the screen and `off` how far
 * into it (px), if known; otherwise the saved position is kept if it's the same part.
 */
export function rememberPlace(at, off = 0) {
  if (state.page !== 'day') return;
  const map = all();
  const old = map[state.date];
  const now = place();
  delete map[state.date]; // re-insert so it counts as the most recent
  const keep = samePart(old, now);
  map[state.date] = at !== undefined
    ? { ...now, at, off: at ? off : 0 }
    : { ...now, at: keep ? old.at : null, off: keep ? old.off || 0 : 0 };
  save(map);
}

/** Open `date` where it was left, if it was read before. Returns whether there was a place. */
export function restorePlace(date) {
  const p = all()[date];
  if (!p) return false;
  Object.assign(state, { view: p.view, hour: p.hour, office: p.office || 'day', massN: p.massN || 1, massMode: p.massMode || state.massMode });
  if (p.at) setPendingScroll({ id: p.at, flash: false, offset: p.off || 0 });
  return true;
}

/** While reading, keep track of the section at the top of the screen. */
export function trackReading() {
  let timer = null;
  window.addEventListener('scroll', () => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (state.page !== 'day') return;
      const col = document.querySelector('#text .cmp-col') || document.getElementById('text');
      const topBar = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--topbar')) || 0;
      const sticky = window.matchMedia('(max-width: 720px)').matches ? 50 : topBar + 50;
      // The last section that has started at (or above) the top of the reading area.
      const line = sticky + 30;
      let at = null;
      let off = 0;
      for (const el of col.querySelectorAll('section[id]')) {
        const top = el.getBoundingClientRect().top;
        if (top > line) break;
        at = el.id;
        off = Math.round(line - 30 - top); // how far the reading area is into it
      }
      rememberPlace(window.scrollY < 200 ? null : at, Math.max(0, off));
    }, 500);
  }, { passive: true });
}
