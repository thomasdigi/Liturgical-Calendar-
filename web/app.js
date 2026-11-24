// Viewer. Loads data/config.json, then
// data/<calendar>/<version>/<lang>/<YYYY>/<MM-DD>.json, and shows the Mass or one Hour.
const $ = (id) => document.getElementById(id);
const COLORS = { white: 'var(--c-white)', red: 'var(--c-red)', green: 'var(--c-green)', violet: 'var(--c-violet)', rose: 'var(--c-rose)', black: 'var(--c-black)' };
const COLOR_NAMES = { white: 'White', red: 'Red', green: 'Green', violet: 'Violet', rose: 'Rose', black: 'Black' };
const INFO_ICON = '<svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true"><circle cx="8" cy="8" r="7" fill="none" stroke="currentColor" stroke-width="1.5"/><circle cx="8" cy="4.8" r="1" fill="currentColor"/><rect x="7.25" y="6.8" width="1.5" height="5" rx=".7" fill="currentColor"/></svg>';

// On a static site, data/available.json says which dates and languages were built
// (see scripts/site.ts). Against the local server it's absent and everything is available.
let avail = null;
let RANGE = null;

const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

let config = null;
let day = null; // the day's index (header, parts, Masses) in the language actually shown
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
  massN: Number(params.get('n')) || 1, // which Mass, on days with several
  page: ['month', 'search'].includes(params.get('page')) ? params.get('page') : 'day',
  office: params.get('office') || 'day', // 'day' or a votive office id (dead, parvum, sabbato)
  compare: !!params.get('cmp'), // show another calendar/version beside this one
  cmpCalendar: (params.get('cmp') || '').split('/')[0] || null,
  cmpVersion: (params.get('cmp') || '').split('/')[1] || null,
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
/** Was this language built for the current calendar/version (static site)? */
const built = (id, cal = state.calendar, ver = state.version) =>
  !avail || (avail.combos[`${cal}/${ver}`] ?? []).includes(id);
