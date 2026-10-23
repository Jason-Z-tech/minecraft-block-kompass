import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isSafeUrl, isSafeSitePath, sitePath, el, svgEl, clear, setChildren } from '../../js/ui/dom.js';

// Minimales Fake-DOM: reicht, um el()/svgEl() ohne Browser zu prüfen
class FakeText {
  constructor(text) {
    this.nodeType = 3;
    this.textContent = text;
  }
}

class FakeElement {
  constructor(tagName, namespaceURI = null) {
    this.nodeType = 1;
    this.tagName = tagName;
    this.namespaceURI = namespaceURI;
    this.attributes = new Map();
    this.childNodes = [];
    this.dataset = {};
    this.listeners = [];
  }

  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.has(name) ? this.attributes.get(name) : null; }
  addEventListener(type, handler) { this.listeners.push([type, handler]); }
  append(...nodes) { this.childNodes.push(...nodes); }
  replaceChildren(...nodes) { this.childNodes = nodes; }
}

globalThis.document = {
  createElement: (tag) => new FakeElement(tag),
  createElementNS: (namespace, tag) => new FakeElement(tag, namespace),
  createTextNode: (text) => new FakeText(text),
};

const LF = String.fromCharCode(10);
const TAB = String.fromCharCode(9);
const NUL = String.fromCharCode(0);

test('isSafeUrl erlaubt relative Pfade, Anker, Abfragen und https', () => {
  for (const url of ['bau.html?id=tokyo-skytree', '/assets/icons.svg#home', '#main', '?q=turm', 'thumbs/turm.webp',
    '../index.html', 'https://de.wikipedia.org/wiki/Tokyo_Skytree', '  bau.html  ']) {
    assert.equal(isSafeUrl(url), true, url);
  }
});

test('isSafeUrl blockt javascript:, fremde Schemata und Tricks mit Leer- und Steuerzeichen', () => {
  const blocked = [
    'javascript:alert(1)', 'JavaScript:alert(1)', ' javascript:alert(1)', `java${LF}script:alert(1)`, `java${TAB}script:alert(1)`,
    'vbscript:msgbox(1)', 'data:text/html,<script>alert(1)</script>', 'http://example.com/', 'file:///C:/Windows/win.ini',
    '//evil.example/x', '/\\evil.example/x', '\\\\evil.example\\x', 'https:', 'https://', `bau.html${NUL}`, '', '   ',
    'blob:http://127.0.0.1/abc', 'data:image/png;base64,AAAA',
  ];
  for (const url of blocked) assert.equal(isSafeUrl(url), false, JSON.stringify(url));
  for (const value of [null, undefined, 42, {}, ['bau.html']]) assert.equal(isSafeUrl(value), false);
  assert.equal(isSafeUrl(`a/${'x'.repeat(3000)}`), false, 'zu lang');
});

test('isSafeUrl mit allowImageData erlaubt nur Rasterbilder als data: und blob:', () => {
  assert.equal(isSafeUrl('data:image/png;base64,iVBORw0KGgo=', { allowImageData: true }), true);
  assert.equal(isSafeUrl('data:image/webp;base64,UklGRg==', { allowImageData: true }), true);
  assert.equal(isSafeUrl(`data:image/png;base64,${'A'.repeat(100_000)}`, { allowImageData: true }), true, 'große Bilder');
  assert.equal(isSafeUrl('blob:http://127.0.0.1:8080/0f1c2d3e', { allowImageData: true }), true);
  assert.equal(isSafeUrl('data:image/svg+xml;base64,PHN2Zz4=', { allowImageData: true }), false, 'SVG kann Skripte enthalten');
  assert.equal(isSafeUrl('data:image/png;base64,AAA<script>', { allowImageData: true }), false);
  assert.equal(isSafeUrl('data:text/html;base64,PGgxPg==', { allowImageData: true }), false);
  assert.equal(isSafeUrl('javascript:alert(1)', { allowImageData: true }), false);
});

test('isSafeSitePath akzeptiert nur Pfade innerhalb der Webseite', () => {
  for (const ok of ['game-data/catalog.json', 'bau.html?id=a1', 'assets/icons.svg', 'kategorie.html?k=redstone#liste']) assert.equal(isSafeSitePath(ok), true, ok);
  for (const bad of ['../secret.json', 'a/../../b', './x', '/x', 'https://x/y', 'javascript:alert(1)', 'a/%2e%2e/b', '', 'a\\b', 'a b', '?q=x', 42]) {
    assert.equal(isSafeSitePath(bad), false, String(bad));
  }
});

