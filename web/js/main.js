// Start-up and loading: wires the controls to the state.
import { fastTipHtml, renderMonth, renderWeek } from './calendar.js';
import { hideTip, initTips, toggleTip } from './tip.js';
import { defaultComparison, fixComparison, openInfo, syncControls, syncMasses, syncOffice, updateUrl } from './controls.js';
import { fetchDay } from './data.js';
import { runFeastSearch, runSearch, syncSearchOptions } from './search.js';
import { RANGE, avail, calendarHas, clampDate, comboBuilt, config, day, maxSizeIndex, params, setAvail, setConfig, setDay, setRANGE, shownLangId, sizeIndex, state } from './state.js';
import { render, setPendingScroll } from './text.js';
import { renderSacristan } from './sacristan.js';
import { renderWheel } from './wheel.js';
import { initOffline, offlineHint } from './offline.js';
import { scrollToTarget } from './outline.js';
import { initSettings } from './settings.js';
import { restorePlace, trackReading } from './lastread.js';
import { initTheme } from './theme.js';
import { initTypography } from './typography.js';
import { fmtDate, initUi, t } from './ui.js';
import { initReport } from './report.js';
import { $, isoToday, monthOf, shift, store } from './util.js';

export async function init() {
  try {
    setConfig(await (await fetch('data/config.json')).json());
  } catch {
    $('title').textContent = t('Could not load settings');
    return;
  }
  try {
    const res = await fetch('data/available.json');
    if (res.ok) {
      setAvail(await res.json());
      setRANGE({ first: avail.first, last: avail.last });
      state.date = clampDate(state.date);
    }
  } catch { /* local server: everything available */ }
  const has = (list, id) => list.some((x) => x.id === id);
  if (!has(config.calendars, state.calendar)) state.calendar = config.calendars[0].id;
  if (!has(config.versions, state.version)) state.version = config.versions[0].id;
  if (!has(config.languages, state.lang)) state.lang = config.defaultLanguage ?? 'en';
  if (!has(config.languages, state.altLang)) state.altLang = config.fallbackLanguage;
  if (!has(config.hours, state.hour)) state.hour = config.hours[0].id;
  if (!calendarHas(state.calendar, state.version)) state.calendar = config.calendars[0].id;
  if (!comboBuilt(state.calendar, state.version)) {
    const [c, v] = Object.keys(avail.combos)[0].split('/');
    state.calendar = c; state.version = v;
  }
  if (RANGE) Object.assign($('date'), { min: RANGE.first, max: RANGE.last });

  $('calendar').onchange = (e) => { state.calendar = e.target.value; store.set('calendar', state.calendar); syncControls(); load(); };
  $('version').onchange = (e) => { state.version = e.target.value; store.set('version', state.version); syncControls(); load(); };
  $('lang').onchange = (e) => { state.lang = e.target.value; store.set('lang', state.lang); syncControls(); load(); };
  document.querySelectorAll('#display button').forEach((b) => (b.onclick = () => {
    state.display = b.dataset.display; store.set('display', state.display); syncControls();
  }));
  document.querySelectorAll('#layout button').forEach((b) => (b.onclick = () => {
    if (b.disabled) return;
    state.layout = b.dataset.layout; store.set('layout', state.layout); syncControls();
  }));
  document.querySelectorAll('#massmode button[data-mass]').forEach((b) => (b.onclick = () => {
    if (b.disabled) return;
    state.massMode = b.dataset.mass; store.set('massMode', state.massMode); syncControls(); render();
  }));
  $('office').onchange = (e) => { state.office = e.target.value; syncControls(); render(); };
  $('compare').onclick = () => {
    state.compare = !state.compare;
    if (state.compare && !state.cmpVersion) defaultComparison();
    syncControls(); render();
  };
  $('cmp-calendar').onchange = (e) => { state.cmpCalendar = e.target.value; fixComparison(); syncControls(); render(); };
  $('cmp-version').onchange = (e) => { state.cmpVersion = e.target.value; fixComparison(); syncControls(); render(); };
  $('outline').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-target]');
    if (b) scrollToTarget(b.dataset.target);
  });
  $('chant').onclick = () => {
    if ($('chant').disabled) return;
    state.chant = !state.chant; store.set('chant', state.chant ? 'on' : 'off'); syncControls(); render();
  };
  // Buttons on the Sacristan page open the Mass or an Hour of the day.
  $('sacristan-body').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-open]');
    if (!b) return;
    state.page = 'day';
    state.office = 'day';
    if (b.dataset.open === 'mass') state.view = 'mass';
    else { state.view = 'office'; state.hour = b.dataset.open; }
    store.set('view', state.view);
    syncControls(); load(); window.scrollTo(0, 0);
  });
  $('martyrology').onclick = () => {
    state.office = 'day';
    if (state.hour === 'prime') {
      document.querySelector('#text section.martyrology')?.scrollIntoView({ block: 'start' });
      return;
    }
    state.hour = 'prime';
    setPendingScroll('martyrology');
    syncControls(); render();
  };
  // The outline bar sticks below the top bar, whose height depends on the screen.
  if (window.ResizeObserver) {
    // The top bar always stays; the controls below it stay too on wide screens (scroll away on phones).
    const bars = () => {
      const app = $('appbar').offsetHeight;
      const top = document.querySelector('.top');
      const sticky = getComputedStyle(top).position === 'sticky';
      document.documentElement.style.setProperty('--appbar', `${app}px`);
      document.documentElement.style.setProperty('--topbar', `${app + (sticky ? top.offsetHeight : 0)}px`);
    };
    const ro = new ResizeObserver(bars);
    ro.observe(document.querySelector('.top'));
    ro.observe($('appbar'));
  }
  $('searchform').onsubmit = (e) => { e.preventDefault(); runFeastSearch(); runSearch(); };
  // Feasts and saints appear as you type; tap one to open its day.
  let feastTimer;
  $('q').addEventListener('input', () => { clearTimeout(feastTimer); feastTimer = setTimeout(runFeastSearch, 250); });
  $('feastlist').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-date]');
    if (!b) return;
    state.page = 'day';
    syncControls();
    go(b.dataset.date);
    window.scrollTo(0, 0);
  });
  // The menu (left panel) asks for a page: the Sacristan page or a devotion.
  window.addEventListener('open-page', (e) => {
    state.page = e.detail.page;
    if (e.detail.devotion) state.devotion = e.detail.devotion;
    syncControls(); load(); window.scrollTo(0, 0);
  });
  // Top bar: search opens (or closes) the search page; the menu opens the left panel.
  $('search-btn').onclick = () => {
    state.page = state.page === 'search' ? 'day' : 'search';
    syncControls(); load(); window.scrollTo(0, 0);
  };
  $('results').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-hit]');
    if (b) openHit(JSON.parse(b.dataset.hit));
  });
  $('masschoice').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-n]');
    if (!b) return;
    state.massN = Number(b.dataset.n); syncMasses(); updateUrl(); render();
  });
  document.querySelectorAll('#view button').forEach((b) => (b.onclick = () => {
    state.view = b.dataset.view; store.set('view', state.view); syncControls(); load();
  }));
  document.querySelectorAll('#page button').forEach((b) => (b.onclick = () => {
    state.page = b.dataset.page; syncControls(); load(); window.scrollTo(0, 0);
  }));
  $('month-prev').onclick = () => { const [y, m] = monthOf(state.date).split('-').map(Number); go(new Date(Date.UTC(y, m - 2, 1)).toISOString().slice(0, 10)); };
  $('month-next').onclick = () => { const [y, m] = monthOf(state.date).split('-').map(Number); go(new Date(Date.UTC(y, m, 1)).toISOString().slice(0, 10)); };
  const openDay = (e) => {
    const b = e.target.closest('button[data-date]');
    if (!b || b.disabled) return;
    state.page = 'day';
    go(b.dataset.date);
  };
  $('month-list').addEventListener('click', openDay);
  $('month-today').onclick = () => go(isoToday());
  $('wheel-prev').onclick = () => go(shift(state.date, -1));
  $('wheel-next').onclick = () => go(shift(state.date, 1));
  $('week').addEventListener('click', openDay);
  document.querySelectorAll('#size button').forEach((b) => (b.onclick = () => {
    if (b.disabled) return;
    // Start from the size actually shown (it may be capped for two columns).
    state.size = Math.min(maxSizeIndex() - 2, Math.max(-2, sizeIndex() - 2 + Number(b.dataset.size)));
    store.set('textSize', String(state.size)); syncControls();
  }));
  // Turning the phone changes which text sizes fit in two columns.
  let resizeTimer;
  window.addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(syncControls, 200); });
  $('reading').onclick = () => { state.reading = !state.reading; store.set('reading', state.reading ? 'on' : 'off'); syncControls(); };
  $('jump').onchange = (e) => {
    const el = document.getElementById(e.target.value);
    if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    e.target.value = '';
  };
  $('totop').onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  window.addEventListener('scroll', () => { $('totop').hidden = window.scrollY < 600 || state.page === 'month' || state.page === 'search'; }, { passive: true });
  $('prev').onclick = () => go(shift(state.date, -1));
  $('next').onclick = () => go(shift(state.date, 1));
  $('today').onclick = () => go(isoToday());
  $('date').onchange = (e) => e.target.value && go(e.target.value);
  $('alt-lang').onchange = (e) => { state.altLang = e.target.value; store.set('altLang', state.altLang); syncControls(); load(); };
  $('text').addEventListener('click', (e) => { if (e.target.closest('.info')) openInfo(e.target.closest('.info').dataset.kind); });
  $('fallback').addEventListener('click', (e) => { if (e.target.closest('.info')) openInfo('view'); });
  document.addEventListener('keydown', (e) => {
    if (/INPUT|SELECT/.test(e.target.tagName) || $('info').open) return;
    if (e.key === 'ArrowLeft') go(shift(state.date, -1));
    if (e.key === 'ArrowRight') go(shift(state.date, 1));
  });

  // Opened without naming a Mass or Hour: continue where this day was left.
  if (!params.has('view') && !params.has('hour') && state.page === 'day') restorePlace(state.date);
  syncControls();
  load();
}

