// Erzeugt kleine Fake-Spieldaten im Aufbau von misode/mcmeta für tests/unit/data-remote.test.mjs (keine Mojang-Dateien:
// alles hier ist ausgedacht, nur Namen und Format folgen dem Spiel). Ordner: <Commit-Schlüssel aus sources.js>/<Pfad im Repo>,
// z. B. summary/version.json oder atlas/blocks/atlas.png. Der Test leitet MCMETA_BASE/<SHA>/<Pfad> hierher um.
// Aufruf: node tests/fixtures/mcmeta-mini/make-fixtures.mjs   (Ergebnis ist eingecheckt)

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { encodePng, createImage } from '../../../js/render/texture-store.js';

const DIR = path.dirname(fileURLToPath(import.meta.url));

// Einfarbige Fläche bzw. Muster im RGBA-Bild
function fill(image, x0, y0, w, h, rgba) {
  for (let y = y0; y < y0 + h; y++) {
    for (let x = x0; x < x0 + w; x++) image.data.set(rgba, (y * image.width + x) * 4);
  }
}

// ------------------------------------------------------------------ Texturen und Atlanten

// Lage im Atlas [x, y, w, h] und Farbe; sea_lantern ist ein Animationsstreifen mit 4 Frames (16×64).
export const BLOCK_SPRITES = {
  'block/stone': { rect: [0, 0, 16, 16], rgba: [120, 120, 120, 255] },
  'block/glass': { rect: [16, 0, 16, 16], rgba: [200, 230, 240, 0], border: [170, 210, 220, 255] },
  'block/oak_planks': { rect: [32, 0, 16, 16], rgba: [160, 120, 70, 255] },
  'block/dirt': { rect: [0, 16, 16, 16], rgba: [120, 85, 60, 255] },
  'block/sea_lantern': { rect: [48, 0, 16, 64], frames: [[170, 200, 190, 255], [180, 210, 200, 255], [190, 220, 210, 255], [200, 230, 220, 255]] },
};
export const ITEM_SPRITES = {
  'item/stick': { rect: [0, 0, 16, 16], rgba: [140, 100, 50, 255] },
  'item/apple': { rect: [16, 0, 16, 16], rgba: [220, 30, 40, 255] },
};
// entity/pig/pig passt auf kein Muster von isIncludedTexture und darf nicht in textures.json landen.
export const ENTITY_SPRITES = {
  'entity/chest/normal': { rect: [0, 0, 32, 32], rgba: [150, 110, 40, 255] },
  'entity/pig/pig': { rect: [32, 0, 32, 16], rgba: [240, 170, 170, 255] },
};

function drawAtlas(width, height, sprites) {
  const image = createImage(width, height);
  for (const sprite of Object.values(sprites)) {
    const [x, y, w, h] = sprite.rect;
    if (sprite.frames) {
      sprite.frames.forEach((rgba, i) => fill(image, x, y + i * 16, w, 16, rgba));
    } else {
      fill(image, x, y, w, h, sprite.rgba);
      if (sprite.border) {
        fill(image, x, y, w, 1, sprite.border);
        fill(image, x, y + h - 1, w, 1, sprite.border);
        fill(image, x, y, 1, h, sprite.border);
        fill(image, x + w - 1, y, 1, h, sprite.border);
      }
    }
  }
  return image;
}

const rects = (sprites) => Object.fromEntries(Object.entries(sprites).map(([name, sprite]) => [name, sprite.rect]));

// ------------------------------------------------------------------ Blöcke, Blockstates, Modelle, Namen

function blockReport() {
  const report = {
    air: [{}, {}],
    stone: [{}, {}],
    glass: [{}, {}],
    oak_planks: [{}, {}],
    sea_lantern: [{}, {}],
    oak_stairs: [
      { facing: ['north', 'south', 'west', 'east'], half: ['top', 'bottom'], shape: ['straight', 'inner_left', 'inner_right', 'outer_left', 'outer_right'], waterlogged: ['true', 'false'] },
      { facing: 'north', half: 'bottom', shape: 'straight', waterlogged: 'false' },
    ],
  };
  // convertMcmetaBlocks verlangt mindestens 500 Blöcke (Schutz vor abgeschnittenen Berichten): ausgedachte Füllblöcke.
  for (let i = 0; i < 500; i++) report[`mini_filler_${String(i).padStart(3, '0')}`] = [{}, {}];
  return report;
}

const cubeAll = (texture) => ({ parent: 'minecraft:block/cube_all', textures: { all: `minecraft:${texture}` } });
const face = (texture, cullface) => (cullface ? { texture, cullface } : { texture });

