/**
 * The Clergy summary of a day: what a priest needs to know about the Mass and Office at a
 * glance (rank, colour, Gloria, Credo, Preface, votive Masses, Matins, Lauds scheme, Vespers…).
 * Read from Divinum Officium's own texts for the day (headings, notes, rubrics), so it follows
 * the calendar and version shown. Language-independent: computed from the Latin.
 */
import type { VersionId } from './config.ts';
import type { DayHeader, Section } from './parse.ts';

export interface Votive {
  status: 'permitted' | 'restricted' | 'not permitted';
  note: string;
}

export interface Ordo {
  mass: {
    title: string;
    rank: string;
    color: string;
    gloria: boolean;
    credo: boolean;
    preface: string; // e.g. "Common", "of Advent", "of the Most Holy Trinity"
    between: string; // "Gradual and Alleluia", "Gradual and Tract", "Alleluia", …
    sequence: boolean;
    commemorations: string[]; // commemorated at Mass (orations)
    votive: Votive;
    masses: string[]; // several Masses today (Christmas, All Souls, …)
  } | null;
  office: {
    title: string;
    rank: string;
    psalter: string; // where the psalms come from, e.g. "Psalter of the day", "Proper of the Saints"
    matins: { nocturns: number; lessons: number; teDeum: boolean };
    laudsScheme: 'I' | 'II';
    vespers: { kind: 'first' | 'second'; of: string; commemorations: string[] };
    commemorations: string[]; // at Lauds
    preces: boolean;
    suffrage: boolean;
  } | null;
}

const plain = (h: string) => h.replace(/<span class="initial">([^<]*)<\/span>/g, '$1').replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
const notes = (secs: Section[]) => secs.flatMap((s) => [...s.latin.matchAll(/class="note">\{([^}]*)\}/g)].map((m) => m[1]));
const labels = (secs: Section[], kind: string) =>
  secs.flatMap((s) => [...s.latin.matchAll(new RegExp(`data-kind="${kind}">([^<]*)<`, 'g'))].map((m) => m[1].replace(/^Commemoratio\s*/, '').trim()));
