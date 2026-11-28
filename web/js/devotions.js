// The devotions' pages (menu → Devotions): Via Petri, the Angelus (or Regina Caeli), the Chaplet
// of Divine Mercy. The prayers in Latin, in the language of the app, or both side by side (the
// switch at the top, remembered). Instructions are always in the language of the app.
// Each devotion can add a reminder to the phone's calendar (web/js/angelus.js makes the file).
import { $, esc, isoToday, store } from './util.js';
import { t, uiLang, UI_LANGS } from './ui.js';
import { easter } from './wheel.js';
import { downloadIcs, weeklyIcs } from './angelus.js';
import { trackEvent } from './analytics.js';

/** The devotions that have their page (the others are still to come). */
export const BUILT = new Set(['via-petri', 'angelus', 'mercy']);

let mode = store.get('devotionLang', 'both'); // 'la' | 'native' | 'both'
const native = () => uiLang(); // the app's language (en, de, fr, es, pt, or la)

/* ---------- drawing a text ---------- */

/** Lines of a prayer, with ℣. and ℟. in red. */
const lines = (s) => esc(s).split('\n').map((l) => l.replace(/^(℣\.|℟\.)/, '<span class="vr">$1</span>')).join('<br>');

/** A text in the chosen language(s): Latin, the app's language, or the two side by side. */
function pair(text, tag = 'div', cls = '') {
  const lang = native();
  const one = (l) => `<${tag} class="${cls}" lang="${l}">${lines(text[l] ?? text.en)}</${tag}>`;
  if (mode === 'la' || lang === 'la') return one('la');
  if (mode === 'native' || text.la === text[lang]) return one(mode === 'native' ? lang : 'la'); // (a Latin name kept in every language: once)
  return `<div class="dv-pair">${one('la')}${one(lang)}</div>`;
}

const pick = (text) => text[native()] ?? text.en;
const fill = (s, vars = {}) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');

/* ---------- the blocks of a devotion ---------- */

const BOOKS = {
  Matthew: { la: 'Matthaeus', en: 'Matthew', de: 'Matthäus', fr: 'Matthieu', es: 'Mateo', pt: 'Mateus' },
  Luke: { la: 'Lucas', en: 'Luke', de: 'Lukas', fr: 'Luc', es: 'Lucas', pt: 'Lucas' },
  John: { la: 'Ioannes', en: 'John', de: 'Johannes', fr: 'Jean', es: 'Juan', pt: 'João' },
  Acts: { la: 'Actus Apostolorum', en: 'Acts', de: 'Apostelgeschichte', fr: 'Actes des Apôtres', es: 'Hechos de los Apóstoles', pt: 'Atos dos Apóstolos' },
};
const refText = (r, l) => `${BOOKS[r.book][l] ?? r.book} ${r.ch}${l === 'en' ? ':' : ', '}${r.v1}–${r.v2}`;

function reading(id, R) {
  const r = R.REFS[id];
  const col = (l) => `<div class="dv-reading" lang="${l}"><p class="dv-ref">${esc(refText(r, l))}</p><p>${
    R.READINGS[id][l].map(([v, s]) => `<sup>${v}</sup>${esc(s)}`).join(' ')}</p></div>`;
  const lang = native();
  if (mode === 'la' || lang === 'la') return col('la');
  if (mode === 'native') return col(lang);
  return `<div class="dv-pair">${col('la')}${col(lang)}</div>`;
}

async function blocks(list, T) {
  const R = list.some((b) => b.reading || b.sources) ? await import('./devotions/readings.js') : null;
  return list.map((b) => {
    if (b.h) return pair(b.h, 'h2', b.station ? 'dv-station' : '');
    if (b.rubric) return `<p class="dv-rubric">${esc(pick(b.rubric))}</p>`;
    if (b.prayer) return pair(b.prayer, 'p', 'dv-prayer');
    if (b.reading) return reading(b.reading, R);
    if (b.prayers) return b.prayers.map((k) => { const [name, text] = T.COMMON[k]; return `<details class="dv-fold"><summary>${esc(pick(name))}</summary>${pair(text, 'p', 'dv-prayer')}</details>`; }).join('');
    if (b.sources) {
      const l = native();
      const used = l === 'la' || mode === 'la' ? ['la'] : mode === 'native' ? [l] : ['la', l];
      return `<p class="dv-sources">${esc(t('Scripture'))}: ${used.map((x) => esc(R.SOURCES[x])).join(' · ')}</p>`;
    }
    return '';
  }).join('');
}

/* ---------- the pages ---------- */

/** Eastertide for the Regina Caeli: Easter Sunday to the Saturday after Pentecost. */
function eastertide(today = isoToday()) {
  const e = new Date(`${easter(+today.slice(0, 4))}T00:00:00Z`);
  const end = new Date(e.getTime() + 55 * 864e5).toISOString().slice(0, 10);
  return today >= e.toISOString().slice(0, 10) && today <= end;
}

async function angelusPage(T) {
  const easterNow = eastertide();
  const angelus = [{ h: T.ANGELUS_NAMES.angelus }, ...T.ANGELUS];
  const regina = [{ h: T.ANGELUS_NAMES.regina }, ...T.REGINA_CAELI];
  const order = easterNow ? [{ rubric: T.EASTERTIDE_NOW }, ...regina, ...angelus] : [...angelus, ...regina];
  return blocks([{ rubric: T.ANGELUS_RUBRIC }, ...order], T);
}

let step = Math.max(0, +store.get('mercyStep', '0') || 0);

