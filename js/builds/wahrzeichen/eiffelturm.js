// Eiffelturm, Paris – 1:1 nach echten Maßen (Recherche: docs/recherche/eiffelturm.md).
// Koordinaten: Turmmitte bei x = z = 0, Boden (Platz) auf y = 0, 1 Block = 1 m bei scale 1.

export const meta = {
  id: 'eiffelturm',
  title: 'Eiffelturm',
  category: 'wahrzeichen',
  subtitle: 'Gitterturm aus Eisen in Paris, 330 m hoch',
  tags: ['Paris', 'Frankreich', 'Turm', 'Gitterturm', 'Eisen', 'Riesig', 'Maßstab 1:1', 'Aussichtsturm', 'Weltausstellung'],
  aliases: [
    'eiffelturm', 'eifelturm', 'eifel turm', 'eiffel turm', 'eiffel tower', 'eifel tower', 'tour eiffel', 'la tour eiffel',
    'paris turm', 'pariser turm', 'turm paris', 'eiffel', 'eifeltum', 'eiffelturm paris',
  ],
  accuracy: 'massstab',
  difficulty: 5,
  description: 'Der Eiffelturm im Maßstab 1:1: 330 m hoch mit Antennen, 125 m breite quadratische Grundfläche, vier geschwungene Pfeiler mit Zierbögen und drei Etagen auf 57,6 m, 115,7 m und 276,1 m. Das Eisen ist als sichtbares Gitterwerk gebaut – Eckträger und Gurte massiv, die Streben dazwischen aus Kupfergittern – in drei Brauntönen, unten dunkler als oben. Die Außenkurve folgt den 29 Feldern des echten Turms; die Pfeiler-Innenkanten, die Spitze und die Einrichtung der Pavillons sind vereinfacht und teils geschätzt.',
  facts: [
    'Höhe heute 330 m mit Antennen (seit März 2022), Eisenkonstruktion 300 m, eröffnet 1889 zur Weltausstellung.',
    'Grundfläche: Quadrat mit 125 m Seitenlänge, zwischen den Pfeilern 74,24 m, jeder Pfeiler rund 26 m breit.',
    'Etagen: 57,6 m (Seite 70,7 m), 115,7 m (Seite 41 m), 276,1 m mit Oberdeck auf 279,1 m (Seite 18,7 m).',
    'Die Zierbögen reichen 39 m hoch – sie tragen nichts und kamen auf Wunsch des Architekten Stephen Sauvestre dazu.',
    'Rund 7 300 t Schmiedeeisen aus 18 038 Teilen und 2,5 Millionen Nieten; gestrichen in „Eiffelturm-Braun“, unten dunkler als oben.',
    'Im echten Turm zeigen die vier Pfeiler in die vier Himmelsrichtungen; hier stehen sie in den Ecken, die Seiten zeigen nach Norden, Osten, Süden und Westen.',
    'Geschätzt (nicht belegt): Verlauf der Pfeiler-Innenkanten, Form der Turmspitze über 280 m, Lage und Größe der Pavillons.',
  ],
  sources: [
    { title: 'Wikipedia (de): Eiffelturm', url: 'https://de.wikipedia.org/wiki/Eiffelturm' },
    { title: 'Wikipedia (fr): Tour Eiffel – Dimensions', url: 'https://fr.wikipedia.org/wiki/Tour_Eiffel' },
    { title: 'Wikipedia (en): Eiffel Tower', url: 'https://en.wikipedia.org/wiki/Eiffel_Tower' },
    { title: 'P. Weidman, I. Pinelis: Model equations for the Eiffel Tower profile (C. R. Mécanique 332, 2004)', url: 'https://doi.org/10.1016/j.crme.2004.02.021' },
  ],
  credits: null,
  scales: [1, 0.5, 0.25],
  tested: null,
};

// Außenprofil nach Weidman & Pinelis (2004), Tabelle 1: x = Abstand unter der Oberkante von Feld 29 (m),
// w = halbe Turmbreite (m). Oberkante Feld 29 = dritte Etage (276,13 m).
const PROFILE = [
  [0, 5.0], [11.28, 5.0], [17.113, 5.284], [23.278, 5.585], [29.795, 5.903], [36.683, 6.239], [43.963, 6.594],
  [51.658, 6.969], [59.791, 7.365], [68.387, 7.784], [77.473, 8.227], [87.076, 8.696], [97.076, 9.245],
  [107.076, 9.999], [117.576, 10.79], [128.076, 11.786], [138.676, 12.88], [149.376, 14.303], [160.676, 15.806],
  [165.576, 16.925], [175.576, 19.21], [185.776, 21.583], [196.776, 24.365], [207.776, 27.415], [218.776, 30.919],
  [225.776, 33.697], [236.776, 38.637], [247.776, 43.578], [258.776, 48.519], [269.776, 53.459],
];
const TOP_DECK_M = 276.13;
const BASE_HALF_M = 124.9 / 2;
const INNER_HALF_M = 74.24 / 2;
const FLOOR1 = { m: 57.63, side: 70.69 };
const FLOOR2 = { m: 115.73, side: 40.96 };
const FLOOR3 = { m: 276.13, upper: 279.11, side: 18.65 };
const ARCH = { apexM: 39, radiusM: 37 };
const STRUCTURE_TOP_M = 300.51;
const TOTAL_HEIGHT_M = 330;

