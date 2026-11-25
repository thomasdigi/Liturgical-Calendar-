// The liturgical year as a wheel (top of the month page): every season around a circle,
// an arrow at the day shown, and the day and its season in the middle. Tap the ring to
// go to that point of the year; tap the middle to open the day.
import { summariesFor } from './data.js';
import { state } from './state.js';
import { $, COLORS, esc } from './util.js';

const DAY = 86_400_000;
const utc = (iso) => Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10));
const iso = (t) => new Date(t).toISOString().slice(0, 10);
const add = (isoDate, n) => iso(utc(isoDate) + n * DAY);

/** Easter Sunday (Gregorian). */
export function easter(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** First Sunday of Advent: the fourth Sunday before Christmas. */
export function adventStart(year) {
  const christmas = `${year}-12-25`;
  const wd = new Date(utc(christmas)).getUTCDay();
  return add(christmas, -(wd === 0 ? 7 : wd) - 21);
}

/**
 * The seasons of the liturgical year that contains `date` (from the First Sunday of Advent),
 * each { id, label, name, color, from, to } with inclusive ISO dates.
 */
export function seasonsFor(date) {
  const y = +date.slice(0, 4);
  const Y = date >= adventStart(y) ? y + 1 : y; // the year of this liturgical year's Easter
  const E = easter(Y);
  const s = (id, label, name, color, from, to) => ({ id, label, name, color, from, to });
  return [
    s('advent', 'Advent', 'Advent', 'violet', adventStart(Y - 1), `${Y - 1}-12-24`),
    s('christmas', 'Christmas', 'Christmastide', 'white', `${Y - 1}-12-25`, `${Y}-01-13`),
    s('epiphany', 'Epiphany', 'Time after Epiphany', 'green', `${Y}-01-14`, add(E, -64)),
    s('septuagesima', 'Septuagesima', 'Septuagesima', 'violet', add(E, -63), add(E, -47)),
    s('lent', 'Lent', 'Lent', 'violet', add(E, -46), add(E, -1)),
    s('easter', 'Eastertide', 'Eastertide', 'white', E, add(E, 48)),
    s('pentecost', 'Pentecost', 'Octave of Pentecost', 'red', add(E, 49), add(E, 55)),
    s('after', 'Time after Pentecost', 'Time after Pentecost', 'green', add(E, 56), add(adventStart(Y), -1)),
  ];
}

/** The season's name for a day, with Passiontide and Holy Week inside Lent. */
export function seasonName(date) {
  const seasons = seasonsFor(date);
  const se = seasons.find((x) => date >= x.from && date <= x.to) ?? seasons[0];
  if (se.id === 'lent') {
    const toEaster = (utc(seasons[5].from) - utc(date)) / DAY;
    if (toEaster <= 7) return 'Holy Week';
    if (toEaster <= 14) return 'Passiontide';
  }
  return se.name;
}

// Geometry (SVG units): the ring, and where things sit around it.
const C = 200, R = 140, W = 20, LABEL_R = 164, LABEL_STEP = 15;
const point = (angle, r) => [C + r * Math.sin(angle), C - r * Math.cos(angle)]; // 0 = top, clockwise
const f2 = (n) => n.toFixed(2);

function arc(a0, a1, r) {
  const [x0, y0] = point(a0, r);
  const [x1, y1] = point(a1, r);
  const large = a1 - a0 > Math.PI ? 1 : 0;
  return `M${f2(x0)} ${f2(y0)} A${r} ${r} 0 ${large} 1 ${f2(x1)} ${f2(y1)}`;
}
/** An arc for a label: drawn the other way round on the lower half, so the text stays upright. */
function labelArc(mid, r) {
  const span = 1.6; // radians each side: room for the longest label
  const lower = Math.cos(mid) < -0.15;
  if (lower) r += 9; // text hangs below the line there: keep it clear of the ring
  const [x0, y0] = point(mid + (lower ? span : -span), r);
  const [x1, y1] = point(mid + (lower ? -span : span), r);
  return `M${f2(x0)} ${f2(y0)} A${r} ${r} 0 0 ${lower ? 0 : 1} ${f2(x1)} ${f2(y1)}`;
}

let seq = 0;
let current = null; // { start, total } of the year drawn, to turn a tap into a date

export async function renderWheel(onPick) {
  const mine = ++seq;
  const date = state.date;
  const seasons = seasonsFor(date);
  const start = utc(seasons[0].from);
  const total = (utc(seasons.at(-1).to) - start) / DAY + 1;
  const angleOf = (d, end = false) => (((utc(d) - start) / DAY + (end ? 1 : 0)) / total) * 2 * Math.PI;
  current = { start, total };

  // Labels: where a short season's name would run into the one before, it moves out a ring.
  const placed = []; // [radius, from, to] angles already used
  const segs = seasons.map((se, i) => {
    const a0 = angleOf(se.from), a1 = angleOf(se.to, true);
    const mid = (a0 + a1) / 2;
    let r = LABEL_R;
    const half = (rr) => (se.label.length * 8.6 + 6) / 2 / rr; // half the label's width, as an angle
    while (placed.some(([pr, f, t]) => pr === r && mid - half(r) < t && mid + half(r) > f)) r += LABEL_STEP;
    placed.push([r, mid - half(r), mid + half(r)]);
    return `<path d="${arc(a0, a1, R)}" stroke="${COLORS[se.color]}" class="w-seg w-${se.color}"/>
      <path id="wl${i}" d="${labelArc(mid, r)}" fill="none" stroke="none"/>
      <text class="w-label"><textPath href="#wl${i}" startOffset="50%" text-anchor="middle">${esc(se.label.toUpperCase())}</textPath></text>`;
  }).join('');
  // The day: a marker on the ring and an arrow from outside pointing at it.
  const a = angleOf(date) + Math.PI / total; // middle of the day
  const [mx, my] = point(a, R);
  const [ax0, ay0] = point(a, R + 50);
  const [ax1, ay1] = point(a, R + 16);
  $('wheel-svg').innerHTML = `
    <defs><marker id="w-arrowhead" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0 0 L10 5 L0 10 z" class="w-arrowhead"/></marker></defs>
    <circle cx="${C}" cy="${C}" r="${R}" class="w-track" stroke-width="${W + 3}"/>
    <g stroke-width="${W}" fill="none">${segs}</g>
    <circle cx="${C}" cy="${C}" r="${R - W / 2 - 14}" class="w-inner"/>
    <line x1="${f2(ax0)}" y1="${f2(ay0)}" x2="${f2(ax1)}" y2="${f2(ay1)}" class="w-arrow" marker-end="url(#w-arrowhead)"/>
    <circle cx="${f2(mx)}" cy="${f2(my)}" r="7" class="w-dot"/>`;

  const d = new Date(`${date}T12:00:00Z`);
  $('wheel-weekday').textContent = d.toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  $('wheel-day').textContent = String(d.getUTCDate());
  $('wheel-month').textContent = d.toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
  $('wheel-season').textContent = seasonName(date);
  $('wheel-feast').textContent = '';
  $('wheel').onclick = (e) => {
    if (e.target.closest('.wheel-center')) return onPick(date, true);
    const svg = $('wheel-svg').getBoundingClientRect();
    const x = (e.clientX - svg.left) / svg.width * 400 - C;
    const y = (e.clientY - svg.top) / svg.height * 400 - C;
    const r = Math.hypot(x, y);
    if (r < R - W * 1.5 || r > LABEL_R + 14) return; // only the ring (and its labels)
    let ang = Math.atan2(x, -y);
    if (ang < 0) ang += 2 * Math.PI;
    const n = Math.min(current.total - 1, Math.floor((ang / (2 * Math.PI)) * current.total));
    onPick(iso(current.start + n * DAY), false);
  };
  // The feast of the day, once its month summary has loaded.
  const [sum] = await summariesFor([date]);
  if (mine !== seq || !sum) return;
  $('wheel-feast').textContent = sum.title;
  $('wheel-feast').style.color = sum.color === 'red' ? 'var(--rubric)' : '';
}
