// E-books (EPUB 3): a day, a week or a month of the Mass and/or the Office, made in the browser
// from the texts the site already has (so it works offline for saved days). Each day is a
// chapter; each section gives the Latin and then the translation (e-readers have no room for
// columns). It follows the languages shown, the calendar and version, and the Typography
// options for the Latin. Chant notation isn't included (e-readers can't draw it).
import { getJson } from './data.js';
import { comboLabel, config, inRange, lang, shownLangId, state } from './state.js';
import { esc, monthOf, shift } from './util.js';
import { simplifyLatin } from './typography.js';
import { fmtDate, t, uiLang } from './ui.js';

// ---------- a minimal ZIP writer (stored, no compression: EPUB's "mimetype" must be stored) ----------
const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(bytes) {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
export function zip(files) {
  const enc = new TextEncoder();
  const chunks = [];
  const central = [];
  let offset = 0;
  for (const { name, data } of files) {
    const nameBytes = enc.encode(name);
    const bytes = typeof data === 'string' ? enc.encode(data) : data;
    const crc = crc32(bytes);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true); // version needed
    local.setUint16(6, 0x0800, true); // UTF-8 names
    local.setUint16(8, 0, true); // stored
    local.setUint32(14, crc, true);
    local.setUint32(18, bytes.length, true);
    local.setUint32(22, bytes.length, true);
    local.setUint16(26, nameBytes.length, true);
    chunks.push(local, nameBytes, bytes);
    const cen = new DataView(new ArrayBuffer(46));
    cen.setUint32(0, 0x02014b50, true);
    cen.setUint16(4, 20, true);
    cen.setUint16(6, 20, true);
    cen.setUint16(8, 0x0800, true);
    cen.setUint32(16, crc, true);
    cen.setUint32(20, bytes.length, true);
    cen.setUint32(24, bytes.length, true);
    cen.setUint16(28, nameBytes.length, true);
    cen.setUint32(42, offset, true);
    central.push(cen, nameBytes);
    offset += 30 + nameBytes.length + bytes.length;
  }
  const size = central.reduce((n, c) => n + c.byteLength, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, size, true);
  end.setUint32(16, offset, true);
  return new Blob([...chunks, ...central, end], { type: 'application/epub+zip' });
}

// ---------- the texts ----------
const dir = (langId, date) => `data/${state.calendar}/${state.version}/${langId}/${date.slice(0, 4)}/${date.slice(5)}`;

async function loadPart(langId, date, id) {
  const own = await getJson(`${dir(langId, date)}/${id}.json`);
  const latin = own.latin ?? (await getJson(`${dir('latin', date)}/${id}.json`)).sections;
  return own.sections.map((s, i) => ({ heading: latin[i]?.heading ?? '', headingVn: s.heading, latin: latin[i]?.latin ?? '', vernacular: s.vernacular }));
}

/** Which dates a range covers: 'day', 'week' (7 days from the date) or 'month'. */
export function rangeDates(range, date = state.date) {
  let dates;
  if (range === 'day') dates = [date];
  else if (range === 'week') dates = Array.from({ length: 7 }, (_, i) => shift(date, i));
  else {
    const m = monthOf(date);
    dates = [];
    for (let d = `${m}-01`; monthOf(d) === m; d = shift(d, 1)) dates.push(d);
  }
  return dates.filter((d) => inRange(d));
}

const longDate = (d) => fmtDate(d, 'long');
const COLOURS = { white: 'White', red: 'Red', green: 'Green', violet: 'Violet', rose: 'Rose', black: 'Black' };

/** HTML (to become XHTML) for one day. */
async function dayChapter(date, n, { langId, contents, display }) {
  const index = await getJson(`${dir(langId, date)}/index.json`);
  const L = lang(langId);
  const want = index.parts.filter((p) =>
    (contents !== 'office' && /^mass(-\d+)?$/.test(p.id)) ||
    (contents !== 'mass' && config.hours.some((h) => h.id === p.id)));
  const toc = [];
  let html = `<h1 id="d${n}">${esc(longDate(date))}</h1>
    <p class="feast" lang="la">${esc(index.header.title)}</p>
    <p class="rank">${esc([index.header.rank, COLOURS[index.header.color] && t(COLOURS[index.header.color])].filter(Boolean).join(' · '))}</p>`;
  if (index.header.commemorations?.length) html += `<p class="com" lang="la">${t('Com.')} ${esc(index.header.commemorations.join('; '))}</p>`;
  for (const p of want) {
    const sections = await loadPart(langId, date, p.id);
    const masses = index.masses ?? [];
    const label = p.id.startsWith('mass')
      ? (masses.length > 1 ? `${t('Mass')}: ${masses.find((m) => `mass${m.n > 1 ? `-${m.n}` : ''}` === p.id)?.label ?? ''}` : t('Mass'))
      : t(config.hours.find((h) => h.id === p.id).label);
    const pid = `d${n}-${p.id}`;
    toc.push([pid, label]);
    html += `<section class="part"><h2 id="${pid}">${esc(label)}</h2>`;
    for (const s of sections) {
      if (!s.latin && !s.vernacular) { if (s.heading) html += `<p class="marker">${s.heading}</p>`; continue; }
      const head = s.heading || s.headingVn;
      if (head) html += `<h3><span lang="la">${s.heading}</span>${s.headingVn && s.headingVn !== s.heading ? ` <span class="vnh">· ${s.headingVn}</span>` : ''}</h3>`;
      if (display !== 'vernacular') html += `<div class="la" lang="la">${s.latin}</div>`;
      if (display !== 'latin') html += `<div class="vn" lang="${L.htmlLang}"${L.rtl ? ' dir="rtl"' : ''}>${s.vernacular}</div>`;
    }
    html += '</section>';
  }
  return { html, toc, title: index.header.title };
}

