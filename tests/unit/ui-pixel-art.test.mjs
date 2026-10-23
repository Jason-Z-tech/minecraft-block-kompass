import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { renderAll } from '../../assets/pixel-art/build.mjs';
import { ICONS } from '../../assets/pixel-art/art.mjs';

const ASSETS = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'assets');

test('Die SVG-Dateien entsprechen den ASCII-Quellen (sonst: node assets/pixel-art/build.mjs)', async () => {
  const rendered = renderAll();
  assert.ok(Object.keys(rendered).length >= 8);
  for (const [file, content] of Object.entries(rendered)) {
    assert.equal(await readFile(path.join(ASSETS, file), 'utf8'), content, `${file} ist nicht aktuell`);
  }
});

test('Alle Icon-Raster sind 16 × 16 und nutzen nur bekannte Zeichen', () => {
  for (const [name, grid] of Object.entries(ICONS)) {
    assert.equal(grid.length, 16, name);
    for (const row of grid) {
      assert.equal(row.length, 16, `${name}: ${row}`);
      assert.match(row, /^[.#%+o]+$/, `${name}: ${row}`);
    }
  }
});