// Profil unter Feld 1 mit dessen Neigung bis zum Boden verlängert; Faktor so, dass die Grundfläche 124,9 m misst.
const LAST = PROFILE[PROFILE.length - 1];
const PREV = PROFILE[PROFILE.length - 2];
const GROUND_W = LAST[1] + (TOP_DECK_M - LAST[0]) * (LAST[1] - PREV[1]) / (LAST[0] - PREV[0]);
const PROFILE_FACTOR = BASE_HALF_M / GROUND_W;

const P = {
  dark: 'brown_terracotta',
  mid: 'packed_mud',
  light: 'light_gray_terracotta',
  brace: 'waxed_exposed_copper_grate',
  bars: 'waxed_exposed_copper_bars',
  deck: 'spruce_planks',
  deckEdge: 'stripped_spruce_wood',
  glass: 'glass',
  pane: 'glass_pane',
  frame: 'light_gray_terracotta',
  roof: 'smooth_stone_slab',
  plinth: 'polished_andesite',
  paving: 'smooth_sandstone',
  path: 'sandstone',
};

function outerHalfM(m) {
  const x = TOP_DECK_M - m;
  if (x <= 0) return PROFILE[0][1] * PROFILE_FACTOR;
  for (let i = 1; i < PROFILE.length; i++) {
    const [x0, w0] = PROFILE[i - 1];
    const [x1, w1] = PROFILE[i];
    if (x <= x1) return (w0 + (x - x0) * (w1 - w0) / (x1 - x0)) * PROFILE_FACTOR;
  }
  return (LAST[1] + (x - LAST[0]) * (LAST[1] - PREV[1]) / (LAST[0] - PREV[0])) * PROFILE_FACTOR;
}

// Innenkante der Pfeiler (geschätzt): gerade von 37,12 m am Boden bis zur Mitte auf Höhe der zweiten Etage.
function innerHalfM(m) {
  return Math.max(0, INNER_HALF_M * (1 - m / FLOOR2.m));
}

function geometry(scale) {
  const s = scale;
  const level = (m) => 1 + Math.round(m * s); // Ebene, deren Unterkante auf m Metern liegt
  const meters = (y) => (y - 0.5) / s; // Mitte der Ebene y in Metern über dem Boden
  const outer = (y) => Math.max(1, Math.round(outerHalfM(meters(y)) * s - 0.5));
  const inner = (y) => Math.round(innerHalfM(meters(y)) * s + 0.5);
  const half = (sideM) => Math.max(2, Math.round((sideM / 2) * s - 0.5));
  const len = (m, min = 1) => Math.max(min, Math.round(m * s));
  return { s, level, meters, outer, inner, half, len };
}

function shadeFor(m) {
  if (m < 110) return P.dark;
  if (m < 220) return P.mid;
  return P.light;
}

// Feldgrenzen (Gurte) als Ebenen; zu dichte Grenzen werden zusammengelegt.
function panelLevels(g) {
  const minGap = Math.max(4, Math.round(5 * g.s));
  const raw = [...PROFILE.map(([x]) => g.level(TOP_DECK_M - x)), 1].sort((a, b) => a - b);
  const kept = [];
  for (const y of raw) {
    if (kept.length === 0 || y - kept[kept.length - 1] >= minGap) kept.push(y);
  }
  return kept;
}

function panelAt(levels, y) {
  for (let i = levels.length - 1; i >= 0; i--) {
    if (levels[i] <= y) return { y0: levels[i], y1: levels[i + 1] ?? levels[i] + 8, index: i };
  }
  return { y0: 1, y1: levels[0], index: 0 };
}

// Rolle einer Zelle in einer Gitterfläche: 'solid' (Eckträger/Gurt), 'brace' (Strebe), 'bars' (schmales Gitter)
// oder null (offen). Schmale Felder bekommen nur eine Strebe, abwechselnd steigend und fallend (Zickzack).
function latticeRole(u, lo, hi, y, panel, cw) {
  if (u - lo < cw || hi - u < cw) return 'solid';
  if (y === panel.y0) return 'solid';
  const p0 = lo + cw;
  const q0 = hi - cw;
  if (q0 < p0) return 'solid';
  const span = q0 - p0 + 1;
  const height = panel.y1 - panel.y0;
  if (span <= 2) return 'bars';
  const n = Math.min(8, Math.max(1, Math.round(span / height)));
  const zigzag = span / n < 6;
  for (let j = 0; j < n; j++) {
    const c0 = p0 + (j * span) / n;
    const c1 = p0 - 1 + ((j + 1) * span) / n;
    const rising = (panel.index + j) % 2 === 0;
    if (zigzag ? onDiagonal(u, rising ? c0 : c1, rising ? c1 : c0, y, panel)
      : onDiagonal(u, c0, c1, y, panel) || onDiagonal(u, c1, c0, y, panel)) return 'brace';
  }
  return null;
}