const comboBuilt = (cal, ver) => !avail || !!avail.combos[`${cal}/${ver}`];
const offers = (id) => lang(id)[viewKey()] && built(id);
/** The alternative language for gaps: the user's choice, if it covers this view. */
function altLangId() {
  if (state.altLang !== state.lang && offers(state.altLang)) return state.altLang;
  if (offers(config.fallbackLanguage)) return config.fallbackLanguage;
  return config.languages.find((l) => offers(l.id))?.id ?? config.fallbackLanguage;
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
  try {
    const res = await fetch('data/available.json');
    if (res.ok) {
      avail = await res.json();
      RANGE = { first: avail.first, last: avail.last };
      state.date = clampDate(state.date);
    }
  } catch { /* local server: everything available */ }
  const has = (list, id) => list.some((x) => x.id === id);
  if (!has(config.calendars, state.calendar)) state.calendar = config.calendars[0].id;
  if (!has(config.versions, state.version)) state.version = config.versions[0].id;
  if (!has(config.languages, state.lang)) state.lang = config.languages[0].id;
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

const calendarHas = (cal, version) => (config.calendars.find((c) => c.id === cal)?.versions ?? []).includes(version);

// ---------- loading ----------

async function getJson(path) {
  if (!cache.has(path)) {
    const p = fetch(path).then((res) => {
      if (!res.ok) throw new Error(String(res.status));
      return res.json();
    });
    cache.set(path, p);
    p.catch(() => cache.delete(path)); // let a failed request be retried later
  }
  return cache.get(path);
}
const dayDir = (langId, cal = state.calendar, ver = state.version) =>
  `data/${cal}/${ver}/${langId}/${state.date.slice(0, 4)}/${state.date.slice(5)}`;
/** The day's index: header, the list of parts, and the Masses if there are several. */
const fetchDay = (langId, cal, ver) => getJson(`${dayDir(langId, cal, ver)}/index.json`);
/** One part (an Hour or a Mass), with its Latin from the shared folder merged in. */
async function fetchPart(langId, id, cal, ver) {
  const own = await getJson(`${dayDir(langId, cal, ver)}/${id}.json`);
  const latin = own.latin ?? (await getJson(`${dayDir('latin', cal, ver)}/${id}.json`)).sections;
  return own.sections.map((s, i) => ({
    heading: { latin: latin[i]?.heading ?? '', vernacular: s.heading },
    latin: latin[i]?.latin ?? '',
    vernacular: s.vernacular,
    fallback: s.fallback,
  }));
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
    $('month-list').innerHTML = `<li class="msg">No calendar for this month${RANGE ? ' on this site' : ' yet'}.</li>`;
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
  if (state.page === 'search') { syncSearchOptions(); return; }
  renderWeek();
  const shown = shownLangId();
  try {
    const d = await fetchDay(shown);
    if (seq !== loadSeq) return;
    day = d;
  } catch {
    if (seq !== loadSeq) return;
    day = null;
    $('weekday').textContent = '';
    $('title').textContent = 'Not available';
    $('rank').textContent = ''; $('comm').textContent = ''; $('swatch').style.background = 'transparent';
    $('hours').innerHTML = '';
    $('fallback').hidden = true;
    $('text').innerHTML = `<p class="msg">No texts for ${state.date} in this calendar, version and language${RANGE ? ' on this site' : ' yet'}.</p>`;
    $('masschoice').hidden = true;
    return;
  }
  if (state.massN > Math.max(1, day.masses?.length ?? 0)) state.massN = 1;
  syncMasses();
  syncOffice();
  render();
}

/** Buttons to choose between a day's Masses (Christmas, All Souls, …). */
function syncMasses() {
  const masses = day?.masses ?? [];
  $('masschoice').hidden = masses.length < 2;
  $('masschoice').innerHTML = masses.map((m) =>
    `<button type="button" data-n="${m.n}" aria-pressed="${m.n === state.massN}" title="${esc(m.title)}">
       <span class="mn">${esc(m.label)}</span><span class="mtitle">${esc(m.title)}</span>
     </button>`).join('');
}

function go(date) { state.date = clampDate(date); load(); }

// ---------- controls ----------

function syncControls() {
  // Day or month page
  $('month').hidden = state.page !== 'month';
  $('searchpage').hidden = state.page !== 'search';
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
    const exists = c.versions.includes(state.version);
    const ok = exists && comboBuilt(c.id, state.version);
    const note = !exists ? ` (${c.versions.map((v) => config.versions.find((x) => x.id === v)?.label.split(' ')[0]).join(', ')} only)`
      : ok ? '' : ' (not on this site)';
    return `<option value="${c.id}"${ok ? '' : ' disabled'}>${esc(c.label + note)}</option>`;
  }).join('');
  $('version').innerHTML = config.versions.map((v) => {
    const exists = calendarHas(state.calendar, v.id);
    const ok = exists && comboBuilt(state.calendar, v.id);
    return `<option value="${v.id}"${ok ? '' : ' disabled'}>${esc(v.label + (!exists ? ' (not in this calendar)' : ok ? '' : ' (not on this site)'))}</option>`;
  }).join('');
  $('lang').innerHTML = config.languages.map((l) => {
    const ok = offers(l.id);
    const why = !l[viewKey()] ? ` (no ${viewWord})` : ' (not on this site)';
    return `<option value="${l.id}"${ok ? '' : ' disabled'}>${esc(l.label + (ok ? '' : why))}</option>`;
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
  $('officebar').hidden = state.view !== 'office';
  syncOffice();
  // Compare: another calendar/version beside this one
  $('compare').setAttribute('aria-pressed', String(state.compare));
  $('comparebar').hidden = !state.compare;
  if (state.compare) {
    $('cmp-calendar').innerHTML = config.calendars.map((c) =>
      `<option value="${c.id}"${c.versions.some((v) => comboBuilt(c.id, v)) ? '' : ' disabled'}>${esc(c.label)}</option>`).join('');
    $('cmp-version').innerHTML = config.versions.map((v) => {
      const ok = calendarHas(state.cmpCalendar, v.id) && comboBuilt(state.cmpCalendar, v.id);
      return `<option value="${v.id}"${ok ? '' : ' disabled'}>${esc(v.label)}</option>`;
    }).join('');
    $('cmp-calendar').value = state.cmpCalendar;
    $('cmp-version').value = state.cmpVersion;
  }
  if (RANGE) Object.assign($('date'), { min: RANGE.first, max: RANGE.last });

  const full = fullAvailable();
  $('full-btn').disabled = !full;
  $('full-btn').title = full ? 'Show the Ordinary of the Mass as well' : `The Ordinary of the Mass is not translated into ${shownLabel} in Divinum Officium`;
  $('full-hint').hidden = full;
  $('full-hint').textContent = full ? '' : `Full Mass is not available in ${shownLabel}.`;
  document.querySelectorAll('#massmode button[data-mass]').forEach((b) =>
    b.setAttribute('aria-pressed', String(b.dataset.mass === (showFull() ? 'full' : 'propers'))));

  // Whole view not offered in the chosen language: say so, with the ⓘ to pick the alternative.
  const offered = lang(state.lang)[viewKey()];
  const shownIsChosen = shownLangId() === state.lang;
  $('fallback').hidden = shownIsChosen;
  const t = i18n(state.lang);
  const local = t === window.I18N.en ? '' :
    `<span class="local" lang="${lang(state.lang).htmlLang}"${lang(state.lang).rtl ? ' dir="rtl"' : ''}>${esc(state.view === 'mass' ? t.viewMass : t.viewOffice)}</span>`;
  $('fallback').innerHTML = shownIsChosen ? '' : !offered
    ? `<button type="button" class="info" aria-label="About this translation">${INFO_ICON}</button>
       <span><span>Divinum Officium has no ${esc(lang(state.lang).label)} translation of ${viewName()}. Showing ${esc(lang(shownLangId()).label)} instead.</span>${local}</span>`
    : `<span>${esc(lang(state.lang).label)} isn't on this site for this calendar and version. Showing ${esc(lang(shownLangId()).label)} instead.</span>`;
  updateUrl();
}

/** The office selector: the Office of the day, or a votive office built for this day. */
function syncOffice() {
  const built = day?.votives ?? [];
  const sat = new Date(`${state.date}T12:00:00Z`).getUTCDay() === 6;
  // Only drop an unavailable choice once the day has loaded (a link may name one).
  if (day && state.office !== 'day' && !built.some((v) => v.id === state.office)) state.office = 'day';
  $('office').innerHTML = `<option value="day">Office of the day</option>` + (config.votives ?? []).map((v) => {
    const ok = built.some((b) => b.id === v.id);
    const why = v.saturdaysOnly && !sat ? ' (Saturdays only)' : ' (not on this site)';
    return `<option value="${v.id}"${ok ? '' : ' disabled'}>${esc(v.label + (ok ? '' : why))}</option>`;
  }).join('');
  $('office').value = state.office;
}
/** The Hours of the office being shown. */
function officeHours() {
  if (state.office === 'day') return config.hours.map((h) => h.id);
  return day?.votives?.find((v) => v.id === state.office)?.hours ?? [];
}

/** Compare with 1954 if showing 1962, otherwise with 1962; same calendar where it exists. */
function defaultComparison() {
  const want = state.version === '1962' ? '1954' : '1962';
  state.cmpCalendar = state.calendar;
  state.cmpVersion = want;
  fixComparison();
}
function fixComparison() {
  if (!state.cmpCalendar || !config.calendars.some((c) => c.id === state.cmpCalendar)) state.cmpCalendar = state.calendar;
  const ok = (cal, ver) => calendarHas(cal, ver) && comboBuilt(cal, ver);
  if (!ok(state.cmpCalendar, state.cmpVersion)) {
    state.cmpVersion = config.versions.map((v) => v.id).find((v) => ok(state.cmpCalendar, v)) ?? null;
  }
  if (!state.cmpVersion) {
    for (const c of config.calendars) {
      const v = config.versions.map((x) => x.id).find((x) => ok(c.id, x));
      if (v) { state.cmpCalendar = c.id; state.cmpVersion = v; break; }
    }
  }
}
const comboLabel = (cal, ver) =>
  `${config.calendars.find((c) => c.id === cal)?.label} · ${config.versions.find((v) => v.id === ver)?.label}`;

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
    .filter((l) => l.id !== state.lang && offers(l.id))
    .map((l) => `<option value="${l.id}">${esc(l.label)}</option>`).join('');
  $('alt-lang').value = altLangId();
  if ($('info').showModal) $('info').showModal(); else $('info').setAttribute('open', '');
}

