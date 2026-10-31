// Quelltext eines Moduls samt aller relativ importierten Dateien (rekursiv) und die gemeinsame Vorbereitung für Hashes.
// Gemeinsam genutzt von scripts/make-thumbs.mjs (Hash je Vorschaubild) und scripts/build-catalog.mjs (Fingerabdruck des Katalogs).
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const IMPORT_PATTERN = /(?:^|[\s;])(?:import|export)\s[^'"`]*?from\s*['"](\.{1,2}\/[^'"]+)['"]|(?:^|[\s;])import\s*['"](\.{1,2}\/[^'"]+)['"]|import\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g;

/**
 * Quelltext für Hashes: Zeilenenden vereinheitlicht (CRLF → LF). Eine Windows-Arbeitskopie kann CRLF haben (z. B. eine neue
 * Datei aus dem Editor vor dem ersten Commit; Git speichert LF). Katalog-Fingerabdruck (build-catalog) und Hash der
 * Vorschaubilder (make-thumbs) sollen unter Windows und Linux gleich sein. Nur für Text, nie für Binärdateien.
 */
export function normalizeNewlines(text) {
  return text.replace(/\r\n/g, '\n');
}

/** Quelltext eines Moduls und aller relativ importierten Dateien (rekursiv) → [{ file, text }], fest sortiert. */
export async function moduleSources(entryFile, { root = ROOT } = {}) {
  const seen = new Map();
  const visit = async (file) => {
    if (seen.has(file)) return;
    if (!file.startsWith(root + path.sep)) throw new Error(`Import außerhalb des Projekts: ${file}`);
    const text = await readFile(file, 'utf8');
    seen.set(file, text);
    for (const match of text.matchAll(IMPORT_PATTERN)) {
      const spec = match[1] ?? match[2] ?? match[3];
      await visit(path.resolve(path.dirname(file), spec));
    }
  };
  await visit(entryFile);
  return [...seen].map(([file, text]) => ({ file: path.relative(root, file).split(path.sep).join('/'), text })).sort((a, b) => (a.file < b.file ? -1 : 1));
}
