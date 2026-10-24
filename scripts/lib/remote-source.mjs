// Spieldaten-Quellen ohne Minecraft-Installation (für Claude Code im Web): öffentliche Archive von
// misode/mcmeta (enthalten die unveränderten Dateien der Client-Jar) und die deutsche Sprachdatei über
// die offiziellen Mojang-Adressen. Lädt nur Daten herunter, führt nichts aus, lädt keine Jar.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { parseZip } from './zip.mjs';

export const MCMETA_REPO = 'misode/mcmeta';
const DE_LANG_OBJECT = 'minecraft/lang/de_de.json';
const DE_LANG_PATH = 'assets/minecraft/lang/de_de.json';
const VERSION_MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';
const SHA1_PATTERN = /^[0-9a-f]{40}$/;
const ASSET_INDEX_ID_PATTERN = /^[0-9A-Za-z._-]{1,40}$/;

const PROXY_VARIABLES = ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy'];
const MB = 1024 * 1024;
const LIMITS = { archive: 96 * MB, json: 16 * MB, small: 256 * 1024 };
const DOWNLOAD_TIMEOUT_MS = 180_000;

// Alle Domains, die der Remote-Modus braucht (README „In der Cloud“ listet dieselben).
export const REMOTE_DOMAINS = [
  { host: 'codeload.github.com', purpose: 'ZIP-Archive von misode/mcmeta (Blockstates, Modelle, Texturen, englische Namen, Strukturen)', required: true },
  { host: 'raw.githubusercontent.com', purpose: 'Blockbericht von misode/mcmeta (Eigenschaften und Standardwerte), Rückfall für de_de.json', required: true },
  { host: 'piston-meta.mojang.com', purpose: 'Mojang-Versionsliste, Versionsdatei und Asset-Index (Prüfsumme der deutschen Sprachdatei)', required: false },
  { host: 'resources.download.minecraft.net', purpose: 'deutsche Sprachdatei de_de.json (offizielle Quelle)', required: false },
];
const ALLOWED_HOSTS = new Set(REMOTE_DOMAINS.map((domain) => domain.host));

// Erwartete Probleme (gesperrte Domain, fehlender Cache …): Meldung ohne Stacktrace.
export class RemoteSourceError extends Error {
  constructor(message, { host = null, blocked = false } = {}) {
    super(message);
    this.name = 'RemoteSourceError';
    this.host = host;
    this.blocked = blocked;
  }
}

// Tags von misode/mcmeta: „assets-tiny“ = Assets ohne Sounds und fremde Sprachen (Bytes wie in der Jar),
// „data“ = Datenpaket mit den Struktur-NBTs, „assets“ (voll, ≈ 450 MB) nur für die einzelne de_de.json.
export function mcmetaTags(version) {
  return { assets: `${version}-assets-tiny`, data: `${version}-data`, fullAssets: `${version}-assets` };
}

export const mcmetaArchiveUrl = (tag) => `https://codeload.github.com/${MCMETA_REPO}/zip/refs/tags/${encodeURIComponent(tag)}`;
export const mcmetaRawUrl = (tag, file) => `https://raw.githubusercontent.com/${MCMETA_REPO}/${encodeURIComponent(tag)}/${file}`;
export const mojangObjectUrl = (hash) => `https://resources.download.minecraft.net/${hash.slice(0, 2)}/${hash}`;

export const sha1Hex = (data) => crypto.createHash('sha1').update(data).digest('hex');

