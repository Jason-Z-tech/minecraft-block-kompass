// Styleguide (tests/visual/styleguide.html): zeigt alle Komponenten und Zustände mit Beispieldaten.
// Die Kontrasttabelle rechnet live aus den CSS-Tokens – dieselben Paare prüft tests/unit/ui-contrast.test.mjs.
import { el, requireElement } from '../../js/ui/dom.js';
import { loadJson, CATALOG_PATH } from '../../js/ui/data.js';
import {
  initPage, CATEGORIES, ACCURACY_KEYS, ICON_NAMES, icon, createCategoryChip, createAccuracyChip, createUntestedChip,
  createChip, renderCategoryGrid, setTileCount, createBuildCard, createSkeletonCards, createState,
  renderError, initTabs, initSlider, syncSlider, setXpProgress, createToast, showToast, attachTooltip, tooltipContent,
  linkButton, contrastRatio, mixHex, formatNumber,
} from '../../js/ui/shared.js';

const SWATCHES = [
  ['--c-bg', 'Grund (Tiefenschiefer)'], ['--c-surface', 'Fläche'], ['--c-surface-2', 'Fläche 2'], ['--c-surface-3', 'Fläche 3'],
  ['--c-sunken', 'Vertieft (Felder, Slots)'], ['--c-line', 'Linie'], ['--c-text', 'Text (warmes Weiß)'], ['--c-text-muted', 'Text gedämpft'],
  ['--c-grass', 'Grasgrün'], ['--c-copper', 'Kupfer'], ['--c-oxidized', 'Oxidiert-Türkis'], ['--c-gold', 'Gold'],
  ['--c-redstone', 'Redstone-Rot'], ['--c-diamond', 'Diamant'], ['--c-amethyst', 'Amethyst'], ['--c-xp', 'XP-Grün'],
  ...CATEGORIES.map((category) => [`--cat-${category.slug}`, `${category.shortTitle} (${category.colorName})`]),
];

// Beispieldaten – keine echten Bauten
const SAMPLE_BUILDS = [
  { id: 'beispiel-turm', title: 'Beispiel: Wachturm', category: 'mittelalter', subtitle: 'Beispieldaten für den Styleguide, ohne Vorschaubild.', accuracy: 'eigenes', size: [9, 24, 9], blocks: 1284, steps: 24, tested: null, thumb: null },
  { id: 'beispiel-farm', title: 'Beispiel: Kaktusfarm', category: 'farmen', subtitle: 'Zeigt den Hinweis für ungetestete Farmen.', accuracy: 'nachempfunden', size: [6, 5, 4], blocks: 96, steps: 12, tested: false, thumb: null },
  { id: 'beispiel-haus', title: 'Beispiel: Haus mit Vorschaubild', category: 'haeuser', subtitle: 'Das Bild ist eine im Browser gezeichnete Pixel-Szene.', accuracy: 'vorlage', size: [12, 10, 14], blocks: 2312, steps: 18, tested: null, thumb: null },
  { id: 'beispiel-riese', title: 'Beispiel: Sehr langer Titel für einen Riesenbau mit Zeilenumbruch', category: 'wahrzeichen', subtitle: 'Lange Titel und große Zahlen bleiben lesbar.', accuracy: 'massstab', size: [120, 634, 120], blocks: 1234567, steps: 412, tested: null, thumb: null },
];

const SAMPLE_SLOTS = [
  { name: 'Steinziegel', id: 'minecraft:stone_bricks', color: '#8a8a8a', count: 64 },
  { name: 'Eichenholzbretter', id: 'minecraft:oak_planks', color: '#b8945f', count: 2304, selected: true },
  { name: 'Glas', id: 'minecraft:glass', color: '#a8d8e8', count: 12 },
  { name: 'Goldblock', id: 'minecraft:gold_block', color: '#f2c14e', count: 1 },
  { name: 'Redstone-Staub', id: 'minecraft:redstone', color: '#e0342f', count: 37, done: true },
  { name: 'Moosbewachsenes Kopfsteinpflaster', id: 'minecraft:mossy_cobblestone', color: '#5da33b', count: 180 },
  { name: 'Kupferblock', id: 'minecraft:copper_block', color: '#d0703c', count: 9 },
  { name: 'Prismarin', id: 'minecraft:prismarine', color: '#4fa38b', count: 640 },
  null,
  null,
];

