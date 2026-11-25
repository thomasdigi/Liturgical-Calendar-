/**
 * Turns a Divinum Officium page (an Hour of the Office, or the Mass propers) into clean data.
 * ALL knowledge of DO's HTML lives in this file.
 */
import * as cheerio from 'cheerio';
import type { AnyNode } from 'domhandler';

export type LiturgicalColor = 'white' | 'red' | 'green' | 'violet' | 'rose' | 'black';

export interface DayHeader {
  title: string; // e.g. "In Conceptione Immaculata Beatæ Mariæ Virginis"
  rank: string; // e.g. "I. classis"
  color: LiturgicalColor;
  commemorations: string[];
}

/** One part of the text: Latin plus the chosen second ("vernacular") language. */
export interface Section {
  heading: { latin: string; vernacular: string }; // e.g. Psalmi / Psalms
  latin: string; // clean HTML
  vernacular: string;
  /** Line numbers (see splitLines) of `vernacular` that DO filled with English: not translated. */
  fallback?: number[];
}

/** Splits a section's HTML into lines. The viewer splits the same way (on <br>). */
export function splitLines(html: string): string[] {
  return html.split(/<br\s*\/?>/i);
}

export interface ParsedPage {
  header: DayHeader;
  title: string; // e.g. "Ad Laudes", "Sancta Missa"
  versionShown: string; // the version DO says it rendered, e.g. "Rubrics 1960 - 1960"
  /** On days with several Masses, DO's names for them ("Missa prima", "Forma longior", …). */
  masses: string[];
  sections: Section[];
}

/**
 * DO colours the day's title by vestment colour (DivinumOfficium/Main.pm,
 * liturgical_color): black text = white vestments, blue = white (Marian),
 * grey = black vestments, purple = violet, deeppink = rose.
 */
const COLOR_MAP: Record<string, LiturgicalColor> = {
  black: 'white',
  blue: 'white',
  grey: 'black',
  gray: 'black',
  purple: 'violet',
  deeppink: 'rose',
  red: 'red',
  green: 'green',
};

export function parsePage(html: string): ParsedPage {
  const $ = cheerio.load(html);

  // --- Day header: first centered paragraph inside the form.
  const headP = $('form p').first();
  const titleEl = headP.find('font').first();
  const doColor = (titleEl.attr('color') ?? 'black').toLowerCase();
  const rank = headP.find('span[style*="maroon"]').first().text().trim();
  const commemorations: string[] = [];
  headP.find('i font[color]').each((_, el) => {
    const t = $(el).text().trim();
    if (t) commemorations.push(t);
  });
  const header: DayHeader = {
    title: titleEl.text().trim(),
    rank,
    color: COLOR_MAP[doColor] ?? 'white',
    commemorations,
  };

  // Office pages have <H2>Ad Laudes</H2>; the Mass page a "Sancta Missa" paragraph.
  const title =
    $('h2').first().text().trim() || $('form p b i').filter((_, el) => /Missa/.test($(el).text())).first().text().trim();

  // --- Sections: each two-cell row of the main table is one part, Latin | second language.
  const table = $('table.contrastbg')
    .filter((_, t) => $(t).find('td[width="50%"]').length > 0)
    .first();
  const sections: Section[] = [];
  table.find('tr').each((_, tr) => {
    const tds = $(tr).children('td');
    if (tds.length < 2) return;
    const [la, vn] = [cleanCell($, tds.eq(0)), cleanCell($, tds.eq(1))];
    // Heading-only rows are markers such as "Gloria" / "Credo" in the Mass: keep them.
    if (!la.html && !vn.html && !la.heading) return;
    // DO marks parts that are not said today with {omittitur}; skip them.
    if (/\{omittitur\}/.test(la.html) && la.html.replace(/<[^>]+>/g, '').length < 80) return;
    // In the Mass, an omitted Gloria/Credo is a row whose only text is "omit.".
    if (/^\s*omit\.?\s*$/i.test(la.html.replace(/<[^>]+>/g, ''))) return;
    sections.push({ heading: { latin: la.heading, vernacular: vn.heading }, latin: la.html, vernacular: vn.html });
  });

  for (const sec of sections) markCommemorations(sec);

  // DO prints the version it actually used next to its own title (it silently falls
  // back to its default for an unknown version name, so callers can check this).
  const versionShown = $('font[color="RED"][size="+1"], font[color="red"][size="+1"]')
    .filter((_, el) => /\d{4}/.test($(el).text()))
    .first()
    .text()
    .trim();

  // DO offers a choice of Mass with radio buttons: name='missanumber' value='2'>Missa secunda
  const masses = [...html.matchAll(/name='missanumber' value='(\d+)'>([^<]*)/g)]
    .sort((a, b) => +a[1] - +b[1])
    .map((m) => m[2].trim());

  return { header, title, versionShown, masses, sections };
}

