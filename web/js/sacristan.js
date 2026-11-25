// Sacristan mode: everything a priest or sacristan needs about the liturgical day on one page (Mass: rank,
// colour, Gloria, Credo, Preface, votive Masses…; Office: Matins, Lauds scheme, Vespers…).
// The facts come from the day's index (`ordo`, computed at build time in src/ordo.ts).
import { fastMarks, fastText } from './calendar.js';
import { fetchDay, summariesFor } from './data.js';
import { comboLabel, shownLangId, state } from './state.js';
import { $, COLOR_NAMES, COLORS, esc } from './util.js';
import { fmtDate, t, uiLang } from './ui.js';

/**
 * Latin ranks in the app's language: "III. classis" → "Third class", "Duplex I. classis" →
 * "Double of the first class". (With the app in Latin, the rank stays as the book has it.)
 */
export function rankName(rank) {
  const r = (rank || '').trim();
  if (uiLang() === 'la') return r;
  const ord = { I: 'First', II: 'Second', III: 'Third', IV: 'Fourth' };
  let m;
  if ((m = /^(I{1,3}|IV)\. classis$/.exec(r))) return t(`${ord[m[1]]} class`);
  if ((m = /^Duplex (I{1,2})\. classis$/.exec(r))) return t(`Double of the ${ord[m[1]].toLowerCase()} class`);
  if (/Semiduplex Dominica minor/i.test(r)) return t('Semidouble (lesser Sunday)');
  const words = [
    [/Duplex majus/i, 'Greater double'], [/^Duplex/i, 'Double'], [/Semiduplex/i, 'Semidouble'],
    [/Simplex/i, 'Simple'], [/Dominica major/i, 'Greater Sunday'], [/Dominica minor/i, 'Lesser Sunday'], [/Feria/i, 'Feria'],
  ];
  for (const [re, en] of words) if (re.test(r)) return r.replace(re, t(en));
  return r;
}

const yesNo = (b) => t(b ? 'Yes' : 'No');
const row = (label, value, note = '', noteClass = '') =>
  value === '' || value == null ? '' :
  `<div class="crow"><dt>${esc(t(label))}</dt><dd>${value}${note ? `<span class="cnote${noteClass ? ` ${noteClass}` : ''}">${esc(note)}</span>` : ''}</dd></div>`;
const MATINS = ['No nocturns, {lessons} lessons', 'One nocturn, {lessons} lessons', 'Two nocturns, {lessons} lessons', 'Three nocturns, {lessons} lessons'];

let seq = 0;
export async function renderSacristan() {
  const mine = ++seq;
  const out = $('sacristan-body');
  out.innerHTML = `<p class="msg">${t('Loading…')}</p>`;
  let day;
  let sum;
  try {
    [day, [sum]] = await Promise.all([fetchDay(shownLangId()), summariesFor([state.date])]);
  } catch {
    if (mine === seq) out.innerHTML = `<p class="msg">${t('No texts for this day on this site.')}</p>`;
    return;
  }
  if (mine !== seq) return;
  const o = day.ordo;
  $('sacristan-date').textContent = fmtDate(state.date, 'long');
  $('sacristan-title').textContent = day.header.title;
  $('sacristan-combo').textContent = comboLabel(state.calendar, state.version);
  if (!o) {
    out.innerHTML = `<p class="msg">${t('This day’s summary isn’t built yet. It appears after the site’s next rebuild.')}</p>`;
    return;
  }
  const colour = (c) => `<span class="swatch" style="background:${COLORS[c] || 'transparent'}"></span> ${esc(COLOR_NAMES[c] ? t(COLOR_NAMES[c]) : c)}`;
  const m = o.mass;
  const f = o.office;
  const fast = sum?.fasting && (sum.fasting.fast || sum.fasting.abstinence)
    ? `<p class="cfast">${fastMarks(sum.fasting)} ${esc(fastText(sum.fasting))}</p>` : '';
  const massHtml = m ? `
    <section class="ccard">
      <h2>${t('Mass')}</h2>
      <dl>
        ${m.title !== day.header.title ? row('Mass of', esc(m.title)) : ''}
        ${row('Rank', esc(rankName(m.rank)), uiLang() === 'la' ? '' : m.rank, 'rank')}
        ${row('Liturgical colour', colour(m.color))}
        ${row('Gloria', yesNo(m.gloria))}
        ${row('Credo', yesNo(m.credo))}
        ${row('Preface', esc(m.preface ? t(m.preface) : '—'))}
        ${row('After the Epistle', m.between ? esc(t(m.between)) : '')}
        ${m.sequence ? row('Sequence', t('Yes')) : ''}
        ${row('Commemorations', m.commemorations.length ? esc(m.commemorations.join('; ')) : '—')}
        ${row('Votive Masses', esc(t(m.votive.status[0].toUpperCase() + m.votive.status.slice(1))), t(m.votive.note))}
        ${m.masses.length ? row('Masses today', m.masses.map(esc).join('<br>')) : ''}
      </dl>
      <p class="clinks"><button type="button" data-open="mass">${t('Open the Mass')}</button></p>
    </section>` : '';
  const vespers = f ? (f.vespers.kind === 'first' ? t('First Vespers of {feast}', { feast: esc(f.vespers.of) }) : t('Second Vespers')) : '';
  const officeHtml = f ? `
    <section class="ccard">
      <h2>${t('Divine Office')}</h2>
      <dl>
        ${row('Rank', esc(rankName(f.rank)), uiLang() === 'la' ? '' : f.rank, 'rank')}
        ${row('Psalms', esc(f.psalter ? t(f.psalter) : '—'))}
        ${row('Matins', t(MATINS[f.matins.nocturns] ?? MATINS[3], { lessons: f.matins.lessons }))}
        ${row('Te Deum', yesNo(f.matins.teDeum))}
        ${row('Lauds', t('Scheme {n}', { n: f.laudsScheme }))}
        ${f.commemorations.length ? row('Commemorations at Lauds', esc(f.commemorations.join('; '))) : ''}
        ${f.preces ? row('Preces', t('Said')) : ''}
        ${f.suffrage ? row('Suffrage', t('Said')) : ''}
        ${row('Vespers', vespers, f.vespers.commemorations.length ? `${t('Com.')} ${f.vespers.commemorations.join('; ')}` : '')}
      </dl>
      <p class="clinks">
        <button type="button" data-open="matins">${t('Matins')}</button>
        <button type="button" data-open="lauds">${t('Lauds')}</button>
        <button type="button" data-open="vespers">${t('Vespers')}</button>
        <button type="button" data-open="compline">${t('Compline')}</button>
      </p>
    </section>` : '';
  out.innerHTML = `${fast}${massHtml}${officeHtml}
    <p class="cnote-foot">${t('Summary drawn from Divinum Officium’s texts for this day. Votive Masses: the general rule for the day’s class; particular cases follow the rubrics.')}</p>`;
}