export let loadSeq = 0;

/** The devotions in the menu. Latin names stay Latin in every language of the app. */
export const DEVOTIONS = { rosary: 'Rosary', mercy: 'Divine Mercy', stations: 'Stations of the Cross', 'via-petri': 'Via Petri', angelus: 'Angelus' };
const LATIN_NAMES = new Set(['via-petri', 'angelus']);
function renderDevotion() {
  if (!(state.devotion in DEVOTIONS)) state.devotion = 'rosary';
  const name = DEVOTIONS[state.devotion];
  $('devotion-title').textContent = LATIN_NAMES.has(state.devotion) ? name : t(name);
  $('devotion-title').lang = LATIN_NAMES.has(state.devotion) ? 'la' : '';
}

export async function load() {
  const seq = ++loadSeq;
  updateUrl();
  $('date').value = state.date;
  if (state.page === 'month') {
    renderMonth();
    // The wheel: tapping the ring moves the day (and the month list with it); the middle opens it.
    renderWheel((date, open) => { if (open) state.page = 'day'; if (open) syncControls(); go(date); });
    return;
  }
  if (state.page === 'search') { syncSearchOptions(); return; }
  if (state.page === 'sacristan') { renderWeek(); renderSacristan(); return; }
  if (state.page === 'devotion') { renderDevotion(); return; }
  renderWeek();
  const shown = shownLangId();
  try {
    const d = await fetchDay(shown);
    if (seq !== loadSeq) return;
    setDay(d);
  } catch {
    if (seq !== loadSeq) return;
    setDay(null);
    $('weekday').textContent = '';
    $('title').textContent = t('Not available');
    $('rank').textContent = ''; $('comm').textContent = ''; $('swatch').style.background = 'transparent';
    $('hours').innerHTML = '';
    $('fallback').hidden = true;
    $('text').innerHTML = navigator.onLine
      ? `<p class="msg">${t(RANGE ? 'No texts for {date} in this calendar, version and language on this site.' : 'No texts for {date} in this calendar, version and language yet.', { date: fmtDate(state.date, 'long') })}</p>`
      : `<p class="msg">${offlineHint().trim()}</p>`;
    $('masschoice').hidden = true;
    return;
  }
  if (state.massN > Math.max(1, day.masses?.length ?? 0)) state.massN = 1;
  syncMasses();
  syncOffice();
  render();
}