// Strebe von Zelle `from` (Unterkante des Felds) bis Zelle `to` (Oberkante): je Ebene die Zellen bis zur nächsten
// Ebene einschließlich, damit die Strebe über Flächen zusammenhängt (keine Blöcke, die sich nur an Kanten berühren).
function onDiagonal(u, from, to, y, panel) {
  const height = panel.y1 - panel.y0;
  const at = (yy) => from + ((yy - panel.y0) / height) * (to - from);
  const a = at(y);
  const c = at(y + 1);
  return u >= Math.round(Math.min(a, c)) && u <= Math.round(Math.max(a, c));
}

function placeRole(b, x, y, z, role, m) {
  if (role === 'solid') b.set(x, y, z, shadeFor(m));
  else if (role === 'brace') b.set(x, y, z, P.brace);
  else if (role === 'bars') b.set(x, y, z, P.bars);
}

function cornerWidth(g, m) {
  const metres = m < FLOOR1.m ? 3 : m < FLOOR2.m ? 2 : 1;
  return Math.max(1, Math.round(metres * g.s));
}

// Querschnitt einer Ebene: Außen- und Innenkante, Eckträgerbreite und ob die vier Pfeiler noch getrennt stehen.
function sectionAt(g, y) {
  const m = g.meters(y);
  const k = g.outer(y);
  const a = g.inner(y);
  const cw = cornerWidth(g, m);
  return { m, k, a, cw, piers: a > cw + 1 && k - a >= 2 * cw };
}

// Eine Ebene des Turms: vier Pfeiler (Kasten zwischen inner und outer je Ecke) oder ein gemeinsamer Schaft.
function towerLevel(b, g, levels, y) {
  const { m, k, a, cw, piers } = sectionAt(g, y);
  const panel = panelAt(levels, y);
  if (piers) {
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        for (let u = a; u <= k; u++) {
          for (const face of [k, a]) {
            const role = latticeRole(u, a, k, y, panel, cw);
            placeRole(b, sx * face, y, sz * u, role, m);
            placeRole(b, sx * u, y, sz * face, role, m);
          }
        }
        for (const cx of [a, k - cw + 1]) {
          for (const cz of [a, k - cw + 1]) {
            b.fill(sx * cx, y, sz * cz, sx * (cx + cw - 1), y, sz * (cz + cw - 1), shadeFor(m));
          }
        }
      }
    }
    return;
  }
  for (let u = -k; u <= k; u++) {
    const role = latticeRole(u, -k, k, y, panel, cw);
    for (const sign of [-1, 1]) {
      placeRole(b, sign * k, y, u, role, m);
      placeRole(b, u, y, sign * k, role, m);
    }
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) b.fill(sx * k, y, sz * k, sx * (k - cw + 1), y, sz * (k - cw + 1), shadeFor(m));
  }
}

function buildGround(b, g) {
  const k0 = g.outer(1);
  const edge = k0 + g.len(10, 3);
  b.fill(-edge, 0, -edge, edge, 0, edge, 'grass_block');
  b.fill(-(k0 + 2), 0, -(k0 + 2), k0 + 2, 0, k0 + 2, P.paving);
  const pathHalf = g.len(6, 1);
  b.fill(-pathHalf, 0, -edge, pathHalf, 0, edge, P.path);
  b.fill(-edge, 0, -pathHalf, edge, 0, pathHalf, P.path);
  // Sockel unter den Pfeilern
  const a0 = g.inner(1);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) b.fill(sx * (a0 - 1), 0, sz * (a0 - 1), sx * (k0 + 1), 0, sz * (k0 + 1), P.plinth);
  }
  // Baumreihen und Hecken am Rand (Champ de Mars)
  if (g.s >= 1) {
    const ring = k0 + 6;
    for (let i = -ring; i <= ring; i += 10) {
      if (Math.abs(i) <= pathHalf + 3) continue;
      for (const [x, z] of [[i, -ring], [i, ring], [-ring, i], [ring, i]]) buildTree(b, x, z);
    }
  }
  if (g.s >= 0.5) {
    for (let i = -edge + 2; i <= edge - 2; i++) {
      if (Math.abs(i) <= pathHalf + 2) continue;
      for (const sign of [-1, 1]) {
        b.set(i, 1, sign * (edge - 1), 'azalea_leaves');
        b.set(sign * (edge - 1), 1, i, 'azalea_leaves');
      }
    }
  }
}

// Kleine Platane als Eiche: Stamm 4 Blöcke, Krone als runde Laubkugel.
function buildTree(b, x, z) {
  b.sphere(x, 6, z, 2.4, 'oak_leaves');
  b.fill(x, 1, z, x, 5, z, 'oak_log');
  b.set(x, 0, z, 'grass_block');
}

