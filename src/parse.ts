/**
 * Turns a Divinum Officium Office page into clean data.
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

export interface OfficeSection {
  heading: { latin: string; english: string }; // e.g. Psalmi / Psalms
  latin: string; // clean HTML
  english: string;
}

export interface ParsedOffice {
  header: DayHeader;
  hourTitle: string; // e.g. "Ad Laudes"
  sections: OfficeSection[];
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

export function parseOffice(html: string): ParsedOffice {
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

  const hourTitle = $('h2').first().text().trim();

  // --- Sections: each row of the main table = one part of the Hour, Latin | English.
  const sections: OfficeSection[] = [];
  $('h2').first().nextAll('table').first().find('tr').each((_, tr) => {
    const tds = $(tr).children('td');
    if (tds.length < 2) return;
    const [la, en] = [cleanCell($, tds.eq(0)), cleanCell($, tds.eq(1))];
    if (!la.html && !en.html) return;
    // DO marks parts that are not said today with {omittitur}; skip them.
    if (/\{omittitur\}/.test(la.html) && la.html.replace(/<[^>]+>/g, '').length < 80) return;
    sections.push({ heading: { latin: la.heading, english: en.heading }, latin: la.html, english: en.html });
  });

  return { header, hourTitle, sections };
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
  const first = cell.contents().filter((_, n) => !(n.type === 'text' && !$(n).text().trim())).first();
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
    const cls = /^\s*\d+[:,]\d+[a-z]?\s*$/.test(t) ? 'verse' : 'rubric small';
    $(el).replaceWith(`<span class="${cls}">${escapeHtml(t)}</span>`);
  });
  cell.find('font[color="red"], font[color="RED"], span[style*="color:red"]').each((_, el) => {
    $(el).replaceWith(`<span class="rubric">${escapeHtml($(el).text())}</span>`);
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
