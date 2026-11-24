// Viewer. Loads data/config.json, then
// data/<calendar>/<version>/<lang>/<YYYY>/<MM-DD>.json, and shows the Mass or one Hour.
const $ = (id) => document.getElementById(id);
const COLORS = { white: 'var(--c-white)', red: 'var(--c-red)', green: 'var(--c-green)', violet: 'var(--c-violet)', rose: 'var(--c-rose)', black: 'var(--c-black)' };
const COLOR_NAMES = { white: 'White', red: 'Red', green: 'Green', violet: 'Violet', rose: 'Rose', black: 'Black' };
const INFO_ICON = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="4.8" r="1" fill="currentColor"/><rect x="7.25" y="6.8" width="1.5" height="5" rx=".7" fill="currentColor"/></svg>';

// Optional limits, set by a page that bundles only some dates (e.g. a demo).
const RANGE = window.DATE_RANGE || null;

const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

let config = null;
let day = null; // data for the language actually shown
let altDay = null; // data for the alternative language, used where `day` has gaps
const cache = new Map();
const params = new URLSearchParams(location.search);
const state = {
  date: clampDate(params.get('date') || isoToday()),
  view: params.get('view') || store.get('view', 'office'),
  hour: params.get('hour') || defaultHour(),
  calendar: params.get('calendar') || store.get('calendar', 'general'),
  version: params.get('version') || store.get('version', '1962'),
  lang: params.get('lang') || store.get('lang', 'en'),
  altLang: store.get('altLang', 'en'), // shown where the chosen language has no translation
  display: store.get('display', 'both'),
  layout: store.get('layout', 'interlinear'), // 'interlinear' | 'side'
  massMode: params.get('mass') || store.get('massMode', 'propers'), // 'propers' | 'full'
  page: params.get('page') === 'month' ? 'month' : 'day',
  size: Number(store.get('textSize', '0')) || 0, // steps from normal, see SIZES
  reading: store.get('reading', 'off') === 'on',
};
const SIZES = [0.85, 0.92, 1, 1.12, 1.25, 1.4, 1.6]; // text scale; index 2 is normal
const sizeIndex = () => Math.min(SIZES.length - 1, Math.max(0, 2 + state.size));

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function clampDate(d) {
  if (!RANGE) return d;
  return d < RANGE.first ? RANGE.first : d > RANGE.last ? RANGE.last : d;
}
function defaultHour() {
  const h = new Date().getHours();
  if (h < 5) return 'matins';
  if (h < 7) return 'lauds';
  if (h < 9) return 'prime';
  if (h < 11) return 'terce';
  if (h < 14) return 'sext';
  if (h < 16) return 'none';
  if (h < 20) return 'vespers';
  return 'compline';
}
function shift(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---------- languages ----------

const lang = (id) => config.languages.find((l) => l.id === id) || config.languages[0];
const viewKey = () => (state.view === 'mass' ? 'mass' : 'office');
const offers = (id) => lang(id)[viewKey()];
/** The alternative language for gaps: the user's choice, if it covers this view. */
function altLangId() {
  if (state.altLang !== state.lang && offers(state.altLang)) return state.altLang;
  return config.fallbackLanguage;
}
/** The language whose data is loaded: the chosen one, or the alternative if it isn't offered here. */
const shownLangId = () => (offers(state.lang) ? state.lang : altLangId());
const fullAvailable = () => lang(shownLangId()).fullMass;
const showFull = () => state.massMode === 'full' && fullAvailable();
const viewName = () => (state.view === 'mass' ? 'the Mass' : 'the Divine Office');

// ---------- light / dark ----------
// No saved choice: follow the system setting. Clicking stores an explicit choice.
const darkQuery = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
function isDark() {
  const t = document.documentElement.dataset.theme;
  return t ? t === 'dark' : !!darkQuery?.matches;
}
function syncTheme() {
  const dark = isDark();
  $('theme').setAttribute('aria-pressed', String(dark));
  $('theme').querySelector('.theme-label').textContent = dark ? 'Dark mode: on' : 'Dark mode: off';
}
$('theme').onclick = () => {
  const next = isDark() ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  store.set('theme', next);
  syncTheme();
};
darkQuery?.addEventListener?.('change', syncTheme);
syncTheme();

// ---------- setup ----------

async function init() {
  try {
    config = await (await fetch('data/config.json')).json();
  } catch {
    $('title').textContent = 'Could not load settings';
    return;
  }
  const has = (list, id) => list.some((x) => x.id === id);
  if (!has(config.calendars, state.calendar)) state.calendar = config.calendars[0].id;
  if (!has(config.versions, state.version)) state.version = config.versions[0].id;
  if (!has(config.languages, state.lang)) state.lang = config.languages[0].id;
  if (!has(config.languages, state.altLang)) state.altLang = config.fallbackLanguage;
  if (!has(config.hours, state.hour)) state.hour = config.hours[0].id;
  if (!calendarHas(state.calendar, state.version)) state.calendar = config.calendars[0].id;
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
  document.querySelectorAll('#massmode button').forEach((b) => (b.onclick = () => {
    if (b.disabled) return;
    state.massMode = b.dataset.mass; store.set('massMode', state.massMode); syncControls(); render();
  }));
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

const calendarHas = (cal, version) => (config.calendars.find((c) => c.id === cal)?.versions ?? []).includes(version);

// ---------- loading ----------

async function fetchDay(langId) {
  const key = `${state.calendar}/${state.version}/${langId}/${state.date.slice(0, 4)}/${state.date.slice(5)}`;
  if (!cache.has(key)) {
    const res = await fetch(`data/${key}.json`);
    if (!res.ok) throw new Error(String(res.status));
    cache.set(key, await res.json());
  }
  return cache.get(key);
}

// ---------- month summaries (month view, week strip, fasting) ----------

const monthOf = (iso) => iso.slice(0, 7);
async function fetchMonth(month) {
  const key = `${state.calendar}/${state.version}/summary/${month}`;
  if (!cache.has(key)) {
    const res = await fetch(`data/${key}.json`);
    if (!res.ok) throw new Error(String(res.status));
    cache.set(key, await res.json());
  }
  return cache.get(key);
}
/** Summaries for these dates (null where unavailable). */
async function summariesFor(dates) {
  const months = [...new Set(dates.map(monthOf))];
  const loaded = await Promise.all(months.map((m) => fetchMonth(m).catch(() => null)));
  const byDate = new Map();
  for (const m of loaded) if (m) for (const d of m.days) byDate.set(d.date, d);
  return dates.map((d) => byDate.get(d) || null);
}
const inRange = (d) => !RANGE || (d >= RANGE.first && d <= RANGE.last);

function fastText(f) {
  if (!f || (!f.fast && !f.abstinence)) return '';
  const what = f.fast && f.abstinence ? 'Fast and abstinence' : f.fast ? 'Fast' : 'Abstinence';
  return `${what}${f.note ? ` ${f.note}` : ''}${f.reasons.length ? ` · ${f.reasons.join(', ')}` : ''}`;
}
function fastMarks(f) {
  if (!f) return '';
  return (f.fast ? '<span class="fastmark fast" title="Fast">F</span>' : '') +
    (f.abstinence ? '<span class="fastmark abst" title="Abstinence">A</span>' : '');
}

let weekSeq = 0;
/** The week (Sunday to Saturday) around the current date, plus today's fasting line. */
async function renderWeek() {
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
    return `<button type="button" class="wday${date === state.date ? ' current' : ''}" data-date="${date}"${usable ? '' : ' disabled'}
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

let monthSeq = 0;
async function renderMonth() {
  const seq = ++monthSeq;
  const month = monthOf(state.date);
  const [y, m] = month.split('-').map(Number);
  $('month-title').textContent = new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  $('month-list').innerHTML = '<li class="msg">Loading…</li>';
  let data;
  try { data = await fetchMonth(month); } catch { data = null; }
  if (seq !== monthSeq) return;
  if (!data) {
    $('month-list').innerHTML = `<li class="msg">No calendar for this month${RANGE ? ' in this demo' : ' yet'}.</li>`;
    return;
  }
  $('month-list').innerHTML = data.days.map((s) => {
    const dt = new Date(`${s.date}T12:00:00Z`);
    const sunday = dt.getUTCDay() === 0;
    const ok = inRange(s.date);
    return `<li class="mrow${sunday ? ' sunday' : ''}${s.date === state.date ? ' current' : ''}">
      <button type="button" data-date="${s.date}"${ok ? '' : ' disabled'}>
        <span class="md"><b>${dt.getUTCDate()}</b> ${dt.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' })}</span>
        <span class="mc"><span class="swatch" style="background:${COLORS[s.color]}" title="${COLOR_NAMES[s.color]}"></span></span>
        <span class="mt">${esc(s.title)}${s.commemorations.length ? `<small>Com. ${esc(s.commemorations.join('; '))}</small>` : ''}</span>
        <span class="mr">${esc(s.rank)}</span>
        <span class="mf">${fastMarks(s.fasting)}</span>
      </button></li>`;
  }).join('');
}

let loadSeq = 0;
async function load() {
  const seq = ++loadSeq;
  updateUrl();
  $('date').value = state.date;
  if (state.page === 'month') { renderMonth(); return; }
  renderWeek();
  const shown = shownLangId();
  try {
    const d = await fetchDay(shown);
    if (seq !== loadSeq) return;
    day = d;
  } catch {
    if (seq !== loadSeq) return;
    day = null;
    altDay = null;
    $('weekday').textContent = '';
    $('title').textContent = 'Not available';
    $('rank').textContent = ''; $('comm').textContent = ''; $('swatch').style.background = 'transparent';
    $('hours').innerHTML = '';
    $('fallback').hidden = true;
    $('text').innerHTML = `<p class="msg">No texts for ${state.date} in this calendar, version and language${RANGE ? ' in this demo' : ' yet'}.</p>`;
    return;
  }
  // The alternative language is only needed if it differs from the English DO already shows.
  const alt = altLangId();
  altDay = null;
  if (alt !== shown && alt !== config.fallbackLanguage) {
    try { altDay = await fetchDay(alt); } catch { altDay = null; }
    if (seq !== loadSeq) return;
  }
  render();
}

function go(date) { state.date = clampDate(date); load(); }

// ---------- controls ----------

function syncControls() {
  // Day or month page
  $('month').hidden = state.page !== 'month';
  $('dayview').hidden = state.page !== 'day';
  document.querySelectorAll('#page button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.page === state.page)));
  $('prev').setAttribute('aria-label', 'Previous day');
  // Text size and reading mode
  document.body.style.setProperty('--text-scale', String(SIZES[sizeIndex()]));
  document.querySelector('#size [data-size="-1"]').disabled = sizeIndex() === 0;
  document.querySelector('#size [data-size="1"]').disabled = sizeIndex() === SIZES.length - 1;
  document.body.dataset.reading = state.reading ? 'on' : 'off';
  $('reading').setAttribute('aria-pressed', String(state.reading));
  const viewWord = state.view === 'mass' ? 'Mass' : 'Office';
  $('calendar').innerHTML = config.calendars.map((c) => {
    const ok = c.versions.includes(state.version);
    const note = ok ? '' : ` (${c.versions.map((v) => config.versions.find((x) => x.id === v)?.label.split(' ')[0]).join(', ')} only)`;
    return `<option value="${c.id}"${ok ? '' : ' disabled'}>${esc(c.label + note)}</option>`;
  }).join('');
  $('version').innerHTML = config.versions.map((v) => {
    const ok = calendarHas(state.calendar, v.id);
    return `<option value="${v.id}"${ok ? '' : ' disabled'}>${esc(v.label + (ok ? '' : ' (not in this calendar)'))}</option>`;
  }).join('');
  $('lang').innerHTML = config.languages.map((l) => {
    const ok = l[viewKey()];
    return `<option value="${l.id}"${ok ? '' : ' disabled'}>${esc(l.label + (ok ? '' : ` (no ${viewWord})`))}</option>`;
  }).join('');
  // A disabled option can still be the saved choice: keep it selected so the notice explains it.
  $('lang').querySelector(`option[value="${state.lang}"]`)?.removeAttribute('disabled');
  $('calendar').value = state.calendar;
  $('version').value = state.version;
  $('lang').value = state.lang;

  const shownLabel = lang(shownLangId()).label;
  $('vernacular-btn').textContent = shownLabel;
  document.body.dataset.display = state.display;
  document.body.dataset.layout = state.layout;
  document.querySelectorAll('#display button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.display === state.display)));
  document.querySelectorAll('#layout button').forEach((b) => {
    b.disabled = state.display !== 'both';
    b.setAttribute('aria-pressed', String(b.dataset.layout === state.layout));
  });
  $('layout').title = state.display === 'both' ? '' : 'Layout applies when both languages are shown';
  document.querySelectorAll('#view button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
  $('hours').hidden = state.view !== 'office';
  $('massmode').hidden = state.view !== 'mass';

  const full = fullAvailable();
  $('full-btn').disabled = !full;
  $('full-btn').title = full ? 'Show the Ordinary of the Mass as well' : `The Ordinary of the Mass is not translated into ${shownLabel} in Divinum Officium`;
  $('full-hint').hidden = full;
  $('full-hint').textContent = full ? '' : `Full Mass is not available in ${shownLabel}.`;
  document.querySelectorAll('#massmode button').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.mass === (showFull() ? 'full' : 'propers'))));

  // Whole view not offered in the chosen language: say so, with the ⓘ to pick the alternative.
  const offered = offers(state.lang);
  $('fallback').hidden = offered;
  const t = i18n(state.lang);
  const local = t === window.I18N.en ? '' :
    `<span class="local" lang="${lang(state.lang).htmlLang}"${lang(state.lang).rtl ? ' dir="rtl"' : ''}>${esc(state.view === 'mass' ? t.viewMass : t.viewOffice)}</span>`;
  $('fallback').innerHTML = offered ? '' :
    `<button type="button" class="info" aria-label="About this translation">${INFO_ICON}</button>
     <span><span>Divinum Officium has no ${esc(lang(state.lang).label)} translation of ${viewName()}. Showing ${esc(lang(shownLangId()).label)} instead.</span>${local}</span>`;
  updateUrl();
}

// ---------- info pop-up ----------

/** Pop-up wording in the given language (the one with the gap), English if we have none. */
function i18n(langId) {
  const all = window.I18N || {};
  return all[lang(langId).htmlLang] || all.en;
}

function openInfo(kind) {
  // Written in the language whose translation is missing, so its readers can understand it.
  const L = lang(state.lang);
  const t = i18n(state.lang);
  const dlg = $('info');
  dlg.setAttribute('lang', t === window.I18N.en ? 'en' : L.htmlLang);
  dlg.setAttribute('dir', L.rtl && t !== window.I18N.en ? 'rtl' : 'ltr');
  $('info-title').textContent = kind === 'view' ? t.viewTitle : t.partialTitle;
  $('info-text').textContent = kind === 'view' ? (state.view === 'mass' ? t.viewMass : t.viewOffice) : t.partial;
  dlg.querySelector('.info-alt span').textContent = t.label;
  dlg.querySelector('.info-note').textContent = t.note;
  $('info-close').textContent = t.done;
  $('alt-lang').innerHTML = config.languages
    .filter((l) => l.id !== state.lang && l[viewKey()])
    .map((l) => `<option value="${l.id}">${esc(l.label)}</option>`).join('');
  $('alt-lang').value = altLangId();
  if ($('info').showModal) $('info').showModal(); else $('info').setAttribute('open', '');
}

// ---------- rendering ----------

function currentPart(d) {
  if (!d) return null;
  const id = state.view === 'mass' ? (showFull() ? 'massFull' : 'mass') : state.hour;
  return d.parts.find((p) => p.id === id) || d.parts.find((p) => p.id !== 'mass' && p.id !== 'massFull');
}

/**
 * The second-language text of a section, with lines DO left in English replaced
 * by the alternative language where the two line up.
 */
function vernacularOf(s, i, altPart) {
  if (!s.fallback || !altPart) return s.vernacular;
  const a = altPart.sections[i];
  if (!a || a.heading.latin !== s.heading.latin) return s.vernacular;
  const lines = s.vernacular.split(/<br\s*\/?>/i);
  const altLines = a.vernacular.split(/<br\s*\/?>/i);
  if (lines.length === altLines.length) {
    for (const n of s.fallback) lines[n] = altLines[n];
    return lines.join('<br>');
  }
  // Lines don't line up: if the whole section is untranslated, take the alternative's section.
  const long = lines.filter((l) => l.replace(/<[^>]+>/g, '').trim().length >= 25).length;
  return s.fallback.length >= long ? a.vernacular : s.vernacular;
}

function render() {
  if (!day) return;
  const part = currentPart(day);
  const altPart = currentPart(altDay);
  const h = state.view === 'mass' ? part.header : day.header;
  const d = new Date(`${day.date}T12:00:00Z`);
  $('weekday').textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  $('title').textContent = h.title;
  $('rank').textContent = [h.rank, COLOR_NAMES[h.color]].filter(Boolean).join(' · ');
  $('swatch').style.background = COLORS[h.color] || 'transparent';
  $('comm').textContent = h.commemorations.length ? `Commemoration: ${h.commemorations.join('; ')}` : '';
  $('source-version').textContent = state.view === 'mass' ? `Missal: ${day.versionName.mass}.` : `Breviary: ${day.versionName.office}.`;

  // Hour tabs
  $('hours').innerHTML = '';
  for (const hr of config.hours) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.textContent = hr.label;
    b.title = hr.latin;
    b.setAttribute('aria-selected', String(hr.id === state.hour));
    b.onclick = () => { state.hour = hr.id; updateUrl(); render(); };
    $('hours').append(b);
  }

  // Per-section notes only make sense when the chosen language is the one shown.
  const notes = offers(state.lang);
  const L = lang(shownLangId());
  const out = [`<h2 class="part-title"><span class="la">${part.title.latin}</span><span class="vn">${part.title.label}</span></h2>`];
  const jumps = [];
  part.sections.forEach((s, i) => {
    const hl = s.heading.latin, hv = s.heading.vernacular && s.heading.vernacular !== hl ? s.heading.vernacular : '';
    const sid = `s${i}`;
    if (hl) jumps.push([sid, hv ? `${hl} · ${hv}` : hl]);
    const info = notes && s.fallback
      ? `<button type="button" class="info" data-kind="section" aria-label="Not fully translated: choose a language for the missing text" title="Not fully translated">${INFO_ICON}</button>`
      : '';
    const head = hl || hv || info
      ? `<h3><span class="la">${hl}</span>${hv ? `<span class="vn"> · ${hv}</span>` : ''}${info}</h3>`
      : '';
    if (!s.latin && !s.vernacular) {
      out.push(`<section class="marker" id="${sid}">${head}</section>`); // e.g. "Gloria", "Credo" in the Mass
      return;
    }
    const vn = vernacularOf(s, i, altPart);
    out.push(`<section id="${sid}"${s.fallback && notes ? ' class="partial"' : ''}>${head}<div class="col la" lang="la">${s.latin}</div><div class="col vn" lang="${L.htmlLang}"${L.rtl ? ' dir="auto"' : ''}>${vn}</div></section>`);
  });
  $('text').innerHTML = out.join('');
  // Reading mode hides instructions: longer red rubrics ("Secreto", "Deinde, clara voce…"),
  // but keeps the short markers (℣. ℟. Ant.).
  $('text').querySelectorAll('.rubric').forEach((el) => {
    if (el.classList.contains('small') || el.textContent.trim().length > 14) el.classList.add('instr');
  });
  $('jump').innerHTML = `<option value="">Jump to…</option>` +
    jumps.map(([id, label]) => `<option value="${id}">${esc(label)}</option>`).join('');
  $('jump').disabled = jumps.length < 2;
}

function updateUrl() {
  const p = new URLSearchParams({ date: state.date, view: state.view, calendar: state.calendar, version: state.version, lang: state.lang });
  if (state.page === 'month') p.set('page', 'month');
  if (state.view === 'office') p.set('hour', state.hour);
  else p.set('mass', showFull() ? 'full' : 'propers');
  try { history.replaceState(null, '', `?${p}`); } catch { /* sandboxed */ }
}

init();
