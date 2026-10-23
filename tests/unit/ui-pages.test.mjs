import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CONTENT_SECURITY_POLICY } from '../../scripts/serve.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const PAGES = [
  { file: 'index.html', page: 'home', module: 'js/ui/home.js' },
  { file: 'kategorie.html', page: 'category', module: 'js/ui/category.js' },
  { file: 'bau.html', page: 'build', module: 'js/ui/build-page.js' },
  { file: 'erstellen.html', page: 'create', module: 'js/ui/create-page.js' },
  { file: 'tests/visual/styleguide.html', page: 'styleguide', module: 'tests/visual/styleguide.js' },
];

const read = (file) => readFile(path.join(ROOT, file), 'utf8');

async function exists(file) {
  try {
    return (await stat(file)).isFile();
  } catch {
    return false;
  }
}

function between(html, start, end) {
  const from = html.indexOf(start);
  const to = html.indexOf(end, from);
  assert.ok(from >= 0 && to > from, `Abschnitt ${start} … ${end} fehlt`);
  return html.slice(from, to + end.length);
}

const expectedCsp = CONTENT_SECURITY_POLICY.split('; ').filter((rule) => !rule.startsWith('frame-ancestors')).join('; ');

for (const spec of PAGES) {
  test(`${spec.file}: Grundgerüst, CSP und keine Inline-Skripte oder -Styles`, async () => {
    const html = await read(spec.file);
    assert.match(html, /^<!doctype html>\n<html lang="de">/);
    assert.match(html, /<meta charset="utf-8">/);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
    const csp = /<meta http-equiv="Content-Security-Policy" content="([^"]+)">/.exec(html);
    assert.ok(csp, 'CSP-Meta fehlt');
    assert.equal(csp[1], expectedCsp);
    assert.ok(html.indexOf('Content-Security-Policy') < html.indexOf('<link'), 'CSP muss vor allen Ressourcen stehen');
    assert.match(html, /<title>[^<]{5,}<\/title>/);
    assert.match(html, /<meta name="description" content="[^"]{20,}">/);
    assert.match(html, new RegExp(`<body data-page="${spec.page}">`));
    assert.match(html, /<a class="skip-link" href="#main">/);
    assert.match(html, /<main id="main" tabindex="-1">/);
    assert.match(html, /<noscript>/);
    assert.match(html, /id="toast-region"[^>]*aria-live="polite"/);

    const scripts = [...html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/g)];
    assert.equal(scripts.length, 1, 'genau ein Modul-Skript');
    assert.match(scripts[0][1], /type="module"/);
    assert.match(scripts[0][1], /src="[^"]+"/);
    assert.equal(scripts[0][2].trim(), '', 'kein Inline-Code');
    assert.doesNotMatch(html, /<style\b/i);
    assert.doesNotMatch(html, /\sstyle="/i);
    assert.doesNotMatch(html, /\son[a-z]+\s*=/i);
    assert.doesNotMatch(html, /javascript:/i);
  });

  test(`${spec.file}: alle lokalen Verweise zeigen auf vorhandene Dateien`, async () => {
    const html = await read(spec.file);
    const baseDir = path.dirname(path.join(ROOT, spec.file));
    const refs = [...html.matchAll(/\b(?:href|src)="([^"]+)"/g)].map((m) => m[1]).filter((url) => !url.startsWith('#') && !/^https:/.test(url));
    assert.ok(refs.length > 10);
    for (const ref of refs) {
      assert.doesNotMatch(ref, /^(?:[a-z]+:|\/\/)/i, `nur relative Verweise: ${ref}`);
      const file = path.resolve(baseDir, ref.split(/[?#]/)[0]);
      assert.ok(file.startsWith(ROOT), `Verweis außerhalb des Projekts: ${ref}`);
      assert.ok(await exists(file), `${spec.file}: ${ref} fehlt`);
    }
    const moduleSrc = /<script type="module" src="([^"]+)">/.exec(html)[1];
    assert.equal(path.relative(ROOT, path.resolve(baseDir, moduleSrc)).replaceAll('\\', '/'), spec.module);
  });
}

