// Viewer: loads data/YYYY/MM-DD.json and shows one Hour at a time.
const $ = (id) => document.getElementById(id);
const COLORS = { white: 'var(--c-white)', red: 'var(--c-red)', green: 'var(--c-green)', violet: 'var(--c-violet)', rose: 'var(--c-rose)', black: 'var(--c-black)' };
const COLOR_NAMES = { white: 'White', red: 'Red', green: 'Green', violet: 'Violet', rose: 'Rose', black: 'Black' };

const store = {
  get(k, d) { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch {} },
};

const params = new URLSearchParams(location.search);
let state = {
  date: params.get('date') || isoToday(),
  hour: params.get('hour') || defaultHour(),
  lang: store.get('lang', 'both'),
};
let day = null;

function isoToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function defaultHour() {
  const h = new Date().getHours();
  return h < 11 ? 'lauds' : h < 15 ? 'sext' : h < 20 ? 'vespers' : 'compline';
}
function shift(iso, n) {
  const d = new Date(`${iso}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

async function load() {
  $('date').value = state.date;
  $('title').textContent = 'Loading…';
  $('office').innerHTML = '';
  const url = `data/${state.date.slice(0, 4)}/${state.date.slice(5)}.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`${res.status}`);
    day = await res.json();
  } catch (e) {
    day = null;
    $('title').textContent = 'Not available';
    $('office').innerHTML = `<p class="msg">No Office text for ${state.date} yet.</p>`;
    return;
  }
  renderDay();
}

function renderDay() {
  const h = day.header;
  const d = new Date(`${day.date}T12:00:00Z`);
  $('weekday').textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  $('title').textContent = h.title;
  $('rank').textContent = [h.rank, COLOR_NAMES[h.color]].filter(Boolean).join(' · ');
  $('swatch').style.background = COLORS[h.color] || 'transparent';
  $('comm').textContent = h.commemorations.length ? `Commemoration: ${h.commemorations.join('; ')}` : '';

  $('hours').innerHTML = '';
  for (const hr of day.hours) {
    const b = document.createElement('button');
    b.role = 'tab';
    b.textContent = hr.title.english;
    b.title = hr.title.latin;
    b.setAttribute('aria-selected', String(hr.id === state.hour));
    b.onclick = () => { state.hour = hr.id; updateUrl(); renderDay(); };
    $('hours').append(b);
  }
  renderHour();
}

function renderHour() {
  const hr = day.hours.find((x) => x.id === state.hour) || day.hours[0];
  const out = [];
  for (const s of hr.sections) {
    const head = s.heading.latin || s.heading.english
      ? `<h2><span class="la">${s.heading.latin}</span>${s.heading.latin && s.heading.english ? '<span class="sep la"> · </span>' : ''}<span class="en">${s.heading.english}</span></h2>`
      : '';
    out.push(`<section>${head}<div class="col la" lang="la">${s.latin}</div><div class="col en" lang="en">${s.english}</div></section>`);
  }
  $('office').innerHTML = out.join('');
}

function updateUrl() {
  const p = new URLSearchParams({ date: state.date, hour: state.hour });
  history.replaceState(null, '', `?${p}`);
}

function setLang(lang) {
  state.lang = lang;
  document.body.dataset.lang = lang;
  store.set('lang', lang);
  document.querySelectorAll('.lang button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.lang === lang)));
}

function go(date) { state.date = date; updateUrl(); load(); }

$('prev').onclick = () => go(shift(state.date, -1));
$('next').onclick = () => go(shift(state.date, 1));
$('today').onclick = () => go(isoToday());
$('date').onchange = (e) => e.target.value && go(e.target.value);
document.querySelectorAll('.lang button').forEach((b) => (b.onclick = () => setLang(b.dataset.lang)));
document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.key === 'ArrowLeft') go(shift(state.date, -1));
  if (e.key === 'ArrowRight') go(shift(state.date, 1));
});

setLang(state.lang);
updateUrl();
load();
