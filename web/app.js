// Viewer. Loads data/config.json, then data/<version>/<lang>/<YYYY>/<MM-DD>.json,
// and shows either the Mass propers or one Hour of the Office.
const $ = (id) => document.getElementById(id);
const COLORS = { white: 'var(--c-white)', red: 'var(--c-red)', green: 'var(--c-green)', violet: 'var(--c-violet)', rose: 'var(--c-rose)', black: 'var(--c-black)' };
const COLOR_NAMES = { white: 'White', red: 'Red', green: 'Green', violet: 'Violet', rose: 'Rose', black: 'Black' };

// Optional limits, set by a page that bundles only some dates (e.g. a demo).
const RANGE = window.DATE_RANGE || null;

const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* storage unavailable */ } },
};

let config = null;
let day = null;
const cache = new Map();
const params = new URLSearchParams(location.search);
const state = {
  date: clampDate(params.get('date') || isoToday()),
  view: params.get('view') || store.get('view', 'office'),
  hour: params.get('hour') || defaultHour(),
  version: params.get('version') || store.get('version', '1962'),
  lang: params.get('lang') || store.get('lang', 'en'),
  display: store.get('display', 'both'),
};

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
const langLabel = () => config.languages.find((l) => l.id === state.lang)?.label ?? 'Translation';

// ---------- loading ----------

async function init() {
  try {
    config = await (await fetch('data/config.json')).json();
  } catch {
    $('title').textContent = 'Could not load settings';
    return;
  }
  if (!config.versions.some((v) => v.id === state.version)) state.version = config.versions[0].id;
  if (!config.languages.some((l) => l.id === state.lang)) state.lang = config.languages[0].id;
  if (!config.hours.some((h) => h.id === state.hour)) state.hour = config.hours[0].id;

  $('version').innerHTML = config.versions.map((v) => `<option value="${v.id}">${v.label}</option>`).join('');
  $('lang').innerHTML = config.languages.map((l) => `<option value="${l.id}">${l.label}</option>`).join('');
  if (RANGE) Object.assign($('date'), { min: RANGE.first, max: RANGE.last });

  $('version').onchange = (e) => { state.version = e.target.value; store.set('version', state.version); load(); };
  $('lang').onchange = (e) => { state.lang = e.target.value; store.set('lang', state.lang); syncControls(); load(); };
  document.querySelectorAll('#display button').forEach((b) => (b.onclick = () => {
    state.display = b.dataset.display; store.set('display', state.display); syncControls();
  }));
  document.querySelectorAll('#view button').forEach((b) => (b.onclick = () => {
    state.view = b.dataset.view; store.set('view', state.view); syncControls(); render();
  }));
  $('prev').onclick = () => go(shift(state.date, -1));
  $('next').onclick = () => go(shift(state.date, 1));
  $('today').onclick = () => go(isoToday());
  $('date').onchange = (e) => e.target.value && go(e.target.value);
  document.addEventListener('keydown', (e) => {
    if (/INPUT|SELECT/.test(e.target.tagName)) return;
    if (e.key === 'ArrowLeft') go(shift(state.date, -1));
    if (e.key === 'ArrowRight') go(shift(state.date, 1));
  });

  syncControls();
  load();
}

async function load() {
  updateUrl();
  $('date').value = state.date;
  const key = `${state.version}/${state.lang}/${state.date.slice(0, 4)}/${state.date.slice(5)}`;
  if (!cache.has(key)) {
    $('title').textContent = 'Loading…';
    $('text').innerHTML = '';
  }
  try {
    if (!cache.has(key)) {
      const res = await fetch(`data/${key}.json`);
      if (!res.ok) throw new Error(String(res.status));
      cache.set(key, await res.json());
    }
    day = cache.get(key);
  } catch {
    day = null;
    $('weekday').textContent = '';
    $('title').textContent = 'Not available';
    $('rank').textContent = ''; $('comm').textContent = ''; $('swatch').style.background = 'transparent';
    $('hours').innerHTML = '';
    $('text').innerHTML = `<p class="msg">No texts for ${state.date} in this version and language yet.</p>`;
    return;
  }
  render();
}

function go(date) { state.date = clampDate(date); load(); }

// ---------- rendering ----------

function syncControls() {
  $('version').value = state.version;
  $('lang').value = state.lang;
  $('vernacular-btn').textContent = langLabel();
  document.body.dataset.display = state.display;
  document.querySelectorAll('#display button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.display === state.display)));
  document.querySelectorAll('#view button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.view === state.view)));
  $('hours').hidden = state.view !== 'office';
  updateUrl();
}

function currentPart() {
  if (!day) return null;
  const id = state.view === 'mass' ? 'mass' : state.hour;
  return day.parts.find((p) => p.id === id) || day.parts.find((p) => p.id !== 'mass');
}

function render() {
  if (!day) return;
  const part = currentPart();
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

  // Text
  const out = [`<h2 class="part-title"><span class="la">${part.title.latin}</span><span class="vn">${part.title.label}</span></h2>`];
  for (const s of part.sections) {
    const hl = s.heading.latin, hv = s.heading.vernacular && s.heading.vernacular !== hl ? s.heading.vernacular : '';
    const head = hl || hv ? `<h3><span class="la">${hl}</span>${hv ? `<span class="vn"> · ${hv}</span>` : ''}</h3>` : '';
    if (!s.latin && !s.vernacular) {
      out.push(`<section class="marker">${head}</section>`); // e.g. "Gloria", "Credo" in the Mass
      continue;
    }
    out.push(`<section>${head}<div class="col la" lang="la">${s.latin}</div><div class="col vn" lang="${state.lang}">${s.vernacular}</div></section>`);
  }
  $('text').innerHTML = out.join('');
}

function updateUrl() {
  const p = new URLSearchParams({ date: state.date, view: state.view, version: state.version, lang: state.lang });
  if (state.view === 'office') p.set('hour', state.hour);
  try { history.replaceState(null, '', `?${p}`); } catch { /* sandboxed */ }
}

init();
