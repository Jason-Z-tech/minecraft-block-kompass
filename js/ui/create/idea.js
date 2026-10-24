// Ergebnis der Freitext-Erkennung (parseRequest) als DOM: Treffer-Karten mit Maßstab, „So verstanden“ für Formen,
// ehrliches „nicht gefunden“ mit echten Vorschlägen. Alle Texte als Textknoten (die Anfrage kann HTML enthalten).
import { el, sitePath } from '../dom.js';
import {
  icon, createBuildCard, createChip, createCategoryChip, createAccuracyChip, createUntestedChip, createStats, findCategory,
  formatCount, linkButton,
} from '../shared.js';
import { SHAPES, shapeSize } from '../../create/shape-generators.js';
import { variantFor } from '../build/entry.js';
import { shapeGlyph } from './shape-glyphs.js';
import { buildHref, shapeHref, scaleLabel, shapeFacts, estimateText } from './model.js';

/**
 * Baut die Ergebnis-Knoten. actions: { onShape(shape, params, { preview }), onTab(tabKey) }.
 * → { title, nodes }
 */
export function renderRequestResult(result, { actions, names = null }) {
  const notices = [];
  if (result.truncated) notices.push(noteList([{ kind: 'info', text: 'Deine Eingabe war länger als 200 Zeichen – gelesen wurden nur die ersten 200.' }]));
  if (result.kind === 'build') return { title: buildTitle(result), nodes: [...notices, ...buildNodes(result, actions)] };
  if (result.kind === 'shape') return { title: `So verstanden: ${result.title}`, nodes: [...notices, shapeNode(result, actions, names)] };
  return { title: 'Dafür gibt es noch keinen Bauplan', nodes: [...notices, ...noneNodes(result, actions)] };
}

function buildTitle(result) {
  return result.matches.length === 1 ? 'Passender Bau gefunden' : `${formatCount(result.matches.length, 'Bau passt', 'Bauten passen')} – welchen meinst du?`;
}

function noteList(items) {
  return el('ul', { class: 'create-notes', role: 'list' }, items.map((item) => el('li', { class: `create-note create-note--${item.kind}` },
    icon(item.kind === 'warning' ? 'warning' : item.kind === 'error' ? 'close' : 'info'), el('span', null, item.text))));
}

/* ---------------------------------------------------------------- Bauten */

function buildNodes(result, actions) {
  const nodes = [];
  const meta = [];
  if (result.scaleText) meta.push(createChip(`Maßstab erkannt: ${result.scaleText}`, { className: 'chip--ok' }));
  if (meta.length) nodes.push(el('div', { class: 'cluster create-result__meta' }, meta));
  if (result.notes.length) nodes.push(noteList(result.notes.map((text) => ({ kind: 'info', text }))));
  if (result.matches.length === 1) {
    nodes.push(featureCard(result.matches[0]));
  } else {
    nodes.push(el('ul', { class: 'card-grid create-matches', role: 'list' }, result.matches.map((match) => el('li', null, matchCard(match)))));
  }
  if (result.alternative) nodes.push(alternativeCard(result.alternative, actions));
  return nodes;
}

/** Karte des Design-Systems, Link mit Maßstab und ein Chip für den Maßstab */
function matchCard({ entry, scale }) {
  const card = createBuildCard(entry);
  const link = card.querySelector('.build-card__link');
  link.setAttribute('href', sitePath(buildHref(entry.id, scale)));
  const label = scaleLabel(scale);
  if (label) card.querySelector('.build-card__body')?.insertBefore(createChip(label, { className: 'chip--ok create-scale-chip' }), card.querySelector('.build-card__foot'));
  return card;
}

function featureCard({ entry, scale }) {
  const category = findCategory(entry.category);
  const href = sitePath(buildHref(entry.id, scale));
  const fallback = () => el('div', { class: 'build-card__fallback' }, icon(category?.icon ?? 'cube', { size: 64 }));
  let media = fallback();
  if (entry.thumb) {
    media = el('img', { class: 'create-feature__img', src: sitePath(entry.thumb), alt: '', width: 640, height: 400, decoding: 'async' });
    media.addEventListener('error', () => {
      console.warn(`[Block-Kompass] Vorschaubild fehlt: ${entry.thumb}`);
      media.replaceWith(fallback());
    }, { once: true });
  }
  const variant = variantFor(entry, scale);
  const chips = [
    category ? createCategoryChip(entry.category) : null,
    entry.accuracy ? createAccuracyChip(entry.accuracy) : null,
    scaleLabel(scale) ? createChip(scaleLabel(scale), { className: 'chip--ok' }) : null,
    entry.tested === false ? createUntestedChip() : null,
  ].filter(Boolean);
  return el('article', { class: 'create-feature', dataset: { category: entry.category } },
    el('a', { class: 'create-feature__media', href, tabindex: -1, 'aria-hidden': 'true' }, media),
    el('div', { class: 'create-feature__body' },
      el('ul', { class: 'chip-list', role: 'list' }, chips.map((chip) => el('li', null, chip))),
      el('h3', { class: 'create-feature__title' }, entry.title),
      entry.subtitle ? el('p', { class: 'create-feature__subtitle' }, entry.subtitle) : null,
      entry.description ? el('p', { class: 'create-feature__text' }, entry.description) : null,
      createStats({ size: variant.size, blocks: variant.blocks, steps: variant.steps }),
      el('div', { class: 'create-feature__actions' },
        el('a', { class: 'btn btn--primary btn--lg', href }, icon('book'), el('span', null, 'Anleitung öffnen')),
        category ? linkButton(`Mehr aus ${category.shortTitle}`, `kategorie.html?k=${category.slug}`, { iconName: category.icon }) : null)));
}

