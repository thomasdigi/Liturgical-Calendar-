// The outline of an Hour: Matins' Nocturns, lessons and Te Deum, and the Martyrology at Prime.
// DO prints these as plain red lines ("Nocturnus II", "Lectio 4", "Te Deum") or, for the
// Martyrology, as a section of its own; we find them in the drawn text and link to them.
import { $, esc } from './util.js';

const NOCTURN = /^Nocturnus\s+([IV]+)$/;
const LESSON = /^Lectio\s+(\d+)$/;
const TE_DEUM = /^Te Deum$/;

/**
 * Marks the structure in a drawn part (`col`: the main column) and returns it in reading order:
 * [{ kind: 'nocturn'|'lesson'|'tedeum'|'martyrology', label, id }].
 */
export function markStructure(col) {
  const items = [];
  col.querySelectorAll('.col.la .rubric').forEach((el) => {
    const text = el.textContent.trim();
    let m;
    if ((m = NOCTURN.exec(text))) {
      el.classList.add('struct', 'nocturn');
      el.id = `nocturn-${m[1]}`;
      items.push({ kind: 'nocturn', label: `Nocturn ${m[1]}`, id: el.id });
    } else if ((m = LESSON.exec(text))) {
      el.classList.add('struct', 'lesson');
      el.id = `lesson-${m[1]}`;
      items.push({ kind: 'lesson', label: m[1], id: el.id });
    } else if (TE_DEUM.test(text)) {
      el.classList.add('struct', 'tedeum');
      el.id = 'te-deum';
      items.push({ kind: 'tedeum', label: 'Te Deum', id: el.id });
    }
  });
  // DO usually marks every Nocturn; if the first isn't, it begins with "Psalmi cum lectionibus".
  const nocturns = items.filter((i) => i.kind === 'nocturn');
  if (nocturns.length && nocturns[0].label !== 'Nocturn I') {
    const first = col.querySelector('section[data-jump^="Psalmi cum lectionibus"]');
    if (first) items.unshift({ kind: 'nocturn', label: 'Nocturn I', id: first.id });
  }
  const mart = col.querySelector('section[data-jump^="Martyrologium"]');
  if (mart) {
    mart.classList.add('martyrology');
    items.push({ kind: 'martyrology', label: 'Martyrology', id: mart.id });
  }
  return items;
}

/** The outline bar: Nocturn I 1 2 3 · Nocturn II 4 5 6 · … · Te Deum, or Martyrology. */
export function renderOutline(items) {
  const nav = $('outline');
  const useful = items.filter((i) => i.kind !== 'lesson').length > 0 || items.length > 1;
  nav.hidden = !useful;
  if (!useful) { nav.innerHTML = ''; return; }
  const groups = [];
  for (const it of items) {
    if (it.kind === 'lesson') {
      if (!groups.length || groups.at(-1).closed) groups.push({ head: { label: 'Lessons' }, lessons: [] });
      groups.at(-1).lessons.push(it);
    } else if (it.kind === 'nocturn') {
      groups.push({ head: it, lessons: [] });
    } else {
      groups.push({ head: it, lessons: [], closed: true });
    }
  }
  nav.innerHTML = groups.map((g) => {
    const head = g.head.id
      ? `<button type="button" class="ohead" data-target="${g.head.id}">${esc(g.head.label)}</button>`
      : `<span class="ohead">${esc(g.head.label)}</span>`;
    const lessons = g.lessons.map((l) =>
      `<button type="button" class="olesson" data-target="${l.id}" aria-label="Lesson ${esc(l.label)}">${esc(l.label)}</button>`).join('');
    return `<span class="ogroup">${head}${lessons}</span>`;
  }).join('');
}

export function scrollToTarget(id) {
  const el = document.getElementById(id);
  if (!el) return;
  el.scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
}
