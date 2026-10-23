// Prüfrunde Kern/3D: Fehler, die gegen das Spiel (26.2) nachgewiesen und behoben wurden.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { Builder } from '../../js/core/builder.js';
import { getProp } from '../../js/core/blockstate.js';
import { describeState, blockName, blockLabel, setNames } from '../../js/core/describe.js';
import { BlockVolume } from '../../js/core/volume.js';
import { applyConnections, isSturdyFull, isFullSolid } from '../../js/core/connections.js';
import { loadFixtureData } from '../fixtures/core/setup.mjs';

loadFixtureData();

// Gerade Mauerlinie (Ost–West) aus drei Blöcken, auf der mittleren liegt `above`; Ergebnis der mittleren Mauer.
function middleWall(above) {
  const b = new Builder();
  for (let x = 0; x < 3; x++) b.set(x, 0, 0, 'cobblestone_wall');
  b.set(1, 1, 0, above);
  const state = b.finalize().volume.get(1, 0, 0);
  return `${getProp(state, 'east')} ${getProp(state, 'west')} up=${getProp(state, 'up')}`;
}

test('Mauer: Blöcke mit voller Unterseite darüber machen die Seiten tall (WallBlock.isCovered)', () => {
  // Die Kollisionsform an der Unterseite deckt den Arm-Test: untere Stufe/Treppe, Teppich, Laub, Falltür unten, Schnee ab 2 Schichten
  for (const above of ['oak_slab[type=bottom]', 'oak_stairs[facing=north,half=bottom]', 'white_carpet', 'oak_leaves[persistent=true]',
    'oak_trapdoor[half=bottom,open=false]', 'snow[layers=3]', 'farmland']) {
    assert.equal(middleWall(above), 'tall tall up=false', above);
  }
  // Obere Stufe/Treppe, offene Falltür und eine Schneeschicht (ohne Kollision) lassen die Seiten niedrig, ohne Pfosten
  for (const above of ['oak_slab[type=top]', 'oak_stairs[facing=north,half=top]', 'oak_trapdoor[half=bottom,open=true]', 'snow[layers=1]']) {
    assert.equal(middleWall(above), 'low low up=false', above);
  }
});

test('Mauer: Laterne, Kerze, Blumentopf, Kopf, Truhe darüber heben den Pfosten (Mitte bedeckt), hängende Laterne nicht', () => {
  for (const above of ['lantern[hanging=false]', 'candle', 'flower_pot', 'potted_poppy', 'skeleton_skull', 'chest', 'sea_pickle']) {
    assert.equal(middleWall(above), 'low low up=true', above);
  }
  assert.equal(middleWall('lantern[hanging=true]'), 'low low up=false');
});

test('Mauer: Wandschilder und Wandbanner zählen wie im Tag wall_post_override (Pfosten)', () => {
  assert.equal(middleWall('oak_wall_sign[facing=south]'), 'low low up=true');
  assert.equal(middleWall('white_wall_banner[facing=south]'), 'low low up=true');
  assert.equal(middleWall('oak_sign[rotation=0]'), 'low low up=true');
  assert.equal(middleWall('white_banner[rotation=0]'), 'low low up=true');
});

test('Mauer: geschlossenes Zauntor deckt die Arme in seiner Ebene (tall), quer dazu nur die Mitte (Pfosten)', () => {
  // Blick nach Norden: das Tor liegt Ost–West und deckt Ost- und West-Arm
  assert.equal(middleWall('oak_fence_gate[facing=north]'), 'tall tall up=false');
  // Blick nach Osten: das Tor liegt Nord–Süd, deckt nur die Mitte → niedrige Arme mit Pfosten
  assert.equal(middleWall('oak_fence_gate[facing=east]'), 'low low up=true');
  // Offen: keine Kollision
  assert.equal(middleWall('oak_fence_gate[facing=north,open=true]'), 'low low up=false');
});

