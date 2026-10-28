// Tests für js/builds/game-structures.js: Auswahl der Original-Strukturen (ARCHITEKTUR §9).
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import * as gameStructures from '../../js/builds/game-structures.js';
import { CATEGORIES as CHECK_CATEGORIES } from '../../scripts/check-build.mjs';
import { validateStructureDefinition, structureFileName, catalogStructures, sizeClass } from '../../scripts/build-catalog.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const DATA_DIR = path.join(ROOT, 'game-data');
const INDEX_FILE = path.join(DATA_DIR, 'structures', 'index.json');
const NO_DATA = existsSync(INDEX_FILE) ? false : 'game-data/ fehlt (node scripts/extract-game-data.mjs)';
const { GAME_STRUCTURES, GAME_STRUCTURE_DEFAULTS } = gameStructures;
const CATEGORIES = ['haeuser', 'wahrzeichen', 'fantasy', 'mittelalter', 'klein', 'farmen', 'infrastruktur'];

test('Standardwerte: original, ohne Quellen, Mojang als Urheber, tested null', () => {
  assert.equal(GAME_STRUCTURE_DEFAULTS.accuracy, 'original');
  assert.deepEqual(GAME_STRUCTURE_DEFAULTS.sources, []);
  assert.deepEqual(GAME_STRUCTURE_DEFAULTS.credits, { author: 'Mojang Studios', url: 'https://www.minecraft.net/', license: 'Teil von Minecraft Java 26.2' });
  assert.equal(GAME_STRUCTURE_DEFAULTS.tested, null);
  assert.ok(Object.isFrozen(GAME_STRUCTURES) && GAME_STRUCTURES.every(Object.isFrozen));
});

test('Jeder Eintrag ist gültig, IDs, Titel und Vorlagen sind eindeutig', () => {
  assert.ok(GAME_STRUCTURES.length >= 150, `nur ${GAME_STRUCTURES.length} Einträge`);
  for (const def of GAME_STRUCTURES) assert.deepEqual(validateStructureDefinition(def), [], def.id);
  for (const key of ['id', 'title', 'structure']) {
    const values = GAME_STRUCTURES.map((d) => (key === 'title' ? d.title.toLowerCase() : d[key]));
    const dupes = values.filter((v, i) => values.indexOf(v) !== i);
    assert.deepEqual(dupes, [], `doppelt: ${key}`);
  }
  for (const def of GAME_STRUCTURES) assert.ok(CATEGORIES.includes(def.category), def.id);
});

test('Ohne Schwierigkeit und Wissenswertes, ohne Redstone; Texte, Quellen und credits bleiben', () => {
  assert.deepEqual(CHECK_CATEGORIES, CATEGORIES);
  assert.deepEqual(Object.keys(gameStructures).sort(), ['GAME_STRUCTURES', 'GAME_STRUCTURE_DEFAULTS'], 'difficultyForBlocks gibt es nicht mehr');
  for (const def of GAME_STRUCTURES) {
    assert.equal('difficulty' in def, false, `${def.id}: difficulty`);
    assert.equal('facts' in def, false, `${def.id}: facts`);
    assert.notEqual(def.category, 'redstone', def.id);
    for (const key of ['title', 'subtitle', 'description']) assert.ok(typeof def[key] === 'string' && def[key].trim() !== '', `${def.id}: ${key}`);
  }
  assert.equal('difficulty' in GAME_STRUCTURE_DEFAULTS || 'facts' in GAME_STRUCTURE_DEFAULTS, false);
  assert.ok(GAME_STRUCTURE_DEFAULTS.credits && GAME_STRUCTURE_DEFAULTS.sources, 'credits und sources bleiben');
});

test('Texte: Beschreibung mit 2–4 Sätzen, Untertitel kurz, Aliases deutsch/englisch klein geschrieben', () => {
  for (const def of GAME_STRUCTURES) {
    assert.match(def.description, /[.!]$/, `${def.id}: Satzende`);
    const sentences = def.description.split(/(?<=[.!?])\s+(?=[A-ZÄÖÜ„])/).length;
    assert.ok(sentences >= 2 && sentences <= 4, `${def.id}: ${sentences} Sätze`);
    assert.ok(def.description.length <= 600, `${def.id}: Beschreibung zu lang`);
    assert.ok(def.subtitle.length <= 80, `${def.id}: Untertitel zu lang`);
    assert.ok(def.title.length <= 60, `${def.id}: Titel zu lang`);
    assert.ok(def.aliases.length >= 2, `${def.id}: zu wenige Aliases`);
    assert.equal(new Set(def.aliases).size, def.aliases.length, `${def.id}: doppelte Aliases`);
    assert.doesNotMatch(def.description, /TODO|lorem|xxx/i);
  }
});

test('Keine Bruchstücke oder Doppel: keine Zombie-, Verfalls-, Kohle-, Straßen- oder Deko-Vorlagen', () => {
  const banned = /zombie|_degraded$|_coal$|\/streets\/|\/terminators\/|\/decor\/|\/villagers\/|\/animals\/|lamp|\/decays\/|nether_fossils|_halves?$|fronthalf|backhalf|^empty$|well_bottom|igloo\/middle/;
  for (const def of GAME_STRUCTURES) assert.doesNotMatch(def.structure, banned, def.id);
});

