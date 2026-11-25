// Finding a feast or saint by name (the search page and the top bar's search). The calendar's
// titles are in Latin ("S. Martini Papæ et Martyris"), so a query is matched loosely:
// names of the main feasts and saints in the app's language are turned into Latin, and each word only has to
// begin a word of the title ("Martin" finds "Martini", "Cecilia" finds "Cæciliæ").
import { fetchMonth } from './data.js';
import { avail, state } from './state.js';
import { addMonths, monthOf } from './util.js';
import { uiLang } from './ui.js';

/** Lower case, no accents, æ/œ → e, j → i, y → i: so spellings meet. */
export const norm = (s) => s.toLowerCase().replace(/ß/g, 'ss').normalize('NFD').replace(/[̀-ͯ]/g, '')
  .replace(/æ/g, 'ae').replace(/œ/g, 'oe').replace(/ae|oe/g, 'e').replace(/j/g, 'i').replace(/y/g, 'i')
  .replace(/[^a-z0-9]+/g, ' ').trim();

/**
 * Names of feasts and saints in each language of the app → the Latin in the titles (both are
 * normalised with norm(), so accents and æ don't matter). Only the app's own language is used
 * (with Latin, English too); Latin itself always works, since it's what the titles are in.
 */
const NAMES = {
  en: {
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
},
  de: {
    'christi geburt': 'nativitate domini', weihnachten: 'nativitate domini', 'heilige drei konige': 'epiphania', 'erscheinung des herrn': 'epiphania',
    dreikonig: 'epiphania', ostern: 'resurrectionis', ostersonntag: 'resurrectionis', pfingsten: 'pentecostes',
    'maria himmelfahrt': 'assumptione', 'mariä himmelfahrt': 'assumptione', 'christi himmelfahrt': 'ascensione', himmelfahrt: 'ascensione',
    'unbefleckte empfangnis': 'immaculata', verkundigung: 'annuntiatione', lichtmess: 'purificatione', 'maria lichtmess': 'purificatione',
    allerheiligen: 'omnium sanctorum', allerseelen: 'defunctorum', fronleichnam: 'corporis christi', 'herz jesu': 'cordis iesu',
    'herz mariä': 'cordis mari', christkonig: 'christi regis', christkonigsfest: 'christi regis', dreifaltigkeit: 'trinitate',
    dreifaltigkeitssonntag: 'trinitate', verklarung: 'transfiguratione', aschermittwoch: 'cinerum', palmsonntag: 'palmis',
    karfreitag: 'parasceve', grundonnerstag: 'cena domini', karsamstag: 'sabbato sancto', 'heilige familie': 'familie',
    kreuzerhohung: 'exaltatione crucis', kreuz: 'crucis', schutzengel: 'angelorum custodum', 'sieben schmerzen': 'septem dolorum',
    rosenkranz: 'rosarii', beschneidung: 'circumcisione', advent: 'adventus', fastenzeit: 'quadragesim', kirchweih: 'dedicatione',
    maria: 'mari', 'unsere liebe frau': 'mari', petrus: 'petri', paulus: 'pauli', johannes: 'ioannis', jakobus: 'iacobi', andreas: 'andre',
    stephanus: 'stephani', antonius: 'antonii', dominikus: 'dominici', georg: 'georgii', laurentius: 'laurentii', lukas: 'luc',
    markus: 'marci', matthaus: 'matthei', bartholomaus: 'bartholomei', philippus: 'philippi', 'judas thaddaus': 'iude', matthias: 'matthie',
    barnabas: 'barnab', luzia: 'luci', katharina: 'catharin', klara: 'clar', augustinus: 'augustini', ambrosius: 'ambrosii',
    hieronymus: 'hieronimi', bonifatius: 'bonifatii', patrick: 'patricii', nikolaus: 'nicolai', elisabeth: 'elisabeth', anna: 'anne',
    joachim: 'ioachim', josef: 'ioseph', joseph: 'ioseph', gabriel: 'gabrielis', raphael: 'raphelis', michael: 'michelis', thomas: 'thom',
    gregor: 'gregorii', ignatius: 'ignatii', pius: 'pii', leo: 'leonis', benedikt: 'benedicti', franziskus: 'francisci', franz: 'francisci',
    theresia: 'teresi', teresa: 'teresi', agnes: 'agnetis', cacilia: 'cecili', agatha: 'agath', vinzenz: 'vincentii', sebastian: 'sebastiani',
    karl: 'caroli', bernhard: 'bernardi', bonaventura: 'bonaventur', martin: 'martini', hedwig: 'hedwigis', albert: 'alberti',
    ulrich: 'udalrici', apostel: 'apostolorum', engel: 'angelorum', martyrer: 'martirum', konig: 'regis',
  },
  fr: {
    noel: 'nativitate domini', nativite: 'nativitate', epiphanie: 'epiphania', rois: 'epiphania', paques: 'resurrectionis',
    pentecote: 'pentecostes', ascension: 'ascensione', assomption: 'assumptione', 'immaculee conception': 'immaculata', immaculee: 'immaculata',
    annonciation: 'annuntiatione', chandeleur: 'purificatione', presentation: 'purificatione', purification: 'purificatione',
    toussaint: 'omnium sanctorum', 'jour des morts': 'defunctorum', defunts: 'defunctorum', 'fete dieu': 'corporis christi',
    'saint sacrement': 'corporis christi', 'sacre coeur': 'cordis iesu', 'coeur immacule': 'cordis mari', 'christ roi': 'christi regis',
    trinite: 'trinitate', transfiguration: 'transfiguratione', 'mercredi des cendres': 'cinerum', cendres: 'cinerum', rameaux: 'palmis',
    'vendredi saint': 'parasceve', 'jeudi saint': 'cena domini', 'samedi saint': 'sabbato sancto', 'sainte famille': 'familie',
    'saint nom': 'nominis', croix: 'crucis', 'anges gardiens': 'angelorum custodum', 'sept douleurs': 'septem dolorum', douleurs: 'dolorum',
    rosaire: 'rosarii', circoncision: 'circumcisione', avent: 'adventus', careme: 'quadragesim', dedicace: 'dedicatione',
    'notre dame': 'mari', marie: 'mari', pierre: 'petri', paul: 'pauli', jean: 'ioannis', jacques: 'iacobi', andre: 'andre',
    etienne: 'stephani', antoine: 'antonii', dominique: 'dominici', georges: 'georgii', laurent: 'laurentii', luc: 'luc', marc: 'marci',
    matthieu: 'matthei', barthelemy: 'bartholomei', philippe: 'philippi', jude: 'iude', matthias: 'matthie', barnabe: 'barnab',
    lucie: 'luci', catherine: 'catharin', claire: 'clar', augustin: 'augustini', ambroise: 'ambrosii', jerome: 'hieronimi',
    boniface: 'bonifatii', patrice: 'patricii', nicolas: 'nicolai', elisabeth: 'elisabeth', anne: 'anne', joachim: 'ioachim',
    joseph: 'ioseph', gabriel: 'gabrielis', raphael: 'raphelis', michel: 'michelis', thomas: 'thom', gregoire: 'gregorii',
    ignace: 'ignatii', pie: 'pii', leon: 'leonis', benoit: 'benedicti', francois: 'francisci', therese: 'teresi', agnes: 'agnetis',
    cecile: 'cecili', agathe: 'agath', vincent: 'vincentii', sebastien: 'sebastiani', charles: 'caroli', bernard: 'bernardi',
    bonaventure: 'bonaventur', martin: 'martini', louis: 'ludovici', apotres: 'apostolorum', anges: 'angelorum', martyrs: 'martirum', roi: 'regis',
  },
  es: {
    navidad: 'nativitate domini', natividad: 'nativitate', epifania: 'epiphania', reyes: 'epiphania', pascua: 'resurrectionis',
    resurreccion: 'resurrectionis', pentecostes: 'pentecostes', ascension: 'ascensione', asuncion: 'assumptione',
    'inmaculada concepcion': 'immaculata', inmaculada: 'immaculata', anunciacion: 'annuntiatione', candelaria: 'purificatione',
    purificacion: 'purificatione', 'todos los santos': 'omnium sanctorum', 'fieles difuntos': 'defunctorum', difuntos: 'defunctorum',
    'corpus christi': 'corporis christi', 'sagrado corazon': 'cordis iesu', 'inmaculado corazon': 'cordis mari', 'cristo rey': 'christi regis',
    'santisima trinidad': 'trinitate', trinidad: 'trinitate', transfiguracion: 'transfiguratione', 'miercoles de ceniza': 'cinerum',
    ceniza: 'cinerum', 'domingo de ramos': 'palmis', ramos: 'palmis', 'viernes santo': 'parasceve', 'jueves santo': 'cena domini',
    'sabado santo': 'sabbato sancto', 'sagrada familia': 'familie', 'santo nombre': 'nominis', 'santa cruz': 'crucis', cruz: 'crucis',
    'angeles custodios': 'angelorum custodum', 'siete dolores': 'septem dolorum', dolores: 'dolorum', rosario: 'rosarii',
    circuncision: 'circumcisione', adviento: 'adventus', cuaresma: 'quadragesim', dedicacion: 'dedicatione',
    'nuestra senora': 'mari', virgen: 'mari', maria: 'mari', pedro: 'petri', pablo: 'pauli', juan: 'ioannis', santiago: 'iacobi',
    jacobo: 'iacobi', andres: 'andre', esteban: 'stephani', antonio: 'antonii', 'santo domingo': 'dominici', jorge: 'georgii',
    lorenzo: 'laurentii', lucas: 'luc', marcos: 'marci', mateo: 'matthei', bartolome: 'bartholomei', felipe: 'philippi',
    'judas tadeo': 'iude', matias: 'matthie', bernabe: 'barnab', lucia: 'luci', catalina: 'catharin', clara: 'clar', agustin: 'augustini',
    ambrosio: 'ambrosii', jeronimo: 'hieronimi', bonifacio: 'bonifatii', patricio: 'patricii', nicolas: 'nicolai', isabel: 'elisabeth',
    ana: 'anne', joaquin: 'ioachim', jose: 'ioseph', gabriel: 'gabrielis', rafael: 'raphelis', miguel: 'michelis', tomas: 'thom',
    gregorio: 'gregorii', ignacio: 'ignatii', pio: 'pii', leon: 'leonis', benito: 'benedicti', francisco: 'francisci', teresa: 'teresi',
    ines: 'agnetis', cecilia: 'cecili', agueda: 'agath', vicente: 'vincentii', sebastian: 'sebastiani', carlos: 'caroli',
    bernardo: 'bernardi', buenaventura: 'bonaventur', martin: 'martini', apostoles: 'apostolorum', angeles: 'angelorum',
    martires: 'martirum', rey: 'regis',
  },
};
NAMES.pt = {
  natal: 'nativitate domini', natividade: 'nativitate', epifania: 'epiphania', reis: 'epiphania', 'santos reis': 'epiphania',
  pascoa: 'resurrectionis', ressurreicao: 'resurrectionis', pentecostes: 'pentecostes', ascensao: 'ascensione', assuncao: 'assumptione',
  'imaculada conceicao': 'immaculata', imaculada: 'immaculata', anunciacao: 'annuntiatione', candelaria: 'purificatione',
  purificacao: 'purificatione', apresentacao: 'purificatione', 'todos os santos': 'omnium sanctorum', finados: 'defunctorum',
  'fieis defuntos': 'defunctorum', defuntos: 'defunctorum', 'corpus christi': 'corporis christi', 'sagrado coracao': 'cordis iesu',
  'imaculado coracao': 'cordis mari', 'cristo rei': 'christi regis', 'santissima trindade': 'trinitate', trindade: 'trinitate',
  transfiguracao: 'transfiguratione', 'quarta feira de cinzas': 'cinerum', cinzas: 'cinerum', 'domingo de ramos': 'palmis',
  ramos: 'palmis', 'sexta feira santa': 'parasceve', 'quinta feira santa': 'cena domini', 'sabado santo': 'sabbato sancto',
  'sagrada familia': 'familie', 'santo nome': 'nominis', 'santa cruz': 'crucis', cruz: 'crucis', 'anjos da guarda': 'angelorum custodum',
  'sete dores': 'septem dolorum', dores: 'dolorum', rosario: 'rosarii', circuncisao: 'circumcisione', advento: 'adventus',
  quaresma: 'quadragesim', dedicacao: 'dedicatione', aparecida: 'apparecida', 'nossa senhora': 'mari', virgem: 'mari', maria: 'mari',
  pedro: 'petri', paulo: 'pauli', joao: 'ioannis', tiago: 'iacobi', andre: 'andre', estevao: 'stephani', antonio: 'antonii',
  'sao domingos': 'dominici', jorge: 'georgii', lourenco: 'laurentii', lucas: 'luc', marcos: 'marci', mateus: 'matthei',
  bartolomeu: 'bartholomei', filipe: 'philippi', 'judas tadeu': 'iude', matias: 'matthie', barnabe: 'barnab', luzia: 'luci',
  catarina: 'catharin', clara: 'clar', agostinho: 'augustini', ambrosio: 'ambrosii', jeronimo: 'hieronimi', bonifacio: 'bonifatii',
  patricio: 'patricii', nicolau: 'nicolai', isabel: 'elisabeth', ana: 'anne', joaquim: 'ioachim', jose: 'ioseph', gabriel: 'gabrielis',
  rafael: 'raphelis', miguel: 'michelis', tome: 'thom', gregorio: 'gregorii', inacio: 'ignatii', pio: 'pii', leao: 'leonis',
  bento: 'benedicti', francisco: 'francisci', teresa: 'teresi', ines: 'agnetis', cecilia: 'cecili', agueda: 'agath', vicente: 'vincentii',
  sebastiao: 'sebastiani', carlos: 'caroli', bernardo: 'bernardi', boaventura: 'bonaventur', martinho: 'martini', apostolos: 'apostolorum',
  anjos: 'angelorum', martires: 'martirum', rei: 'regis',
};

