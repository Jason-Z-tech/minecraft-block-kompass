// Prüft alle statisch erkennbaren lokalen Verweise, ob die Zieldatei mit exakt gleicher Groß-/Kleinschreibung
// existiert (unter Linux, z. B. in der Cloud, entscheidend; Windows verzeiht falsche Schreibweisen).
// Geprüft: JS/MJS in js/, scripts/, tests/ (import … from, export … from, import(), new URL('…', import.meta.url)
// samt daraus gebildeter Basis-Variablen, new Worker('…'), fetch('…')), HTML-Seiten (src/href) und CSS (url(), @import).
// fetch('…') und new Worker('…') gelten relativ zur Seite: für js/ die Projektwurzel (alle Seiten liegen dort),
// sonst der Ordner der Datei. Erzeugte Ordner (game-data/, thumbs/, tmp/) werden nicht geprüft.
// Aufruf: node scripts/check-imports.mjs [--root <ordner>]   Exit-Code 1 bei Funden.

import fs from 'node:fs';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { fileURLToPath, pathToFileURL } from 'node:url';

const DEFAULT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SCAN = [
  { dir: 'js', exts: ['.js', '.mjs'] },
  { dir: 'scripts', exts: ['.js', '.mjs'] },
  { dir: 'tests', exts: ['.js', '.mjs', '.html', '.css'] },
  { dir: 'css', exts: ['.css'] },
  { dir: '.', exts: ['.html'], recursive: false },
];
const SKIP_DIRS = new Set(['.git', 'node_modules', 'game-data', 'thumbs', 'tmp']);
const GENERATED_TOP = new Set(['game-data', 'thumbs', 'tmp']);

// ---------------------------------------------------------------------------------------------
// JavaScript-Tokenizer (genug für Verweise: Kommentare, Strings, Template-Literale, Regex-Literale)

const REGEX_AFTER_PUNCT = new Set(['(', ',', '=', ':', '[', '!', '&', '|', '?', '{', '}', ';', '+', '-', '*', '%', '<', '>', '~', '^']);
const REGEX_AFTER_WORD = new Set(['return', 'typeof', 'instanceof', 'in', 'of', 'new', 'delete', 'void', 'throw', 'case', 'do', 'else', 'yield', 'await']);
const IDENT_START = /[\p{ID_Start}$_]/u;
const IDENT_PART = /[\p{ID_Continue}$‌‍]/u;
const ESCAPES = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', 0: '\0' };