test('Dörfer: alle fünf Dorfarten mit Häusern und Dorfplatz, Berufe mit deutschem Spielnamen', () => {
  for (const [biome, name] of [['plains', 'Ebenendorf'], ['desert', 'Wüstendorf'], ['savanna', 'Savannendorf'], ['snowy', 'Schneedorf'], ['taiga', 'Taigadorf']]) {
    const houses = GAME_STRUCTURES.filter((d) => d.structure.startsWith(`village/${biome}/houses/`));
    assert.ok(houses.length >= 20, `${biome}: nur ${houses.length} Häuser`);
    assert.ok(houses.every((d) => d.title.endsWith(`(${name})`)), `${biome}: Titel mit Dorfname`);
    assert.ok(GAME_STRUCTURES.some((d) => d.structure.startsWith(`village/${biome}/town_centers/`) && d.category === 'klein'), `${biome}: Dorfplatz`);
  }
  // de_de.json 26.2: armorer = Panzermacher, mason = Maurer, toolsmith = Grobschmied
  const subtitles = GAME_STRUCTURES.map((d) => d.subtitle).join('\n');
  for (const word of ['des Panzermachers', 'des Maurers', 'des Grobschmieds', 'des Geistlichen', 'des Kartografen', 'des Gerbers']) assert.ok(subtitles.includes(word), word);
  assert.ok(GAME_STRUCTURES.some((d) => d.structure === 'igloo/top'));
  assert.ok(GAME_STRUCTURES.some((d) => d.structure === 'end_city/ship'));
});

describe('Abgleich mit den Spieldaten', { skip: NO_DATA }, () => {
  const index = NO_DATA ? null : new Map(JSON.parse(readFileSync(INDEX_FILE, 'utf8')).structures.map((s) => [s.path, s]));

  test('Alle Vorlagen gibt es in game-data/structures/, keine ist zu klein', () => {
    for (const def of GAME_STRUCTURES) {
      const info = index.get(def.structure);
      assert.ok(info, `${def.id}: ${def.structure} fehlt in index.json`);
      assert.equal(info.file, structureFileName(def.structure));
      assert.ok(existsSync(path.join(DATA_DIR, 'structures', info.file)), `${def.id}: Datei fehlt`);
      assert.ok(info.blocks >= 30, `${def.id}: nur ${info.blocks} Blöcke – zu klein`);
    }
  });

  test('catalogStructures übernimmt alle Einträge ohne Fehler', async () => {
    const { entries, errors } = await catalogStructures(GAME_STRUCTURES, GAME_STRUCTURE_DEFAULTS, { dataDir: DATA_DIR });
    assert.deepEqual(errors, []);
    assert.equal(entries.length, GAME_STRUCTURES.length);
    for (const entry of entries) {
      const info = index.get(GAME_STRUCTURES.find((d) => d.id === entry.id).structure);
      assert.equal(entry.blocks, info.blocks);
      assert.ok(entry.size.every((v, i) => v <= info.size[i]), `${entry.id}: Begrenzung größer als die Vorlage`);
      assert.ok(entry.steps >= 1 && entry.steps <= entry.size[1], `${entry.id}: ${entry.steps} Schritte bei Höhe ${entry.size[1]}`);
      assert.equal(entry.sizeClass, sizeClass(entry.blocks));
      assert.equal(entry.module, null);
      assert.equal(entry.tested, null);
    }
  });

  test('Arbeitsblöcke, Betten und Glocken aus den Beschreibungen stecken wirklich in den Vorlagen', () => {
    const JOB_BLOCKS = { Lesepult: 'lectern', Räucherofen: 'smoker', Kartentisch: 'cartography_table', Braustand: 'brewing_stand', Fass: 'barrel',
      Bognertisch: 'fletching_table', Kessel: 'cauldron', Steinsäge: 'stonecutter', Webstuhl: 'loom', Schmiedetisch: 'smithing_table',
      Schleifstein: 'grindstone', Schmelzofen: 'blast_furnace' };
    for (const def of GAME_STRUCTURES.filter((d) => d.structure.startsWith('village/'))) {
      const data = JSON.parse(readFileSync(path.join(DATA_DIR, 'structures', structureFileName(def.structure)), 'utf8'));
      const ids = new Set(data.palette.map((s) => s.split('[')[0]));
      const job = /^(?:Der|Die|Das) (\S+) im Gebäude macht/.exec(def.description.replace(/^Kommt in \S+ vor\. /, ''));
      if (job) {
        const block = JOB_BLOCKS[job[1]];
        assert.ok(block, `${def.id}: unbekannter Arbeitsblock ${job[1]}`);
        assert.ok(ids.has(block) || (block === 'cauldron' && ids.has('water_cauldron')), `${def.id}: ${block} fehlt`);
      }
      const beds = /Wohnhaus mit (einem|\d+) Bett/.exec(def.description);
      if (beds) {
        const expected = beds[1] === 'einem' ? 1 : Number(beds[1]);
        let bedHeads = 0;
        for (let i = 0; i < data.rle.length; i += 2) {
          const state = data.palette[data.rle[i]];
          if (/_bed\[/.test(state) && state.includes('part=head')) bedHeads += data.rle[i + 1];
        }
        assert.equal(bedHeads, expected, `${def.id}: Zahl der Betten`);
      }
      if (/Glocke/.test(def.subtitle)) assert.ok(ids.has('bell'), `${def.id}: keine Glocke`);
    }
  });
});
