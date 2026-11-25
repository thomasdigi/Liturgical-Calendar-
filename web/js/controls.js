// Keeping the controls in step with the state; the translation pop-up; the page address.
import { RANGE, SIZES, altLangId, maxSizeIndex, built, calendarHas, chantAvailable, comboBuilt, config, day, fullAvailable, lang, offers, showFull, shownLangId, sizeIndex, state, viewKey, viewName } from './state.js';
import { $, INFO_ICON, esc } from './util.js';

/** Buttons to choose between a day's Masses (Christmas, All Souls, …). */
export function syncMasses() {
  const masses = day?.masses ?? [];
  $('masschoice').hidden = masses.length < 2;
  $('masschoice').innerHTML = masses.map((m) =>
    `<button type="button" data-n="${m.n}" aria-pressed="${m.n === state.massN}" title="${esc(m.title)}">
       <span class="mn">${esc(m.label)}</span><span class="mtitle">${esc(m.title)}</span>
     </button>`).join('');
}

export function syncControls() {
  // Day or month page
  $('month').hidden = state.page !== 'month';
  $('searchpage').hidden = state.page !== 'search';
  $('dayview').hidden = state.page !== 'day';
  $('sacristan').hidden = state.page !== 'sacristan';
  $('sacristan-tab').hidden = !state.sacristan;
  $('sacristan-mode').checked = state.sacristan;
  document.querySelectorAll('#page button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.page === state.page)));
  $('prev').setAttribute('aria-label', 'Previous day');
  // Text size and reading mode
  document.body.style.setProperty('--text-scale', String(SIZES[sizeIndex()]));
  document.querySelector('#size [data-size="-1"]').disabled = sizeIndex() === 0;
  const plus = document.querySelector('#size [data-size="1"]');
  plus.disabled = sizeIndex() >= maxSizeIndex();
  plus.title = !plus.disabled ? '' : maxSizeIndex() < SIZES.length - 1
    ? 'Largest size for two columns on this screen. Choose Interlinear for bigger text.' : 'Largest size';
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
  $('martyrology').hidden = state.office !== 'day';
  const chantOk = chantAvailable();
  $('chant').disabled = !chantOk;
  $('chant').setAttribute('aria-pressed', String(state.chant && chantOk));
  $('chant').title = chantOk ? 'Show the Gregorian chant notation in place of the Latin'
    : state.office !== 'day' ? 'Chant is available for the Office of the day only' : 'Chant is not on this site for this calendar and version';
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
export function syncOffice() {
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

/** Compare with 1954 if showing 1962, otherwise with 1962; same calendar where it exists. */
export function defaultComparison() {
  const want = state.version === '1962' ? '1954' : '1962';
  state.cmpCalendar = state.calendar;
  state.cmpVersion = want;
  fixComparison();
}

export function fixComparison() {
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

export function i18n(langId) {
  const all = window.I18N || {};
  return all[lang(langId).htmlLang] || all.en;
}

export function openInfo(kind) {
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

export function updateUrl() {
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