// → [{ type: 'ident'|'string'|'template'|'regex'|'number'|'punct', value, line }]
// 'string' = Strings und Template-Literale ohne ${…}; 'template' = mit ${…} (nicht statisch).
export function tokenize(source) {
  const tokens = [];
  const stack = []; // 'brace' | 'template'
  let i = 0;
  let line = 1;
  const push = (type, value, tokenLine) => tokens.push({ type, value, line: tokenLine });
  const last = () => tokens[tokens.length - 1];

  if (source.startsWith('#!')) while (i < source.length && source[i] !== '\n') i++;

  // Liest ein Template-Literal ab i (nach ` oder nach dem } eines ${…}); hält bei ` oder ${ an.
  function readTemplatePart(startLine, firstPart) {
    let value = '';
    while (i < source.length) {
      const ch = source[i];
      if (ch === '\\') {
        value += ESCAPES[source[i + 1]] ?? source[i + 1];
        if (source[i + 1] === '\n') line++;
        i += 2;
      } else if (ch === '`') {
        i++;
        push(firstPart ? 'string' : 'template', value, startLine);
        return;
      } else if (ch === '$' && source[i + 1] === '{') {
        i += 2;
        if (firstPart) push('template', value, startLine);
        stack.push('template');
        return;
      } else {
        if (ch === '\n') line++;
        value += ch;
        i++;
      }
    }
    throw new Error(`Template-Literal ab Zeile ${startLine} wird nicht geschlossen.`);
  }

  while (i < source.length) {
    const ch = source[i];
    if (ch === '\n') { line++; i++; continue; }
    if (/\s/.test(ch)) { i++; continue; }
    if (ch === '/' && source[i + 1] === '/') {
      while (i < source.length && source[i] !== '\n') i++;
      continue;
    }
    if (ch === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2);
      if (end < 0) throw new Error(`Kommentar ab Zeile ${line} wird nicht geschlossen.`);
      for (let k = i; k < end; k++) if (source[k] === '\n') line++;
      i = end + 2;
      continue;
    }
    if (ch === '"' || ch === "'") {
      const startLine = line;
      let value = '';
      i++;
      while (i < source.length && source[i] !== ch) {
        if (source[i] === '\n') throw new Error(`String in Zeile ${startLine} wird nicht geschlossen.`);
        if (source[i] === '\\') {
          if (source[i + 1] === '\n') line++;
          else value += ESCAPES[source[i + 1]] ?? source[i + 1];
          i += 2;
        } else {
          value += source[i++];
        }
      }
      if (i >= source.length) throw new Error(`String in Zeile ${startLine} wird nicht geschlossen.`);
      i++;
      push('string', value, startLine);
      continue;
    }
    if (ch === '`') {
      i++;
      readTemplatePart(line, true);
      continue;
    }
    if (ch === '}' && stack.at(-1) === 'template') {
      stack.pop();
      i++;
      readTemplatePart(line, false);
      continue;
    }
    if (ch === '/') {
      const prev = last();
      const regexAllowed = !prev || (prev.type === 'punct' && REGEX_AFTER_PUNCT.has(prev.value)) || (prev.type === 'ident' && REGEX_AFTER_WORD.has(prev.value));
      if (regexAllowed) {
        const startLine = line;
        let inClass = false;
        i++;
        while (i < source.length) {
          const c = source[i];
          if (c === '\n') throw new Error(`Regex-Literal in Zeile ${startLine} wird nicht geschlossen.`);
          if (c === '\\') { i += 2; continue; }
          if (c === '[') inClass = true;
          else if (c === ']') inClass = false;
          else if (c === '/' && !inClass) break;
          i++;
        }
        i++;
        while (i < source.length && /[a-z]/i.test(source[i])) i++;
        push('regex', '', startLine);
        continue;
      }
    }
    if (IDENT_START.test(ch) || ch === '\\') {
      let value = '';
      while (i < source.length && (IDENT_PART.test(source[i]) || source[i] === '\\')) value += source[i++];
      push('ident', value, line);
      continue;
    }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(source[i + 1] ?? ''))) {
      let value = '';
      while (i < source.length && /[0-9a-zA-Z_.]/.test(source[i])) value += source[i++];
      push('number', value, line);
      continue;
    }
    if (ch === '{') stack.push('brace');
    if (ch === '}') stack.pop();
    push('punct', ch, line);
    i++;
  }
  return tokens;
}

// ---------------------------------------------------------------------------------------------
// Verweise finden

const isPunct = (token, value) => token?.type === 'punct' && token.value === value;
const isIdent = (token, value) => token?.type === 'ident' && token.value === value;
const isString = (token) => token?.type === 'string';

// Passt t[i…] auf „import . meta . url“?
const isImportMetaUrl = (t, i) => isIdent(t[i], 'import') && isPunct(t[i + 1], '.') && isIdent(t[i + 2], 'meta') && isPunct(t[i + 3], '.') && isIdent(t[i + 4], 'url');

// → [{ spec, line, kind, base }]  base: 'module' (relativ zur Datei) | 'page' | { variable }
export function extractJsReferences(source) {
  const t = tokenize(source);
  const refs = [];
  const bases = new Map(); // Variable → Verweis, aus dem sie entstand
  for (let i = 0; i < t.length; i++) {
    const token = t[i];
    if (token.type !== 'ident' || isPunct(t[i - 1], '.')) continue;

    if (token.value === 'import') {
      const next = t[i + 1];
      if (isString(next)) refs.push({ spec: next.value, line: next.line, kind: 'import', base: 'module' });
      else if (isPunct(next, '(')) {
        if (isString(t[i + 2]) && (isPunct(t[i + 3], ')') || isPunct(t[i + 3], ','))) refs.push({ spec: t[i + 2].value, line: t[i + 2].line, kind: 'import()', base: 'module' });
      } else if (!isPunct(next, '.')) {
        for (let j = i + 1; j < t.length && j < i + 500; j++) {
          if (isIdent(t[j], 'from') && isString(t[j + 1])) {
            refs.push({ spec: t[j + 1].value, line: t[j + 1].line, kind: 'import', base: 'module' });
            break;
          }
          if (isPunct(t[j], ';') || isString(t[j]) || isPunct(t[j], '=') || isPunct(t[j], '(')) break;
        }
      }
    } else if (token.value === 'export') {
      let j = i + 1;
      if (isPunct(t[j], '*')) {
        j++;
        if (isIdent(t[j], 'as')) j += 2;
      } else if (isPunct(t[j], '{')) {
        while (j < t.length && !isPunct(t[j], '}')) j++;
        j++;
      } else {
        continue;
      }
      if (isIdent(t[j], 'from') && isString(t[j + 1])) refs.push({ spec: t[j + 1].value, line: t[j + 1].line, kind: 'export', base: 'module' });
    } else if (token.value === 'new' && isIdent(t[i + 1], 'URL') && isPunct(t[i + 2], '(') && isString(t[i + 3]) && isPunct(t[i + 4], ',')) {
      const spec = t[i + 3];
      let ref = null;
      if (isImportMetaUrl(t, i + 5) && isPunct(t[i + 10], ')')) ref = { spec: spec.value, line: spec.line, kind: 'new URL', base: 'module' };
      else if (t[i + 5]?.type === 'ident' && isPunct(t[i + 6], ')') && bases.has(t[i + 5].value)) {
        ref = { spec: spec.value, line: spec.line, kind: 'new URL', base: { variable: bases.get(t[i + 5].value) } };
      }
      if (ref) {
        refs.push(ref);
        // „const X = new URL('../../', import.meta.url)“ → X dient später als Basis.
        if (isPunct(t[i - 1], '=') && t[i - 2]?.type === 'ident' && ['const', 'let', 'var'].includes(t[i - 3]?.value)) bases.set(t[i - 2].value, ref);
      }
    } else if (token.value === 'Worker' && isIdent(t[i - 1], 'new') && isPunct(t[i + 1], '(') && isString(t[i + 2])) {
      refs.push({ spec: t[i + 2].value, line: t[i + 2].line, kind: 'new Worker', base: 'page' });
    } else if (token.value === 'fetch' && isPunct(t[i + 1], '(') && isString(t[i + 2])) {
      refs.push({ spec: t[i + 2].value, line: t[i + 2].line, kind: 'fetch', base: 'page' });
    }
  }
  return refs;
}