initPage();
renderSwatches();
renderContrastTable();
renderIcons();
renderChips();
renderTiles();
renderCards();
initTabs(requireElement('sg-tabs-demo'));
initPlayerDemo();
initSlider(requireElement('sg-slider-2'));
syncSlider(requireElement('sg-slider-3'));
renderInventory();
renderToasts();
renderStates();

function tokenValue(name) {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  if (!/^#[0-9a-f]{3,6}$/i.test(value)) throw new Error(`Token ${name} ist keine Hex-Farbe: „${value}“`);
  return value;
}

// „#fff“, „--token“ oder „mix(--a,16,--b)“ (wie color-mix in srgb)
function resolveColor(spec) {
  if (spec.startsWith('#')) return spec;
  const mix = /^mix\((--[a-z0-9-]+),(\d+),(--[a-z0-9-]+)\)$/.exec(spec);
  if (mix) return mixHex(tokenValue(mix[1]), tokenValue(mix[3]), Number(mix[2]) / 100);
  return tokenValue(spec);
}

function swatchSquare(color) {
  const square = el('span', { 'aria-hidden': 'true' });
  square.style.display = 'block';
  square.style.width = '100%';
  square.style.height = '56px';
  square.style.marginBottom = '8px';
  square.style.background = color;
  square.style.boxShadow = 'inset 0 0 0 2px rgb(255 255 255 / 0.08), inset 0 -6px 0 rgb(0 0 0 / 0.25)';
  return square;
}

function renderSwatches() {
  const list = requireElement('sg-swatches');
  list.style.setProperty('--grid-min', '150px');
  list.replaceChildren(...SWATCHES.map(([name, label]) => {
    const value = tokenValue(name);
    const item = el('li', { class: 'plate' }, swatchSquare(value), el('strong', null, label), el('br'), el('span', { class: 'mono muted' }, name), el('br'), el('span', { class: 'mono' }, value));
    item.style.padding = '12px';
    return item;
  }));
}

function renderContrastTable() {
  for (const row of requireElement('sg-contrast').querySelectorAll('tbody tr')) {
    const fg = resolveColor(row.dataset.fg);
    const bg = resolveColor(row.dataset.bg);
    const min = Number(row.dataset.min);
    const ratio = contrastRatio(fg, bg);
    const sample = el('span', null, 'Aa Probe');
    sample.style.display = 'inline-block';
    sample.style.padding = '4px 10px';
    sample.style.color = fg;
    sample.style.background = bg;
    sample.style.fontWeight = '700';
    const ok = ratio >= min;
    const verdict = ok
      ? createChip(min >= 4.5 ? 'AA' : 'AA Grafik', { iconName: 'check', className: 'chip--ok' })
      : createChip('zu wenig', { iconName: 'warning', className: 'chip--warning' });
    row.replaceChildren(
      el('td', null, sample),
      el('td', null, el('code', null, row.dataset.fg), el('br'), el('span', { class: 'mono muted' }, fg)),
      el('td', null, el('code', null, row.dataset.bg), el('br'), el('span', { class: 'mono muted' }, bg), el('span', { class: 'muted' }, ` · ${row.dataset.use}`)),
      el('td', { class: 'num' }, `${formatNumber(ratio, { maximumFractionDigits: 2 })} : 1`),
      el('td', null, verdict),
    );
    if (!ok) console.error(`Kontrast zu gering: ${row.dataset.fg} auf ${row.dataset.bg} = ${ratio.toFixed(2)} (mindestens ${min})`);
  }
}

function renderIcons() {
  requireElement('sg-icons-list').replaceChildren(...ICON_NAMES.map((name) => {
    const item = el('li', { class: 'plate cluster' }, icon(name), icon(name, { size: 32 }), icon(name, { size: 48 }), el('code', null, name));
    item.style.padding = '12px';
    return item;
  }));
}

function renderChips() {
  requireElement('sg-chips-categories').replaceChildren(...CATEGORIES.map((category) => el('li', null, createCategoryChip(category.slug))));
  requireElement('sg-chips-accuracy').replaceChildren(...ACCURACY_KEYS.map((key) => el('li', null, createAccuracyChip(key))));
  requireElement('sg-chips-misc').replaceChildren(
    createUntestedChip(),
    createChip('Java 26.2', { className: 'chip--version' }),
    createChip('Schlagwort'),
  );
}

function renderTiles() {
  const tiles = renderCategoryGrid(requireElement('sg-tiles'));
  const sampleCounts = { haeuser: 12, wahrzeichen: 1, fantasy: undefined, mittelalter: 0, klein: 27, farmen: null, infrastruktur: 3 };
  for (const [slug, tile] of tiles) setTileCount(tile, sampleCounts[slug]);
}

// Kleine Pixel-Szene als Vorschaubild (Himmel, Hügel, Haus) – nur für den Styleguide
function drawSampleThumbnail() {
  const canvas = document.createElement('canvas');
  canvas.width = 80;
  canvas.height = 50;
  const ctx = canvas.getContext('2d');
  const rect = (color, x, y, w, h) => { ctx.fillStyle = color; ctx.fillRect(x, y, w, h); };
  rect('#1b2a3a', 0, 0, 80, 50);
  rect('#22364a', 0, 18, 80, 32);
  for (const [x, y] of [[6, 5], [19, 9], [33, 4], [61, 7], [72, 12], [48, 11]]) rect('#ece8df', x, y, 1, 1);
  rect('#2f4f3a', 0, 30, 80, 20);
  rect('#5da33b', 0, 36, 80, 2);
  rect('#6b4a33', 0, 38, 80, 12);
  rect('#7a7a7a', 26, 28, 28, 8);
  rect('#b8945f', 28, 18, 24, 10);
  for (let i = 0; i < 9; i++) rect('#7c3a2a', 25 + i, 18 - i, 30 - 2 * i, 1);
  rect('#5a3d22', 37, 27, 6, 9);
  rect('#a8d8e8', 30, 21, 4, 4);
  rect('#a8d8e8', 46, 21, 4, 4);
  rect('#f2c14e', 39, 31, 1, 1);
  const big = document.createElement('canvas');
  big.width = 320;
  big.height = 200;
  const bigCtx = big.getContext('2d');
  bigCtx.imageSmoothingEnabled = false;
  bigCtx.drawImage(canvas, 0, 0, 320, 200);
  return big.toDataURL('image/png');
}

function renderCards() {
  const thumbnail = drawSampleThumbnail();
  requireElement('sg-cards').replaceChildren(...SAMPLE_BUILDS.map((build) => el('li', null,
    createBuildCard(build, { imageSrc: build.id === 'beispiel-haus' ? thumbnail : null }))));
  for (const link of document.querySelectorAll('#sg-cards a')) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      showToast({ kind: 'info', title: 'Nur ein Beispiel', text: 'Beispielkarten führen zu keinem echten Bau.' });
    });
  }
}