// ---------- rendering ----------

/** The id of the part to show: an Hour, or the Mass (propers or full; 2nd/3rd Mass as 'mass-2' …). */
function currentPartId() {
  if (state.view !== 'mass') return state.office === 'day' ? state.hour : `${state.office}-${state.hour}`;
  const base = showFull() ? 'massFull' : 'mass';
  return state.massN > 1 ? `${base}-${state.massN}` : base;
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

/** A part ready to show: its sections in the given language, gaps filled from the alternative. */
async function loadPart(langId, id, cal = state.calendar, ver = state.version) {
  const index = await fetchDay(langId, cal, ver);
  const meta = index.parts.find((p) => p.id === id) || index.parts.find((p) => p.id === state.hour) || index.parts[0];
  const sections = await fetchPart(langId, meta.id, cal, ver);
  let altPart = null;
  const alt = altLangId();
  if (alt !== langId && alt !== config.fallbackLanguage && sections.some((s) => s.fallback) && built(alt, cal, ver)) {
    try { altPart = { sections: await fetchPart(alt, meta.id, cal, ver) }; } catch { altPart = null; }
  }
  return { index, part: { ...meta, sections }, altPart };
}

/** HTML for a part's sections. `prefix` keeps ids unique when two parts are shown side by side. */
function sectionsHtml(part, altPart, L, notes, prefix) {
  const out = [];
  part.sections.forEach((s, i) => {
    const hl = s.heading.latin, hv = s.heading.vernacular && s.heading.vernacular !== hl ? s.heading.vernacular : '';
    const sid = `${prefix}${i}`;
    const info = notes && s.fallback
      ? `<button type="button" class="info" data-kind="section" aria-label="Not fully translated: choose a language for the missing text" title="Not fully translated">${INFO_ICON}</button>`
      : '';
    const head = hl || hv || info
      ? `<h3><span class="la">${hl}</span>${hv ? `<span class="vn"> · ${hv}</span>` : ''}${info}</h3>`
      : '';
    const jump = hl ? ` data-jump="${esc(hv ? `${hl} · ${hv}` : hl)}"` : '';
    const cls = [
      s.fallback && notes ? 'partial' : '',
      /^Suffragi/i.test(hl) ? 'suffrage' : '',
      /data-kind="commemoration"/.test(s.latin) ? 'has-commem' : '',
    ].filter(Boolean).join(' ');
    if (!s.latin && !s.vernacular) {
      out.push(`<section class="marker" id="${sid}"${jump}>${head}</section>`); // e.g. "Gloria", "Credo" in the Mass
      return;
    }
    const vn = vernacularOf(s, i, altPart);
    out.push(`<section id="${sid}"${jump}${cls ? ` class="${cls}"` : ''}>${head}<div class="col la" lang="la">${s.latin}</div><div class="col vn" lang="${L.htmlLang}"${L.rtl ? ' dir="auto"' : ''}>${vn}</div></section>`);
  });
  return out.join('');
}

const headerHtml = (h) =>
  `<p class="cmp-title">${esc(h.title)}</p><p class="cmp-meta"><span class="swatch" style="background:${COLORS[h.color] || 'transparent'}"></span>${esc([h.rank, COLOR_NAMES[h.color]].filter(Boolean).join(' · '))}</p>` +
  (h.commemorations.length ? `<p class="cmp-comm">Com. ${esc(h.commemorations.join('; '))}</p>` : '');

let renderSeq = 0;
let pendingScroll = null; // a section to scroll to once drawn (from a search result)
async function render() {
  if (!day) return;
  const seq = ++renderSeq;
  if (state.view === 'office' && !officeHours().includes(state.hour)) state.hour = officeHours()[0] ?? 'lauds';
  const id = currentPartId();
  const shown = shownLangId();
  let main;
  try {
    main = await loadPart(shown, id);
  } catch {
    if (seq !== renderSeq) return;
    $('text').innerHTML = '<p class="msg">This part could not be loaded.</p>';
    return;
  }
  // Compare: the same part in another calendar/version, in the same language where it's there.
  let other = null;
  let otherLang = null;
  if (state.compare && state.cmpCalendar && state.cmpVersion) {
    otherLang = built(shown, state.cmpCalendar, state.cmpVersion) ? shown
      : built(config.fallbackLanguage, state.cmpCalendar, state.cmpVersion) ? config.fallbackLanguage : null;
    if (otherLang) {
      // Use the corresponding part there: the same Hour, or the same Mass if it has that many.
      let oid = id;
      try {
        const oi = await fetchDay(otherLang, state.cmpCalendar, state.cmpVersion);
        if (!oi.parts.some((p) => p.id === oid)) oid = oid.replace(/-\d+$/, '');
        other = await loadPart(otherLang, oid, state.cmpCalendar, state.cmpVersion);
      } catch { other = null; }
    }
  }
  if (seq !== renderSeq) return;

  const { part, altPart } = main;
  const h = state.view === 'mass' || state.office !== 'day' ? part.header : day.header;
  const d = new Date(`${day.date}T12:00:00Z`);
  $('weekday').textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  $('title').textContent = h.title;
  $('rank').textContent = [h.rank, COLOR_NAMES[h.color]].filter(Boolean).join(' · ');
  $('swatch').style.background = COLORS[h.color] || 'transparent';
  $('comm').textContent = h.commemorations.length ? `Commemoration: ${h.commemorations.join('; ')}` : '';
  $('source-version').textContent = state.view === 'mass' ? `Missal: ${day.versionName.mass}.` : `Breviary: ${day.versionName.office}.`;

  // Hour tabs (a votive office may have only some Hours)
  const hours = officeHours();
  $('hours').innerHTML = '';
  for (const hr of config.hours) {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.textContent = hr.label;
    b.title = hours.includes(hr.id) ? hr.latin : `Not part of this office`;
    b.disabled = !hours.includes(hr.id);
    b.setAttribute('aria-selected', String(hr.id === state.hour));
    b.onclick = () => { state.hour = hr.id; updateUrl(); render(); };
    $('hours').append(b);
  }

  // Per-section notes only make sense when the chosen language is the one shown.
  const notes = offers(state.lang);
  const L = lang(shown);
  const title = `<h2 class="part-title"><span class="la">${part.title.latin}</span><span class="vn">${part.title.label}</span></h2>`;
  if (state.compare) {
    const right = other
      ? `<div class="cmp-head">${headerHtml(other.part.header)}</div>${sectionsHtml(other.part, other.altPart, lang(otherLang), false, 'c')}`
      : `<p class="msg">Not available for ${esc(comboLabel(state.cmpCalendar, state.cmpVersion))} on this day${RANGE ? ' on this site' : ''}.</p>`;
    $('text').innerHTML = `${title}<div class="compare">
      <div class="cmp-col"><p class="cmp-label">${esc(comboLabel(state.calendar, state.version))}</p>
        <div class="cmp-head">${headerHtml(part.header)}</div>${sectionsHtml(part, altPart, L, notes, 's')}</div>
      <div class="cmp-col"><p class="cmp-label">${esc(comboLabel(state.cmpCalendar, state.cmpVersion))}</p>${right}</div>
    </div>`;
  } else {
    $('text').innerHTML = title + sectionsHtml(part, altPart, L, notes, 's');
  }
  document.body.classList.toggle('comparing', state.compare);

  // Reading mode hides instructions: longer red rubrics ("Secreto", "Deinde, clara voce…"),
  // but keeps the short markers (℣. ℟. Ant.) and the commemoration/suffrage labels.
  $('text').querySelectorAll('.rubric').forEach((el) => {
    if (el.classList.contains('commem')) return;
    if (el.classList.contains('small') || el.textContent.trim().length > 14) el.classList.add('instr');
  });
  // Jump menu: the headings, plus each commemoration and suffrage (in the main column).
  const jumps = [];
  const mainCol = state.compare ? $('text').querySelector('.cmp-col') : $('text');
  mainCol.querySelectorAll('section[data-jump], .col.la .commem').forEach((el, n) => {
    if (el.matches('section')) jumps.push([el.id, el.dataset.jump]);
    else {
      el.id = el.id || `cm${n}`;
      const kind = el.dataset.kind === 'suffrage' ? 'Suffrage' : 'Commemoration';
      const name = el.textContent.replace(/^Commemoratio\s*/, '').trim();
      jumps.push([el.id, `  ↳ ${kind}: ${name}`]);
    }
  });
  $('jump').innerHTML = `<option value="">Jump to…</option>` +
    jumps.map(([jid, label]) => `<option value="${jid}">${esc(label)}</option>`).join('');
  $('jump').disabled = jumps.length < 2;

  if (pendingScroll) {
    const el = document.getElementById(pendingScroll);
    pendingScroll = null;
    if (el) {
      el.scrollIntoView({ block: 'center' });
      el.classList.add('flash');
      setTimeout(() => el.classList.remove('flash'), 2400);
    }
  }
}

function updateUrl() {
  const p = new URLSearchParams({ date: state.date, view: state.view, calendar: state.calendar, version: state.version, lang: state.lang });
  if (state.page !== 'day') p.set('page', state.page);
  if (state.view === 'office') {
    p.set('hour', state.hour);
    if (state.office !== 'day') p.set('office', state.office);
  }
  else {
    p.set('mass', showFull() ? 'full' : 'propers');
    if (state.massN > 1) p.set('n', String(state.massN));
  }
  if (state.compare && state.cmpCalendar && state.cmpVersion) p.set('cmp', `${state.cmpCalendar}/${state.cmpVersion}`);
  try { history.replaceState(null, '', `?${p}`); } catch { /* sandboxed */ }
}

// ---------- search ----------

const addMonths = (month, n) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1 + n, 1)).toISOString().slice(0, 7);
};
const monthLabel = (month) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
};
/** The search language: the chosen one if it was built, else English. */
const searchLangId = () => (built(state.lang) ? state.lang : config.fallbackLanguage);