const ALIASES = Object.fromEntries(Object.entries(NAMES).map(([lang, names]) => [lang,
  Object.entries(names).map(([k, v]) => [norm(k), norm(v)]).sort((a, b) => b[0].length - a[0].length)]));

/** Words that don't help: "St.", "Saint", "Hl.", "San", "feast", "the", "and"… */
const STOP = new Set(['st', 's', 'ss', 'sts', 'saint', 'saints', 'feast', 'of', 'the', 'and', 'et', 'day', 'blessed', 'bl',
  'hl', 'heilige', 'heiliger', 'heiligen', 'sankt', 'fest', 'der', 'die', 'das', 'des', 'und', 'von',
  'ste', 'sainte', 'saintes', 'fete', 'de', 'du', 'la', 'le', 'les', 'd', 'l', 'bienheureux',
  'san', 'santo', 'santa', 'santos', 'fiesta', 'del', 'el', 'los', 'las', 'y', 'beato', 'beata',
  'sao', 'festa', 'da', 'do', 'dos', 'das', 'e', 'o', 'a', 'os', 'as']);

/** The names understood besides Latin: the app's language (and English when the app is in Latin). */
const activeAliases = () => {
  const ui = uiLang();
  return ui === 'la' ? ALIASES.en : ALIASES[ui] ?? ALIASES.en;
};

export function queryWords(q) {
  let n = ` ${norm(q)} `;
  for (const [name, la] of activeAliases()) n = n.replace(new RegExp(` ${name} `, 'g'), ` ${la} `);
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
