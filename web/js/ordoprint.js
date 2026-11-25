// The month's Ordo, printed (Settings → Print, on the month page): a compact table, one row a
// day, like a printed Ordo. The feast, its rank, colour and commemorations; for the Mass:
// Gloria, Credo, Preface; for the Office: Matins, Te Deum, First or Second Vespers; fasting.
// Uses the customary Latin abbreviations (Gl., Cr., Praef.), with a key in the app's language.
import { fetchMonth, getJson } from './data.js';
import { comboLabel, shownLangId, state, versionHasMass } from './state.js';
import { COLOR_NAMES, esc, monthOf } from './util.js';
import { fmtDate, t } from './ui.js';

const LETTER = { white: 'W', red: 'R', green: 'G', violet: 'V', rose: 'Ro', black: 'N' }; // for black-and-white printers
const MATINS = ['', 'I noct.', 'II noct.', 'III noct.'];

async function dayOrdo(date) {
  try {
    const index = await getJson(`data/${state.calendar}/${state.version}/${shownLangId()}/${date.slice(0, 4)}/${date.slice(5)}/index.json`);
    return index.ordo ?? null;
  } catch {
    return null;
  }
}

function fastMarks(f) {
  if (!f) return '';
  const partial = f.partial ?? (f.fast && !f.abstinence);
  return [f.fast ? 'F' : '', f.abstinence ? 'A' : '', partial ? 'P' : ''].filter(Boolean).map((l) => `<span class="op-fast">${l}</span>`).join('');
}

/** Build the month's Ordo into the page (hidden on screen) and open the print dialog. */
export async function printOrdo() {
  const month = monthOf(state.date);
  const data = await fetchMonth(month);
  const ordos = await Promise.all(data.days.map((d) => dayOrdo(d.date)));
  const mass = versionHasMass();
  const rows = data.days.map((d, i) => {
    const o = ordos[i];
    const sunday = new Date(`${d.date}T12:00:00Z`).getUTCDay() === 0;
    const m = o?.mass;
    const f = o?.office;
    const massCell = !mass ? '' : m ? [
      m.gloria ? 'Gl.' : '', m.credo ? 'Cr.' : '', m.preface ? `Praef. ${esc(t(m.preface))}` : '',
      m.commemorations.length ? `<br><i>${t('Com.')} ${esc(m.commemorations.join('; '))}</i>` : '',
    ].filter(Boolean).join(' ') : '';
    const officeCell = f ? [
      f.matins.nocturns ? `${t('Matins')}: ${MATINS[f.matins.nocturns] ?? ''}` : '',
      f.matins.teDeum ? 'Te Deum' : '',
      f.vespers.kind === 'first' ? `I Vesp. ${esc(f.vespers.of)}` : 'II Vesp.',
    ].filter(Boolean).join(' · ') : '';
    return `<tr class="${sunday ? 'op-sunday' : ''}">
      <td class="op-date"><b>${+d.date.slice(8)}</b> ${esc(fmtDate(d.date, 'weekdayShort'))}</td>
      <td class="op-col"><span class="op-swatch op-${d.color}"></span>${LETTER[d.color] ?? ''}</td>
      <td class="op-feast" lang="la"><span class="op-title">${esc(d.title)}</span> <span class="op-rank">${esc(d.rank)}</span>
        ${d.commemorations.length ? `<br><i>${t('Com.')} ${esc(d.commemorations.join('; '))}</i>` : ''}</td>
      ${mass ? `<td class="op-mass">${massCell}</td>` : ''}
      <td class="op-office">${officeCell}</td>
      <td class="op-fasting">${fastMarks(d.fasting)}</td>
    </tr>`;
  }).join('');
  const colours = Object.entries(LETTER).map(([c, l]) => `${l} ${t(COLOR_NAMES[c])}`).join(' · ');
  const key = [
    mass ? `Gl. ${t('Gloria')} · Cr. ${t('Credo')} · Praef. ${t('Preface')}` : '',
    `I Vesp. / II Vesp. ${t('First and Second Vespers')} · noct. ${t('Nocturn')}`,
    `${t('Com.')} ${t('Commemoration')}`,
    `F ${t('fast')} · A ${t('abstinence')} · P ${t('partial abstinence')}`,
    colours,
  ].filter(Boolean).join('<br>');
  let el = document.getElementById('ordo-print');
  if (!el) {
    el = document.createElement('div');
    el.id = 'ordo-print';
    document.body.append(el);
  }
  el.innerHTML = `<header><h1>${t('Ordo')} · ${esc(fmtDate(month, 'monthYear'))}</h1><p>${esc(comboLabel(state.calendar, state.version))}</p></header>
    <table>
      <thead><tr><th>${t('Day')}</th><th></th><th>${t('Feast')}</th>${mass ? `<th>${t('Mass')}</th>` : ''}<th>${t('Divine Office')}</th><th></th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    <footer>${key}<br>${t('Drawn from Divinum Officium’s texts. Fasting: the traditional discipline (1917 Code).')}</footer>`;
  document.body.classList.add('printing-ordo');
  const done = () => { document.body.classList.remove('printing-ordo'); window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 100);
}