const XHTML = 'http://www.w3.org/1999/xhtml';
/** Turn HTML into well-formed XHTML for the book (and apply the Typography options to the Latin). */
function toXhtml(html, title, langCode) {
  const doc = document.implementation.createHTMLDocument('');
  doc.body.innerHTML = html;
  doc.body.querySelectorAll('.GABC, .GCHANT, button, script').forEach((el) => el.remove());
  doc.body.querySelectorAll('.rubric').forEach((el) => { if (/^\s*(✠|✙︎?|\+)\s*$/.test(el.textContent)) { el.textContent = '✠'; el.classList.add('cross'); } });
  simplifyLatin(doc.body);
  const body = new XMLSerializer().serializeToString(doc.body).replace(/^<body[^>]*>|<\/body>$/g, '');
  return `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="${XHTML}" xmlns:epub="http://www.idpf.org/2007/ops" lang="${langCode}" xml:lang="${langCode}">
<head><meta charset="utf-8"/><title>${esc(title)}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body>${body}</body>
</html>`;
}

const CSS = `body { font-family: serif; line-height: 1.5; margin: 0 4%; }
h1 { font-size: 1.4em; text-align: center; margin: 1em 0 .2em; page-break-before: always; }
.feast { text-align: center; font-size: 1.2em; font-weight: bold; margin: .2em 0; }
.rank, .com { text-align: center; color: #555; margin: .2em 0; }
.com { font-style: italic; }
h2 { font-size: 1.25em; color: #8b1a14; border-bottom: 1px solid #ccc; margin: 1.4em 0 .4em; page-break-after: avoid; }
h3 { font-size: .85em; text-transform: uppercase; letter-spacing: .06em; color: #8b1a14; margin: 1em 0 .3em; page-break-after: avoid; }
h3 .vnh { color: #777; }
.la { margin: 0 0 .4em; }
.vn { margin: 0 0 .8em; padding-left: .8em; border-left: 2px solid #ddd; color: #333; }
.rubric { color: #b3261e; font-style: italic; }
.rubric.cross { font-style: normal; }
.initial { color: #b3261e; font-size: 1.4em; font-weight: bold; }
.verse, .small { color: #b3261e; font-size: .75em; }
.note { color: #666; font-size: .85em; font-style: italic; }
.supplied { font-style: italic; color: #666; }
.marker { font-weight: bold; color: #8b1a14; }
.title-page { text-align: center; margin-top: 30%; }
.title-page h1 { page-break-before: avoid; font-size: 1.8em; }`;

/** Make the e-book. `onProgress(done, total)` reports each day. Returns { blob, filename, days }. */
export async function makeEpub({ range, contents }, onProgress = () => {}) {
  const dates = rangeDates(range);
  if (!dates.length) throw new Error(t('No dates on this site for that range.'));
  const langId = shownLangId();
  const L = lang(langId);
  const display = state.display;
  const chapters = [];
  for (const [i, date] of dates.entries()) {
    try {
      chapters.push({ date, n: i + 1, ...(await dayChapter(date, i + 1, { langId, contents, display })) });
    } catch { /* a day that isn't on the site (or not saved, offline): left out */ }
    onProgress(i + 1, dates.length);
  }
  if (!chapters.length) throw new Error(t('None of these days could be loaded (are you offline?).'));

  const first = dates[0], last = dates.at(-1);
  const span = first === last ? longDate(first)
    : range === 'month' ? fmtDate(first, 'monthYear')
    : t('{from} to {to}', { from: fmtDate(first, 'medium'), to: fmtDate(last, 'medium') });
  const what = t(contents === 'mass' ? 'The Mass' : contents === 'office' ? 'The Divine Office' : 'The Mass and Divine Office');
  const bookTitle = `${what}: ${span}`;
  const langs = display === 'latin' ? t('Latin') : display === 'vernacular' ? L.label : t('Latin and {lang}', { lang: L.label });
  const uid = `urn:uuid:${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`}`;
  const modified = new Date().toISOString().replace(/\.\d+Z$/, 'Z');
  const bookLang = display === 'latin' ? 'la' : L.htmlLang;

  const titlePage = toXhtml(`<div class="title-page"><h1>${esc(what)}</h1><p>${esc(span)}</p>
    <p>${esc(comboLabel(state.calendar, state.version))}</p><p>${esc(langs)}</p>
    <p class="rank">${t('Texts from Divinum Officium (MIT License).')}</p></div>`, bookTitle, bookLang);
  const files = [
    { name: 'mimetype', data: 'application/epub+zip' },
    { name: 'META-INF/container.xml', data: `<?xml version="1.0" encoding="UTF-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles><rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml"/></rootfiles>
