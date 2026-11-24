// Clergy mode: everything a priest needs about the liturgical day on one page (Mass: rank,
// colour, Gloria, Credo, Preface, votive Masses…; Office: Matins, Lauds scheme, Vespers…).
// The facts come from the day's index (`ordo`, computed at build time in src/ordo.ts).
import { fastMarks, fastText } from './calendar.js';
import { fetchDay, summariesFor } from './data.js';
import { comboLabel, shownLangId, state } from './state.js';
import { $, COLOR_NAMES, COLORS, esc } from './util.js';

/** Latin ranks in English: "III. classis" → "Third class", "Duplex I. classis" → "Double of the first class". */
export function rankInEnglish(rank) {
  const ord = { I: 'first', II: 'second', III: 'third', IV: 'fourth' };
  const r = (rank || '').trim();
  let m;
  if ((m = /^(I{1,3}|IV)\. classis$/.exec(r))) return `${ord[m[1]][0].toUpperCase()}${ord[m[1]].slice(1)} class`;
  if ((m = /^Duplex (I{1,2})\. classis$/.exec(r))) return `Double of the ${ord[m[1]]} class`;
  const words = [
    [/Duplex majus/i, 'Greater double'], [/^Duplex/i, 'Double'], [/Semiduplex/i, 'Semidouble'],
    [/Simplex/i, 'Simple'], [/Dominica major/i, 'Greater Sunday'], [/Dominica minor/i, 'Lesser Sunday'], [/Feria/i, 'Feria'],
  ];
  for (const [re, en] of words) if (re.test(r)) return r.replace(/Semiduplex Dominica minor/i, 'Semidouble (lesser Sunday)').replace(re, en);
  return r;
}

const yesNo = (b) => (b ? 'Yes' : 'No');
const row = (label, value, note = '') =>
  value === '' || value == null ? '' :
  `<div class="crow"><dt>${esc(label)}</dt><dd>${value}${note ? `<span class="cnote">${esc(note)}</span>` : ''}</dd></div>`;
const words = ['None', 'One', 'Two', 'Three'];

let seq = 0;
export async function renderClergy() {
  const mine = ++seq;
  const out = $('clergy-body');
  out.innerHTML = '<p class="msg">Loading…</p>';
  let day;
  let sum;
  try {
    [day, [sum]] = await Promise.all([fetchDay(shownLangId()), summariesFor([state.date])]);
  } catch {
    if (mine === seq) out.innerHTML = '<p class="msg">No texts for this day on this site.</p>';
    return;
  }
  if (mine !== seq) return;
  const o = day.ordo;
  const d = new Date(`${state.date}T12:00:00Z`);
  $('clergy-date').textContent = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  $('clergy-title').textContent = day.header.title;
  $('clergy-combo').textContent = comboLabel(state.calendar, state.version);
  if (!o) {
    out.innerHTML = '<p class="msg">The clergy summary for this day isn’t built yet. It appears after the site’s next rebuild.</p>';
    return;
  }
  const colour = (c) => `<span class="swatch" style="background:${COLORS[c] || 'transparent'}"></span> ${esc(COLOR_NAMES[c] || c)}`;
  const m = o.mass;
  const f = o.office;
  const fast = sum?.fasting && (sum.fasting.fast || sum.fasting.abstinence)
    ? `<p class="cfast">${fastMarks(sum.fasting)} ${esc(fastText(sum.fasting))}</p>` : '';
  const massHtml = m ? `
    <section class="ccard">
      <h2>Mass</h2>
      <dl>
        ${m.title !== day.header.title ? row('Mass of', esc(m.title)) : ''}
        ${row('Rank', esc(rankInEnglish(m.rank)), m.rank)}
        ${row('Liturgical colour', colour(m.color))}
        ${row('Gloria', yesNo(m.gloria))}
        ${row('Credo', yesNo(m.credo))}
        ${row('Preface', esc(m.preface || '—'))}
        ${row('After the Epistle', esc(m.between))}
        ${m.sequence ? row('Sequence', 'Yes') : ''}
        ${row('Commemorations', m.commemorations.length ? esc(m.commemorations.join('; ')) : 'None')}
        ${row('Votive Masses', esc(m.votive.status[0].toUpperCase() + m.votive.status.slice(1)), m.votive.note)}
        ${m.masses.length ? row('Masses today', m.masses.map(esc).join('<br>')) : ''}
      </dl>
      <p class="clinks"><button type="button" data-open="mass">Open the Mass</button></p>
    </section>` : '';
  const vespers = f ? (f.vespers.kind === 'first' ? `First Vespers of ${esc(f.vespers.of)}` : 'Second Vespers') : '';
  const officeHtml = f ? `
    <section class="ccard">
      <h2>Divine Office</h2>
      <dl>
        ${row('Rank', esc(rankInEnglish(f.rank)), f.rank)}
        ${row('Psalms', esc(f.psalter || '—'))}
        ${row('Matins', `${words[f.matins.nocturns] ?? f.matins.nocturns} nocturn${f.matins.nocturns === 1 ? '' : 's'}, ${f.matins.lessons} lessons`)}
        ${row('Te Deum', yesNo(f.matins.teDeum))}
        ${row('Lauds', `Scheme ${f.laudsScheme}`)}
        ${f.commemorations.length ? row('Commemorations at Lauds', esc(f.commemorations.join('; '))) : ''}
        ${f.preces ? row('Preces', 'Said') : ''}
        ${f.suffrage ? row('Suffrage', 'Said') : ''}
        ${row('Vespers', vespers, f.vespers.commemorations.length ? `Com. ${f.vespers.commemorations.join('; ')}` : '')}
      </dl>
      <p class="clinks">
        <button type="button" data-open="matins">Matins</button>
        <button type="button" data-open="lauds">Lauds</button>
        <button type="button" data-open="vespers">Vespers</button>
        <button type="button" data-open="compline">Compline</button>
      </p>
    </section>` : '';
  out.innerHTML = `${fast}${massHtml}${officeHtml}
    <p class="cnote-foot">Summary drawn from Divinum Officium’s texts for this day. Votive Masses: the general rule for the day’s class; particular cases follow the rubrics.</p>`;
}
