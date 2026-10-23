import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dataTest, createModels, bindFor, loadGameData } from './render-models-fixture.test.mjs';
import { specialKind, specialQuads, fluidOf, fluidHeight, averageCornerHeight, fluidFaces, DYE_COLORS, FLUID_SURFACE } from '../../js/render/special-models.js';
import { parseTextureName } from '../../js/render/texture-store.js';

const PX = 1 / 16;
// Der Truhendeckel ist gegen Flimmern um 1/16 Pixel vergrößert (die Shulkerkiste nicht, siehe unten)
const GROW = PX / 16;
const near = (a, b, eps = 1e-6) => Math.abs(a - b) < eps;

function bounds(quads) {
  const min = [Infinity, Infinity, Infinity];
  const max = [-Infinity, -Infinity, -Infinity];
  for (const q of quads) {
    for (let v = 0; v < 4; v++) {
      for (let a = 0; a < 3; a++) {
        min[a] = Math.min(min[a], q.pos[v * 3 + a]);
        max[a] = Math.max(max[a], q.pos[v * 3 + a]);
      }
    }
  }
  return { min, max };
}

function roundedNormal(quad) {
  return quad.normal.map((v) => Math.round(v));
}

function quadWith(quads, texture) {
  const found = quads.filter((q) => q.texture === texture);
  assert.ok(found.length > 0, `kein Quad mit ${texture}`);
  return found;
}

dataTest('Truhe: 14×14×14 mit Deckel und Verschluss, Verschluss vorne in facing-Richtung', async () => {
  const models = createModels();
  const states = ['north', 'south', 'east', 'west'].map((f) => `chest[facing=${f},type=single,waterlogged=false]`);
  await bindFor(models, states);
  const front = { north: [0, 0, -1], south: [0, 0, 1], east: [1, 0, 0], west: [-1, 0, 0] };
  for (const state of states) {
    const facing = state.match(/facing=(\w+)/)[1];
    const quads = models.quads(state);
    assert.equal(quads.length, 18);
    const lockFront = quadWith(quads, 'region:entity/chest/normal:4,1,2,4');
    assert.deepEqual(roundedNormal(lockFront[0]), front[facing], state);
    const { min, max } = bounds(quads);
    assert.ok(near(max[1], 14 * PX + GROW), `${state}: Höhe ${max[1] * 16}`);
    assert.ok(near(min[1], 0));
    assert.ok(models.quads(state).every((q) => q.layer === 'solid' || q.layer === 'cutout'));
  }
  const north = bounds(models.quads(states[0]));
  assert.ok(near(north.min[0], PX - GROW) && near(north.max[0], 15 * PX + GROW));
  assert.ok(near(north.min[2], 0) && near(north.max[2], 15 * PX + GROW), 'Verschluss ragt nach Norden bis z = 0');
  // Unterteil exakt 14×10×14 (Pixel 1 … 15)
  const bottom = bounds(models.quads(states[0]).filter((q) => q.texture.includes(':14,19,') || q.texture.includes(',33,')));
  assert.ok(near(bottom.min[0], PX) && near(bottom.max[0], 15 * PX) && near(bottom.max[1], 10 * PX));
  assert.equal(models.isOpaqueFullCube(states[0]), false);
  assert.equal(models.renderInfo(states[0]).ao, false);
});