function mercyPage(T) {
  const steps = T.mercySteps();
  if (step >= steps.length) step = 0;
  const s = steps[step];
  const [label, vars] = s.label;
  const beads = steps.map((x, i) => {
    const gap = (i === 4 || (x.decade && steps[i - 1]?.decade !== x.decade) || (x.closing && !steps[i - 1]?.closing)) ? ' gap' : '';
    return `<button type="button" class="bead ${x.bead}${i === step ? ' now' : ''}${i < step ? ' done' : ''}${gap}" data-step="${i}" aria-label="${esc(fill(pick(x.label[0]), x.label[1]))}: ${esc(pick(x.name))}"${i === step ? ' aria-current="step"' : ''}></button>`;
  }).join('');
  const last = step === steps.length - 1;
  return `<p class="dv-rubric">${esc(pick(T.MERCY_LABELS.intro))}</p>
    <div class="mercy-card" aria-live="polite">
      <p class="mercy-where">${esc(fill(pick(label), vars))}</p>
      ${s.text.la.startsWith(s.name.la) ? '' : pair(s.name, 'h2', 'mercy-name')}
      ${pair(s.text, 'p', 'dv-prayer')}
    </div>
    <div class="mercy-nav">
      <button type="button" id="mercy-back"${step === 0 ? ' disabled' : ''}>‹ ${esc(t('Back'))}</button>
      <button type="button" id="mercy-next" class="primary">${esc(last ? t('Start again') : t('Next'))}${last ? '' : ' ›'}</button>
    </div>
    <div class="mercy-beads" role="group" aria-label="${esc(t('Beads'))}">${beads}</div>`;
}

function goStep(n, T) {
  const steps = T.mercySteps();
  step = (n + steps.length) % steps.length;
  store.set('mercyStep', String(step));
  draw();
  document.querySelector('.mercy-card')?.scrollIntoView({ block: 'nearest' });
}

/* ---------- the reminder (the phone's calendar) ---------- */

const REMINDER_DEFAULT = { mercy: '15:00', 'via-petri': '20:00' };
const DAYS = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];

function syncReminder(id) {
  const box = $('devotion-reminder');
  box.hidden = !(id in REMINDER_DEFAULT);
  if (box.hidden) return;
  const saved = JSON.parse(store.get(`reminder:${id}`, 'null') ?? 'null') ?? { time: REMINDER_DEFAULT[id], days: DAYS };
  $('dv-time').value = saved.time;
  // Monday to Sunday, named in the language of the app (1 January 2024 was a Monday).
  const fmt = new Intl.DateTimeFormat(UI_LANGS.find((l) => l.id === uiLang())?.locale ?? 'en-US', { weekday: 'short', timeZone: 'UTC' });
  $('dv-days').innerHTML = `<legend>${esc(t('Days'))}</legend>${DAYS.map((d, i) =>
    `<label class="check day"><input type="checkbox" value="${d}"${saved.days.includes(d) ? ' checked' : ''}> ${esc(fmt.format(new Date(Date.UTC(2024, 0, 1 + i))))}</label>`).join('')}`;
}

export function initDevotions() {
  for (const b of document.querySelectorAll('#dv-langs button')) {
    b.onclick = () => { mode = b.dataset.dvlang; store.set('devotionLang', mode); draw(); };
  }
  $('dv-add').onclick = () => {
    const id = current;
    const time = $('dv-time').value || REMINDER_DEFAULT[id];
    const days = [...document.querySelectorAll('#dv-days input:checked')].map((i) => i.value);
    if (!days.length) return;
    store.set(`reminder:${id}`, JSON.stringify({ time, days }));
    const title = id === 'mercy' ? t('Divine Mercy') : 'Via Petri';
    trackEvent(`feature/reminder/${id}`);
    downloadIcs(weeklyIcs({ id, title, note: title, time, days }), `${id}.ics`);
  };
  $('devotion-body').addEventListener('click', (e) => {
    const T = texts;
    if (!T) return;
    const bead = e.target.closest('.bead');
    if (bead) return goStep(+bead.dataset.step, T);
    if (e.target.closest('#mercy-next')) return goStep(step + 1, T);
    if (e.target.closest('#mercy-back')) return goStep(step - 1, T);
  });
  document.addEventListener('keydown', (e) => {
    if (current !== 'mercy' || $('devotion').hidden || e.target.closest('input, select, textarea')) return;
    if (e.key === 'ArrowRight') goStep(step + 1, texts);
    if (e.key === 'ArrowLeft') goStep(step - 1, texts);
  });
}

let current = '';
let texts = null;
let drawSeq = 0;

/** Draw the devotion `id` (or, for one not built yet, say so). */
export async function renderDevotionBody(id) {
  current = id;
  return draw();
}

async function draw() {
  const id = current;
  const seq = ++drawSeq;
  const built = BUILT.has(id);
  $('devotion-soon').hidden = built;
  $('dv-langs').hidden = !built || uiLang() === 'la';
  syncReminder(id);
  const body = $('devotion-body');
  if (!built) { body.innerHTML = ''; return; }
  const nat = UI_LANGS.find((l) => l.id === uiLang());
  $('dv-native').textContent = nat?.label ?? 'English';
  $('dv-native').lang = nat?.id ?? 'en';
  for (const b of document.querySelectorAll('#dv-langs button')) b.setAttribute('aria-pressed', String(b.dataset.dvlang === mode));
  texts ??= await import('./devotions/texts.js');
  const T = texts;
  const html = id === 'via-petri' ? await blocks(T.VIA_PETRI, T) : id === 'angelus' ? await angelusPage(T) : mercyPage(T);
  if (seq !== drawSeq) return;
  body.innerHTML = html;
  body.dataset.devotion = id;
  body.classList.toggle('both', mode === 'both' && uiLang() !== 'la');
}