/** Convert one DO table cell into our minimal HTML, pulling out its heading. */
function cleanCell($: cheerio.CheerioAPI, td: cheerio.Cheerio<AnyNode>): { heading: string; html: string } {
  const cell = td.clone();
  cell.find('div[align]').remove(); // "Top / Next" nav and row numbers
  cell.find('script, input, a[onclick]').remove();

  // Heading: <FONT SIZE='+1' COLOR="red"><B><I>Psalmi</I></B></FONT>
  let heading = '';
  // Only counts as a heading if it opens the cell and isn't glued to following text
  // (DO also uses SIZE=+1 for some initials, "P|er Dominum", and for "N." placeholders).
  // (DO's special services, e.g. Holy Week, put line breaks before the heading: skip those.)
  const first = cell.contents().filter((_, n) => !(n.type === 'text' && !$(n).text().trim()) && !(n.type === 'tag' && n.name === 'br')).first();
  if (first.length) first.prevAll('br').remove();
  const after = first.length ? first[0].next : null;
  const glued = after?.type === 'text' && /^\S/.test($(after).text());
  const h = first.is('font[size="+1"]') && !glued ? first : cell.find('nothing');
  if (h.length) {
    heading = h.text().trim();
    // a small note in braces often follows the heading, e.g. "{… ex Proprio Sanctorum}"
    const note = h.nextAll('font[size="-1"]').first();
    const noteText = note.text().trim();
    h.replaceWith(noteText ? `<p class="note">${escapeHtml(noteText)}</p>` : '');
    note.remove();
  }

  // Replace DO's presentational markup with semantic classes.
  cell.find('font[size="+2"], font[size="+1"]').each((_, el) => {
    const t = $(el).text();
    const cls = t.trim().length === 1 ? 'initial' : 'rubric';
    $(el).replaceWith(`<span class="${cls}">${escapeHtml(t)}</span>`);
  });
  // Small red text: verse numbers ("92:1") or small-print rubrics.
  cell.find('font[size="1"][color="red"]').each((_, el) => {
    const t = $(el).text();
    const cls = /^\s*\d+[:,]\d+[a-z]?\s*$/.test(t) ? 'verse' : /^\s*[‡†]\s*$/.test(t) ? 'rubric small cross' : 'rubric small';
    $(el).replaceWith(`<span class="${cls}">${escapeHtml(t)}</span>`);
  });
  cell.find('font[color="red"], font[color="RED"], span[style*="color:red"]').each((_, el) => {
    // DO's crosses: ✠ (sign of the cross), ✙ (small cross on the lips), "+" (the three
    // crosses at the Gospel). All are shown as ✠, so they look alike in every language.
    const t = $(el).text().replace(/^\s*(?:✙\uFE0E?|\+)\s*$/, '✠');
    // Crosses and the psalm marks ‡ and † stand upright (not in italics like the other red text).
    $(el).replaceWith(`<span class="rubric${/^[✠‡†]$/.test(t.trim()) ? ' cross' : ''}">${escapeHtml(t)}</span>`);
  });
  cell.find('font[size="-1"]').each((_, el) => {
    $(el).replaceWith(`<span class="small">${escapeHtml($(el).text())}</span>`);
  });
  cell.find('font').each((_, el) => {
    $(el).replaceWith($(el).html() ?? '');
  });
  // Drop remaining inline styles/attributes we don't want.
  cell.find('*').each((_, el) => {
    const keep = $(el).attr('class');
    for (const name of Object.keys((el as { attribs?: Record<string, string> }).attribs ?? {})) {
      $(el).removeAttr(name);
    }
    if (keep) $(el).attr('class', keep);
  });

  let html = (cell.html() ?? '')
    .replace(/^\s*(<br\s*\/?>\s*)+/i, '')
    .replace(/(<\/p>)\s*(<br\s*\/?>\s*)+/gi, '$1')
    .replace(/(<br\s*\/?>\s*)+$/i, '')
    .replace(/<b>\s*<i>\s*<\/i>\s*<\/b>/gi, '')
    .trim();
  html = html.replace(/(\s*<br\s*\/?>\s*){3,}/gi, '<br><br>');
  return { heading, html };
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}


/**
 * Labels commemorations and suffrages, which DO prints as plain red lines:
 * "Commemoratio S. N." (Mass and Office), and in the Suffragium section
 * "De Cruce", "De Beata Maria", "De sancto Joseph", … The red line becomes
 * <span class="rubric commem" data-kind="commemoration|suffrage">. The same line of
 * the translation is labelled too, when the two columns line up.
 */
export function markCommemorations(sec: Section): void {
  const suffrage = /^Suffragi/i.test(sec.heading.latin);
  const RUBRIC = /<span class="rubric">([^<]*)<\/span>/;
  const la = splitLines(sec.latin);
  const vn = splitLines(sec.vernacular);
  const hits: [number, string][] = [];
  la.forEach((line, i) => {
    const m = RUBRIC.exec(line);
    if (!m) return;
    const text = m[1].trim();
    // The rubric must be the whole line (apart from DO's {notes}), not part of an instruction.
    const rest = line.replace(/<p class="note">[^<]*<\/p>/, '').replace(m[0], '').replace(/<[^>]+>/g, '').trim();
    if (rest) return;
    const kind = /^Commemoratio\b/.test(text) ? 'commemoration' : suffrage && /^De\s/.test(text) ? 'suffrage' : '';
    if (!kind) return;
    la[i] = line.replace(m[0], `<span class="rubric commem" data-kind="${kind}">${m[1]}</span>`);
    hits.push([i, kind]);
  });
  if (!hits.length) return;
  sec.latin = la.join('<br>');
  if (vn.length === la.length) {
    for (const [i, kind] of hits) {
      vn[i] = vn[i].replace(RUBRIC, (_, t) => `<span class="rubric commem" data-kind="${kind}">${t}</span>`);
    }
    sec.vernacular = vn.join('<br>');
  }
}