function formatMb(bytes) {
  if (bytes < MB) return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('de-CH')} KB`;
  return `${(bytes / MB).toLocaleString('de-CH', { maximumFractionDigits: 1 })} MB`;
}

export function parseJsonBuffer(data, label) {
  const text = data.toString('utf8');
  try {
    return JSON.parse(text.charCodeAt(0) === 0xfeff ? text.slice(1) : text);
  } catch (error) {
    throw new Error(`${label}: ungültiges JSON (${error.message})`);
  }
}

// ---------------------------------------------------------------------------------------------
// Netzwerk

function networkReason(error) {
  if (error?.name === 'TimeoutError' || error?.name === 'AbortError') return 'Zeitüberschreitung';
  const cause = error?.cause;
  const code = cause?.code ?? error?.code;
  const message = cause?.message && cause.message !== code ? cause.message : null;
  return [code, message].filter(Boolean).join(': ') || error?.message || 'unbekannter Netzwerkfehler';
}

export function blockedDomainMessage(host, reason, env = process.env) {
  const domain = REMOTE_DOMAINS.find((entry) => entry.host === host);
  const proxy = PROXY_VARIABLES.find((name) => env[name]);
  return [
    `Die Domain „${host}“ ist nicht erreichbar (${reason}).`,
    domain ? `  Sie liefert: ${domain.purpose}.` : null,
    // Nur der Name der Variable: Proxy-Adressen enthalten oft Zugangsdaten.
    proxy ? `  Die Verbindung läuft über den Proxy aus ${proxy}; er kann die Domain sperren oder selbst nicht erreichbar sein.` : null,
    `→ Erlaube im Netzwerkzugriff der Umgebung diese Domains: ${REMOTE_DOMAINS.map((entry) => entry.host).join(', ')}`,
    '  (Claude Code im Web: Umgebung bearbeiten → Netzwerkzugriff; Liste auch in README.md, Abschnitt „In der Cloud“).',
    '→ Danach erneut: node scripts/extract-game-data.mjs --remote',
  ].filter(Boolean).join('\n');
}

// fetchImpl ist für Tests austauschbar. Lädt nur von den Domains aus REMOTE_DOMAINS.
export function createDownloader({ fetchImpl = globalThis.fetch, timeoutMs = DOWNLOAD_TIMEOUT_MS, log = () => {} } = {}) {
  if (typeof fetchImpl !== 'function') throw new Error('createDownloader: fetch fehlt (Node 18 oder neuer nötig).');
  return async function download(url, { maxBytes = LIMITS.json, sha1 = null, label = url } = {}) {
    const host = new URL(url).hostname;
    if (!ALLOWED_HOSTS.has(host)) throw new Error(`Download von ${host} ist nicht vorgesehen.`);
    let response;
    try {
      response = await fetchImpl(url, { signal: AbortSignal.timeout(timeoutMs), redirect: 'follow', headers: { 'user-agent': 'block-kompass-extract' } });
    } catch (error) {
      throw new RemoteSourceError(blockedDomainMessage(host, networkReason(error)), { host, blocked: true });
    }
    const finalHost = response.url ? new URL(response.url).hostname : host;
    if (!ALLOWED_HOSTS.has(finalHost)) throw new RemoteSourceError(`${label}: unerwartete Weiterleitung nach ${finalHost}.`, { host });
    if ([403, 407, 451].includes(response.status)) {
      throw new RemoteSourceError(blockedDomainMessage(host, `HTTP ${response.status} – vermutlich vom Netzwerkfilter gesperrt`), { host, blocked: true });
    }
    if (!response.ok) throw new RemoteSourceError(`${label}: Download fehlgeschlagen (HTTP ${response.status}, ${url}).`, { host });
    const declared = Number(response.headers?.get?.('content-length'));
    if (declared > maxBytes) throw new RemoteSourceError(`${label}: Antwort größer als ${formatMb(maxBytes)}.`, { host });

    const chunks = [];
    let size = 0;
    try {
      for await (const chunk of response.body) {
        size += chunk.length;
        if (size > maxBytes) throw new Error(`Antwort größer als ${formatMb(maxBytes)}`);
        chunks.push(chunk);
      }
    } catch (error) {
      throw new RemoteSourceError(`${label}: Download abgebrochen (${error.message === 'terminated' ? networkReason(error) : error.message}).`, { host });
    }
    const data = Buffer.concat(chunks);
    if (sha1 && sha1Hex(data) !== sha1) throw new RemoteSourceError(`${label}: Prüfsumme stimmt nicht (erwartet SHA-1 ${sha1}).`, { host });
    log(`  ↓ ${label} (${formatMb(data.length)})`);
    return data;
  };
}

// ---------------------------------------------------------------------------------------------
// Archive als „Assets“-Quelle (gleiche Schnittstelle wie createJarAssets im Extraktor)

// GitHub-Archive packen alles in einen Ordner „<repo>-<tag>/“; der wird hier abgeschnitten.
export function archiveAssets(zip, label) {
  const names = zip.list('');
  const top = names[0]?.split('/')[0];
  if (!top || names.some((name) => !name.startsWith(`${top}/`))) throw new Error(`${label}: unerwarteter Aufbau (kein gemeinsamer Hauptordner).`);
  const prefix = `${top}/`;
  return {
    has: (name) => zip.entries.has(prefix + name) && !zip.entries.get(prefix + name).isDirectory,
    list: (start) => zip.list(prefix + start).map((name) => name.slice(prefix.length)),
    read: (name) => zip.read(prefix + name),
    readJson: (name) => parseJsonBuffer(zip.read(prefix + name), name),
  };
}

// Mehrere Quellen wie eine: die erste mit der Datei gewinnt, list() liefert die sortierte Vereinigung.
export function mergeAssets(...sources) {
  const owner = (name) => sources.find((source) => source.has(name));
  return {
    has: (name) => owner(name) !== undefined,
    list: (start) => [...new Set(sources.flatMap((source) => source.list(start)))].sort(),
    read: (name) => {
      const source = owner(name);
      if (!source) throw new Error(`Eintrag „${name}“ fehlt.`);
      return source.read(name);
    },
    readJson: (name) => {
      const source = owner(name);
      if (!source) throw new Error(`Eintrag „${name}“ fehlt.`);
      return source.readJson(name);
    },
  };
}

// version.json im mcmeta-Format → dieselben Felder, die der Extraktor aus der Jar liest.
export function readMcmetaVersion(assets, expectedVersion, label) {
  if (!assets.has('version.json')) throw new Error(`${label}: version.json fehlt.`);
  const info = assets.readJson('version.json');
  if (info?.id !== expectedVersion) throw new Error(`${label}: enthält Minecraft ${info?.id}, gebraucht wird genau ${expectedVersion}.`);
  if (!Number.isInteger(info.data_version)) throw new Error(`${label}: version.json ohne data_version.`);
  return {
    id: info.id,
    worldVersion: info.data_version,
    resourcePack: Number.isInteger(info.resource_pack_version) ? info.resource_pack_version : null,
    dataPack: Number.isInteger(info.data_pack_version) ? info.data_pack_version : null,
  };
}

// ---------------------------------------------------------------------------------------------
// Cache

function readCacheFile(filePath) {
  try {
    return fs.readFileSync(filePath);
  } catch (error) {
    if (error.code === 'ENOENT') return null;
    throw error;
  }
}

function writeCacheFile(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const temp = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(temp, data);
  fs.renameSync(temp, filePath);
}

// Holt eine Datei aus dem Cache (wenn validate sie annimmt) oder lädt sie und legt sie ab.
async function cachedDownload({ cacheFile, url, label, maxBytes, sha1 = null, validate, offline, download, warnings }) {
  const cached = readCacheFile(cacheFile);
  if (cached) {
    try {
      if (sha1 && sha1Hex(cached) !== sha1) throw new Error('Prüfsumme stimmt nicht');
      return { value: validate(cached), data: cached, cached: true };
    } catch (error) {
      warnings.add(`Cache ${path.basename(cacheFile)} unbrauchbar (${error.message}) – lade neu.`);
    }
  }
  if (offline) throw new RemoteSourceError(`${label} fehlt im Cache (${cacheFile}) und --offline ist gesetzt.\n→ Einmal ohne --offline laufen lassen.`);
  const data = await download(url, { maxBytes, sha1, label });
  let value;
  try {
    value = validate(data);
  } catch (error) {
    throw new RemoteSourceError(`${label}: unbrauchbare Antwort (${error.message}).`);
  }
  writeCacheFile(cacheFile, data);
  return { value, data, cached: false };
}

// ---------------------------------------------------------------------------------------------
// Quellen

async function loadMcmetaArchive({ tag, version, cacheDir, offline, download, warnings }) {
  const label = `${MCMETA_REPO}@${tag}`;
  const { value } = await cachedDownload({
    cacheFile: path.join(cacheDir, `mcmeta-${tag}.zip`),
    url: mcmetaArchiveUrl(tag),
    label: `Archiv ${label}`,
    maxBytes: LIMITS.archive,
    offline, download, warnings,
    validate: (data) => {
      const assets = archiveAssets(parseZip(data, label), label);
      return { assets, version: readMcmetaVersion(assets, version, label) };
    },
  });
  return { ...value, ref: label };
}

function readAssetIndexInfo(versionJson, version) {
  const index = versionJson?.assetIndex;
  if (versionJson?.id !== version) throw new Error(`Versionsdatei nennt ${versionJson?.id}`);
  if (!index || !ASSET_INDEX_ID_PATTERN.test(index.id ?? '') || !SHA1_PATTERN.test(index.sha1 ?? '') || typeof index.url !== 'string') {
    throw new Error('Versionsdatei ohne gültigen assetIndex');
  }
  if (new URL(index.url).hostname !== 'piston-meta.mojang.com') throw new Error(`Asset-Index liegt auf unerwarteter Domain (${index.url})`);
  return { id: index.id, sha1: index.sha1, url: index.url };
}

function readLangObject(assetIndex) {
  const object = assetIndex?.objects?.[DE_LANG_OBJECT];
  if (!object || !SHA1_PATTERN.test(object.hash ?? '')) throw new Error(`Asset-Index ohne ${DE_LANG_OBJECT}`);
  return object.hash;
}

// Mojang: Versionsliste → Versionsdatei → Asset-Index → Objekt; jede Stufe per SHA-1 geprüft.
async function loadMojangAssetIndex({ version, cacheDir, offline, download, warnings }) {
  const versionFile = path.join(cacheDir, `mojang-${version}.json`);
  let versionJson;
  const cachedVersion = readCacheFile(versionFile);
  if (cachedVersion) {
    try {
      versionJson = parseJsonBuffer(cachedVersion, versionFile);
      readAssetIndexInfo(versionJson, version);
    } catch (error) {
      warnings.add(`Cache ${path.basename(versionFile)} unbrauchbar (${error.message}) – lade neu.`);
      versionJson = null;
    }
  }
  if (!versionJson) {
    if (offline) throw new RemoteSourceError(`Mojang-Versionsdatei fehlt im Cache (${versionFile}) und --offline ist gesetzt.`);
    const manifest = parseJsonBuffer(await download(VERSION_MANIFEST_URL, { maxBytes: LIMITS.json, label: 'Mojang-Versionsliste' }), 'Mojang-Versionsliste');
    const entry = manifest?.versions?.find?.((item) => item?.id === version);
    if (!entry || !SHA1_PATTERN.test(entry.sha1 ?? '') || typeof entry.url !== 'string' || new URL(entry.url).hostname !== 'piston-meta.mojang.com') {
      throw new RemoteSourceError(`Die Mojang-Versionsliste kennt Minecraft ${version} nicht.`);
    }
    const data = await download(entry.url, { maxBytes: LIMITS.json, sha1: entry.sha1, label: `Mojang-Versionsdatei ${version}` });
    versionJson = parseJsonBuffer(data, `Mojang-Versionsdatei ${version}`);
    readAssetIndexInfo(versionJson, version);
    writeCacheFile(versionFile, data);
  }
  const info = readAssetIndexInfo(versionJson, version);
  const { value } = await cachedDownload({
    cacheFile: path.join(cacheDir, `mojang-assets-${info.id}.json`),
    url: info.url,
    label: `Asset-Index ${info.id}`,
    maxBytes: LIMITS.json,
    sha1: info.sha1,
    offline, download, warnings,
    validate: (data) => {
      const index = parseJsonBuffer(data, `Asset-Index ${info.id}`);
      return { id: info.id, langHash: readLangObject(index) };
    },
  });
  return value;
}

function validateLang(data) {
  const lang = parseJsonBuffer(data, 'de_de.json');
  if (lang === null || typeof lang !== 'object' || Array.isArray(lang) || typeof lang['block.minecraft.stone'] !== 'string') {
    throw new Error('de_de.json enthält keine Blocknamen');
  }
  return lang;
}

async function loadGermanLang({ version, cacheDir, offline, download, warnings, log }) {
  let index = null;
  let mojangProblem = null;
  try {
    index = await loadMojangAssetIndex({ version, cacheDir, offline, download, warnings });
    const { value } = await cachedDownload({
      cacheFile: path.join(cacheDir, 'mojang-de_de.json'),
      url: mojangObjectUrl(index.langHash),
      label: 'de_de.json (Mojang)',
      maxBytes: LIMITS.json,
      sha1: index.langHash,
      offline, download, warnings,
      validate: validateLang,
    });
    return { lang: value, source: 'mojang', assetIndex: index.id };
  } catch (error) {
    if (!(error instanceof RemoteSourceError)) throw error;
    mojangProblem = error;
  }
  // Rückfall: dieselbe Datei aus dem vollen mcmeta-Asset-Tag (einzeln über raw.githubusercontent.com).
  const tag = mcmetaTags(version).fullAssets;
  log(`  Mojang nicht nutzbar – hole de_de.json aus ${MCMETA_REPO}@${tag}.`);
  try {
    const { value } = await cachedDownload({
      cacheFile: path.join(cacheDir, `mcmeta-${tag}-de_de.json`),
      url: mcmetaRawUrl(tag, DE_LANG_PATH),
      label: `de_de.json (${MCMETA_REPO}@${tag})`,
      maxBytes: LIMITS.json,
      offline, download, warnings,
      validate: validateLang,
    });
    // Keine SHA-1-Prüfung möglich: Mojang ergänzt die Datei im Asset-Index nach der Veröffentlichung um Namen
    // neuerer Versionen, mcmeta hat den Stand vom Release (geprüft 2026-10-23: alle 26.2-Namen gleich).
    warnings.add(`de_de.json kommt aus ${MCMETA_REPO}@${tag} statt von Mojang (Stand der Veröffentlichung, ohne Prüfsumme; Namen späterer Versionen fehlen). Grund: ${mojangProblem.message.split('\n')[0]}`);
    return { lang: value, source: `${MCMETA_REPO}@${tag}`, assetIndex: index?.id ?? null };
  } catch (error) {
    if (!(error instanceof RemoteSourceError)) throw error;
    throw new RemoteSourceError(`Die deutsche Sprachdatei ist nicht erreichbar.\n${mojangProblem.message}\n\nRückfall über GitHub ebenfalls gescheitert:\n${error.message}`, { blocked: error.blocked });
  }
}

// Lädt alles, was der Extraktor sonst aus Jar und Asset-Ordner liest.
// → { assets, version: { id, worldVersion, resourcePack, dataPack }, germanLang, assetIndex, refs }
export async function loadRemoteSources({ version, cacheDir, offline = false, download, warnings, log = () => {} }) {
  const tags = mcmetaTags(version);
  const assetsArchive = await loadMcmetaArchive({ tag: tags.assets, version, cacheDir, offline, download, warnings });
  const dataArchive = await loadMcmetaArchive({ tag: tags.data, version, cacheDir, offline, download, warnings });
  if (assetsArchive.version.worldVersion !== dataArchive.version.worldVersion) {
    throw new RemoteSourceError(`${assetsArchive.ref} und ${dataArchive.ref} gehören zu verschiedenen Datenversionen (${assetsArchive.version.worldVersion} / ${dataArchive.version.worldVersion}).`);
  }
  const german = await loadGermanLang({ version, cacheDir, offline, download, warnings, log });
  return {
    assets: mergeAssets(assetsArchive.assets, dataArchive.assets),
    version: assetsArchive.version,
    germanLang: german.lang,
    assetIndex: german.assetIndex,
    refs: { assets: assetsArchive.ref, data: dataArchive.ref, lang: german.source },
  };
}

// ---------------------------------------------------------------------------------------------
// Proxy: Node-fetch nutzt HTTPS_PROXY erst mit --use-env-proxy (Node ≥ 24.5 bzw. 22.21).

export function proxyRelaunchPlan({ env = process.env, execArgv = process.execArgv, allowedFlags = process.allowedNodeEnvironmentFlags } = {}) {
  const proxy = PROXY_VARIABLES.find((name) => env[name]);
  if (!proxy) return { relaunch: false, reason: 'kein Proxy gesetzt' };
  if (env.NODE_USE_ENV_PROXY === '1' || execArgv.includes('--use-env-proxy')) return { relaunch: false, reason: 'Proxy-Unterstützung aktiv' };
  if (!allowedFlags?.has?.('--use-env-proxy')) {
    return { relaunch: false, reason: `${proxy} ist gesetzt, aber diese Node-Version kennt --use-env-proxy nicht (Node 24.5 oder neuer nötig)`, warn: true };
  }
  return { relaunch: true, reason: `${proxy} ist gesetzt` };
}