function initPlayerDemo() {
  const total = 24;
  const slider = requireElement('sg-slider');
  const xp = requireElement('sg-xp');
  const label = requireElement('sg-step-label');
  const play = requireElement('sg-play');
  let step = 1;
  let timer = null;
  const show = (value) => {
    step = Math.min(total, Math.max(1, value));
    slider.value = String(step);
    syncSlider(slider);
    setXpProgress(xp, { value: step, max: total, level: step, label: `Schritt ${step} von ${total}` });
    label.replaceChildren(el('strong', null, `Schritt ${step}`), el('span', null, `von ${total} · Ebene ${Math.ceil(step / 3)}`));
  };
  const setPlaying = (playing) => {
    clearInterval(timer);
    play.setAttribute('aria-pressed', String(playing));
    play.replaceChildren(icon(playing ? 'pause' : 'play'), el('span', { class: 'visually-hidden' }, playing ? 'Anhalten' : 'Abspielen'));
    if (playing) {
      timer = setInterval(() => {
        if (step >= total) setPlaying(false);
        else show(step + 1);
      }, 700);
    }
  };
  initSlider(slider, { onInput: (value) => show(value) });
  requireElement('sg-prev').addEventListener('click', () => show(step - 1));
  requireElement('sg-next').addEventListener('click', () => show(step + 1));
  play.addEventListener('click', () => setPlaying(play.getAttribute('aria-pressed') !== 'true'));
  show(9);
  setXpProgress(requireElement('sg-xp-0'), { value: 0, max: 20, level: 0 });
  setXpProgress(requireElement('sg-xp-35'), { value: 7, max: 20, level: 7 });
  setXpProgress(requireElement('sg-xp-100'), { value: 20, max: 20, level: 20 });
}