function buildArches(b, g) {
  const thickM = Math.max(3, 1 / g.s);
  const centerM = ARCH.apexM - ARCH.radiusM;
  const top = g.level(ARCH.apexM + thickM);
  const sides = [
    ['Bogen Nordseite', (u, y, k) => [u, y, -k]],
    ['Bogen Südseite', (u, y, k) => [u, y, k]],
    ['Bogen Westseite', (u, y, k) => [-k, y, u]],
    ['Bogen Ostseite', (u, y, k) => [k, y, u]],
  ];
  for (const [title, place] of sides) {
    b.step(title, 'Der Bogen liegt in der Außenfläche des Turms und spannt sich von Pfeiler zu Pfeiler. Setze die Bogenreihe von beiden Pfeilern aus gleichzeitig nach oben – die massiven Kanten zuerst, dann die Kupfergitter dazwischen. Am Scheitel treffen sich beide Hälften.');
    for (let y = 1; y <= top; y++) {
      const m = g.meters(y);
      const k = g.outer(y);
      const a = g.inner(y);
      for (let u = -(a - 1); u <= a - 1; u++) {
        const rho = Math.hypot(u / g.s, m - centerM);
        if (rho < ARCH.radiusM || rho > ARCH.radiusM + thickM) continue;
        const edge = rho - ARCH.radiusM < 1 / g.s || ARCH.radiusM + thickM - rho < 1 / g.s;
        const [x, yy, z] = place(u, y, k);
        b.set(x, yy, z, edge ? shadeFor(m) : P.brace);
      }
    }
  }
}

// Randträger unter einer Plattform: Ober- und Untergurt massiv, dazwischen Streben.
function buildBelt(b, g, half, yTop, height) {
  const panel = { y0: yTop - height + 1, y1: yTop + 1 };
  for (let y = yTop - height + 1; y <= yTop; y++) {
    const m = g.meters(y);
    for (let u = -half; u <= half; u++) {
      const role = y === yTop || y === panel.y0 ? 'solid' : latticeRole(u, -half, half, y, panel, 1);
      for (const sign of [-1, 1]) {
        placeRole(b, sign * half, y, u, role, m);
        placeRole(b, u, y, sign * half, role, m);
      }
    }
  }
}

// Innenraum eines Pfeilers (nur solange die Pfeiler getrennt stehen).
function insidePier(g, y, x, z) {
  const { k, a, piers } = sectionAt(g, y);
  if (!piers) return false;
  const ax = Math.abs(x);
  const az = Math.abs(z);
  return ax > a && ax < k && az > a && az < k;
}

// Plattformboden; über den hohlen Pfeilern liegt ein Gitterrost (begehbar, Monster spawnen darauf nicht).
function buildDeck(b, g, yDeck, half, hole, glassRim) {
  for (let x = -half; x <= half; x++) {
    for (let z = -half; z <= half; z++) {
      const ring = Math.max(Math.abs(x), Math.abs(z));
      if (ring < hole) continue;
      if (b.get(x, yDeck, z) !== 'air') continue;
      if (insidePier(g, yDeck, x, z)) {
        b.set(x, yDeck, z, P.brace);
        continue;
      }
      const state = ring === half ? P.deckEdge : ring < hole + glassRim ? P.glass : P.deck;
      b.set(x, yDeck, z, state);
    }
  }
}

function buildRailing(b, g, y, half, lanternEvery) {
  for (let u = -half; u <= half; u++) {
    for (const [x, z] of [[u, -half], [u, half], [-half, u], [half, u]]) {
      if (b.get(x, y, z) !== 'air') continue;
      const post = lanternEvery > 0 && (u + half) % lanternEvery === 0;
      b.set(x, y, z, P.bars);
      if (post && b.get(x, y + 1, z) === 'air') b.set(x, y + 1, z, 'lantern');
    }
  }
}

