// Downloads der Spieldaten (raw.githubusercontent.com): nur einfache GET-Anfragen ohne eigene Header (sonst verlangt
// der Browser einen OPTIONS-Preflight, den GitHub mit 403 beantwortet), ohne Cookies und ohne Referrer. Wiederholt
// bei Netzfehlern, Zeitüberschreitung, 429 und 5xx; begrenzt die Größe. Läuft in Browser, Worker und Node.
// fetch und sleep sind für Tests austauschbar.

const RETRY_DELAYS_MS = [500, 1500, 4000];
const MAX_RETRY_AFTER_MS = 20_000;
const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_RETRIES = 3;

export class NetError extends Error {
  // kind: 'network' | 'timeout' | 'http' | 'rate-limit' | 'too-large' | 'format'
  constructor(message, { kind, status = null, url = null, cause } = {}) {
    super(message, cause === undefined ? undefined : { cause });
    this.name = 'NetError';
    this.kind = kind;
    this.status = status;
    this.url = url;
  }

  // Lohnt ein neuer Versuch? (nicht bei 404, zu großen oder kaputten Dateien)
  get retryable() {
    return this.kind === 'network' || this.kind === 'timeout' || this.kind === 'rate-limit'
      || (this.kind === 'http' && this.status >= 500);
  }
}

function sourceName(url) {
  try {
    const host = new URL(url, 'http://localhost/').hostname;
    return host === 'github.com' || host.endsWith('.github.com') || host.endsWith('githubusercontent.com') ? 'GitHub' : 'der Server';
  } catch {
    return 'der Server';
  }
}

