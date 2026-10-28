// Community-Bauten für den Katalog (ARCHITEKTUR §9.2): data/community/builds.json streng prüfen, die Dateien prüfen
// (vorhanden, Größe, Prüfsumme, nichts Fremdes im Ordner) und jede Datei in Node mit derselben Import-Pipeline bauen
// wie ein Upload auf der Seite (Ebene für Ebene). Genutzt von scripts/build-catalog.mjs.

import { readFile, readdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  COMMUNITY_FORMATS, COMMUNITY_LIST_FILE, COMMUNITY_LICENSE_DIR, COMMUNITY_MAX_BLOCKS, COMMUNITY_MAX_FILE_BYTES,
  COMMUNITY_MAX_TOTAL_BYTES, OPEN_LICENSES, OPEN_LICENSE_IDS, parseCommunityFile,
} from '../../js/data/community.js';
import { importFile, importToBuildResult } from '../../js/create/import/index.js';
import { CATEGORIES, difficultyTags } from '../check-build.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const DEFAULT_COMMUNITY_DIR = path.join(ROOT, 'data', 'community');

const REQUIRED_KEYS = ['id', 'title', 'subtitle', 'category', 'file', 'format', 'author', 'url', 'license', 'licenseUrl', 'commit', 'tags'];
const OPTIONAL_KEYS = ['aliases', 'sourcePath', 'sha256', 'licenseFile'];
const ID_PATTERN = /^[a-z0-9-]{2,80}$/;
// Git-Commit (40 Hex-Zeichen) oder eine Modrinth-Version samt SHA-1 der Datei
const COMMIT_PATTERN = /^(?:[0-9a-f]{40}|modrinth:[A-Za-z0-9]{8}\/[A-Za-z0-9._+-]{1,60}\/sha1:[0-9a-f]{40})$/;
const LICENSE_FILE_PATTERN = /^licenses\/[a-z0-9][a-z0-9._-]{0,100}\.txt$/;
const SHA256_PATTERN = /^[0-9a-f]{64}$/;
const CONTROL = /[\u0000-\u001f\u007f-\u009f​-‏‪-‮⁠⁦-⁩﻿]/;
const MAX_TAGS = 12;
const MAX_ALIASES = 30;

const sha256 = (data) => createHash('sha256').update(data).digest('hex');

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isText(value, max) {
  return typeof value === 'string' && value.trim() !== '' && value === value.trim() && value.length <= max && !CONTROL.test(value);
}

function isHttps(value) {
  if (typeof value !== 'string' || value.length > 500 || CONTROL.test(value) || /\s/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && url.hostname !== '' && url.username === '' && url.password === '';
  } catch {
    return false;
  }
}

function checkList(value, { label, max, maxLength, lowercase = false }, errors) {
  if (!Array.isArray(value) || value.length > max || value.some((item) => !isText(item, maxLength))) {
    errors.push(`${label} muss eine Liste aus höchstens ${max} nicht leeren Texten (bis ${maxLength} Zeichen) sein.`);
    return;
  }
  if (new Set(value).size !== value.length) errors.push(`${label} enthält Einträge doppelt.`);
  if (lowercase && value.some((item) => item !== item.toLowerCase())) errors.push(`${label} muss klein geschrieben sein (für die Suche).`);
}

/**
 * Prüft einen Eintrag aus builds.json (ohne Dateizugriff). → Liste der Fehler (deutsch, ohne Präfix)
 * Pflicht: id, title, subtitle, category, file, format, author, url, license, licenseUrl, commit, tags
 * Optional: aliases (klein geschrieben), sourcePath (Pfad in der Quelle), sha256 (der Datei), licenseFile (licenses/….txt)
 */