// Glaspavillon mit Rahmen, flachem Dach, Tischen, Stühlen und hängenden Laternen.
function buildPavilion(b, x1, z1, x2, z2, yFloor, height, doorSide) {
  const yTop = yFloor + height;
  for (let y = yFloor + 1; y < yTop; y++) {
    for (let x = x1; x <= x2; x++) {
      for (let z = z1; z <= z2; z++) {
        const onX = x === x1 || x === x2;
        const onZ = z === z1 || z === z2;
        if (!onX && !onZ) continue;
        const corner = onX && onZ;
        const post = corner || (onZ && (x - x1) % 4 === 0) || (onX && (z - z1) % 4 === 0);
        b.set(x, y, z, post || y === yTop - 1 ? P.frame : P.pane);
      }
    }
  }
  b.fill(x1, yTop, z1, x2, yTop, z2, P.roof);
  // Eingang (3 breit, 2 hoch) in der Mitte der Wand auf der Seite doorSide
  const mx = Math.round((x1 + x2) / 2);
  const mz = Math.round((z1 + z2) / 2);
  for (const d of [-1, 0, 1]) {
    for (let y = yFloor + 1; y <= yFloor + 2; y++) {
      if (doorSide === 'north') b.remove(mx + d, y, z1);
      else if (doorSide === 'south') b.remove(mx + d, y, z2);
      else if (doorSide === 'west') b.remove(x1, y, mz + d);
      else b.remove(x2, y, mz + d);
    }
  }
  // Einrichtung: Tischreihen mit Stühlen, Laternen an der Decke
  for (let x = x1 + 2; x <= x2 - 2; x += 3) {
    for (let z = z1 + 2; z <= z2 - 2; z += 3) {
      if (x + 1 > x2 - 1 && z + 1 > z2 - 1) continue;
      b.set(x, yFloor + 1, z, 'spruce_fence');
      b.set(x, yFloor + 2, z, 'spruce_pressure_plate');
      if (x - 1 > x1) b.stairs(x - 1, yFloor + 1, z, 'spruce_stairs', { facing: 'west' });
      if (x + 1 < x2) b.stairs(x + 1, yFloor + 1, z, 'spruce_stairs', { facing: 'east' });
    }
  }
  for (let x = x1 + 2; x <= x2 - 2; x += 4) {
    for (let z = z1 + 1; z <= z2 - 1; z += 4) {
      if (height >= 4) {
        b.set(x, yTop - 1, z, 'iron_chain');
        b.set(x, yTop - 2, z, 'lantern[hanging=true]');
      } else {
        b.set(x, yTop - 1, z, 'lantern[hanging=true]');
      }
    }
  }
}

function buildFloor1(b, g) {
  const yDeck = g.level(FLOOR1.m) - 1;
  const half = g.half(FLOOR1.side);
  const beltH = g.len(6, 2);
  const hole = g.len(11, 2);
  b.phase('Erste Etage (57,6 m)', `Die erste Plattform liegt auf Ebene ${yDeck + 1} und misst ${2 * half + 1} × ${2 * half + 1} Blöcke. Ein umlaufender Randträger verbindet die vier Pfeiler; darauf liegt der Holzboden mit dem Glasboden um die offene Mitte.`, {
    tips: [
      'Spanne den Randträger erst als Untergurt von Pfeiler zu Pfeiler – das ist deine Arbeitsbühne für alles darüber.',
      'Der Glasboden ist echt: seit 2014 kann man auf der ersten Etage über die Mitte des Turms laufen.',
    ],
  });
  b.step('Randträger', `Baue den Randträger ringsum in der Außenkante der Plattform, ${beltH} Ebenen hoch: unten und oben einen massiven Gurt, dazwischen gekreuzte Kupfergitter.`);
  buildBelt(b, g, half, yDeck - 1, beltH);
  b.note(0, yDeck - 1, -half, 'Randträger der ersten Etage – hier stand früher der Fries mit 72 Namen von Wissenschaftlern.');
  b.step('Plattformboden', `Lege den Boden aus Fichtenbrettern (Rand: entrindetes Fichtenholz). In der Mitte bleibt ein Loch von ${2 * hole - 1} × ${2 * hole - 1} Blöcken offen, umrahmt von einem Glasboden. Über den hohlen Pfeilern legst du einen Rost aus Kupferrost – so fällt niemand in den Pfeilerschacht, und man sieht trotzdem hinunter.`);
  buildDeck(b, g, yDeck, half, hole, g.len(2, 1));
  b.step('Geländer und Laternen', 'Setze ringsum Kupfergitter als Geländer, an der Außenkante und um das Loch in der Mitte. Auf jedes achte Gitter kommt eine Laterne, dazu je eine Laterne an den Innenecken der vier Pfeiler und in der Mitte der Ost- und Westseite ein Laternenpfosten (zwei Kupfergitter übereinander, Laterne obendrauf).');
  buildRailing(b, g, yDeck + 1, half, Math.max(4, g.len(8)));
  buildRailing(b, g, yDeck + 1, hole, Math.max(4, g.len(6)));
  // Laternen an den Innenecken der Pfeiler, wo das Geländerlicht nicht hinreicht
  const corner = g.inner(yDeck + 1) - 1;
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      if (corner > hole && b.get(sx * corner, yDeck, sz * corner) !== 'air' && b.get(sx * corner, yDeck + 1, sz * corner) === 'air') {
        b.set(sx * corner, yDeck + 1, sz * corner, 'lantern');
      }
    }
  }
  // Laternenpfosten in der Mitte der Ost- und Westseite (dort steht kein Pavillon)
  const postX = Math.round((hole + half) / 2);
  for (const sx of [-1, 1]) {
    if (b.get(sx * postX, yDeck, 0) === 'air' || b.get(sx * postX, yDeck + 1, 0) !== 'air') continue;
    b.set(sx * postX, yDeck + 1, 0, P.bars);
    b.set(sx * postX, yDeck + 2, 0, P.bars);
    b.set(sx * postX, yDeck + 3, 0, 'lantern');
  }
  if (g.s >= 0.5) {
    b.step('Pavillons auf der Nord- und Südseite', 'Zwischen den Pfeilern stehen zwei Glaspavillons mit Restaurant und Ausstellung. Baue die Rahmen aus Hellgrauer Keramik, fülle mit Glasscheiben, decke mit glatten Steinstufen und richte Tische, Stühle und hängende Laternen ein.');
    const a = g.inner(yDeck + 1);
    const x1 = -(a - 2);
    const x2 = a - 2;
    const depth = Math.max(4, Math.round((half - a) * 0.6));
    const height = g.len(5, 4);
    buildPavilion(b, x1, -(half - 2), x2, -(half - 1 - depth), yDeck, height, 'south');
    buildPavilion(b, x1, half - 1 - depth, x2, half - 2, yDeck, height, 'north');
  }
}