/**
 * Move to another day. It opens where you left off reading that day (see lastread.js),
 * otherwise on the same Mass or Hour as now, at the top of the page.
 */
export function go(date, { animate = 0 } = {}) {
  const changed = clampDate(date) !== state.date;
  state.date = clampDate(date);
  if (changed && state.page === 'day') {
    const back = restorePlace(state.date);
    if (!back) window.scrollTo(0, 0);
    syncControls();
  }
  if (animate && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const el = state.page === 'month' ? $('month') : state.page === 'sacristan' ? $('sacristan') : $('dayview');
    el.classList.remove('swipe-next', 'swipe-prev');
    void el.offsetWidth; // restart the animation
    el.classList.add(animate > 0 ? 'swipe-next' : 'swipe-prev');
  }
  load();
}

/** Swipe left or right on the page: next or previous day (in the month view, month). */
function initSwipe() {
  let start = null;
  const ignore = (t) => t.closest('.week, .outline, .hours, .top, dialog, input, select, textarea, .tip');
  document.addEventListener('touchstart', (e) => {
    start = e.touches.length === 1 && !ignore(e.target)
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY, t: Date.now() } : null;
  }, { passive: true });
  document.addEventListener('touchend', (e) => {
    if (!start || state.page === 'search' || state.page === 'devotion') return;
    const dx = e.changedTouches[0].clientX - start.x;
    const dy = e.changedTouches[0].clientY - start.y;
    const quick = Date.now() - start.t < 700;
    start = null;
    if (!quick || Math.abs(dx) < 70 || Math.abs(dy) > Math.abs(dx) * 0.6) return;
    if (String(window.getSelection?.() ?? '').length) return; // selecting text, not swiping
    const dir = dx < 0 ? 1 : -1; // swipe left = next
    if (state.page === 'month') {
      const [y, m] = monthOf(state.date).split('-').map(Number);
      go(new Date(Date.UTC(y, m - 1 + dir, 1)).toISOString().slice(0, 10), { animate: dir });
    } else {
      go(shift(state.date, dir), { animate: dir });
    }
  }, { passive: true });
}