export function validateCommunityEntry(raw) {
  const errors = [];
  if (!isPlainObject(raw)) return ['Eintrag ist kein Objekt.'];
  for (const key of Object.keys(raw)) {
    if (!REQUIRED_KEYS.includes(key) && !OPTIONAL_KEYS.includes(key)) errors.push(`Feld „${key}“ ist unbekannt.`);
  }
  for (const key of REQUIRED_KEYS) if (!Object.hasOwn(raw, key)) errors.push(`Feld „${key}“ fehlt.`);
  if (!(typeof raw.id === 'string' && ID_PATTERN.test(raw.id))) errors.push('id muss aus 2–80 Zeichen a–z, 0–9 und - bestehen.');
  if (Object.hasOwn(raw, 'title') && !isText(raw.title, 120)) errors.push('title muss ein nicht leerer Text (bis 120 Zeichen) sein.');
  if (Object.hasOwn(raw, 'subtitle') && !isText(raw.subtitle, 200)) errors.push('subtitle muss ein nicht leerer Text (bis 200 Zeichen) sein.');
  if (Object.hasOwn(raw, 'category') && !CATEGORIES.includes(raw.category)) errors.push(`category muss eine von ${CATEGORIES.join(', ')} sein.`);
  if (Object.hasOwn(raw, 'format') && !COMMUNITY_FORMATS.includes(raw.format)) errors.push(`format muss eines von ${COMMUNITY_FORMATS.join(', ')} sein.`);
  if (Object.hasOwn(raw, 'file')) {
    const parsed = parseCommunityFile(raw.file);
    if (!parsed) errors.push('file muss „<id>.nbt“, „<id>.schem“ oder „<id>.litematic“ sein (a–z, 0–9, -).');
    else {
      if (parsed.id !== raw.id) errors.push(`file „${raw.file}“ passt nicht zur id „${raw.id}“.`);
      if (parsed.format !== raw.format) errors.push(`Die Endung von „${raw.file}“ passt nicht zum format „${raw.format}“.`);
    }
  }
  if (Object.hasOwn(raw, 'author') && !isText(raw.author, 120)) errors.push('author muss ein nicht leerer Text (bis 120 Zeichen) sein.');
  for (const key of ['url', 'licenseUrl']) if (Object.hasOwn(raw, key) && !isHttps(raw[key])) errors.push(`${key} muss eine https-Adresse sein.`);
  if (Object.hasOwn(raw, 'license') && !OPEN_LICENSE_IDS.includes(raw.license)) {
    errors.push(`license „${String(raw.license).slice(0, 40)}“ ist keine offene Lizenz aus der Liste (${OPEN_LICENSE_IDS.join(', ')}).`);
  }
  if (Object.hasOwn(raw, 'commit') && !(typeof raw.commit === 'string' && COMMIT_PATTERN.test(raw.commit))) {
    errors.push('commit muss ein Git-Commit (40 Hex-Zeichen) oder „modrinth:<version-id>/<version>/sha1:<40 Hex-Zeichen>“ sein.');
  }
  if (Object.hasOwn(raw, 'tags')) {
    checkList(raw.tags, { label: 'tags', max: MAX_TAGS, maxLength: 40 }, errors);
    for (const tag of difficultyTags(raw.tags)) errors.push(`tags: „${tag}“ ist eine Schwierigkeit – die gibt es nicht.`);
  }
  if (Object.hasOwn(raw, 'aliases')) checkList(raw.aliases, { label: 'aliases', max: MAX_ALIASES, maxLength: 80, lowercase: true }, errors);
  if (Object.hasOwn(raw, 'sourcePath') && !isText(raw.sourcePath, 300)) errors.push('sourcePath muss ein nicht leerer Text (bis 300 Zeichen) sein.');
  if (Object.hasOwn(raw, 'sha256') && !(typeof raw.sha256 === 'string' && SHA256_PATTERN.test(raw.sha256))) errors.push('sha256 muss aus 64 Hex-Zeichen (klein) bestehen.');
  if (Object.hasOwn(raw, 'licenseFile') && !(typeof raw.licenseFile === 'string' && LICENSE_FILE_PATTERN.test(raw.licenseFile))) {
    errors.push('licenseFile muss „licenses/<name>.txt“ sein.');
  }
  return errors;
}

/**
 * Prüft die ganze Liste (Aufbau, Einträge, doppelte IDs und Dateien, Kollision mit Bau-Modulen).
 * → { entries: [gültige Einträge], errors: [Text] }. Einträge mit Fehlern fehlen in entries.
 */