function fileLabel(url) {
  const clean = String(url).split(/[?#]/)[0];
  return clean.slice(clean.lastIndexOf('/') + 1) || clean;
}

function formatSize(bytes) {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toLocaleString('de-CH', { maximumFractionDigits: 1 })} MB`;
  return `${Math.max(1, Math.round(bytes / 1024)).toLocaleString('de-CH')} KB`;
}

// Menschliche Meldungen (ohne Befehle); technische Angaben stehen in kind, status und url.
function httpError(status, url) {
  const source = sourceName(url);
  if (status === 429) {
    return new NetError(`${source} begrenzt gerade die Downloads (429). Versuche es in ein paar Minuten noch einmal.`, { kind: 'rate-limit', status, url });
  }
  if (status >= 500) {
    return new NetError(`${source} hat gerade Probleme (Fehler ${status}). Versuche es etwas später noch einmal.`, { kind: 'http', status, url });
  }
  if (status === 404) {
    return new NetError(`Die Spieldaten-Datei „${fileLabel(url)}“ wurde nicht gefunden (404).`, { kind: 'http', status, url });
  }
  return new NetError(`${source} hat den Download von „${fileLabel(url)}“ abgelehnt (Fehler ${status}).`, { kind: 'http', status, url });
}

function networkError(url, cause) {
  const source = sourceName(url);
  const target = source === 'GitHub' ? 'zu GitHub' : 'zum Server';
  return new NetError(`Keine Verbindung ${target}. Prüfe die Internetverbindung und versuche es noch einmal.`, { kind: 'network', url, cause });
}

function timeoutError(url, timeoutMs) {
  return new NetError(`${sourceName(url)} antwortet zu langsam (keine vollständige Antwort nach ${Math.round(timeoutMs / 1000)} s). `
    + 'Prüfe die Internetverbindung und versuche es noch einmal.', { kind: 'timeout', url });
}

function tooLargeError(url, maxBytes) {
  return new NetError(`Die Datei „${fileLabel(url)}“ ist größer als erwartet (über ${formatSize(maxBytes)}) und wurde nicht geladen.`,
    { kind: 'too-large', url });
}

const HTTP_DATE_PATTERN = /^[A-Za-z]{3}, \d{2} [A-Za-z]{3} \d{4} \d{2}:\d{2}:\d{2} GMT$/;

// Retry-After: Sekunden oder HTTP-Datum („Tue, 27 Oct 2026 10:00:05 GMT“) → Millisekunden (null, wenn fehlt oder unlesbar)
export function parseRetryAfter(value, now = Date.now()) {
  if (typeof value !== 'string') return null;
  const text = value.trim();
  if (/^\d{1,9}$/.test(text)) return Number(text) * 1000;
  if (!HTTP_DATE_PATTERN.test(text)) return null;
  const date = Date.parse(text);
  return Number.isNaN(date) ? null : Math.max(0, date - now);
}

// Grund des Abbruchs (ältere Browser kennen signal.reason nicht).
function abortReason(signal) {
  return signal.reason ?? new DOMException('Der Download wurde abgebrochen.', 'AbortError');
}

function defaultSleep(ms, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortReason(signal));
      return;
    }
    const onAbort = () => {
      clearTimeout(timer);
      reject(abortReason(signal));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

// Erfüllt nie, lehnt beim Abbruch ab: damit hängt das Lesen auch dann nicht, wenn der Körper das Signal nicht kennt.
function abortPromise(signal) {
  const promise = new Promise((resolve, reject) => {
    if (signal.aborted) reject(abortReason(signal));
    else signal.addEventListener('abort', () => reject(abortReason(signal)), { once: true });
  });
  promise.catch(() => {});
  return promise;
}

// Liest den Körper und bricht ab, sobald er größer als maxBytes wird oder das Signal abbricht.
async function readBody(response, url, maxBytes, signal) {
  const aborted = abortPromise(signal);
  const reader = response.body?.getReader?.();
  if (!reader) {
    const bytes = new Uint8Array(await Promise.race([response.arrayBuffer(), aborted]));
    if (bytes.length > maxBytes) throw tooLargeError(url, maxBytes);
    return bytes;
  }
  const chunks = [];
  let size = 0;
  for (;;) {
    let step;
    try {
      step = await Promise.race([reader.read(), aborted]);
    } catch (error) {
      reader.cancel().catch(() => {});
      throw error;
    }
    const { done, value } = step;
    if (done) break;
    size += value.length;
    if (size > maxBytes) {
      reader.cancel().catch(() => {});
      throw tooLargeError(url, maxBytes);
    }
    chunks.push(value);
  }
  if (chunks.length === 1) return chunks[0];
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

// Ein Versuch mit eigenem Zeitlimit (gilt für Antwort und Körper). Fehler immer als NetError, außer beim Abbruch von außen.
async function attempt(url, { maxBytes, timeoutMs, fetch, signal }) {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  const onAbort = () => controller.abort(abortReason(signal));
  signal?.addEventListener('abort', onAbort, { once: true });
  try {
    let response;
    try {
      response = await fetch(url, {
        method: 'GET',
        credentials: 'omit',
        referrerPolicy: 'no-referrer',
        cache: 'default',
        redirect: 'follow',
        signal: controller.signal,
      });
    } catch (error) {
      throw networkError(url, error);
    }
    if (!response.ok) {
      const error = httpError(response.status, url);
      if (error.kind === 'rate-limit' || error.status >= 500) error.retryAfterMs = parseRetryAfter(response.headers?.get?.('retry-after'));
      response.body?.cancel?.().catch?.(() => {});
      throw error;
    }
    const declared = Number(response.headers?.get?.('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) {
      response.body?.cancel?.().catch?.(() => {});
      throw tooLargeError(url, maxBytes);
    }
    try {
      return await readBody(response, url, maxBytes, controller.signal);
    } catch (error) {
      if (error instanceof NetError) throw error;
      throw networkError(url, error);
    }
  } catch (error) {
    if (signal?.aborted) throw abortReason(signal);
    if (timedOut) throw timeoutError(url, timeoutMs);
    throw error;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onAbort);
  }
}

// → Uint8Array. maxBytes ist Pflicht (Schutz vor unerwartet großen Antworten).
export async function fetchBytes(url, {
  maxBytes, timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES,
  fetch = globalThis.fetch, sleep = defaultSleep, signal,
} = {}) {
  if (typeof url !== 'string' || url === '') throw new TypeError('fetchBytes: Adresse fehlt.');
  if (!Number.isFinite(maxBytes) || maxBytes <= 0) throw new TypeError('fetchBytes: maxBytes (Größengrenze) fehlt.');
  if (typeof fetch !== 'function') {
    throw new NetError('Dieser Browser kann keine Dateien nachladen (fetch fehlt).', { kind: 'network', url });
  }
  if (signal?.aborted) throw abortReason(signal);
  const tries = Math.max(0, Math.floor(retries)) + 1;
  for (let index = 0; ; index++) {
    try {
      return await attempt(url, { maxBytes, timeoutMs, fetch, signal });
    } catch (error) {
      if (!(error instanceof NetError) || !error.retryable || index + 1 >= tries) throw error;
      const backoff = RETRY_DELAYS_MS[Math.min(index, RETRY_DELAYS_MS.length - 1)];
      const retryAfter = error.retryAfterMs ?? null;
      // Verlangt der Server eine lange Pause, lohnt Warten nicht: gleich ehrlich melden.
      if (retryAfter !== null && retryAfter > MAX_RETRY_AFTER_MS) throw error;
      await sleep(Math.max(backoff, retryAfter ?? 0), signal);
    }
  }
}

// → geparstes JSON (UTF-8, BOM erlaubt). Kaputtes JSON: NetError mit kind 'format'.
export async function fetchJson(url, options = {}) {
  const bytes = await fetchBytes(url, options);
  let text;
  try {
    text = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch (error) {
    throw new NetError(`Die Datei „${fileLabel(url)}“ ist keine gültige Textdatei (UTF-8).`, { kind: 'format', url, cause: error });
  }
  try {
    return JSON.parse(text);
  } catch (error) {
    throw new NetError(`Die Datei „${fileLabel(url)}“ ist beschädigt (kein gültiges JSON).`, { kind: 'format', url, cause: error });
  }
}

// Höchstens `concurrency` Aufgaben gleichzeitig; limit(fn) → Promise mit dem Ergebnis von fn().
export function createLimiter(concurrency) {
  if (!Number.isInteger(concurrency) || concurrency < 1) throw new TypeError('createLimiter: concurrency muss eine ganze Zahl ab 1 sein.');
  let active = 0;
  const queue = [];
  const next = () => {
    while (active < concurrency && queue.length > 0) {
      const { fn, resolve, reject } = queue.shift();
      active++;
      Promise.resolve()
        .then(fn)
        .then(resolve, reject)
        .finally(() => {
          active--;
          next();
        });
    }
  };
  return (fn) => new Promise((resolve, reject) => {
    if (typeof fn !== 'function') {
      reject(new TypeError('createLimiter: Aufgabe muss eine Funktion sein.'));
      return;
    }
    queue.push({ fn, resolve, reject });
    next();
  });
}