</container>` },
    { name: 'OEBPS/style.css', data: CSS },
    { name: 'OEBPS/title.xhtml', data: titlePage },
  ];
  for (const c of chapters) files.push({ name: `OEBPS/day${c.n}.xhtml`, data: toXhtml(c.html, `${longDate(c.date)}: ${c.title}`, bookLang) });

  // Table of contents: each day, and its Mass and Hours.
  const navList = chapters.map((c) => `<li><a href="day${c.n}.xhtml#d${c.n}">${esc(longDate(c.date))}: ${esc(c.title)}</a>
    <ol>${c.toc.map(([id, label]) => `<li><a href="day${c.n}.xhtml#${id}">${esc(label)}</a></li>`).join('')}</ol></li>`).join('\n');
  files.push({ name: 'OEBPS/nav.xhtml', data: `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="${XHTML}" xmlns:epub="http://www.idpf.org/2007/ops" lang="${uiLang()}" xml:lang="${uiLang()}">
<head><meta charset="utf-8"/><title>${esc(t('Contents'))}</title><link rel="stylesheet" type="text/css" href="style.css"/></head>
<body><nav epub:type="toc" id="toc"><h1>${esc(t('Contents'))}</h1><ol>${navList}</ol></nav></body></html>` });
  // The older table of contents (EPUB 2 readers).
  let play = 0;
  const ncxPoints = chapters.map((c) => `<navPoint id="np${++play}" playOrder="${play}"><navLabel><text>${esc(longDate(c.date))}: ${esc(c.title)}</text></navLabel><content src="day${c.n}.xhtml#d${c.n}"/>
    ${c.toc.map(([id, label]) => `<navPoint id="np${++play}" playOrder="${play}"><navLabel><text>${esc(label)}</text></navLabel><content src="day${c.n}.xhtml#${id}"/></navPoint>`).join('')}
  </navPoint>`).join('\n');
  files.push({ name: 'OEBPS/toc.ncx', data: `<?xml version="1.0" encoding="UTF-8"?>
<ncx xmlns="http://www.daisy.org/z3986/2005/ncx/" version="2005-1">
  <head><meta name="dtb:uid" content="${uid}"/></head>
  <docTitle><text>${esc(bookTitle)}</text></docTitle>
  <navMap>${ncxPoints}</navMap>
</ncx>` });
  files.push({ name: 'OEBPS/content.opf', data: `<?xml version="1.0" encoding="UTF-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="uid" xml:lang="en">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="uid">${uid}</dc:identifier>
    <dc:title>${esc(bookTitle)}</dc:title>
    <dc:language>${bookLang}</dc:language>
    <dc:creator>Divinum Officium</dc:creator>
    <dc:description>${esc(`${comboLabel(state.calendar, state.version)}. ${langs}.`)}</dc:description>
    <meta property="dcterms:modified">${modified}</meta>
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav"/>
    <item id="ncx" href="toc.ncx" media-type="application/x-dtbncx+xml"/>
    <item id="css" href="style.css" media-type="text/css"/>
    <item id="title" href="title.xhtml" media-type="application/xhtml+xml"/>
    ${chapters.map((c) => `<item id="day${c.n}" href="day${c.n}.xhtml" media-type="application/xhtml+xml"/>`).join('\n    ')}
  </manifest>
  <spine toc="ncx">
    <itemref idref="title"/>
    <itemref idref="nav"/>
    ${chapters.map((c) => `<itemref idref="day${c.n}"/>`).join('\n    ')}
  </spine>
</package>` });

  const tag = range === 'month' ? monthOf(first) : first === last ? first : `${first}_${last}`;
  return {
    blob: zip(files),
    filename: `${contents === 'mass' ? 'mass' : contents === 'office' ? 'office' : 'mass-and-office'}-${tag}-${display === 'latin' ? 'la' : langId}.epub`,
    days: chapters.length,
    missing: dates.length - chapters.length,
  };
}