export function validateCommunityList(json, { moduleIds = new Set() } = {}) {
  if (!Array.isArray(json)) return { entries: [], errors: [`${COMMUNITY_LIST_FILE} muss eine Liste ([…]) sein.`] };
  const errors = [];
  const valid = [];
  const counts = new Map();
  for (const raw of json) if (isPlainObject(raw) && typeof raw.id === 'string') counts.set(raw.id, (counts.get(raw.id) ?? 0) + 1);
  json.forEach((raw, index) => {
    const label = isPlainObject(raw) && typeof raw.id === 'string' && ID_PATTERN.test(raw.id) ? raw.id : `Eintrag ${index + 1}`;
    const found = validateCommunityEntry(raw);
    if (isPlainObject(raw) && typeof raw.id === 'string') {
      if (counts.get(raw.id) > 1) found.push(`id „${raw.id}“ steht mehrfach in ${COMMUNITY_LIST_FILE}.`);
      if (moduleIds.has(raw.id)) found.push(`id „${raw.id}“ gibt es schon als Bau-Modul.`);
    }
    if (found.length) errors.push(...found.map((error) => `${COMMUNITY_LIST_FILE}: ${label}: ${error}`));
    else valid.push(raw);
  });
  return { entries: valid, errors };
}

/** Alle Dateien im Ordner (rekursiv, Pfade relativ mit /) → [{ rel, file, size, isFile }] */
async function listFiles(dir) {
  const found = [];
  const walk = async (folder, prefix) => {
    for (const entry of (await readdir(folder, { withFileTypes: true })).sort((a, b) => (a.name < b.name ? -1 : 1))) {
      const file = path.join(folder, entry.name);
      const rel = `${prefix}${entry.name}`;
      if (entry.isDirectory()) await walk(file, `${rel}/`);
      else {
        const info = await lstat(file);
        found.push({ rel, file, size: info.size, isFile: info.isFile() });
      }
    }
  };
  await walk(dir, '');
  return found;
}