test('Alle Seiten haben denselben Kopf und Fuß', async () => {
  const pages = await Promise.all(PAGES.map(async (spec) => {
    const html = await read(spec.file);
    // Pfade des Styleguides (tests/visual/) auf die Wurzel zurückrechnen
    const normalized = spec.file.includes('/') ? html.replaceAll('../../', '') : html;
    return {
      file: spec.file,
      header: between(normalized, '<header class="site-header"', '</header>'),
      footer: between(normalized, '<footer class="site-footer"', '</footer>'),
    };
  }));
  for (const page of pages.slice(1)) {
    assert.equal(page.header, pages[0].header, `Kopf von ${page.file} weicht ab`);
    assert.equal(page.footer, pages[0].footer, `Fuß von ${page.file} weicht ab`);
  }
});

test('Die oben im Seitenmodul dokumentierten Container-IDs gibt es im HTML', async () => {
  for (const spec of PAGES.slice(0, 4)) {
    const [html, source] = await Promise.all([read(spec.file), read(spec.module)]);
    const header = source.slice(0, source.indexOf('\nimport '));
    const documented = [...header.matchAll(/#([a-z][a-z0-9-]+)/g)].map((m) => m[1]);
    assert.ok(documented.length >= 4, `${spec.module}: keine IDs dokumentiert`);
    const ids = new Set([...html.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
    for (const id of documented) assert.ok(ids.has(id), `${spec.file}: #${id} fehlt`);
    // Jede verwendete ID ist dokumentiert und vorhanden
    for (const [, id] of source.matchAll(/requireElement\('([^']+)'\)/g)) {
      assert.ok(ids.has(id), `${spec.module} nutzt #${id}, das im HTML fehlt`);
      assert.ok(documented.includes(id), `${spec.module} nutzt #${id}, ohne es oben zu dokumentieren`);
    }
  }
});

test('Schriften: @font-face-Dateien sind echte woff2, Lizenzen und Quellen liegen bei', async () => {
  const css = await read('css/style.css');
  const fontUrls = [...css.matchAll(/url\('\.\.\/(assets\/fonts\/[^']+\.woff2)'\)/g)].map((m) => m[1]);
  assert.ok(fontUrls.length >= 8, 'zu wenige @font-face-Regeln');
  for (const url of new Set(fontUrls)) {
    const data = await readFile(path.join(ROOT, url));
    assert.equal(data.subarray(0, 4).toString('latin1'), 'wOF2', url);
  }
  const faces = [...css.matchAll(/@font-face\s*\{([^}]*)\}/g)].map((m) => m[1]);
  assert.ok(faces.every((face) => /font-display:\s*swap/.test(face)), 'font-display: swap fehlt');
  for (const license of ['pixelify-sans-OFL.txt', 'atkinson-hyperlegible-next-OFL.txt', 'atkinson-hyperlegible-mono-OFL.txt']) {
    assert.match(await read(`assets/fonts/${license}`), /SIL OPEN FONT LICENSE/i, license);
  }
  const sources = await read('assets/fonts/QUELLEN.md');
  for (const url of fontUrls) assert.ok(sources.includes(path.basename(url)), `${url} fehlt in QUELLEN.md`);
  assert.doesNotMatch(css, /fonts\.googleapis|fonts\.gstatic|@import/i, 'keine externen Schriften');
});

test('Logo, Favicon und Muster sind pixelgenaue SVGs ohne Skripte', async () => {
  for (const file of ['assets/logo.svg', 'assets/favicon.svg', 'assets/icons.svg', 'assets/patterns/drip.svg', 'assets/patterns/terrain.svg', 'assets/patterns/deepslate.svg', 'assets/ui/check.svg', 'assets/ui/chevron.svg']) {
    const svg = await read(file);
    assert.match(svg, /^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/, file);
    assert.match(svg, /shape-rendering="crispEdges"/, file);
    assert.doesNotMatch(svg, /<script|on[a-z]+=|javascript:|<foreignObject|style=/i, file);
  }
});