function syncSearchOptions() {
  const m = monthOf(state.date);
  const opts = [['1', monthLabel(m)], ['3', `${monthLabel(m)} and the next two months`]];
  if (avail) opts.push(['all', `All dates on this site (${avail.first} to ${avail.last})`]);
  const scope = $('scope').value || '1';
  $('scope').innerHTML = opts.map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
  $('scope').value = opts.some(([v]) => v === scope) ? scope : '1';
  const L = lang(searchLangId());
  const within = $('searchin').value || 'both';
  $('searchin').innerHTML = [['both', `Latin and ${L.label}`], ['latin', 'Latin only'], ['vernacular', `${L.label} only`]]
    .map(([v, l]) => `<option value="${v}">${esc(l)}</option>`).join('');
  $('searchin').value = within;
  setTimeout(() => $('q').focus(), 0);
}
function scopeMonths() {
  const v = $('scope').value;
  if (v === 'all' && avail) {
    const out = [];
    for (let m = monthOf(avail.first); m <= monthOf(avail.last); m = addMonths(m, 1)) out.push(m);
    return out;
  }
  return Array.from({ length: Number(v) || 1 }, (_, i) => addMonths(monthOf(state.date), i));
}

/** Lower case, no accents, æ→ae, œ→oe, j→i; with a map back to positions in the original. */
function normalize(text) {
  let out = '';
  const map = [];
  for (let i = 0; i < text.length; i++) {
    let c = text[i].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    c = c.replace(/æ/g, 'ae').replace(/œ/g, 'oe').replace(/j/g, 'i');
    for (const ch of c) { out += ch; map.push(i); }
  }
  return { out, map };
}
/** Words to find; a "quoted phrase" counts as one term. */
function parseQuery(q) {
  const terms = [];
  q.replace(/"([^"]+)"|(\S+)/g, (_, phrase, word) => { terms.push(normalize(phrase || word).out.trim()); return ''; });
  return terms.filter(Boolean);
}
/** A short extract around the first match, with every match marked. */
function snippet(text, terms) {
  const { out, map } = normalize(text);
  const spans = [];
  for (const t of terms) {
    let i = out.indexOf(t);
    while (i >= 0) { spans.push([map[i], map[i + t.length - 1] + 1]); i = out.indexOf(t, i + t.length); }
  }
  if (!spans.length) return '';
  spans.sort((a, b) => a[0] - b[0]);
  const from = Math.max(0, spans[0][0] - 70);
  const to = Math.min(text.length, spans[0][1] + 140);
  let html = '';
  let pos = from;
  for (const [a, b] of spans) {
    if (a < pos || b > to) continue;
    html += esc(text.slice(pos, a)) + `<mark>${esc(text.slice(a, b))}</mark>`;
    pos = b;
  }
  html += esc(text.slice(pos, to));
  return (from > 0 ? '…' : '') + html + (to < text.length ? '…' : '');
}

