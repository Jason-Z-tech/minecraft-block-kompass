import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tokenize, extractJsReferences, extractHtmlReferences, extractCssReferences, checkImports, formatError } from '../../scripts/check-imports.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const specs = (refs) => refs.map((ref) => `${ref.kind} ${ref.spec} @${ref.line}`);

test('Tokenizer: Kommentare, Strings, Templates und Regex-Literale verwirren nicht', () => {
  const source = [
    "// import x from './kommentar.js'",
    "/* import('./block.js') */ const a = 'import y from \"./string.js\"';",
    'const re = /["\'`]\\/\\/x/g; const n = 4 / 2 / 1;',
    'const t = `a ${`innen ${1 + 2}`} b`; const plain = `ohne`;',
    "import { z } from './echt.js';",
  ].join('\n');
  const tokens = tokenize(source);
  assert.ok(tokens.some((token) => token.type === 'regex'));
  assert.deepEqual(tokens.filter((token) => token.type === 'string').map((token) => token.value), ['import y from "./string.js"', 'ohne', './echt.js']);
  assert.deepEqual(specs(extractJsReferences(source)), ['import ./echt.js @5']);
  assert.throws(() => tokenize("const s = 'offen\n"), /nicht geschlossen/);
});

test('JS-Verweise: import/export/import()/new URL mit Basis-Variable/Worker/fetch', () => {
  const source = [
    "import './nebenwirkung.js';",
    'import a, {',
    '  b as c,',
    "} from '../core/x.js';",
    "export * from './alles.js';",
    "export * as ns from './ns.js';",
    "export { d } from './d.js';",
    'export const e = 1;',
    "const m = await import('./dyn.js');",
    'const dynamic = await import(`./${name}.js`);',
    "const w = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });",
    "const ROOT_URL = new URL('../../', import.meta.url);",
    "const shapes = new URL('js/create/shape-generators.js', ROOT_URL);",
    "const unknown = new URL('x.js', irgendwas);",
    "fetch('game-data/meta.json'); obj.fetch('nicht.json'); new Worker('alt-worker.js');",
    "import fs from 'node:fs'; import lib from 'paket';",
    'const meta = import.meta.url;',
  ].join('\n');
  assert.deepEqual(specs(extractJsReferences(source)), [
    'import ./nebenwirkung.js @1',
    'import ../core/x.js @4',
    'export ./alles.js @5',
    'export ./ns.js @6',
    'export ./d.js @7',
    'import() ./dyn.js @9',
    'new URL ./worker.js @11',
    'new URL ../../ @12',
    'new URL js/create/shape-generators.js @13',
    'fetch game-data/meta.json @15',
    'new Worker alt-worker.js @15',
    'import node:fs @16',
    'import paket @16',
  ]);
});

test('HTML- und CSS-Verweise mit Zeilennummern, Kommentare zählen nicht', () => {
  const html = '<!doctype html>\n<!-- <script src="weg.js"></script> -->\n<link rel="stylesheet" href="css/style.css">\n<script type="module" src="js/ui/home.js"></script>\n<a href="bau.html?id=x">x</a> <svg><use href="assets/icons.svg#home"/></svg>';
  assert.deepEqual(specs(extractHtmlReferences(html)), ['link href css/style.css @3', 'script src js/ui/home.js @4', 'a href bau.html?id=x @5', 'use href assets/icons.svg#home @5']);
  const css = "/* url(weg.png) */\n@import 'basis.css';\n@font-face { src: url(\"../assets/fonts/a.woff2\") format('woff2'); }\n.x { background: url(data:image/png;base64,AAAA); }";
  assert.deepEqual(specs(extractCssReferences(css)), ['@import basis.css @2', 'url() ../assets/fonts/a.woff2 @3', 'url() data:image/png;base64,AAAA @4']);
});

function writeFixture(dir, files) {
  for (const [name, text] of Object.entries(files)) {
    fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
    fs.writeFileSync(path.join(dir, name), text);
  }
}

test('checkImports: findet falsche Groß-/Kleinschreibung und fehlende Dateien mit Datei:Zeile', () => {
  const dir = path.join(ROOT, 'tmp', `check-imports-test-${process.pid}`);
  fs.rmSync(dir, { recursive: true, force: true });
  try {
    writeFixture(dir, {
      'index.html': '<link rel="stylesheet" href="css/style.css">\n<script type="module" src="js/ui/Home.js"></script>\n<a href="bau.html">x</a>',
      'bau.html': '<script type="module" src="./js/ui/home.js"></script>',
      'css/style.css': '@font-face { src: url(../assets/fonts/A.woff2); }',
      'assets/fonts/a.woff2': 'x',
      'js/ui/home.js': "import { x } from '../core/Volume.js';\nimport { y } from '../core/steps.js';\nimport('../core/fehlt.js');\nfetch('game-data/catalog.json');\nconst w = new Worker(new URL('./worker.js', import.meta.url));\nimport '../core';",
      'js/ui/worker.js': "import '/js/core/steps.js';\nimport '../../../ausserhalb.js';",
      'js/core/volume.js': 'export const x = 1;',
      'js/core/steps.js': 'export const y = 2;',
      'scripts/tool.mjs': "import fs from 'node:fs';\nimport { y } from '../js/Core/steps.js';",
      'tests/unit/a.test.mjs': "import { y } from '../../js/core/steps.js';",
      'tmp/egal.js': "import './gibt-es-nicht.js';",
    });
    const result = checkImports({ root: dir });
    const found = result.errors.map(formatError);
    assert.deepEqual(found, [
      'css/style.css:1: url() „../assets/fonts/A.woff2“ – falsche Groß-/Kleinschreibung: „assets/fonts/A.woff2“ heißt „assets/fonts/a.woff2“',
      'index.html:2: script src „js/ui/Home.js“ – falsche Groß-/Kleinschreibung: „js/ui/Home.js“ heißt „js/ui/home.js“',
      'js/ui/home.js:1: import „../core/Volume.js“ – falsche Groß-/Kleinschreibung: „js/core/Volume.js“ heißt „js/core/volume.js“',
      'js/ui/home.js:3: import() „../core/fehlt.js“ – js/core/fehlt.js existiert nicht',
      'js/ui/home.js:6: import „../core“ – ist ein Ordner, keine Datei',
      'js/ui/worker.js:2: import „../../../ausserhalb.js“ – zeigt aus dem Projektordner heraus',
      'scripts/tool.mjs:2: import „../js/Core/steps.js“ – falsche Groß-/Kleinschreibung: „js/Core“ heißt „js/core“',
    ]);
    assert.equal(result.files, 9, 'tmp/ wird nicht durchsucht');

    const cli = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'check-imports.mjs'), '--root', dir], { encoding: 'utf8' });
    assert.equal(cli.status, 1);
    assert.match(cli.stderr, /js\/ui\/home\.js:1: import „\.\.\/core\/Volume\.js“/);
    assert.match(cli.stderr, /7 Funde/);

    fs.rmSync(path.join(dir, 'js', 'ui', 'worker.js'));
    writeFixture(dir, {
      'index.html': '<script type="module" src="js/ui/home.js"></script>',
      'css/style.css': '',
      'js/ui/home.js': "import { y } from '../core/steps.js';",
      'scripts/tool.mjs': "import { y } from '../js/core/steps.js';",
    });
    const clean = spawnSync(process.execPath, [path.join(ROOT, 'scripts', 'check-imports.mjs'), '--root', dir], { encoding: 'utf8' });
    assert.equal(clean.status, 0, clean.stderr);
    assert.match(clean.stdout, /Alle Verweise in Ordnung/);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});
