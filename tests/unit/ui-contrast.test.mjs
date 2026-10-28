// Prüft alle Text/Hintergrund-Paare aus der Kontrasttabelle des Styleguides gegen die Tokens in css/style.css.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { contrastRatio, mixHex, CATEGORY_SLUGS } from '../../js/ui/shared.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

async function readTokens() {
  const css = await readFile(path.join(ROOT, 'css', 'style.css'), 'utf8');
  const rootBlock = /:root\s*\{([\s\S]*?)\n\}/.exec(css)[1];
  const raw = new Map([...rootBlock.matchAll(/(--[a-z0-9-]+):\s*([^;]+);/g)].map((m) => [m[1], m[2].trim()]));
  const resolve = (name, seen = new Set()) => {
    if (seen.has(name)) throw new Error(`Zirkulärer Token ${name}`);
    const value = raw.get(name);
    if (value === undefined) throw new Error(`Token ${name} fehlt`);
    const alias = /^var\((--[a-z0-9-]+)\)$/.exec(value);
    if (alias) return resolve(alias[1], new Set([...seen, name]));
    if (!/^#[0-9a-f]{6}$/i.test(value)) throw new Error(`Token ${name} ist keine Hex-Farbe: ${value}`);
    return value.toLowerCase();
  };
  return resolve;
}

async function readPairs() {
  const html = await readFile(path.join(ROOT, 'tests', 'visual', 'styleguide.html'), 'utf8');
  return [...html.matchAll(/<tr data-fg="([^"]+)" data-bg="([^"]+)" data-min="([^"]+)" data-use="([^"]+)"><\/tr>/g)]
    .map(([, fg, bg, min, use]) => ({ fg, bg, min: Number(min), use: use.replaceAll('&amp;', '&') }));
}

test('Alle Farbpaare erfüllen WCAG AA (Text 4,5 : 1, Grafik 3 : 1)', async (t) => {
  const token = await readTokens();
  const color = (spec) => {
    if (spec.startsWith('#')) return spec;
    const mix = /^mix\((--[a-z0-9-]+),(\d+),(--[a-z0-9-]+)\)$/.exec(spec);
    return mix ? mixHex(token(mix[1]), token(mix[3]), Number(mix[2]) / 100) : token(spec);
  };
  const pairs = await readPairs();
  assert.ok(pairs.length >= 70, `nur ${pairs.length} Paare gefunden`);
  const failures = [];
  for (const pair of pairs) {
    const ratio = contrastRatio(color(pair.fg), color(pair.bg));
    t.diagnostic(`${ratio.toFixed(2).padStart(5)} : 1  (≥ ${pair.min})  ${pair.fg} auf ${pair.bg} – ${pair.use}`);
    if (ratio < pair.min) failures.push(`${pair.fg} auf ${pair.bg}: ${ratio.toFixed(2)} < ${pair.min}`);
  }
  assert.deepEqual(failures, []);
});

test('Die Tabelle enthält jede Text- und Akzentfarbe mindestens einmal', async () => {
  const pairs = await readPairs();
  const used = new Set(pairs.flatMap((pair) => [pair.fg, pair.bg]));
  for (const name of ['--c-text', '--c-text-muted', '--c-placeholder', '--c-link', '--c-on-accent', '--c-grass-text', '--c-copper-text',
    '--c-redstone-text', '--c-oxidized-text', '--c-amethyst-text', '--c-tooltip-text', '--c-tooltip-muted', '--c-xp', '--c-focus', '--c-field-edge']) {
    assert.ok(used.has(name), `${name} wird nicht geprüft`);
  }
  for (const slug of CATEGORY_SLUGS) {
    assert.ok(used.has(`--cat-${slug}`), `Kategorie ${slug} wird nicht geprüft`);
  }
  assert.ok(!pairs.some((pair) => /--cat-redstone/.test(`${pair.fg} ${pair.bg}`)), 'die Kategorie Redstone gibt es nicht mehr');
});