dataTest('Doppeltruhe: linke Hälfte wächst zum Partner im Uhrzeigersinn, rechte gegen; eigene Texturen', async () => {
  const models = createModels();
  const left = 'chest[facing=north,type=left,waterlogged=false]';
  const right = 'chest[facing=north,type=right,waterlogged=false]';
  await bindFor(models, [left, right]);
  const l = bounds(models.quads(left));
  const r = bounds(models.quads(right));
  assert.ok(near(l.max[0], 1 + GROW) && near(l.min[0], PX - GROW), 'links (Partner im Osten) reicht bis x = 1');
  assert.ok(near(r.min[0], -GROW) && near(r.max[0], 15 * PX + GROW), 'rechts (Partner im Westen) reicht bis x = 0');
  // Die Unterteile stoßen ohne Fuge an der Naht zusammen
  const seam = (state, x) => models.quads(state).some((q) => q.texture.includes(',33,') && [0, 3, 6, 9].every((i) => near(q.pos[i], x)));
  assert.ok(seam(left, 1) && seam(right, 0));
  assert.ok(models.quads(left).every((q) => q.texture.startsWith('region:entity/chest/normal_left:')));
  assert.ok(models.quads(right).every((q) => q.texture.startsWith('region:entity/chest/normal_right:')));
});

dataTest('Truhen-Texturen: Falle, Ender, Kupferstufen (gewachst wie ungewachst)', async () => {
  const models = createModels();
  const cases = {
    'trapped_chest[facing=north,type=single,waterlogged=false]': 'entity/chest/trapped',
    'ender_chest[facing=north,waterlogged=false]': 'entity/chest/ender',
    'copper_chest[facing=north,type=single,waterlogged=false]': 'entity/chest/copper',
    'waxed_oxidized_copper_chest[facing=north,type=right,waterlogged=false]': 'entity/chest/copper_oxidized_right',
    'weathered_copper_chest[facing=north,type=single,waterlogged=false]': 'entity/chest/copper_weathered',
  };
  await bindFor(models, Object.keys(cases));
  for (const [state, texture] of Object.entries(cases)) {
    assert.ok(models.quads(state).every((q) => parseTextureName(q.texture).texture === texture), state);
  }
  assert.equal(models.lightEmission('ender_chest'), 7);
});

dataTest('Banner: Stange + Tuch, Tuch in der Grundfarbe, Vorderseite nach rotation (0 = Süden, 4 = Westen)', async () => {
  const models = createModels();
  const states = ['red_banner[rotation=0]', 'red_banner[rotation=4]', 'white_wall_banner[facing=south]', 'blue_wall_banner[facing=east]'];
  await bindFor(models, states);
  const flagFront = 'region:entity/banner/base:1,1,20,40';
  const front0 = quadWith(models.quads(states[0]), flagFront)[0];
  assert.deepEqual(roundedNormal(front0), [0, 0, 1]);
  assert.equal(front0.tint, DYE_COLORS.red);
  assert.deepEqual(roundedNormal(quadWith(models.quads(states[1]), flagFront)[0]), [-1, 0, 0]);
  const standing = bounds(models.quads(states[0]));
  assert.ok(near(standing.max[1], (44 * 2) / 3 / 16, 1e-5), 'Querstange oben auf 44 Modellpixeln × 2/3');
  assert.ok(near(standing.min[1], 0));
  const pole = models.quads(states[0]).filter((q) => q.texture.startsWith('region:entity/banner/banner_base:'));
  assert.equal(pole.length, 12, 'Stange und Querstange je 6 Flächen');
  assert.ok(pole.every((q) => q.tint === -1));
  const wall = models.quads(states[2]);
  assert.deepEqual(roundedNormal(quadWith(wall, flagFront)[0]), [0, 0, 1]);
  assert.equal(quadWith(wall, flagFront)[0].tint, DYE_COLORS.white);
  const wallBounds = bounds(wall);
  assert.ok(wallBounds.min[2] > 0 && wallBounds.max[2] < 0.2, 'Wandbanner hängt an der Nordwand');
  assert.ok(wallBounds.min[1] < -0.9 && wallBounds.max[1] < 0.7, 'Tuch hängt unter den Block');
  assert.ok(wall.every((q) => !q.texture.includes('44,0')), 'Wandbanner ohne Stange');
  assert.deepEqual(roundedNormal(quadWith(models.quads(states[3]), flagFront)[0]), [1, 0, 0]);
});

