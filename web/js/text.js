// Drawing a Mass or an Hour (and, in compare mode, two side by side).
import { updateUrl } from './controls.js';
import { fetchDay, fetchPart } from './data.js';
import { RANGE, altLangId, built, comboLabel, config, currentPartId, day, lang, offers, officeHours, shownLangId, state } from './state.js';
import { rememberPlace } from './lastread.js';
import { offlineHint } from './offline.js';
import { markStructure, renderOutline } from './outline.js';
import { $, COLORS, COLOR_NAMES, INFO_ICON, esc } from './util.js';

/**
 * The second-language text of a section, with lines DO left in English replaced
 * by the alternative language where the two line up.
 */
export function vernacularOf(s, i, altPart) {
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
export async function loadPart(langId, id, cal = state.calendar, ver = state.version) {
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
export function sectionsHtml(part, altPart, L, notes, prefix) {
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

export const headerHtml = (h) =>
  `<p class="cmp-title">${esc(h.title)}</p><p class="cmp-meta"><span class="swatch" style="background:${COLORS[h.color] || 'transparent'}"></span>${esc([h.rank, COLOR_NAMES[h.color]].filter(Boolean).join(' · '))}</p>` +
  (h.commemorations.length ? `<p class="cmp-comm">Com. ${esc(h.commemorations.join('; '))}</p>` : '');

export let renderSeq = 0;

export let pendingScroll = null; // a section to scroll to once drawn (from a search result)

export async function render() {
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
    $('text').innerHTML = `<p class="msg">${navigator.onLine ? 'This part could not be loaded.' : offlineHint().trim()}</p>`;
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
    if (el.classList.contains('commem') || el.classList.contains('struct')) return;
    if (el.classList.contains('small') || el.textContent.trim().length > 14) el.classList.add('instr');
  });
  // Outline (Nocturns, lessons, Te Deum, Martyrology) and the jump menu: the headings,
  // the structure, and each commemoration and suffrage, in reading order (main column).
  const mainCol = state.compare ? $('text').querySelector('.cmp-col') : $('text');
  renderOutline(markStructure(mainCol));
  const jumps = [];
  mainCol.querySelectorAll('section[data-jump], .col.la .commem, .col.la .struct').forEach((el, n) => {
    if (el.matches('section')) jumps.push([el.id, el.dataset.jump]);
    else if (el.classList.contains('struct')) {
      const t = el.textContent.trim();
      jumps.push([el.id, el.classList.contains('lesson') ? `  ↳ Lesson ${t.replace(/^Lectio\s+/, '')}` : t.replace(/^Nocturnus/, 'Nocturn')]);
    } else {
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
    // An element id (a search result: scroll there and flash it), 'martyrology' (the Martyrology
    // shortcut), or { id, flash: false } (coming back to where you were reading).
    const want = typeof pendingScroll === 'object' ? pendingScroll : { id: pendingScroll, flash: true };
    const el = want.id === 'martyrology'
      ? mainCol.querySelector('section.martyrology')
      : document.getElementById(want.id);
    pendingScroll = null;
    if (el) {
      el.scrollIntoView({ block: 'start' }); // scroll-margin keeps it clear of the bars
      if (want.offset) window.scrollBy(0, want.offset); // back to the same point inside a long section
      if (want.flash) {
        el.classList.add('flash');
        setTimeout(() => el.classList.remove('flash'), 2400);
      }
    }
  }
  rememberPlace(); // this day's Mass or Hour, for next time
}
export function setPendingScroll(value) { pendingScroll = value; }