function buildFloor2(b, g) {
  const yDeck = g.level(FLOOR2.m) - 1;
  const half = g.half(FLOOR2.side);
  const beltH = g.len(4, 2);
  const shaftHalf = g.s >= 1 ? 2 : 1;
  b.phase('Zweite Etage (115,7 m)', `Hier laufen die vier Pfeiler zusammen. Die Plattform liegt auf Ebene ${yDeck + 1} und misst ${2 * half + 1} × ${2 * half + 1} Blöcke; in der Mitte startet der Aufzugsschacht zur Spitze.`, {
    tips: ['Ab hier ist der Turm ein einziger Schaft – arbeite dich ringsum Ebene für Ebene hoch.'],
  });
  b.step('Randträger', `Baue den Randträger wie bei der ersten Etage, diesmal ${beltH} Ebenen hoch.`);
  buildBelt(b, g, half, yDeck - 1, beltH);
  b.step('Plattformboden', 'Lege den Boden ganz aus; nur in der Mitte bleibt die Öffnung für den Aufzugsschacht frei.');
  buildDeck(b, g, yDeck, half, shaftHalf + 1, 0);
  b.step('Geländer und Laternen', 'Kupfergitter ringsum an der Außenkante, mit Laternen obendrauf.');
  buildRailing(b, g, yDeck + 1, half, Math.max(4, g.len(6)));
  if (g.s >= 0.5) {
    const k = g.outer(yDeck + g.len(6, 4));
    const outerP = k - 2;
    const inner = shaftHalf + 2;
    const height = g.len(5, 4);
    if (outerP - inner >= 4) {
      b.step('Glaspavillon rund um den Schacht', 'Innerhalb des Turmgitters steht ein Ring aus Glaspavillons. Baue ihn als vier Teile um den Schacht herum und lass in jedem Teil einen Eingang zur Plattform.');
      buildPavilion(b, -outerP, -outerP, outerP, -inner - 1, yDeck, height, 'north');
      buildPavilion(b, -outerP, inner + 1, outerP, outerP, yDeck, height, 'south');
      buildPavilion(b, -outerP, -inner, -inner - 1, inner, yDeck, height, 'west');
      buildPavilion(b, inner + 1, -inner, outerP, inner, yDeck, height, 'east');
    }
  }
}

function buildShaftCore(b, g, y1, y2) {
  const h = g.s >= 1 ? 2 : 1;
  if (g.outer(y2) <= h + 1) return;
  for (let y = y1; y <= y2; y++) {
    for (const [x, z] of [[-h, -h], [-h, h], [h, -h], [h, h]]) b.set(x, y, z, 'iron_chain');
  }
}