dataTest('Köpfe: 8×8×8 auf dem Boden, Gesicht nach rotation (8 = Süden wie SkullBlock), Wandköpfe vor der Wand', async () => {
  const models = createModels();
  const states = ['skeleton_skull[powered=false,rotation=8]', 'skeleton_skull[powered=false,rotation=0]', 'skeleton_skull[powered=false,rotation=4]',
    'zombie_wall_head[facing=south,powered=false]', 'player_head[powered=false,rotation=0]'];
  await bindFor(models, states);
  const face = 'region:entity/skeleton/skeleton:8,8,8,8';
  assert.deepEqual(roundedNormal(quadWith(models.quads(states[0]), face)[0]), [0, 0, 1]);
  assert.deepEqual(roundedNormal(quadWith(models.quads(states[1]), face)[0]), [0, 0, -1]);
  assert.deepEqual(roundedNormal(quadWith(models.quads(states[2]), face)[0]), [1, 0, 0]);
  const skull = bounds(models.quads(states[0]));
  assert.deepEqual(skull.min.map((v) => Math.round(v * 16)), [4, 0, 4]);
  assert.deepEqual(skull.max.map((v) => Math.round(v * 16)), [12, 8, 12]);
  const wall = models.quads(states[3]);
  assert.deepEqual(roundedNormal(quadWith(wall, 'region:entity/zombie/zombie:8,8,8,8')[0]), [0, 0, 1]);
  // Nur der Kopf (Textur-Layout links, x < 32); die Hut-Schicht rechts ist 0,25 Pixel größer
  const wallBounds = bounds(wall.filter((q) => parseTextureName(q.texture).x < 32));
  assert.deepEqual(wallBounds.min.map((v) => Math.round(v * 16)), [4, 4, 0]);
  assert.deepEqual(wallBounds.max.map((v) => Math.round(v * 16)), [12, 12, 8]);
  // Spielerkopf mit Hut-Schicht (um 0,25 Pixel größer, cutout)
  const player = models.quads(states[4]);
  assert.equal(player.length, 12);
  const hat = bounds(player.filter((q) => q.layer === 'cutout'));
  assert.ok(near(hat.min[0], 3.75 * PX) && near(hat.max[1], 8.25 * PX));
});

dataTest('Piglin- und Drachenkopf: alle Teile, sinnvolle Größe', async () => {
  const models = createModels();
  const states = ['piglin_head[powered=false,rotation=0]', 'dragon_head[powered=false,rotation=8]', 'dragon_wall_head[facing=east,powered=false]'];
  await bindFor(models, states);
  assert.equal(models.quads(states[0]).length, 36, 'Kopf, Schnauze, 2 Hauer, 2 Ohren');
  const piglin = bounds(models.quads(states[0]));
  assert.ok(near(piglin.min[1], 0) && near(piglin.max[1], 0.5, 0.02));
  assert.equal(models.quads(states[1]).length, 42, 'Oberkiefer, Kopf, 2 Schuppen, 2 Nüstern, Unterkiefer');
  const dragonQuads = models.quads(states[1]);
  const dragon = bounds(dragonQuads);
  // Kopf-Unterseite (Modell-„up“ von upper_head, durch die Spiegelung unten) steht auf dem Boden
  const headBottom = quadWith(dragonQuads, 'region:entity/enderdragon/dragon:144,30,16,16')[0];
  assert.ok(near(headBottom.pos[1], 0, 0.002), `Kopf-Unterseite bei y = ${headBottom.pos[1]}`);
  // Schuppen oben bei 12 Modellpixeln × 0,75 über der Kopfmitte → knapp 15 Pixel
  assert.ok(near(dragon.max[1], 14.99 * PX, 0.002), `oben bei ${dragon.max[1] * 16} Pixeln`);
  // Unterkiefer wie setupAnim um 0,2 rad offen: ragt etwa 2,3 Pixel unter den Block
  assert.ok(dragon.min[1] < -2 * PX && dragon.min[1] > -2.6 * PX, `Kiefer bei ${dragon.min[1] * 16} Pixeln`);
  // Schnauze zeigt in Blickrichtung (rotation 8 = Süden)
  assert.ok(dragon.max[2] > 1.2, 'Schnauze ragt nach Süden über den Block');
  assert.ok(bounds(models.quads(states[2])).max[0] > 1.2, 'Wand-Drachenkopf schaut nach Osten');
});

