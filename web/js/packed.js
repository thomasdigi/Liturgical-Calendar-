// Texts stored once. Most of the Office repeats: the psalms come back every week, the
// Gloria Patri many times a day, the Ordinary of the Mass and the votive offices every day.
// So the published site (scripts/site.ts) cuts each text into pieces (a psalm, a Gloria
// Patri, an antiphon, a hymn…), keeps every piece that occurs more than once in one shared
// "pack" file per folder (data/<cal>/<ver>/<lang>/pack-<hash>.json), and stores each text as
// a list: strings for its own pieces, numbers for pieces in the pack.
//
// Used by the site builder (Node) and the viewer (browser): plain JavaScript, no page needed.

/**
 * Cut a section's HTML into pieces, without losing a character: joined back, the pieces are
 * the same text. A piece starts at a line that begins with a red heading or note ("Psalmus 92",
 * "Ant.", "℣.", "Hymnus", "{…}"), so a psalm, its antiphon and its Gloria Patri are separate pieces.
 */
export function splitPieces(html) {
  if (!html) return [];
  const lines = html.split(/(?<=<br\s*\/?>\n?)/i);
  const out = [];
  let cur = '';
  for (const line of lines) {
    if (cur && /^\s*(<span class="rubric|<p class="note)/.test(line)) {
      out.push(cur);
      cur = '';
    }
    cur += line;
  }
  if (cur) out.push(cur);
  return out;
}

/** A stored text: a plain string (not packed), or a list of pieces and pack numbers. */
export function unpack(value, pack) {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  return value.map((x) => (typeof x === 'number' ? pack[x] : x)).join('');
}