test('Tresor (vault) ist ein voller Würfel mit stabilen Seiten (VaultBlock ohne eigene Form), aber durchsichtig', () => {
  assert.equal(isSturdyFull('vault'), true);
  assert.equal(isFullSolid('vault'), false);
  const volume = new BlockVolume();
  volume.set(0, 0, 0, 'oak_fence');
  volume.set(1, 0, 0, 'vault');
  applyConnections(volume);
  assert.equal(getProp(volume.get(0, 0, 0), 'east'), 'true');
});

test('Doppeltruhen: Kupfertruhen verbinden sich in jeder Oxidationsstufe (Tag copper_chests), andere nur gleich mit gleich', () => {
  // Direkt über applyConnections: die Test-Blockdaten kennen keine Kupfertruhen
  const volume = new BlockVolume();
  volume.set(0, 0, 0, 'copper_chest[facing=south]');
  volume.set(1, 0, 0, 'exposed_copper_chest[facing=south]');
  volume.set(0, 0, 3, 'waxed_oxidized_copper_chest[facing=south]');
  volume.set(1, 0, 3, 'weathered_copper_chest[facing=south]');
  volume.set(0, 0, 6, 'chest[facing=south]');
  volume.set(1, 0, 6, 'trapped_chest[facing=south]');
  volume.set(0, 0, 9, 'copper_chest[facing=south]');
  volume.set(1, 0, 9, 'chest[facing=south]');
  applyConnections(volume);
  const type = (x, z) => getProp(volume.get(x, 0, z), 'type');
  // Blick nach Süden: Partner im Uhrzeigersinn (Westen) → diese Truhe ist „left“
  assert.deepEqual([type(0, 0), type(1, 0)], ['right', 'left']);
  assert.deepEqual([type(0, 3), type(1, 3)], ['right', 'left']);
  assert.deepEqual([type(0, 6), type(1, 6)], ['single', 'single']);
  assert.deepEqual([type(0, 9), type(1, 9)], ['single', 'single']);
});

test('Beschreibung: stehende Köpfe – rotation 0 = Gesicht nach Norden, Schilder/Banner 0 = Süden', () => {
  const detail = (state) => describeState(state).detail;
  assert.equal(detail('skeleton_skull[rotation=0]'), 'zeigt nach Norden');
  assert.equal(detail('skeleton_skull[rotation=4]'), 'zeigt nach Osten');
  assert.equal(detail('skeleton_skull[rotation=8]'), 'zeigt nach Süden');
  assert.equal(detail('skeleton_skull[rotation=12]'), 'zeigt nach Westen');
  assert.equal(detail('skeleton_skull[rotation=2]'), 'zeigt nach Nordosten');
  // Wandköpfe: facing = Blickrichtung (unverändert)
  assert.equal(detail('skeleton_wall_skull[facing=east]'), 'an der Wand, zeigt nach Osten');
  // Schilder und Banner bleiben bei 0 = Süden, 4 = Westen
  assert.equal(detail('oak_sign[rotation=0]'), 'zeigt nach Süden');
  assert.equal(detail('white_banner[rotation=4]'), 'zeigt nach Westen');
});

test('Namen: Wandbanner ohne eigenen Sprachschlüssel heißen wie das stehende Banner (wie im Spiel)', () => {
  // de_de.json 26.2 hat keinen Schlüssel block.minecraft.<farbe>_wall_banner (16 Blöcke)
  setNames({
    block: { white_banner: { de: 'Weißes Banner', en: 'White Banner' }, wall_torch: { de: 'Wandfackel', en: 'Wall Torch' }, torch: { de: 'Fackel', en: 'Torch' } },
    item: {},
  });
  try {
    assert.equal(blockName('white_wall_banner'), 'Weißes Banner');
    assert.equal(blockLabel('white_wall_banner'), 'Weißes Banner · minecraft:white_wall_banner');
    assert.equal(describeState('white_wall_banner[facing=north]').name, 'Weißes Banner');
    // Eigene Namen haben Vorrang, Unbekanntes bleibt die ID
    assert.equal(blockName('wall_torch'), 'Wandfackel');
    assert.equal(blockName('red_wall_banner'), 'red_wall_banner');
    assert.equal(blockName('cobblestone_wall'), 'cobblestone_wall');
  } finally {
    loadFixtureData();
  }
});