dataTest('Glocke: Gestell aus JSON plus Glockenkörper aus entity/bell/bell_body', async () => {
  const models = createModels();
  const state = 'bell[attachment=floor,facing=north,powered=false]';
  await bindFor(models, [state]);
  const quads = models.quads(state);
  const body = quads.filter((q) => q.texture.startsWith('region:entity/bell/bell_body:'));
  assert.equal(body.length, 12);
  const b = bounds(body);
  assert.deepEqual(b.min.map((v) => Math.round(v * 16)), [4, 4, 4]);
  assert.deepEqual(b.max.map((v) => Math.round(v * 16)), [12, 13, 12]);
  assert.ok(quads.some((q) => q.texture.startsWith('block/')), 'Gestell aus dem JSON-Modell');
});

dataTest('Verzierter Krug: Hals über dem Block, vier Seiten mit decorated_pot_side', async () => {
  const models = createModels();
  const state = 'decorated_pot[cracked=false,facing=north,waterlogged=false]';
  await bindFor(models, [state]);
  const quads = models.quads(state);
  const sides = quadWith(quads, 'region:entity/decorated_pot/decorated_pot_side:1,0,14,16');
  assert.equal(sides.length, 4);
  assert.deepEqual(sides.map((q) => roundedNormal(q).join()).sort(), ['-1,0,0', '0,0,-1', '0,0,1', '1,0,0']);
  const b = bounds(quads);
  assert.ok(near(b.min[0], PX, 0.02) && near(b.max[0], 15 * PX, 0.02));
  assert.ok(near(b.max[1], 20 * PX, 0.02), `Krug-Hals bis 20 Pixel (${b.max[1] * 16})`);
});

dataTest('Shulkerkiste: Deckel und Unterteil füllen den Block, Drehung nach facing; Farben', async () => {
  const models = createModels();
  const states = ['shulker_box[facing=up]', 'red_shulker_box[facing=down]', 'blue_shulker_box[facing=north]'];
  await bindFor(models, states);
  for (const state of states) {
    const quads = models.quads(state);
    assert.equal(quads.length, 12);
    const b = bounds(quads);
    // Füllt den Block exakt wie im Spiel (kein vergrößerter Deckel: die Zacken müssen genau ineinandergreifen)
    for (let a = 0; a < 3; a++) {
      assert.ok(near(b.min[a], 0) && near(b.max[a], 1), `${state} Achse ${a}: ${b.min[a]} … ${b.max[a]}`);
    }
  }
  assert.ok(models.quads(states[1]).every((q) => q.texture.startsWith('region:entity/shulker/shulker_red:')));
  assert.ok(models.quads(states[0]).every((q) => q.texture.startsWith('region:entity/shulker/shulker:')));
  // Deckel oben (facing=up): Deckel-Oberseite bei y = 1, Unterteil-Boden bei y = 0
  assert.equal(models.quads(states[0]).filter((q) => q.dir === 'up' && near(q.pos[1], 1)).length, 1);
  assert.equal(models.quads(states[0]).filter((q) => q.dir === 'down' && near(q.pos[1], 0)).length, 1);
  const northTop = models.quads(states[2]).filter((q) => q.dir === 'north' && near(q.pos[2], 0));
  assert.equal(northTop.length, 1, 'facing=north: Deckel zeigt nach Norden');
  // Seitenflächen von Deckel und Unterteil liegen auf derselben Ebene (Zacken greifen ineinander)
  const eastSides = models.quads(states[0]).filter((q) => q.dir === 'east');
  assert.equal(eastSides.length, 2);
  assert.ok(eastSides.every((q) => [0, 3, 6, 9].every((i) => near(q.pos[i], 1))), 'Ostseiten von Deckel und Unterteil bei x = 1');
});

