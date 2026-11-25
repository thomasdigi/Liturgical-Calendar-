// Finding a feast or saint by name (the search page and the top bar's search). The calendar's
// titles are in Latin ("S. Martini Papæ et Martyris"), so a query is matched loosely:
// English names of the main feasts and saints are turned into Latin, and each word only has to
// begin a word of the title ("Martin" finds "Martini", "Cecilia" finds "Cæciliæ").
import { fetchMonth } from './data.js';
import { avail, state } from './state.js';
import { addMonths, monthOf } from './util.js';

/** Lower case, no accents, æ/œ → e, j → i, y → i: so spellings meet. */
export const norm = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/æ/g, 'ae').replace(/œ/g, 'oe').replace(/ae|oe/g, 'e').replace(/j/g, 'i').replace(/y/g, 'i')
  .replace(/[^a-z0-9]+/g, ' ').trim();

/** English → the Latin in the titles (normalised as above). Longer phrases first. */
const ALIASES = Object.entries({
  'christ the king': 'christi regis', 'sacred heart': 'cordis iesu', 'immaculate heart': 'cordis mari',
  'corpus christi': 'corporis christi', 'all saints': 'omnium sanctorum', 'all souls': 'defunctorum',
  'ash wednesday': 'cinerum', 'palm sunday': 'palmis', 'good friday': 'parasceve', 'holy thursday': 'cena domini',
  'maundy thursday': 'cena domini', 'holy saturday': 'sabbato sancto', 'easter vigil': 'vigilia paschalis',
  'holy family': 'familie', 'holy name': 'nominis', 'holy cross': 'crucis', 'guardian angels': 'angelorum custodum',
  'seven sorrows': 'septem dolorum', 'our lady': 'mari', 'blessed virgin': 'mari', 'trinity sunday': 'trinitate',
  christmas: 'nativitate domini', nativity: 'nativitate', epiphany: 'epiphania', easter: 'resurrectionis',
  pentecost: 'pentecostes', whitsunday: 'pentecostes', ascension: 'ascensione', assumption: 'assumptione',
  immaculate: 'immaculata', annunciation: 'annuntiatione', purification: 'purificatione', candlemas: 'purificatione',
  trinity: 'trinitate', transfiguration: 'transfiguratione', circumcision: 'circumcisione', rosary: 'rosarii',
  sorrows: 'dolorum', advent: 'adventus', lent: 'quadragesim', septuagesima: 'septuagesim',
  mary: 'mari', peter: 'petri', john: 'ioannis', james: 'iacobi', andrew: 'andre', stephen: 'stephani',
  anthony: 'antonii', antony: 'antonii', dominic: 'dominici', george: 'georgii', lawrence: 'laurentii',
  laurence: 'laurentii', luke: 'luc', mark: 'marci', matthew: 'matthei', bartholomew: 'bartholomei',
  philip: 'philippi', jude: 'iude', matthias: 'matthie', barnabas: 'barnab', lucy: 'luci', catherine: 'catharin',
  clare: 'clar', augustine: 'augustini', ambrose: 'ambrosii', jerome: 'hieronimi', boniface: 'bonifatii',
  patrick: 'patricii', nicholas: 'nicolai', elizabeth: 'elisabeth', anne: 'anne', ann: 'anne', joachim: 'ioachim',
  joseph: 'ioseph', gabriel: 'gabrielis', raphael: 'raphelis', michael: 'michelis', thomas: 'thom',
  gregory: 'gregorii', ignatius: 'ignatii', pius: 'pii', leo: 'leonis', benedict: 'benedicti', francis: 'francisci',
  teresa: 'teresi', theresa: 'teresi', agnes: 'agnetis', cecilia: 'cecili', agatha: 'agath', vincent: 'vincentii',
  sebastian: 'sebastiani', charles: 'caroli', bernard: 'bernardi', bonaventure: 'bonaventur', paul: 'pauli',
  martin: 'martini', king: 'regis', apostles: 'apostolorum', angels: 'angelorum', martyrs: 'martirum',
}).sort((a, b) => b[0].length - a[0].length);

/** Words that don't help: "St.", "Saint", "feast", "the", "and"… */
const STOP = new Set(['st', 's', 'ss', 'sts', 'saint', 'saints', 'feast', 'of', 'the', 'and', 'et', 'day', 'blessed', 'bl']);

export function queryWords(q) {
  let n = ` ${norm(q)} `;
  for (const [en, la] of ALIASES) n = n.replace(new RegExp(` ${en} `, 'g'), ` ${la} `);
  return n.split(' ').filter((w) => w && !STOP.has(w));
}

/** Does every query word begin some word of the title? One- and two-letter words must match whole. */
export function matches(words, title) {
  const tw = norm(title).split(' ');
  return words.length > 0 && words.every((w) => {
    const stem = w.length >= 5 ? w.slice(0, -1) : w;
    return tw.some((t) => (w.length <= 2 ? t === w : t.startsWith(stem)));
  });
}

/** The months to look in: everything on this site, or (on the local server) the months around the date. */
function monthsToSearch() {
  if (avail) {
    const out = [];
    for (let m = monthOf(avail.first); m <= monthOf(avail.last); m = addMonths(m, 1)) out.push(m);
    return out;
  }
  return Array.from({ length: 3 }, (_, i) => addMonths(monthOf(state.date), i - 1));
}

/** Days whose feast (or a commemoration) matches the query: [{ date, title, rank, color, also }] */
export async function findFeasts(q) {
  const words = queryWords(q);
  if (!words.length) return [];
  const months = await Promise.all(monthsToSearch().map((m) => fetchMonth(m).catch(() => null)));
  const out = [];
  for (const m of months) for (const d of m?.days ?? []) {
    if (matches(words, d.title)) out.push({ date: d.date, title: d.title, rank: d.rank, color: d.color });
    else {
      const c = d.commemorations.find((t) => matches(words, t));
      if (c) out.push({ date: d.date, title: d.title, rank: d.rank, color: d.color, also: c });
    }
  }
  // Closest first: titles with the fewest words beyond those asked for ("In Nativitate Domini"
  // before "Dominica infra Octavam Nativitatis"), then by date.
  const extra = (f) => norm(f.also ?? f.title).split(' ').length - words.length + (f.also ? 2 : 0);
  return out.sort((a, b) => extra(a) - extra(b) || a.date.localeCompare(b.date)).slice(0, 40);
}
