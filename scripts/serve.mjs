// Lokaler Server für den Block-Kompass. Nur Node-Bordmittel, lauscht nur auf 127.0.0.1.
// Start: node scripts/serve.mjs [--port 8080]

import http from 'node:http';
import { createReadStream, existsSync } from 'node:fs';
import { stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const HOST = '127.0.0.1';
const DEFAULT_PORT = 8080;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.bin': 'application/octet-stream',
};

// Gleiche Regeln wie das <meta>-CSP in den Seiten.
export const CONTENT_SECURITY_POLICY = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'self'",
  "frame-ancestors 'none'",
].join('; ');

const SECURITY_HEADERS = {
  'Content-Security-Policy': CONTENT_SECURITY_POLICY,
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'no-referrer',
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Resource-Policy': 'same-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(), payment=()',
};

function sendText(res, status, text) {
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(text);
}

// Liefert den absoluten Dateipfad oder null, wenn die Adresse nicht erlaubt ist.
export function resolveRequestPath(rootDir, rawUrl) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(rawUrl, 'http://localhost').pathname);
  } catch {
    return null;
  }
  if (pathname.includes('\0') || pathname.includes('\\')) return null;
  const segments = pathname.split('/').filter(Boolean);
  // Versteckte Dateien und Ordner (.git, .gitignore, .cache …) werden nie ausgeliefert.
  if (segments.some((s) => s.startsWith('.') || s === 'node_modules')) return null;
  if (pathname.endsWith('/') || segments.length === 0) segments.push('index.html');
  const absolute = path.resolve(rootDir, ...segments);
  const relative = path.relative(rootDir, absolute);
  if (relative.startsWith('..') || path.isAbsolute(relative)) return null;
  return absolute;
}

// Nur Anfragen an diesen Server selbst: schützt vor DNS-Rebinding (eine fremde Seite, deren Name plötzlich auf
// 127.0.0.1 zeigt, könnte sonst als „gleicher Ursprung“ Dateien lesen).
export function isAllowedHost(hostHeader, port) {
  if (typeof hostHeader !== 'string' || !Number.isInteger(port)) return false;
  const host = hostHeader.trim().toLowerCase();
  return host === `${HOST}:${port}` || host === `localhost:${port}`;
}

// Fragt overrides(pathname) (nur Tests, siehe startServer) und sendet deren Antwort. → true, wenn beantwortet.
async function answerFromOverrides(overrides, req, res) {
  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
  } catch {
    return false;
  }
  if (pathname.includes('\0')) return false;
  const answer = await overrides(pathname);
  if (answer === null || answer === undefined) return false;
  const { status = 200, body, type = 'application/octet-stream' } = answer;
  if (!Number.isInteger(status) || status < 200 || status > 599 || typeof type !== 'string'
    || (typeof body !== 'string' && !(body instanceof Uint8Array))) {
    throw new Error(`overrides(${pathname}) lieferte keine gültige Antwort ({ status, body: Text oder Uint8Array, type }).`);
  }
  const payload = typeof body === 'string' ? Buffer.from(body, 'utf8') : body;
  res.writeHead(status, { ...SECURITY_HEADERS, 'Content-Type': type, 'Content-Length': payload.length, 'Cache-Control': 'no-store' });
  res.end(req.method === 'HEAD' ? undefined : payload);
  return true;
}

async function handleRequest(rootDir, req, res, overrides = null) {
  if (!isAllowedHost(req.headers.host, req.socket.localPort)) {
    sendText(res, 403, 'Nicht erlaubt.');
    return;
  }
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, HEAD');
    sendText(res, 405, 'Methode nicht erlaubt.');
    return;
  }
  if (overrides && await answerFromOverrides(overrides, req, res)) return;
  const filePath = resolveRequestPath(rootDir, req.url ?? '/');
  if (!filePath) {
    sendText(res, 404, 'Nicht gefunden.');
    return;
  }
  const type = MIME_TYPES[path.extname(filePath).toLowerCase()];
  let info;
  try {
    info = await stat(filePath);
  } catch {
    info = null;
  }
  if (!info || !info.isFile() || !type) {
    sendText(res, 404, 'Nicht gefunden.');
    return;
  }
  const lastModified = info.mtime.toUTCString();
  if (req.headers['if-modified-since'] === lastModified) {
    res.writeHead(304, { ...SECURITY_HEADERS, 'Last-Modified': lastModified, 'Cache-Control': 'no-cache' });
    res.end();
    return;
  }
  res.writeHead(200, {
    ...SECURITY_HEADERS,
    'Content-Type': type,
    'Content-Length': info.size,
    'Last-Modified': lastModified,
    'Cache-Control': 'no-cache',
  });
  if (req.method === 'HEAD') {
    res.end();
    return;
  }
  const stream = createReadStream(filePath);
  stream.on('error', (error) => {
    console.error(`Lesefehler bei ${filePath}:`, error.message);
    res.destroy();
  });
  stream.pipe(res);
}

// Startet den Server; port 0 = freier Port (für Tests). Gibt { url, port, close } zurück.
// overrides (nur programmatisch, für Tests): (pathname) → null | { status = 200, body: Text | Uint8Array, type }
// (auch als Promise); wird nach Host- und Methodenprüfung vor der Dateisuche gefragt, Antwort mit denselben
// Sicherheits-Headern und Cache-Control: no-store. null = normale Datei ausliefern.
export function startServer({ port = DEFAULT_PORT, rootDir = ROOT, overrides = null } = {}) {
  if (overrides !== null && typeof overrides !== 'function') return Promise.reject(new TypeError('startServer: overrides muss eine Funktion sein.'));
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      handleRequest(rootDir, req, res, overrides).catch((error) => {
        console.error('Serverfehler:', error);
        if (!res.headersSent) sendText(res, 500, 'Interner Fehler.');
        else res.destroy();
      });
    });
    server.on('error', reject);
    server.listen(port, HOST, () => {
      const actualPort = server.address().port;
      resolve({
        port: actualPort,
        url: `http://${HOST}:${actualPort}`,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

function readPortArgument(argv) {
  const index = argv.indexOf('--port');
  const raw = index >= 0 ? argv[index + 1] : process.env.PORT;
  if (raw === undefined) return DEFAULT_PORT;
  const port = Number(raw);
  if (!Number.isInteger(port) || port < 1024 || port > 65535) {
    throw new Error(`Ungültiger Port „${raw}“ – erlaubt sind ganze Zahlen von 1024 bis 65535.`);
  }
  return port;
}

const isMainModule = process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;
if (isMainModule) {
  try {
    const { url } = await startServer({ port: readPortArgument(process.argv.slice(2)) });
    console.log(`Block-Kompass läuft: ${url}  (beenden mit Strg+C)`);
    if (!existsSync(path.join(ROOT, 'game-data', 'meta.json'))) {
      console.log('Hinweis: game-data/ fehlt, die 3D-Ansichten brauchen die Spieldaten.');
      console.log('Alles in einem Schritt (holt die Spieldaten auch ohne Minecraft): node scripts/start.mjs');
    }
  } catch (error) {
    if (error.code === 'EADDRINUSE') console.error('Der Port ist schon belegt. Anderen wählen, z. B.: node scripts/serve.mjs --port 8081');
    else console.error(error.message);
    process.exit(1);
  }
}