const rubrics = (secs: Section[]) => secs.flatMap((s) => [...s.latin.matchAll(/<span class="rubric[^"]*">([^<]*)<\/span>/g)].map((m) => m[1].trim()));

/** Preface names as DO gives them (the Preface's first line), in English. */
const PREFACES: [RegExp, string][] = [
  [/^Communis/i, 'Common'],
  [/Trinitate/i, 'of the Most Holy Trinity'],
  [/Adventu/i, 'of Advent'],
  [/Nativitate/i, 'of the Nativity'],
  [/Epiphania/i, 'of the Epiphany'],
  [/Quadragesima/i, 'of Lent'],
  [/Cruce/i, 'of the Holy Cross'],
  [/Paschal/i, 'of Easter'],
  [/Ascensione/i, 'of the Ascension'],
  [/Spiritu Sancto/i, 'of the Holy Ghost'],
  [/Corde/i, 'of the Sacred Heart'],
  [/Christo Rege|Rege/i, 'of Christ the King'],
  [/Beata Maria|B\.\s*M\.\s*V|Virgine/i, 'of the Blessed Virgin Mary'],
  [/Joseph/i, 'of St Joseph'],
  [/Apostolis/i, 'of the Apostles'],
  [/Defunctis/i, 'of the Dead'],
];

function prefaceName(secs: Section[]): string {
  const sec = secs.find((s) => /^Pr.?fatio/i.test(s.heading.latin));
  if (!sec) return '';
  const first = plain(sec.latin).split(/\s(?=V ?ere dignum)/)[0].trim();
  return PREFACES.find(([re]) => re.test(first))?.[1] ?? first;
}

/**
 * Votive Masses, summarised from the class of the day. 1960 rubrics: none on I and II
 * class days; on III class days only certain (II-class) votive Masses; on IV class days
 * permitted. Older rubrics: none on doubles of I/II class; restricted on doubles and
 * semidoubles; permitted on simples and ferias.
 */
function votive(rank: string, version: VersionId): Votive {
  const r = rank.toLowerCase();
  if (version === '1962') {
    if (/\b(i|ii)\. classis/.test(r)) return { status: 'not permitted', note: 'I or II class day.' };
    if (/\biii\. classis/.test(r)) return { status: 'restricted', note: 'III class day: only votive Masses of the II class.' };
    return { status: 'permitted', note: 'IV class day.' };
  }
  if (/i{1,2}\. classis/.test(r)) return { status: 'not permitted', note: 'Double of the I or II class.' };
  if (/duplex|semiduplex|dominica/.test(r)) return { status: 'restricted', note: 'Double or semidouble: only privileged votive Masses.' };
  return { status: 'permitted', note: 'Simple or feria.' };
}

export function computeOrdo(
  parts: { id: string; header: DayHeader; sections: Section[] }[],
  version: VersionId,
  masses: { label: string; title: string }[],
): Ordo {
  const get = (id: string) => parts.find((p) => p.id === id);
  const mass = get('mass');
  const lauds = get('lauds');
  const matins = get('matins');
  const vespers = get('vespers');

  let massInfo: Ordo['mass'] = null;
  if (mass) {
    const heads = mass.sections.map((s) => s.heading.latin.trim());
    const grad = plain(mass.sections.find((s) => /^Graduale|^Allel/i.test(s.heading.latin))?.latin ?? '');
    const hasGradual = heads.some((h) => /^Graduale/i.test(h));
    const between = /Tractus/i.test(grad) ? (hasGradual ? 'Gradual and Tract' : 'Tract')
      // In Paschaltide the "Graduale" is the Alleluia alone: Alleluia at its start (after the reference).
      : /Allel[uú][ij]a/i.test(grad) ? (hasGradual && !/Allel/i.test(grad.slice(0, 40)) ? 'Gradual and Alleluia' : 'Alleluia') : hasGradual ? 'Gradual' : '';
    massInfo = {
      title: mass.header.title,
      rank: mass.header.rank,
      color: mass.header.color,
      gloria: heads.includes('Gloria'),
      credo: heads.includes('Credo'),
      preface: prefaceName(mass.sections),
      between,
      sequence: heads.some((h) => /^Sequentia/i.test(h)) || /Sequentia/.test(grad),
      commemorations: [...new Set(labels(mass.sections, 'commemoration'))],
      votive: votive(mass.header.rank, version),
      masses: masses.map((m) => `${m.label}: ${m.title}`),
    };
  }

  let officeInfo: Ordo['office'] = null;
  if (lauds) {
    const laudsNotes = notes(lauds.sections);
    const psalmsNote = laudsNotes.find((n) => /Psalmi/.test(n)) ?? '';
    const psalter = /Proprio Sanctorum/.test(psalmsNote) ? 'Proper of the Saints'
      : /Proprio de Tempore/.test(psalmsNote) ? 'Proper of the Season'
      : /Commune/.test(psalmsNote) ? 'Common'
      : /Psalterio/.test(psalmsNote) ? 'Psalter of the day' : '';
    const matRubrics = matins ? rubrics(matins.sections) : [];
    const lessons = matRubrics.filter((t) => /^Lectio \d+$/.test(t)).length;
    const nocturns = matRubrics.filter((t) => /^Nocturnus [IV]+$/.test(t)).length || (lessons ? 1 : 0);
    const first = vespers && vespers.header.title !== lauds.header.title;
    officeInfo = {
      title: lauds.header.title,
      rank: lauds.header.rank,
      psalter,
      matins: { nocturns, lessons, teDeum: matRubrics.includes('Te Deum') },
      laudsScheme: laudsNotes.some((n) => /Laudes:\s*2/.test(n)) ? 'II' : 'I',
      vespers: {
        kind: first ? 'first' : 'second',
        of: vespers?.header.title ?? lauds.header.title,
        commemorations: vespers?.header.commemorations ?? [],
      },
      commemorations: [...new Set(labels(lauds.sections, 'commemoration'))],
      preces: lauds.sections.some((s) => /^Preces/i.test(s.heading.latin)),
      suffrage: lauds.sections.some((s) => /^Suffragi/i.test(s.heading.latin)),
    };
  }
  return { mass: massInfo, office: officeInfo };
}