function buildFloor3(b, g) {
  const yDeck = g.level(FLOOR3.m) - 1;
  const yUpper = Math.max(yDeck + 3, g.level(FLOOR3.upper) - 1);
  const half = g.half(FLOOR3.side);
  b.phase('Dritte Etage (276,1 m)', `Die oberste Plattform hat zwei Ebenen: unten einen verglasten Raum auf Ebene ${yDeck + 1}, darüber das offene Oberdeck auf Ebene ${yUpper + 1}. Beide messen ${2 * half + 1} × ${2 * half + 1} Blöcke.`, {
    tips: ['Baue zuerst den Boden über die Turmkante hinaus – er kragt auf jeder Seite einige Blöcke aus.'],
  });
  b.step('Boden', 'Lege den Boden über den ganzen Turmquerschnitt und lass ihn rundum auskragen.');
  b.fill(-half, yDeck, -half, half, yDeck, half, P.deck);
  b.fill(-half, yDeck, -half, half, yDeck, half, P.deckEdge, { outline: true });
  b.step('Verglaster Raum', 'Setze ringsum Glas, jeden dritten Block einen Pfosten aus Hellgrauer Keramik. Darüber kommt das Oberdeck als Decke.');
  for (let y = yDeck + 1; y < yUpper; y++) {
    for (let u = -half; u <= half; u++) {
      for (const [x, z] of [[u, -half], [u, half], [-half, u], [half, u]]) {
        const post = Math.abs(u) === half || u % 3 === 0;
        b.set(x, y, z, post ? P.frame : P.glass);
      }
    }
  }
  b.fill(-half, yUpper, -half, half, yUpper, half, P.deck);
  if (half >= 4) {
    b.step('Gustave Eiffels Büro', 'Gustave Eiffel hatte hier oben ein kleines Büro für seine Messungen. Stell einen Schreibtisch mit Lesepult, zwei Stühle und Bücherregale auf und häng Laternen unter die Decke.');
    b.set(-1, yDeck + 1, -2, 'lectern[facing=south]');
    b.stairs(-1, yDeck + 1, -1, 'spruce_stairs', { facing: 'south' });
    b.set(1, yDeck + 1, -2, 'spruce_fence');
    b.set(1, yDeck + 2 >= yUpper ? yDeck + 1 : yDeck + 2, -2, 'spruce_pressure_plate');
    b.stairs(1, yDeck + 1, -1, 'spruce_stairs', { facing: 'south' });
    for (let x = -2; x <= 2; x++) b.set(x, yDeck + 1, half - 1, 'bookshelf');
    for (const [x, z] of [[-half + 2, -half + 2], [half - 2, -half + 2], [-half + 2, half - 2], [half - 2, half - 2], [0, 0]]) {
      b.set(x, yUpper - 1, z, 'lantern[hanging=true]');
    }
  } else {
    b.step('Licht', 'Häng eine Laterne unter die Decke.');
    b.set(0, yUpper - 1, 0, 'lantern[hanging=true]');
  }
  b.step('Leiter zum Oberdeck', `Setze an der Innenseite der Ostwand, genau in der Mitte, eine Leiter vom Boden bis durch das Oberdeck (${yUpper - yDeck} Sprossen). Das Feld im Oberdeck ersetzt du dabei durch die oberste Sprosse.`);
  for (let y = yDeck + 1; y <= yUpper; y++) b.set(half - 1, y, 0, 'ladder[facing=west]');
  b.note(half - 1, yDeck + 1, 0, 'Leiter vom verglasten Raum hinauf aufs Oberdeck.');
  b.step('Geländer auf dem Oberdeck', 'Setze ringsum Kupfergitter als Geländer, mit Laternen an den Ecken.');
  buildRailing(b, g, yUpper + 1, half, Math.max(2, half));
  return yUpper;
}

function buildTop(b, g, yUpper) {
  const yLantern = Math.max(yUpper + 3, g.level(290));
  const yStructure = Math.max(yLantern + Math.max(2, Math.round(3 * g.s)) + 2, g.level(STRUCTURE_TOP_M) - 1);
  const yTop = Math.max(yStructure + 2, g.level(TOTAL_HEIGHT_M) - 1);
  const base = Math.max(1, Math.min(g.half(FLOOR3.side) - 2, Math.round(4 * g.s)));
  b.phase('Turmspitze und Antenne', 'Über dem Oberdeck laufen vier Eckstreben zur Laterne mit dem Leuchtfeuer (eine Seelaterne hinter Glas) zusammen; eine kleine Kuppel aus Fichtentreppen schließt sie ab. Darauf steht der Antennenmast bis auf 330 m. Die genaue Form der Spitze ist geschätzt.', {
    tips: ['Der Mast wechselt alle ' + Math.max(1, Math.round(4 * g.s)) + ' Blöcke zwischen Rot und Weiß – fang ganz oben mit Rot an und zähl nach unten.', 'Stell dir für die Spitze eine Säule aus Gerüsten daneben; oben ist kein Platz zum Stehen.'],
  });
  // Vier Eckstreben laufen von den Ecken zur Laterne zusammen
  for (let y = yUpper + 1; y < yLantern; y++) {
    const t = (y - yUpper) / (yLantern - yUpper);
    const r = Math.max(1, Math.round(base - t * (base - 1)));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) b.set(sx * r, y, sz * r, shadeFor(285));
    if (r > 1 && (y - yUpper) % 3 === 0) {
      for (let u = -r + 1; u < r; u++) {
        for (const [x, z] of [[u, -r], [u, r], [-r, u], [r, u]]) b.set(x, y, z, P.brace);
      }
    }
  }
  // Laterne mit Leuchtfeuer: Glasraum, kleine Kuppel aus Treppen, darüber der Mastfuß
  b.fill(-1, yLantern, -1, 1, yLantern, 1, shadeFor(290));
  const glassTop = yLantern + Math.max(2, Math.round(3 * g.s));
  for (let y = yLantern + 1; y <= glassTop; y++) {
    for (const [x, z] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) b.set(x, y, z, shadeFor(290));
    for (const [x, z] of [[0, -1], [0, 1], [-1, 0], [1, 0]]) b.set(x, y, z, P.glass);
  }
  b.set(0, yLantern + 1, 0, 'sea_lantern');
  const dome = glassTop + 1;
  for (const [x, z, facing] of [[0, -1, 'south'], [0, 1, 'north'], [-1, 0, 'east'], [1, 0, 'west']]) b.stairs(x, dome, z, 'spruce_stairs', { facing });
  for (const [x, z] of [[-1, -1], [-1, 1], [1, -1], [1, 1]]) b.slab(x, dome, z, 'spruce_slab');
  b.set(0, dome, 0, P.dark);
  for (let y = dome + 1; y <= yStructure; y++) b.set(0, y, 0, P.dark);
  // Antennenmast mit rot-weißen Ringen
  const band = Math.max(1, Math.round(4 * g.s));
  for (let y = yStructure + 1; y <= yTop; y++) {
    const fromTop = yTop - y;
    b.set(0, y, 0, Math.floor(fromTop / band) % 2 === 0 ? 'red_concrete' : 'white_concrete');
  }
  b.note(0, yTop, 0, `Spitze: ${TOTAL_HEIGHT_M} m über dem Boden.`);
}