/** Open a search result: its day, Mass or Hour, scrolled to the section. */
export function openHit({ date, part, section }) {
  state.date = clampDate(date);
  state.page = 'day';
  state.compare = false;
  const m = /^mass(?:-(\d+))?$/.exec(part);
  if (m) {
    state.view = 'mass';
    state.massMode = 'propers';
    state.massN = Number(m[1] || 1);
  } else {
    state.view = 'office';
    state.office = 'day';
    state.hour = part;
  }
  setPendingScroll(`s${section}`);
  syncControls();
  load();
  window.scrollTo(0, 0);
}

// Fasting marks (F, A) open a small pop-up instead of following the day link they sit in.
// Capture phase: runs before the day buttons' own click handlers.
document.addEventListener('click', (e) => {
  const mark = e.target.closest?.('.fastmark[data-kind]');
  if (mark) {
    e.preventDefault();
    e.stopPropagation();
    toggleTip(mark, fastTipHtml(mark));
  } else {
    hideTip(); // a tap on the bubble itself, or anywhere else, closes it
  }
}, true);
document.addEventListener('keydown', (e) => {
  const mark = e.target.closest?.('.fastmark[data-kind]');
  if (mark && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    e.stopPropagation();
    toggleTip(mark, fastTipHtml(mark));
  }
}, true);

// The app's own language first: it notes the page's English before anything else changes it.
initUi(() => { syncControls(); load(); });
initTheme();
initTypography(() => { syncControls(); load(); });
initReport();
initOffline();
initSettings();
initTips();
initSwipe();
trackReading();
init();