function alternativeCard(alternative, actions) {
  const shape = SHAPES[alternative.shape];
  return el('aside', { class: 'create-alt plate' },
    el('span', { class: 'create-alt__glyph' }, shapeGlyph(alternative.shape, { size: 48 })),
    el('div', { class: 'create-alt__body' },
      el('p', { class: 'create-alt__title' }, `Oder lieber selbst als Form bauen: ${shape?.title ?? 'Form'}`),
      el('p', { class: 'create-alt__text' }, 'Mit dem Formen-Generator legst du Maße und Block selbst fest.'),
      el('div', { class: 'cluster' },
        el('button', { class: 'btn btn--secondary btn--sm', type: 'button', on: { click: () => actions.onShape(alternative.shape, alternative.params, { preview: false }) } },
          icon('cube'), el('span', null, 'Im Formen-Generator anpassen')),
        el('a', { class: 'btn btn--ghost btn--sm', href: sitePath(shapeHref(alternative.queryString)) }, icon('book'), el('span', null, 'Als Anleitung öffnen')))));
}

/* ---------------------------------------------------------------- Form */

function shapeNode(result, actions, names) {
  const items = [
    ...result.understood.map((text) => ({ kind: 'ok', text })),
  ];
  const size = result.ok ? shapeSize(result.shape, result.params) : null;
  const facts = result.ok ? shapeFacts(result.shape, result.params, result.estimate, { size, names }).filter(([term]) => term !== 'Material') : [];
  const notes = [
    ...result.defaults.map((text) => ({ kind: 'info', text: `Nicht angegeben, Standard genommen: ${text.replace(/ \(Standard\)$/, '')}` })),
    ...result.warnings.map((text) => ({ kind: 'warning', text })),
    ...result.errors.map((text) => ({ kind: 'error', text })),
  ];
  const buttons = [];
  if (result.ok) {
    buttons.push(el('button', { class: 'btn btn--primary', type: 'button', on: { click: () => actions.onShape(result.shape, result.params, { preview: true }) } },
      icon('cube'), el('span', null, 'Vorschau hier bauen')));
    buttons.push(el('a', { class: 'btn btn--secondary', href: sitePath(shapeHref(result.queryString)) }, icon('book'), el('span', null, 'Als Anleitung öffnen')));
  }
  buttons.push(el('button', { class: ['btn', result.ok ? 'btn--ghost' : 'btn--primary'], type: 'button', on: { click: () => actions.onShape(result.shape, result.params, { preview: false }) } },
    icon('hammer'), el('span', null, 'Im Formen-Generator anpassen')));
  return el('article', { class: 'create-understood panel' },
    el('div', { class: 'create-understood__head' },
      el('span', { class: 'create-understood__glyph' }, shapeGlyph(result.shape, { size: 64 })),
      el('div', null,
        el('p', { class: 'eyebrow' }, 'Form erkannt'),
        el('h3', { class: 'create-understood__title' }, result.title),
        el('p', { class: 'create-understood__estimate mono' }, result.ok ? estimateText(result.estimate) : 'Noch nicht baubar'))),
    el('ul', { class: 'create-understood__list', role: 'list', 'aria-label': 'Erkannt' }, items.map((item) => el('li', null, icon('check'), el('span', null, item.text)))),
    facts.length ? el('dl', { class: 'facts create-understood__facts' }, facts.map(([term, value, mono]) => el('div', null, el('dt', null, term), el('dd', { class: mono ? 'mono' : null }, value)))) : null,
    notes.length ? noteList(notes) : null,
    el('div', { class: 'create-understood__actions' }, buttons));
}

/* ---------------------------------------------------------------- Nichts gefunden */

function noneNodes(result, actions) {
  const nodes = [
    el('div', { class: 'state state--empty create-none' },
      el('div', { class: 'state__icon', 'aria-hidden': 'true' }, icon('search', { size: 32 })),
      el('p', { class: 'state__title' }, result.reason),
      el('p', { class: 'state__text' }, 'Der Block-Kompass erfindet keine Baupläne. Hier ist, was du stattdessen tun kannst:'),
      el('ul', { class: 'create-none__hints', role: 'list' }, result.hints.map((text, index) => el('li', null,
        el('span', null, text),
        el('button', { class: 'btn btn--secondary btn--sm', type: 'button', on: { click: () => actions.onTab(index === 0 ? 'formen' : 'import') } },
          icon(index === 0 ? 'cube' : 'chest'), el('span', null, index === 0 ? 'Zum Formen-Generator' : 'Datei importieren'))))),
      el('div', { class: 'state__actions' }, linkButton('Alle Kategorien ansehen', 'kategorie.html', { iconName: 'grid', variant: 'ghost' }))),
  ];
  if (result.suggestions.length) {
    nodes.push(el('section', { class: 'create-suggestions', 'aria-labelledby': 'create-suggestions-title' },
      el('h3', { class: 'create-suggestions__title', id: 'create-suggestions-title' }, 'Vielleicht passt einer davon:'),
      el('ul', { class: 'card-grid create-matches', role: 'list' }, result.suggestions.map(({ entry }) => el('li', null, createBuildCard(entry))))));
  }
  return nodes;
}