dataTest('Aquisitor, Endportal und Endtransitportal', async () => {
  const models = createModels();
  await bindFor(models, ['conduit', 'end_portal', 'end_gateway']);
  const conduit = bounds(models.quads('conduit'));
  assert.deepEqual(conduit.min.map((v) => Math.round(v * 16)), [5, 5, 5]);
  assert.deepEqual(conduit.max.map((v) => Math.round(v * 16)), [11, 11, 11]);
  const portal = models.quads('end_portal');
  assert.deepEqual(portal.map((q) => [q.dir, q.pos[1]]).sort(), [['down', 0.375], ['up', 0.75]]);
  assert.ok(portal.every((q) => q.emissive && q.cull === null && q.layer === 'solid'));
  const gateway = models.quads('end_gateway');
  assert.equal(gateway.length, 6);
  assert.ok(gateway.every((q) => q.cull === q.dir));
});

dataTest('Unsichtbar: Luftarten fehlen im Volumen, light/barrier/structure_void/moving_piston ohne Quads', async () => {
  const models = createModels();
  const states = ['barrier[waterlogged=false]', 'light[level=15,waterlogged=false]', 'structure_void', 'moving_piston'];
  const map = await bindFor(models, states);
  assert.equal(map.size, 0);
  for (const state of states) {
    assert.equal(models.quads(state).length, 0, state);
    assert.equal(models.renderInfo(state).invisible, true);
    assert.equal(models.isOpaqueFullCube(state), false);
  }
  assert.equal(models.lightEmission('light[level=9,waterlogged=false]'), 9);
});

dataTest('Flüssigkeiten: Wasser/Lava/Blasensäule ohne Modell-Quads, wassergeflutete Blöcke mit Wasser', async () => {
  const models = createModels();
  const states = ['water[level=0]', 'lava[level=3]', 'bubble_column[drag=true]', 'oak_stairs[facing=north,half=bottom,shape=straight,waterlogged=true]', 'kelp[age=3]'];
  const map = await bindFor(models, states);
  for (const name of ['block/water_still', 'block/water_flow', 'block/water_overlay', 'block/lava_still', 'block/lava_flow']) assert.ok(map.has(name), name);
  assert.equal(models.quads('water[level=0]').length, 0);
  assert.deepEqual(models.fluidOf('water[level=0]'), { type: 'water', amount: 8, falling: false });
  assert.deepEqual(models.fluidOf('lava[level=3]'), { type: 'lava', amount: 5, falling: false });
  assert.deepEqual(models.fluidOf('water[level=9]'), { type: 'water', amount: 8, falling: true });
  assert.deepEqual(models.fluidOf('bubble_column[drag=true]'), { type: 'water', amount: 8, falling: false });
  assert.equal(models.fluidOf(states[3]).type, 'water');
  assert.ok(models.quads(states[3]).length > 0, 'Treppe selbst bleibt sichtbar');
  assert.equal(models.fluidOf('kelp[age=3]').type, 'water');
  assert.equal(models.fluidOf('oak_stairs[facing=north,half=bottom,shape=straight,waterlogged=false]'), null);
  assert.equal(models.lightEmission('lava[level=0]'), 15);
});

test('Flüssigkeitshöhen wie LiquidBlockRenderer: Quelle 14/16, feste Nachbarn zählen nicht, Luft zieht runter', () => {
  assert.equal(fluidHeight(8), FLUID_SURFACE);
  assert.equal(fluidHeight(4), FLUID_SURFACE / 2);
  assert.equal(averageCornerHeight(FLUID_SURFACE, -1, -1, -1), FLUID_SURFACE);
  assert.equal(averageCornerHeight(FLUID_SURFACE, 1, 0, 0), 1);
  assert.ok(near(averageCornerHeight(FLUID_SURFACE, 0, 0, 0), (FLUID_SURFACE * 10) / 12));
  assert.ok(near(averageCornerHeight(FLUID_SURFACE, FLUID_SURFACE, -1, 0.5), (FLUID_SURFACE * 20 + 0.5) / 21));
  assert.equal(averageCornerHeight(0.5, 0.5, -1, 1), 1);
});