export default function build(b, { scale = 1 } = {}) {
  if (!meta.scales.includes(scale)) throw new Error(`Maßstab ${scale} gibt es für den Eiffelturm nicht (erlaubt: ${meta.scales.join(', ')}).`);
  const g = geometry(scale);
  const levels = panelLevels(g);
  const yDeck1 = g.level(FLOOR1.m) - 1;
  const yDeck2 = g.level(FLOOR2.m) - 1;
  const yDeck3 = g.level(FLOOR3.m) - 1;
  const k0 = g.outer(1);

  b.phase('Gelände und Fundamente', `Der Turm steht auf einer Fläche von ${2 * k0 + 1} × ${2 * k0 + 1} Blöcken. Unter jedem Pfeiler liegt ein Sockel aus poliertem Andesit, dazwischen Sandsteinplatten wie auf dem Champ de Mars.`, {
    tips: [
      'Markiere zuerst die vier Ecken der Grundfläche – sie liegen genau ' + (2 * k0) + ' Blöcke auseinander.',
      'Arbeite bei einem Bau dieser Größe im Kreativmodus mit Flugmodus und /fill.',
    ],
  });
  buildGround(b, g);

  b.phase('Die vier Pfeiler bis zur ersten Etage', `Jeder Pfeiler ist ein hohler Gitterkasten: massive Eckträger in Dunkelbraun (Braune Keramik), dazwischen Gurte und gekreuzte Streben aus gewachsten Kupfergittern. Die Pfeiler neigen sich nach innen – in jeder Ebene rücken Außen- und Innenseite ein Stück zur Mitte.`, {
    tips: [
      'Baue alle vier Pfeiler gleichzeitig Ebene für Ebene; so siehst du sofort, ob die Neigung überall gleich ist.',
      'Die Gurte (volle Reihen) liegen dort, wo beim echten Turm ein neues Feld beginnt.',
      'Die Kupfergitter sind gewachst – so bleiben sie braun und laufen nicht grün an.',
    ],
  });
  for (let y = 1; y < yDeck1; y++) towerLevel(b, g, levels, y);
  b.note(g.outer(1), 1, g.outer(1), 'Außenecke: hier misst der Turm 125 m von Ecke zu Ecke einer Seite.');

  b.phase('Die vier Zierbögen', 'Die Bögen zwischen den Pfeilern tragen nichts – sie machen den Turm zum Eingangstor der Weltausstellung. Ihr Scheitel liegt auf 39 m.', {
    tips: ['Setze erst den inneren Rand des Bogens als Linie, dann den äußeren; die Gitter dazwischen gehen danach schnell.'],
  });
  buildArches(b, g);
  b.note(0, g.level(ARCH.apexM), -g.outer(g.level(ARCH.apexM)), 'Scheitel des Zierbogens auf 39 m.');

  buildFloor1(b, g);

  b.phase('Die Pfeiler bis zur zweiten Etage', 'Über der ersten Etage werden die Pfeiler schmaler und rücken zusammen, bis sie auf der zweiten Etage verschmelzen.', {
    tips: ['Die Eckträger sind hier nur noch zwei Blöcke breit.'],
  });
  for (let y = yDeck1; y < yDeck2; y++) towerLevel(b, g, levels, y);

  buildFloor2(b, g);

  b.phase('Der Turmschaft bis zur dritten Etage', `Ab der zweiten Etage ist der Turm ein einziger Gitterschaft, der sich nach oben verjüngt. Im Inneren laufen die Ketten des Aufzugsschachts mit. Ab 110 m wird das Braun heller (Fester Schlamm), ab 220 m am hellsten (Hellgraue Keramik) – wie beim echten Anstrich, der oben heller ist als unten.`, {
    tips: [
      'Das letzte Feld unter der dritten Etage steht senkrecht – dort ändert sich die Breite nicht mehr.',
      'Prüfe alle 20 Ebenen die Breite mit der Ebenen-Ansicht, damit sich keine Seite verschiebt.',
    ],
  });
  for (let y = yDeck2; y < yDeck3; y++) {
    towerLevel(b, g, levels, y);
  }
  buildShaftCore(b, g, yDeck2 + 1, yDeck3 - 1);

  const yUpper = buildFloor3(b, g);
  buildTop(b, g, yUpper);
}
