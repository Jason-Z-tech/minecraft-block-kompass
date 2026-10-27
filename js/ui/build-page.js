// Bau-Seite (bau.html?id=<id>[&scale=<zahl>] oder bau.html?form=<form>&<param>=<wert>…)
// Container-IDs (stabil):
//   #build-status          seitenweiter Zustand (Adresse ungültig, Katalog fehlt, Bau oder Maßstab unbekannt)
//   #build-layout          Raster aus Kopf und Bau-Ansicht (Handy untereinander, Desktop zweispaltig)
//   #build-head            Kopf: #build-crumb-category, #build-crumb-current, #build-title, #build-subtitle, #build-chips
//   #build-view            Bau-Ansicht (mountBuildView aus build-view.js: 3D-Bühne, Schritt-Player, Tabs)
import { el, requireElement, sitePath } from './dom.js';
import {
  initPage, parseBuildParams, findCategory, renderState, renderError, linkButton, createCategoryChip, createAccuracyChip,
  createUntestedChip,
} from './shared.js';
import { mountBuildView } from './build-view.js';
import { loadBuildEntry, resolveScale, sourceForEntry, progressKeyFor, formatScale, scaleToken } from './build/entry.js';
import { formProgressKey } from './build/progress.js';

const INVALID_TEXTS = {
  id: 'Die Kennung des Baus in der Adresse ist ungültig. Erlaubt sind Kleinbuchstaben, Ziffern und Bindestriche.',
  scale: 'Der Maßstab in der Adresse ist ungültig. Erlaubt ist eine Zahl wie 1 oder 0.5.',
  form: 'Der Name der Form in der Adresse ist ungültig.',
  both: 'Die Adresse enthält gleichzeitig einen Bau und eine Form. Wähle eins von beidem.',
};
const SHAPES_MODULE = '../create/shape-generators.js';

initPage();
start(window.location.search).then((view) => {
  // Für Klick-Tests und die Konsole: die geladene Bau-Ansicht ({ viewer, result, context, dispose })
  if (view) window.__buildView = view;
}).catch((error) => {
  // Fehler der Bau-Ansicht zeigt sie selbst an; hier nur Unerwartetes
  if (!error || error.name !== 'ViewerError') console.error('[Block-Kompass] Bau-Seite:', error);
});

async function start(search) {
  const params = parseBuildParams(search);
  if (params.kind === 'build') return startBuild(params);
  if (params.kind === 'form') return startForm(search);
  if (params.kind === 'none') {
    return showPageState({
      kind: 'info',
      title: 'Kein Bau ausgewählt',
      text: 'Wähle einen Bau in einer Kategorie aus oder beschreibe deine eigene Idee.',
      actions: [linkButton('Zu den Kategorien', 'kategorie.html', { iconName: 'grid' }), linkButton('Selber erstellen', 'erstellen.html', { variant: 'ghost', iconName: 'hammer' })],
    });
  }
  return showPageState({
    kind: 'error',
    title: 'Ungültige Adresse',
    text: INVALID_TEXTS[params.reason],
    actions: [linkButton('Zu den Kategorien', 'kategorie.html', { iconName: 'grid' })],
  });
}

function showPageState(spec) {
  requireElement('build-layout').hidden = true;
  document.title = `${spec.title} – Block-Kompass`;
  renderState(requireElement('build-status'), { headingLevel: 1, ...spec });
}

function buildHref(id, scale = null) {
  return `bau.html?id=${encodeURIComponent(id)}${scale === null ? '' : `&scale=${scaleToken(scale)}`}`;
}