test('sitePath rechnet ab der Website-Wurzel und lehnt Ausbrüche ab', () => {
  const root = new URL('http://127.0.0.1:8080/');
  assert.equal(sitePath('erstellen.html?q=Burg%20am%20See', root), '/erstellen.html?q=Burg%20am%20See');
  assert.equal(sitePath('assets/icons.svg#home', new URL('http://h/unter/ordner/')), '/unter/ordner/assets/icons.svg#home');
  assert.throws(() => sitePath('../etc/passwd', root), TypeError);
  assert.throws(() => sitePath('https://evil.example/', root), TypeError);
});

test('el setzt Text immer als Textknoten (kein HTML)', () => {
  const node = el('p', null, '<img src=x onerror=alert(1)>', 42, null, false, undefined, ['a', ['b']]);
  assert.equal(node.tagName, 'p');
  assert.deepEqual(node.childNodes.map((child) => [child.nodeType, child.textContent]), [
    [3, '<img src=x onerror=alert(1)>'], [3, '42'], [3, 'a'], [3, 'b'],
  ]);
});

test('el: Klassen, dataset, boolesche Attribute und Ereignisse', () => {
  const handler = () => {};
  const node = el('button', { class: ['btn', false, 'btn--primary', null], dataset: { category: 'redstone', skip: null }, disabled: true, hidden: false, type: 'button', 'aria-label': 'Los', on: { click: handler } });
  assert.equal(node.getAttribute('class'), 'btn btn--primary');
  assert.deepEqual(node.dataset, { category: 'redstone' });
  assert.equal(node.getAttribute('disabled'), '');
  assert.equal(node.getAttribute('hidden'), null);
  assert.equal(node.getAttribute('aria-label'), 'Los');
  assert.deepEqual(node.listeners, [['click', handler]]);
});

test('el verbietet Event-Attribute, style, unsichere Adressen und gefährliche Elemente', () => {
  assert.throws(() => el('div', { onclick: 'alert(1)' }), /Event-Attribute/);
  assert.throws(() => el('div', { OnMouseOver: 'x' }), /Event-Attribute/);
  assert.throws(() => el('div', { style: 'color:red' }), /verboten/);
  assert.throws(() => el('iframe', { srcdoc: '<p>' }), /darf nicht/);
  assert.throws(() => el('a', { href: 'javascript:alert(1)' }), /Unsichere Adresse/);
  assert.throws(() => el('img', { src: 'http://evil.example/x.png' }), /Unsichere Adresse/);
  assert.throws(() => el('a', { href: 'data:image/png;base64,AAAA' }), /Unsichere Adresse/, 'data: nur für <img src>');
  assert.throws(() => el('img', { srcset: 'a.png 1x, javascript:alert(1) 2x' }), /srcset/);
  assert.throws(() => el('form', { action: '//evil.example/' }), /Unsichere Adresse/);
  for (const tag of ['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'base']) assert.throws(() => el(tag), /darf nicht/, tag);
  assert.throws(() => el('DIV'), /Ungültiger Elementname/);
  assert.throws(() => el('div', { 'x y': '1' }), /Ungültiger Attributname/);
  assert.throws(() => el('div', { title: { toString: () => 'x' } }), /nur Text/);
  assert.throws(() => el('div', { on: { click: 'alert(1)' } }), /Funktion erwartet/);
  assert.throws(() => el('div', null, { nodeName: 'kein Knoten' }), /Kindelemente/);
  assert.equal(el('img', { src: 'data:image/png;base64,iVBORw0KGgo=' }).getAttribute('src'), 'data:image/png;base64,iVBORw0KGgo=');
  assert.equal(el('a', { href: 'bau.html?id=turm' }).getAttribute('href'), 'bau.html?id=turm');
});

test('svgEl erlaubt nur harmlose SVG-Elemente', () => {
  const use = svgEl('use', { href: '/assets/icons.svg#home' });
  assert.equal(use.namespaceURI, 'http://www.w3.org/2000/svg');
  assert.equal(use.getAttribute('href'), '/assets/icons.svg#home');
  for (const tag of ['script', 'foreignObject', 'animate', 'set', 'a', 'style']) assert.throws(() => svgEl(tag), /nicht erlaubt/, tag);
  assert.throws(() => svgEl('use', { href: 'javascript:alert(1)' }), /Unsichere Adresse/);
});

test('clear und setChildren ersetzen Inhalte, setChildren überspringt null', () => {
  const node = el('div', null, 'alt');
  assert.equal(clear(node), node);
  assert.equal(node.childNodes.length, 0);
  setChildren(node, null, 'neu', false, el('span'));
  assert.deepEqual(node.childNodes.map((child) => child.nodeType), [3, 1]);
  assert.equal(node.childNodes[0].textContent, 'neu');
});