test('Flüssigkeitsflächen: Reihenfolge gegen den Uhrzeigersinn von außen, Seiten-UV wie das Spiel', () => {
  const faces = fluidFaces({
    heights: { nw: 0.875, ne: 0.875, se: 0.875, sw: 0.875 },
    faces: { up: true, down: true, north: true, south: true, west: true, east: true },
    overlay: { east: true },
  });
  assert.deepEqual(faces.map((f) => f.dir), ['up', 'down', 'north', 'south', 'west', 'east']);
  const expected = { up: [0, 1, 0], down: [0, -1, 0], north: [0, 0, -1], south: [0, 0, 1], west: [-1, 0, 0], east: [1, 0, 0] };
  for (const face of faces) {
    const p = face.pos;
    const ax = p[0] - p[3], ay = p[1] - p[4], az = p[2] - p[5];
    const bx = p[6] - p[3], by = p[7] - p[4], bz = p[8] - p[5];
    const n = [by * az - bz * ay, bz * ax - bx * az, bx * ay - by * ax].map((v) => Math.sign(Math.round(v * 1000)) + 0);
    assert.deepEqual(n, expected[face.dir], face.dir);
  }
  const north = faces.find((f) => f.dir === 'north');
  assert.deepEqual(north.uv, [8, 1, 8, 8, 0, 8, 0, 1]);
  assert.equal(faces.find((f) => f.dir === 'east').sprite, 'overlay');
  assert.equal(north.sprite, 'flow');
  assert.ok(near(faces[0].pos[1], 0.875 - 1 / 256));
});

dataTest('Alle Blöcke ohne Elemente sind Sondermodell, unsichtbar oder bekannter Ersatzwürfel', () => {
  const { meta } = loadGameData();
  const fallback = [];
  for (const id of meta.features.blocksWithoutGeometry) {
    if (specialKind(id) === null) fallback.push(id);
  }
  assert.ok(fallback.every((id) => id.endsWith('copper_golem_statue')), `ohne Sondermodell: ${fallback.join(', ')}`);
  assert.equal(fallback.length, 8);
});

dataTest('Regionen der Sondermodelle liegen in ihren Entity-Texturen', () => {
  const { textures, blocks } = loadGameData();
  const states = [];
  for (const id of Object.keys(blocks.blocks)) {
    const kind = specialKind(id);
    if (kind === null || kind === 'invisible' || kind === 'fluid') continue;
    const props = blocks.blocks[id].props;
    const variants = [{ ...blocks.blocks[id].default }];
    for (const key of ['facing', 'type', 'rotation']) {
      if (!props[key]) continue;
      for (const value of props[key]) variants.push({ ...blocks.blocks[id].default, [key]: value });
    }
    for (const variant of variants) states.push([id, variant]);
  }
  let regions = 0;
  for (const [id, props] of states) {
    for (const quad of specialQuads(id, props)) {
      const parsed = parseTextureName(quad.texture);
      assert.notEqual(parsed.kind, 'invalid', quad.texture);
      const entry = textures.entries[parsed.texture];
      assert.ok(entry, `Textur fehlt: ${parsed.texture}`);
      if (parsed.kind === 'region') {
        regions++;
        assert.ok(parsed.x + parsed.w <= entry.w && parsed.y + parsed.h <= entry.h, `${quad.texture} außerhalb ${entry.w}×${entry.h}`);
      }
      for (const value of quad.uv) assert.ok(value >= 0 && value <= 16, `${id}: UV ${value}`);
    }
  }
  assert.ok(regions > 1000, `nur ${regions} Regionen geprüft`);
});