function lineAt(text, index) {
  let line = 1;
  for (let k = 0; k < index; k++) if (text.charCodeAt(k) === 10) line++;
  return line;
}

// Kommentare durch Leerzeichen ersetzen (Zeilenumbrüche bleiben, damit Zeilennummern stimmen).
const blankOut = (text, pattern) => text.replace(pattern, (match) => match.replace(/[^\n]/g, ' '));

export function extractHtmlReferences(html) {
  const text = blankOut(html, /<!--[\s\S]*?-->/g);
  const refs = [];
  const pattern = /<(script|link|img|a|source|iframe|use|image)\b[^>]*?\s(src|href|xlink:href)\s*=\s*(["'])(.*?)\3/gis;
  for (const match of text.matchAll(pattern)) {
    refs.push({ spec: match[4], line: lineAt(text, match.index + match[0].lastIndexOf(match[4])), kind: `${match[1].toLowerCase()} ${match[2]}`, base: 'module' });
  }
  return refs;
}

export function extractCssReferences(css) {
  const text = blankOut(css, /\/\*[\s\S]*?\*\//g);
  const refs = [];
  for (const match of text.matchAll(/url\(\s*(["']?)([^"')]+?)\1\s*\)|@import\s+(["'])([^"']+)\3/g)) {
    const spec = match[2] ?? match[4];
    refs.push({ spec, line: lineAt(text, match.index), kind: match[2] ? 'url()' : '@import', base: 'module' });
  }
  return refs;
}

// ---------------------------------------------------------------------------------------------
// Auflösen und Prüfen

// Nur lokale, relative oder wurzel-relative Verweise; Pakete (node:…, bare), http(s):, data: usw. nicht.
function isLocalSpec(spec, kind) {
  if (spec === '' || spec.startsWith('#') || spec.startsWith('//')) return false;
  if (/^[a-z][a-z0-9+.-]*:/i.test(spec)) return false;
  if (kind === 'import' || kind === 'export' || kind === 'import()') return spec.startsWith('./') || spec.startsWith('../') || spec.startsWith('/');
  return true;
}

function resolveReference(ref, file, root) {
  const rootUrl = pathToFileURL(`${root}${path.sep}`);
  let base;
  if (ref.base === 'module') base = pathToFileURL(file);
  else if (ref.base === 'page') base = path.relative(root, file).split(path.sep)[0] === 'js' ? rootUrl : pathToFileURL(file);
  else base = resolveReference(ref.base.variable, file, root);
  if (!base) return null;
  // Wurzel-relative Pfade („/js/…“) meinen die Website-Wurzel = Projektordner.
  const url = ref.spec.startsWith('/') ? new URL(`.${ref.spec}`, rootUrl) : new URL(ref.spec, base);
  url.search = '';
  url.hash = '';
  return url;
}

function createFsIndex() {
  const listings = new Map();
  const list = (dir) => {
    if (!listings.has(dir)) {
      let names = null;
      try {
        names = fs.readdirSync(dir);
      } catch (error) {
        if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') throw error;
      }
      listings.set(dir, names);
    }
    return listings.get(dir);
  };
  // → { ok: true, isDirectory } | { ok: false, message }
  return function lookup(root, target) {
    const parts = path.relative(root, target).split(path.sep).filter(Boolean);
    let dir = root;
    for (let k = 0; k < parts.length; k++) {
      const names = list(dir);
      const shown = parts.slice(0, k + 1).join('/');
      if (!names) return { ok: false, message: `${parts.slice(0, k).join('/')} ist kein Ordner` };
      if (!names.includes(parts[k])) {
        const similar = names.find((name) => name.toLowerCase() === parts[k].toLowerCase());
        if (similar) return { ok: false, message: `falsche Groß-/Kleinschreibung: „${shown}“ heißt „${[...parts.slice(0, k), similar].join('/')}“` };
        return { ok: false, message: `${shown} existiert nicht` };
      }
      dir = path.join(dir, parts[k]);
    }
    return { ok: true, isDirectory: fs.statSync(dir).isDirectory() };
  };
}

function collectFiles(root) {
  const files = [];
  const walk = (dir, exts, recursive) => {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch (error) {
      if (error.code === 'ENOENT') return;
      throw error;
    }
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (recursive && !SKIP_DIRS.has(entry.name)) walk(full, exts, recursive);
      } else if (exts.includes(path.extname(entry.name).toLowerCase())) {
        files.push(full);
      }
    }
  };
  for (const { dir, exts, recursive = true } of SCAN) walk(path.join(root, dir), exts, recursive);
  return [...new Set(files)].sort();
}

function extractReferences(file, text) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.html') return extractHtmlReferences(text);
  if (ext === '.css') return extractCssReferences(text);
  return extractJsReferences(text);
}

// → { files, references, errors: [{ file, line, spec, kind, message }] }  (file relativ zu root, mit „/“)
export function checkImports({ root = DEFAULT_ROOT } = {}) {
  const absoluteRoot = path.resolve(root);
  const lookup = createFsIndex();
  const errors = [];
  let references = 0;
  const files = collectFiles(absoluteRoot);
  for (const file of files) {
    const relFile = path.relative(absoluteRoot, file).split(path.sep).join('/');
    let refs;
    try {
      refs = extractReferences(file, fs.readFileSync(file, 'utf8'));
    } catch (error) {
      errors.push({ file: relFile, line: 1, spec: '', kind: 'parse', message: `nicht lesbar: ${error.message}` });
      continue;
    }
    for (const ref of refs) {
      if (!isLocalSpec(ref.spec, ref.kind)) continue;
      const url = resolveReference(ref, file, absoluteRoot);
      const target = fileURLToPath(url);
      const rel = path.relative(absoluteRoot, target);
      if (rel.startsWith('..') || path.isAbsolute(rel)) {
        errors.push({ file: relFile, line: ref.line, spec: ref.spec, kind: ref.kind, message: 'zeigt aus dem Projektordner heraus' });
        continue;
      }
      if (GENERATED_TOP.has(rel.split(path.sep)[0])) continue;
      references++;
      const found = lookup(absoluteRoot, target);
      const wantsDirectory = url.pathname.endsWith('/');
      let message = found.ok ? null : found.message;
      if (found.ok && found.isDirectory && !wantsDirectory && ref.kind !== 'a href') message = 'ist ein Ordner, keine Datei';
      if (message) errors.push({ file: relFile, line: ref.line, spec: ref.spec, kind: ref.kind, message });
    }
  }
  return { files: files.length, references, errors };
}

export function formatError({ file, line, spec, kind, message }) {
  return `${file}:${line}: ${kind} „${spec}“ – ${message}`;
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
  try {
    const { values } = parseArgs({ options: { root: { type: 'string' } }, strict: true, allowPositionals: false });
    const started = performance.now();
    const result = checkImports({ root: values.root ?? DEFAULT_ROOT });
    for (const error of result.errors) console.error(formatError(error));
    const summary = `${result.files} Dateien, ${result.references} lokale Verweise geprüft (${Math.round(performance.now() - started)} ms)`;
    if (result.errors.length > 0) {
      console.error(`${result.errors.length} Fund${result.errors.length === 1 ? '' : 'e'} · ${summary}`);
      process.exitCode = 1;
    } else {
      console.log(`Alle Verweise in Ordnung · ${summary}`);
    }
  } catch (error) {
    console.error(`Fehler: ${error.message}`);
    process.exitCode = 1;
  }
}