const partLabel = (id) => {
  if (id === 'mass') return 'Mass';
  const m = /^mass-(\d+)$/.exec(id);
  if (m) return `Mass ${m[1]}`;
  return config.hours.find((h) => h.id === id)?.label ?? id;
};

let searchSeq = 0;
const MAX_HITS = 300;
async function runSearch() {
  const seq = ++searchSeq;
  const terms = parseQuery($('q').value);
  if (!terms.length) { $('searchstatus').textContent = 'Type a word or phrase to find.'; return; }
  const within = $('searchin').value;
  const langId = searchLangId();
  const hits = [];
  $('results').innerHTML = '';
  const months = scopeMonths();
  for (const month of months) {
    $('searchstatus').textContent = `Searching ${monthLabel(month)}…${avail ? '' : ' (the first search of a month builds its index, which can take a minute)'}`;
    const base = `data/${state.calendar}/${state.version}`;
    const [la, vn] = await Promise.all([
      within === 'vernacular' ? null : getJson(`${base}/latin/search/${month}.json`).catch(() => null),
      within === 'latin' ? null : getJson(`${base}/${langId}/search/${month}.json`).catch(() => null),
    ]);
    if (seq !== searchSeq) return;
    const days = new Set([...Object.keys(la?.days ?? {}), ...Object.keys(vn?.days ?? {})]);
    for (const dd of [...days].sort()) {
      const parts = new Set([...Object.keys(la?.days[dd] ?? {}), ...Object.keys(vn?.days[dd] ?? {})]);
      for (const pid of parts) {
        const laS = la?.days[dd]?.[pid] ?? [];
        const vnS = vn?.days[dd]?.[pid] ?? [];
        for (let i = 0; i < Math.max(laS.length, vnS.length); i++) {
          const texts = [laS[i]?.[1] ?? '', vnS[i]?.[1] ?? ''];
          const n = normalize(texts.join(' \n ')).out;
          if (!terms.every((t) => n.includes(t))) continue;
          const which = snippet(texts[0], terms) ? 0 : 1;
          hits.push({
            date: `${month}-${dd}`,
            part: pid,
            section: i,
            heading: laS[i]?.[0] || vnS[i]?.[0] || '',
            html: snippet(texts[which], terms) || snippet(texts[1 - which], terms),
            lang: which === 0 ? 'la' : lang(langId).htmlLang,
          });
          if (hits.length >= MAX_HITS) break;
        }
        if (hits.length >= MAX_HITS) break;
      }
      if (hits.length >= MAX_HITS) break;
    }
    renderHits(hits, terms);
    if (hits.length >= MAX_HITS) break;
  }
  if (seq !== searchSeq) return;
  $('searchstatus').textContent = hits.length
    ? `${hits.length >= MAX_HITS ? `First ${MAX_HITS}` : hits.length} result${hits.length === 1 ? '' : 's'} in ${months.length === 1 ? monthLabel(months[0]) : `${monthLabel(months[0])} to ${monthLabel(months.at(-1))}`}.`
    : 'Nothing found. Try fewer words, or a longer period.';
}

function renderHits(hits) {
  let lastDate = '';
  $('results').innerHTML = hits.map((h) => {
    const dt = new Date(`${h.date}T12:00:00Z`);
    const dateHead = h.date !== lastDate
      ? `<li class="rdate">${esc(dt.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' }))}</li>` : '';
    lastDate = h.date;
    return `${dateHead}<li><button type="button" data-hit='${esc(JSON.stringify({ date: h.date, part: h.part, section: h.section }))}'>
      <span class="rwhere">${esc(partLabel(h.part))}${h.heading ? ` · ${esc(h.heading)}` : ''}</span>
      <span class="rtext" lang="${h.lang}">${h.html}</span></button></li>`;
  }).join('');
}

/** Open a search result: its day, Mass or Hour, scrolled to the section. */
function openHit({ date, part, section }) {
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
  pendingScroll = `s${section}`;
  syncControls();
  load();
  window.scrollTo(0, 0);
}

init();
