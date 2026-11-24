// Start-up and loading: wires the controls to the state.
import { fastTipHtml, renderMonth, renderWeek } from './calendar.js';
import { hideTip, initTips, showTip } from './tip.js';
import { defaultComparison, fixComparison, openInfo, syncControls, syncMasses, syncOffice, updateUrl } from './controls.js';
import { fetchDay } from './data.js';
import { runSearch, syncSearchOptions } from './search.js';
import { RANGE, SIZES, avail, calendarHas, clampDate, comboBuilt, config, day, setAvail, setConfig, setDay, setRANGE, shownLangId, state } from './state.js';
import { render, setPendingScroll } from './text.js';
import { initOffline, offlineHint } from './offline.js';
import { scrollToTarget } from './outline.js';
import { initSettings } from './settings.js';
import { initTheme } from './theme.js';
import { $, isoToday, monthOf, shift, store } from './util.js';

export async function init() {
  try {
    setConfig(await (await fetch('data/config.json')).json());
  } catch {
    $('title').textContent = 'Could not load settings';
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
    new ResizeObserver(() => document.documentElement.style.setProperty('--topbar', `${document.querySelector('.top').offsetHeight}px`))
      .observe(document.querySelector('.top'));
  }
  $('searchform').onsubmit = (e) => { e.preventDefault(); runSearch(); };
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
    state.date = b.dataset.date; state.page = 'day'; syncControls(); load(); window.scrollTo(0, 0);
  };
  $('month-list').addEventListener('click', openDay);
  $('week').addEventListener('click', openDay);
  document.querySelectorAll('#size button').forEach((b) => (b.onclick = () => {
    state.size = Math.min(SIZES.length - 3, Math.max(-2, state.size + Number(b.dataset.size)));
    store.set('textSize', String(state.size)); syncControls();
  }));
  $('reading').onclick = () => { state.reading = !state.reading; store.set('reading', state.reading ? 'on' : 'off'); syncControls(); };
  $('jump').onchange = (e) => {
    const el = document.getElementById(e.target.value);
    if (el) el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    e.target.value = '';
  };
  $('totop').onclick = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  window.addEventListener('scroll', () => { $('totop').hidden = window.scrollY < 600 || state.page !== 'day'; }, { passive: true });
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

  syncControls();
  load();
}

export let loadSeq = 0;

export async function load() {
  const seq = ++loadSeq;
  updateUrl();
  $('date').value = state.date;
  if (state.page === 'month') { renderMonth(); return; }
  if (state.page === 'search') { syncSearchOptions(); return; }
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
    $('title').textContent = 'Not available';
    $('rank').textContent = ''; $('comm').textContent = ''; $('swatch').style.background = 'transparent';
    $('hours').innerHTML = '';
    $('fallback').hidden = true;
    $('text').innerHTML = navigator.onLine
      ? `<p class="msg">No texts for ${state.date} in this calendar, version and language${RANGE ? ' on this site' : ' yet'}.</p>`
      : `<p class="msg">${offlineHint().trim()}</p>`;
    $('masschoice').hidden = true;
    return;
  }
  if (state.massN > Math.max(1, day.masses?.length ?? 0)) state.massN = 1;
  syncMasses();
  syncOffice();
  render();
}

export function go(date) { state.date = clampDate(date); load(); }

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
    showTip(mark, fastTipHtml(mark));
  } else if (!e.target.closest?.('.tip')) {
    hideTip();
  }
}, true);
document.addEventListener('keydown', (e) => {
  const mark = e.target.closest?.('.fastmark[data-kind]');
  if (mark && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    e.stopPropagation();
    showTip(mark, fastTipHtml(mark));
  }
}, true);

initTheme();
initOffline();
initSettings();
initTips();
init();
