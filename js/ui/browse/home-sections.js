// Abschnitte der Startseite aus echten Katalogdaten: feste Regeln, keine Zufallsauswahl – bei gleichem
// Katalog immer dieselben Bauten. Ein Bau erscheint nur in einem Abschnitt (außer ein Abschnitt bliebe
// sonst leer). Rein und in Node testbar.
import { CATEGORIES, findCategory, formatCount } from '../shared.js';
import { emptyFilters } from './filters.js';
import { sizeClassOf } from './model.js';
import { compareTitles } from './sort.js';
import { browseHref } from './url-state.js';

export const SECTION_SIZE = 4;
const MAX_LINKS = 2;

function missingLast(a, b, direction) {
  const aMissing = !Number.isFinite(a);
  const bMissing = !Number.isFinite(b);
  if (aMissing || bMissing) return aMissing === bMissing ? 0 : aMissing ? 1 : -1;
  return direction * (a - b);
}

const byBlocksDescending = (a, b) => missingLast(a.blocks, b.blocks, -1) || compareTitles(a, b);
const byBlocksAscending = (a, b) => missingLast(a.blocks, b.blocks, 1) || compareTitles(a, b);

/**
 * match bestimmt die Bauten, compare die Reihenfolge; filters/sort ergeben auf der Kategorie-Seite genau
 * dieselbe Auswahl (für die Links „N Bauten in …“). diverse: abwechselnd aus verschiedenen Kategorien.
 */
export const HOME_SECTIONS = Object.freeze([
  Object.freeze({
    id: 'riesig',
    title: 'Riesenbauten',
    lead: 'Die größten Bauten im Katalog, gemessen an der Zahl der Blöcke.',
    match: (build) => ['gross', 'riesig'].includes(sizeClassOf(build)),
    compare: byBlocksDescending,
    diverse: false,
    filters: { groesse: ['gross', 'riesig'] },
    sort: 'bloecke-ab',
  }),
  Object.freeze({
    id: 'schnell',
    title: 'Klein & schnell gebaut',
    lead: 'Bauten mit weniger als 1.000 Blöcken, die kleinsten zuerst.',
    match: (build) => sizeClassOf(build) === 'klein',
    compare: byBlocksAscending,
    diverse: true,
    filters: { groesse: ['klein'] },
    sort: 'bloecke-auf',
  }),
  Object.freeze({
    id: 'original',
    title: 'Original aus dem Spiel',
    lead: 'Gebäude, die Minecraft selbst in die Welt setzt – Block für Block aus den Strukturdateien von Java 26.2.',
    match: (build) => build.accuracy === 'original',
    compare: byBlocksDescending,
    diverse: true,
    filters: { herkunft: ['original'] },
    sort: 'bloecke-ab',
  }),
  Object.freeze({
    id: 'massstab',
    title: 'Nach echten Maßen',
    lead: 'Echte Bauwerke, nachgebaut nach ihren wirklichen Abmessungen.',
    match: (build) => build.accuracy === 'massstab',
    compare: byBlocksDescending,
    diverse: true,
    filters: { herkunft: ['massstab'] },
    sort: 'bloecke-ab',
  }),
  Object.freeze({
    id: 'farmen',
    title: 'Farmen',
    lead: 'Farmen und Anlagen, die dir Arbeit abnehmen – die größten zuerst.',
    match: (build) => build.category === 'farmen',
    compare: byBlocksDescending,
    diverse: false,
    filters: {},
    sort: 'bloecke-ab',
  }),
]);

/** Nimmt reihum aus jeder Gruppe (Reihenfolge der Gruppen = ihr bester Platz in list) */
export function diversify(list, keyOf, count) {
  const groups = new Map();
  for (const item of list) {
    const key = keyOf(item);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(item);
  }
  const queues = [...groups.values()];
  const picked = [];
  for (let round = 0; picked.length < count; round++) {
    let added = false;
    for (const queue of queues) {
      if (round >= queue.length) continue;
      picked.push(queue[round]);
      added = true;
      if (picked.length === count) break;
    }
    if (!added) break;
  }
  return picked;
}

/** Links „N Bauten in <Kategorie>“ zu den Kategorien mit den meisten weiteren Treffern */
function sectionLinks(section, matching, picked) {
  const shownPerCategory = new Map();
  for (const build of picked) shownPerCategory.set(build.category, (shownPerCategory.get(build.category) ?? 0) + 1);
  const filters = { ...emptyFilters(), ...section.filters };
  return CATEGORIES
    .map((category, order) => ({ category, order, count: matching.filter((build) => build.category === category.slug).length }))
    .filter(({ category, count }) => count > (shownPerCategory.get(category.slug) ?? 0))
    .sort((a, b) => b.count - a.count || a.order - b.order)
    .slice(0, MAX_LINKS)
    .map(({ category, count }) => ({
      slug: category.slug,
      count,
      label: `${formatCount(count, 'Bau', 'Bauten')} in ${category.shortTitle}`,
      href: browseHref(category.slug, { query: '', filters, sort: section.sort }),
    }));
}

/** → [{ id, title, lead, builds, total, links }] nur Abschnitte mit mindestens einem Bau */
export function selectHomeSections(builds, { size = SECTION_SIZE } = {}) {
  const used = new Set();
  const sections = [];
  for (const section of HOME_SECTIONS) {
    const matching = builds.filter((build) => findCategory(build.category) && section.match(build)).sort(section.compare);
    if (matching.length === 0) continue;
    const fresh = matching.filter((build) => !used.has(build.id));
    const pool = fresh.length > 0 ? fresh : matching;
    const picked = section.diverse ? diversify(pool, (build) => build.category, size) : pool.slice(0, size);
    for (const build of picked) used.add(build.id);
    sections.push({
      id: section.id,
      title: section.title,
      lead: section.lead,
      builds: picked,
      total: matching.length,
      links: sectionLinks(section, matching, picked),
    });
  }
  return sections;
}

/** Gesamtzahlen für die Startseite */
export function catalogTotals(builds) {
  const totals = { builds: builds.length, categories: 0, originals: 0, blocks: 0, steps: 0, untested: 0 };
  const categories = new Set();
  for (const build of builds) {
    categories.add(build.category);
    if (build.accuracy === 'original') totals.originals += 1;
    if (build.tested === false) totals.untested += 1;
    if (Number.isInteger(build.blocks)) totals.blocks += build.blocks;
    if (Number.isInteger(build.steps)) totals.steps += build.steps;
  }
  totals.categories = categories.size;
  return totals;
}