function blockDefinitions() {
  return {
    stone: { variants: { '': { model: 'minecraft:block/stone' } } },
    glass: { variants: { '': { model: 'minecraft:block/glass' } } },
    oak_planks: { variants: { '': { model: 'minecraft:block/oak_planks' } } },
    sea_lantern: { variants: { '': { model: 'minecraft:block/sea_lantern' } } },
    oak_stairs: {
      variants: Object.fromEntries(['north', 'south', 'west', 'east'].flatMap((facing) => ['top', 'bottom'].map((half) => [
        `facing=${facing},half=${half},shape=straight`,
        { model: 'minecraft:block/oak_stairs', y: { east: 0, south: 90, west: 180, north: 270 }[facing], ...(half === 'top' ? { x: 180 } : {}), uvlock: true },
      ]))),
    },
  };
}

function modelFiles() {
  const sides = ['down', 'up', 'north', 'south', 'west', 'east'];
  return {
    'block/block': {},
    'block/cube': {
      parent: 'block/block',
      elements: [{ from: [0, 0, 0], to: [16, 16, 16], faces: Object.fromEntries(sides.map((side) => [side, face(`#${side}`, side)])) }],
    },
    'block/cube_all': { parent: 'block/cube', textures: { particle: '#all', ...Object.fromEntries(sides.map((side) => [side, '#all'])) } },
    'block/stone': cubeAll('block/stone'),
    'block/glass': cubeAll('block/glass'),
    'block/oak_planks': cubeAll('block/oak_planks'),
    'block/sea_lantern': cubeAll('block/sea_lantern'),
    'block/stairs': {
      parent: 'block/block',
      textures: { particle: '#side' },
      elements: [
        {
          from: [0, 0, 0], to: [16, 8, 16],
          faces: {
            down: face('#bottom', 'down'), up: face('#top'), north: face('#side', 'north'),
            south: face('#side', 'south'), west: face('#side', 'west'), east: face('#side', 'east'),
          },
        },
        {
          from: [8, 8, 0], to: [16, 16, 16],
          faces: {
            up: face('#top', 'up'), north: face('#side', 'north'), south: face('#side', 'south'),
            west: face('#side'), east: face('#side', 'east'),
          },
        },
      ],
    },
    'block/oak_stairs': {
      parent: 'minecraft:block/stairs',
      textures: { bottom: 'minecraft:block/oak_planks', top: 'minecraft:block/oak_planks', side: 'minecraft:block/oak_planks' },
    },
    'item/generated': {},
    'item/stick': { parent: 'minecraft:item/generated', textures: { layer0: 'minecraft:item/stick' } },
  };
}

const LANG_EN = {
  'block.minecraft.stone': 'Stone',
  'block.minecraft.glass': 'Glass',
  'block.minecraft.oak_planks': 'Oak Planks',
  'block.minecraft.oak_stairs': 'Oak Stairs',
  'item.minecraft.stick': 'Stick',
  'block.minecraft.banner.base': 'Fully Field',
  'gui.done': 'Done',
};
const LANG_DE = {
  'block.minecraft.stone': 'Stein',
  'block.minecraft.glass': 'Glas',
  'block.minecraft.oak_planks': 'Eichenholzbretter',
  'block.minecraft.oak_stairs': 'Eichenholztreppe',
  'block.minecraft.sea_lantern': 'Seelaterne',
  'item.minecraft.stick': 'Stock',
  'gui.done': 'Fertig',
};

// ------------------------------------------------------------------ Schreiben

function write(relative, data) {
  const file = path.join(DIR, ...relative.split('/'));
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, data);
  console.log(`${relative.padEnd(70)} ${String(data.length).padStart(7)} Byte`);
}

const json = (value) => JSON.stringify(value);

async function main() {
  write('summary/version.json', JSON.stringify({ id: '26.2', name: '26.2', type: 'release', stable: true, data_version: 4903 }, null, 2));
  write('summary/blocks/data.min.json', json(blockReport()));
  write('summary/assets/block_definition/data.min.json', json(blockDefinitions()));
  write('summary/assets/model/data.min.json', json(modelFiles()));
  write('atlas/blocks/atlas.png', await encodePng(drawAtlas(64, 64, BLOCK_SPRITES)));
  write('atlas/blocks/data.min.json', json(rects(BLOCK_SPRITES)));
  write('atlas/items/atlas.png', await encodePng(drawAtlas(32, 16, ITEM_SPRITES)));
  write('atlas/items/data.min.json', json(rects(ITEM_SPRITES)));
  write('atlas/entities/atlas.png', await encodePng(drawAtlas(64, 32, ENTITY_SPRITES)));
  write('atlas/entities/data.min.json', json(rects(ENTITY_SPRITES)));
  write('assetsJson/assets/minecraft/lang/en_us.json', JSON.stringify(LANG_EN, null, 2));
  // mit BOM wie manche Sprachdateien – fetchJson muss ihn überspringen
  write('assetsJson/assets/minecraft/lang/de_de.json', `﻿${JSON.stringify(LANG_DE, null, 2)}`);
  write('assets/assets/minecraft/textures/block/sea_lantern.png.mcmeta', JSON.stringify({ animation: { frametime: 5 } }, null, 2));
  write('assets/assets/minecraft/textures/block/glass.png.mcmeta', JSON.stringify({ texture: { mipmap_strategy: 'mean' } }, null, 2));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();