async function startBuild(params) {
  const status = requireElement('build-status');
  let entry;
  try {
    entry = await loadBuildEntry(params.id);
  } catch (error) {
    requireElement('build-layout').hidden = true;
    document.title = 'Bau nicht verfügbar – Block-Kompass';
    renderError(status, error, { onRetry: () => { status.replaceChildren(); requireElement('build-layout').hidden = false; startBuild(params); }, headingLevel: 1 });
    return;
  }
  if (!entry) {
    showPageState({
      kind: 'error',
      title: 'Bau nicht gefunden',
      text: `Im Katalog gibt es keinen Bau mit der Kennung „${params.id}“.`,
      actions: [linkButton('Zu den Kategorien', 'kategorie.html', { iconName: 'grid' }), linkButton('Selber erstellen', 'erstellen.html', { variant: 'ghost', iconName: 'hammer' })],
    });
    return;
  }
  const scale = resolveScale(entry, params.scale);
  if (!scale.ok) {
    const options = entry.scales.map((value) => linkButton(`Maßstab ${formatScale(value)}`, buildHref(entry.id, value), { variant: 'secondary' }));
    showPageState({
      kind: 'error',
      title: 'Maßstab nicht verfügbar',
      text: scale.reason === 'no-scales'
        ? `„${entry.title}“ gibt es nur in seiner Originalgröße.`
        : `Für „${entry.title}“ gibt es den Maßstab ${formatScale(params.scale)} nicht.`,
      actions: options.length ? options : [linkButton(`Zu „${entry.title}“`, buildHref(entry.id), { iconName: 'arrow-right' })],
    });
    return;
  }
  const source = sourceForEntry(entry);
  if (!source) {
    showPageState({
      kind: 'error',
      title: 'Keine 3D-Daten',
      text: `Für „${entry.title}“ fehlt im Katalog das Bau-Modul oder die Struktur.`,
      actions: [linkButton('Zu den Kategorien', 'kategorie.html', { iconName: 'grid' })],
    });
    return;
  }
  showHead(entry);
  return mountBuildView(requireElement('build-view'), {
    source,
    params: scale.scale === null ? {} : { scale: scale.scale },
    entry,
    progressKey: progressKeyFor(entry.id, scale.scale),
    onScaleChange: (next) => {
      try {
        window.history.replaceState(null, '', sitePath(buildHref(entry.id, next)));
      } catch (error) {
        console.warn('[Block-Kompass] Adresse konnte nicht angepasst werden:', error);
      }
    },
  });
}

async function startForm(search) {
  let shapes;
  try {
    shapes = await import(SHAPES_MODULE);
    if (typeof shapes.parseShapeQuery !== 'function' || !shapes.SHAPES) throw new Error('parseShapeQuery oder SHAPES fehlt');
  } catch (error) {
    console.warn('[Block-Kompass] Formen-Generator nicht verfügbar:', error);
    showPageState({
      kind: 'info',
      title: 'Formen-Generator nicht verfügbar',
      text: 'Die Formen lassen sich gerade nicht erzeugen. Probier es auf der Seite „Selber erstellen“.',
      actions: [linkButton('Selber erstellen', 'erstellen.html', { iconName: 'hammer' })],
    });
    return;
  }
  let parsed;
  try {
    parsed = shapes.parseShapeQuery(new URLSearchParams(search));
  } catch (error) {
    console.error('[Block-Kompass] Formparameter nicht lesbar:', error);
    parsed = { ok: false, errors: ['Die Angaben zur Form sind nicht lesbar.'] };
  }
  const spec = parsed?.ok ? shapes.SHAPES[parsed.shape] : null;
  if (!spec) {
    const errors = Array.isArray(parsed?.errors) ? parsed.errors.filter((text) => typeof text === 'string').slice(0, 8) : [];
    showPageState({
      kind: 'error',
      title: 'Form ungültig',
      text: errors.length ? 'Diese Angaben passen nicht:' : 'Diese Form kann nicht erzeugt werden.',
      steps: errors.map((text) => ({ text })),
      actions: [linkButton('Form neu einstellen', 'erstellen.html', { iconName: 'hammer' })],
    });
    return;
  }
  const entry = {
    title: typeof spec.title === 'string' ? spec.title : parsed.shape,
    subtitle: typeof spec.description === 'string' ? spec.description : '',
    accuracy: 'eigenes',
    tags: ['Form'],
  };
  showHead(entry, { form: true });
  return mountBuildView(requireElement('build-view'), {
    source: { kind: 'shape', shape: parsed.shape, params: parsed.params },
    params: {},
    entry,
    progressKey: formProgressKey(parsed.shape, parsed.params),
  });
}

function showHead(entry, { form = false } = {}) {
  requireElement('build-layout').hidden = false;
  document.title = `${entry.title} – Block-Kompass`;
  const crumb = requireElement('build-crumb-category');
  const category = form ? null : findCategory(entry.category);
  if (form) {
    crumb.textContent = 'Selber erstellen';
    crumb.setAttribute('href', sitePath('erstellen.html'));
  } else if (category) {
    crumb.textContent = category.title;
    crumb.setAttribute('href', sitePath(`kategorie.html?k=${category.slug}`));
    requireElement('build-layout').dataset.category = category.slug;
  }
  requireElement('build-crumb-current').textContent = entry.title;
  requireElement('build-title').textContent = entry.title;
  requireElement('build-subtitle').textContent = entry.subtitle ?? '';
  const chips = [
    category ? createCategoryChip(category.slug) : null,
    entry.accuracy ? createAccuracyChip(entry.accuracy) : null,
    entry.tested === false ? createUntestedChip() : null,
  ].filter(Boolean);
  requireElement('build-chips').replaceChildren(...chips.map((chip) => el('li', null, chip)));
}