async function folderExists(dir) {
  try {
    return (await lstat(dir)).isDirectory();
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

/**
 * Liest und prüft data/community/ (builds.json und Dateien). Fehlt der Ordner, gibt es keine Community-Bauten.
 * → { entries: [Eintrag + bytes (Buffer)], errors: [Text], warnings: [Text] }
 */
export async function readCommunity({ dir = DEFAULT_COMMUNITY_DIR, moduleIds = new Set() } = {}) {
  const errors = [];
  const warnings = [];
  if (!(await folderExists(dir))) return { entries: [], errors, warnings };
  const files = await listFiles(dir);
  const listFile = files.find((f) => f.rel === COMMUNITY_LIST_FILE);
  if (!listFile) return { entries: [], errors: [`data/community/${COMMUNITY_LIST_FILE} fehlt.`], warnings };
  let json;
  try {
    json = JSON.parse(await readFile(listFile.file, 'utf8'));
  } catch (error) {
    return { entries: [], errors: [`data/community/${COMMUNITY_LIST_FILE} ist nicht lesbar: ${error.message}`], warnings };
  }
  const { entries: listed, errors: listErrors } = validateCommunityList(json, { moduleIds });
  errors.push(...listErrors);

  const total = files.reduce((sum, f) => sum + f.size, 0);
  if (total > COMMUNITY_MAX_TOTAL_BYTES) errors.push(`data/community ist ${(total / 1024 / 1024).toFixed(1)} MB groß – erlaubt sind höchstens ${COMMUNITY_MAX_TOTAL_BYTES / 1024 / 1024} MB.`);
  const byRel = new Map(files.map((f) => [f.rel, f]));
  // Alle Dateinamen aus builds.json (auch von fehlerhaften Einträgen), damit sie nicht zusätzlich als fremd gelten
  const named = new Set(Array.isArray(json) ? json.flatMap((raw) => (isPlainObject(raw) ? [raw.file, raw.licenseFile] : [])).filter((v) => typeof v === 'string') : []);
  for (const f of files) {
    if (f.rel === COMMUNITY_LIST_FILE || named.has(f.rel)) continue;
    if (f.rel.startsWith(COMMUNITY_LICENSE_DIR)) warnings.push(`data/community/${f.rel}: Lizenztext ohne Eintrag.`);
    else errors.push(`data/community/${f.rel} gehört zu keinem Eintrag in ${COMMUNITY_LIST_FILE}.`);
  }

  const entries = [];
  for (const entry of listed) {
    const label = `data/community/${entry.file}`;
    const info = byRel.get(entry.file);
    const problems = [];
    if (!info) problems.push(`${label} fehlt.`);
    else if (!info.isFile) problems.push(`${label} ist keine normale Datei.`);
    else if (info.size === 0) problems.push(`${label} ist leer.`);
    else if (info.size > COMMUNITY_MAX_FILE_BYTES) problems.push(`${label} ist ${(info.size / 1024 / 1024).toFixed(1)} MB groß – erlaubt sind höchstens ${COMMUNITY_MAX_FILE_BYTES / 1024 / 1024} MB.`);
    if (entry.licenseFile && !byRel.get(entry.licenseFile)?.isFile) problems.push(`data/community/${entry.licenseFile} (Lizenztext von ${entry.id}) fehlt.`);
    let bytes = null;
    if (problems.length === 0) {
      bytes = await readFile(info.file);
      if (entry.sha256 && sha256(bytes) !== entry.sha256) problems.push(`${label} hat eine andere Prüfsumme als in ${COMMUNITY_LIST_FILE} (sha256) – die Datei muss unverändert sein.`);
    }
    if (problems.length) errors.push(...problems.map((p) => `${entry.id}: ${p}`));
    else entries.push({ ...entry, bytes });
  }
  return { entries, errors, warnings };
}

/**
 * Fingerabdruck-Teile des Ordners: jede Datei mit sha256 ihrer Bytes (ohne Umwandlung der Zeilenenden).
 * → [[„data/community/<pfad>“, sha256]] (sortiert); fehlt der Ordner, ein fester Eintrag.
 */
export async function communityFingerprintParts(dir = DEFAULT_COMMUNITY_DIR, root = ROOT) {
  const base = path.relative(root, dir).split(path.sep).join('/');
  if (!(await folderExists(dir))) return [[`${base} (fehlt)`, '-']];
  const parts = [];
  for (const f of await listFiles(dir)) parts.push([`${base}/${f.rel}`, f.isFile ? sha256(await readFile(f.file)) : 'keine Datei']);
  return parts;
}

/** Titel der Quelle für den Katalog: „GitHub: owner/repo“, „Modrinth: projekt“, sonst der Rechnername. */
export function sourceTitle(url) {
  const parsed = new URL(url);
  const parts = parsed.pathname.split('/').filter(Boolean);
  if (parsed.hostname === 'github.com' && parts.length >= 2) return `GitHub: ${parts[0]}/${parts[1]}`;
  if (parsed.hostname === 'modrinth.com' && parts.length >= 2) return `Modrinth: ${parts[1]}`;
  return parsed.hostname;
}

const formatInt = (n) => n.toLocaleString('de-DE');

/**
 * Baut einen geprüften Eintrag (mit bytes) wie einen Upload: importFile + importToBuildResult (Blockdaten müssen
 * geladen sein). Fehler statt Eintrag, wenn die Datei mehr als maxBlocks Blöcke hat oder Blöcke enthält, die es in
 * Minecraft 26.2 nicht gibt (aus Mods, unbekannt, unlesbar): ohne sie wäre der Bau nicht mehr das Original.
 * → { result (BuildResult) | null, errors: [Text] }
 */
export async function buildCommunityEntry(entry, { maxBlocks = COMMUNITY_MAX_BLOCKS } = {}) {
  const label = `${entry.id}: data/community/${entry.file}`;
  try {
    const imported = await importFile({ format: entry.format, name: entry.file, data: entry.bytes });
    const errors = [];
    if (imported.blockCount > maxBlocks) errors.push(`${label} hat ${formatInt(imported.blockCount)} Blöcke – erlaubt sind höchstens ${formatInt(maxBlocks)}.`);
    const dropped = Array.isArray(imported.stats?.dropped) ? imported.stats.dropped : [];
    if (dropped.length) {
      const total = dropped.reduce((sum, [, n]) => sum + n, 0);
      const names = dropped.slice(0, 5).map(([id, n]) => `„${id}“ ${formatInt(n)}×`).join(', ');
      errors.push(`${label}: ${formatInt(total)} Blöcke gibt es in Minecraft 26.2 nicht (${names}${dropped.length > 5 ? ', …' : ''}) – ohne sie wäre der Bau nicht das Original.`);
    }
    if (errors.length) return { result: null, errors };
    return { result: importToBuildResult(imported), errors: [] };
  } catch (error) {
    const reason = error?.name === 'ImportError' ? error.message : `${error?.message ?? error}`;
    return { result: null, errors: [`${label} lässt sich nicht bauen: ${reason}`] };
  }
}

/** Herkunft-Angaben eines Eintrags für den Katalog: Quellen und Credits (mit Lizenz-Adresse). */
export function communityCredits(entry) {
  return {
    sources: [{ title: sourceTitle(entry.url), url: entry.url }],
    credits: { author: entry.author, url: entry.url, license: OPEN_LICENSES[entry.license].label, licenseUrl: entry.licenseUrl },
  };
}