function renderInventory() {
  requireElement('sg-inventory').replaceChildren(...SAMPLE_SLOTS.map((slot) => {
    if (!slot) return el('li', null, el('span', { class: 'slot slot--empty', 'aria-hidden': 'true' }));
    const cube = icon('cube', { size: 32, className: 'slot__icon' });
    cube.style.color = slot.color;
    const button = el('button', {
      class: ['slot', slot.selected && 'is-selected', slot.done && 'is-done'],
      type: 'button',
      'aria-label': `${slot.name}: ${formatNumber(slot.count)}${slot.done ? ' (abgehakt)' : ''}`,
    }, cube, el('span', { class: 'slot__count', 'aria-hidden': 'true' }, formatNumber(slot.count)));
    attachTooltip(button, () => tooltipContent(slot.name, { lines: [{ text: `${formatNumber(slot.count)} Stück`, tone: 'gold' }], meta: slot.id }));
    return el('li', null, button);
  }));
}

function renderToasts() {
  requireElement('sg-toasts-static').replaceChildren(
    createToast({ kind: 'success', title: 'Schritt geschafft!', text: 'Ebene 3 ist fertig gebaut.' }),
    createToast({ kind: 'info', title: 'Befehl kopiert', text: 'node scripts/serve.mjs' }),
    createToast({ kind: 'warning', title: 'Maßstab nicht verfügbar', text: 'Für diesen Bau gibt es nur 1 : 1.' }),
    createToast({ kind: 'error', title: 'Speichern nicht möglich', text: 'Der Browser hat den lokalen Speicher gesperrt.' }),
  );
  const texts = {
    success: ['Schritt geschafft!', 'Ebene 3 ist fertig gebaut.'],
    info: ['Hinweis', 'Ziehen dreht die Ansicht, das Mausrad zoomt.'],
    warning: ['Achtung', 'Dieser Bau ist sehr groß.'],
    error: ['Fehler', 'Etwas ist schiefgelaufen – Details in der Konsole.'],
  };
  for (const button of requireElement('sg-toast-buttons').querySelectorAll('[data-toast]')) {
    const kind = button.dataset.toast;
    button.addEventListener('click', () => showToast({ kind, title: texts[kind][0], text: texts[kind][1] }));
  }
}

async function renderStates() {
  const states = requireElement('sg-states');
  states.replaceChildren(
    createState({ kind: 'loading', title: 'Katalog wird geladen …', headingLevel: 0, compact: true }),
    createState({ kind: 'empty', title: 'Noch keine Bauten in dieser Kategorie', text: 'Sobald der Katalog Bauten zu diesem Thema enthält, erscheinen sie hier.', headingLevel: 3, actions: [linkButton('Alle Kategorien', 'kategorie.html', { iconName: 'grid' })] }),
    createState({ kind: 'info', title: '3D-Ansicht folgt', text: 'Ein neutraler Hinweis, z. B. für Bereiche, die noch kommen.', headingLevel: 3, compact: true }),
    createState({ kind: 'warning', title: 'Sehr großer Bau', text: 'Über eine Million Blöcke – die 3D-Ansicht kann eine Weile laden.', headingLevel: 3 }),
  );
  // Echter Fehlerzustand: loadJson mit einer Antwort 404, so wie ohne data/catalog.json
  const errorBox = el('div');
  states.append(errorBox);
  try {
    await loadJson(CATALOG_PATH, { fetch: async () => new Response('', { status: 404 }) });
    errorBox.append(createState({ kind: 'error', title: 'Unerwartet', text: 'loadJson hätte einen Fehler werfen müssen.', headingLevel: 3 }));
  } catch (error) {
    renderError(errorBox, error, { onRetry: () => showToast({ kind: 'info', title: 'Nur ein Beispiel', text: 'Im Styleguide wird nichts neu geladen.' }), headingLevel: 3 });
  }
  requireElement('sg-skeletons').replaceChildren(...createSkeletonCards(3));
}
