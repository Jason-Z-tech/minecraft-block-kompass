// Katalogsuche für Freitext und Textfilter (ARCHITEKTUR §12.1). Rein: kein DOM, läuft in Browser, Worker und Node.
// Normalisieren → Wörter → Synonyme, Wortstämme und Tippfehler (Damerau-Levenshtein) → gewichtete Bewertung.

export const MATCH_THRESHOLD = 0.45;
export const SUGGEST_THRESHOLD = 0.2;
const MAX_QUERY_LENGTH = 200;
const MAX_TOKENS = 12;

// Feldgewichte: ein Treffer im Titel zählt am meisten
const FIELD_WEIGHTS = Object.freeze({ title: 10, id: 8, aliases: 9, tags: 8, subtitle: 5, category: 4 });
// Felder, deren ganzer Text als „genau dieser Bau“ gilt
const EXACT_FIELDS = new Set(['title', 'aliases', 'id']);

// Kategorien aus §8 (hier noch einmal, damit das Modul ohne UI-Code auskommt)
const CATEGORY_TEXT = Object.freeze({
  haeuser: 'Häuser Wohnen Haus',
  wahrzeichen: 'Wahrzeichen Riesenbauten',
  fantasy: 'Fantasy Anime Film',
  mittelalter: 'Mittelalter Burgen',
  klein: 'Kleine Projekte Deko',
  redstone: 'Redstone',
  farmen: 'Farmen Technik Farm',
  infrastruktur: 'Brücken Bahnhöfe Häfen',
});

// Füllwörter, die bei der Suche nichts bedeuten
export const STOPWORDS = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des', 'ein', 'eine', 'einen', 'einem', 'einer', 'eines',
  'und', 'oder', 'aus', 'von', 'vom', 'im', 'in', 'am', 'an', 'auf', 'mit', 'fuer', 'zu', 'zum', 'zur', 'bei',
  'ich', 'du', 'wir', 'mir', 'mich', 'mein', 'meine', 'meinen', 'will', 'moechte', 'moechten', 'haette', 'gern', 'gerne',
  'bitte', 'bau', 'baue', 'bauen', 'mach', 'mache', 'machen', 'erstelle', 'erstellen', 'zeig', 'zeige', 'wie', 'kann',
  'man', 'so', 'was', 'als', 'ist', 'sein', 'mal', 'auch', 'noch', 'nach', 'minecraft', 'build', 'make', 'the', 'a', 'an',
  'of', 'from', 'with', 'please', 'i', 'want', 'to', 'and', 'or',
]);

// Gleichbedeutende Wörter (normalisiert). Jede Gruppe gilt in beide Richtungen.
export const SYNONYM_GROUPS = Object.freeze([
  ['tokio', 'tokyo'],
  ['turm', 'tuerme', 'tower', 'towers'],
  ['burg', 'burgen', 'schloss', 'schloesser', 'castle', 'castles', 'festung', 'fortress'],
  ['bruecke', 'bruecken', 'bridge', 'bridges'],
  ['haus', 'haeuser', 'house', 'houses', 'home'],
  ['huette', 'huetten', 'hut', 'cabin'],
  ['kirche', 'kirchen', 'church', 'kathedrale', 'cathedral', 'dom'],
  ['tempel', 'temple', 'schrein', 'shrine'],
  ['bahnhof', 'bahnhoefe', 'station', 'railway'],
  ['hafen', 'haefen', 'harbor', 'harbour', 'port'],
  ['leuchtturm', 'lighthouse'],
  ['schiff', 'schiffe', 'ship', 'ships'],
  ['muehle', 'windmuehle', 'windmill', 'mill'],
  ['dorf', 'doerfer', 'village'],
  ['stadt', 'city'],
  ['garten', 'garden'],
  ['baum', 'baeume', 'tree', 'trees'],
  ['farm', 'farmen', 'farms'],
  ['tuer', 'tueren', 'door', 'doors', 'tor'],
  ['unendlichkeit', 'infinity'],
  ['eiffelturm', 'eiffel'],
  ['mittelalter', 'mittelalterlich', 'mittelalterliche', 'medieval'],
  ['japanisch', 'japanische', 'japan', 'japanese'],
  ['pyramide', 'pyramiden', 'pyramid'],
  ['wolkenkratzer', 'hochhaus', 'skyscraper'],
  ['brunnen', 'fountain', 'well'],
  ['statue', 'statuen', 'figur'],
  ['klein', 'kleine', 'kleines', 'small', 'tiny'],
  ['gross', 'grosse', 'grosses', 'big', 'large', 'riesig'],
  ['wachturm', 'watchtower'],
  ['mine', 'bergwerk'],
  ['eisen', 'iron'],
  ['weizen', 'wheat'],
]);

const SYNONYMS = new Map();
for (const group of SYNONYM_GROUPS) {
  for (const word of group) {
    const set = SYNONYMS.get(word) ?? new Set();
    for (const other of group) if (other !== word) set.add(other);
    SYNONYMS.set(word, set);
  }
}

const UMLAUTS = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss', æ: 'ae', œ: 'oe', ø: 'o' };

/** Suchform: klein, ä→ae, ö→oe, ü→ue, ß→ss, Akzente weg, Satzzeichen weg, Leerzeichen zusammengefasst. */
export function normalize(text) {
  if (typeof text !== 'string' && typeof text !== 'number') return '';
  return String(text)
    .slice(0, 2000)
    .normalize('NFC')
    .toLowerCase()
    .replace(/[äöüßæœø]/g, (char) => UMLAUTS[char])
    .normalize('NFKD')
    .replace(/\p{M}+/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

/** Wörter einer Eingabe (ohne Füllwörter, ohne Doppelte). Bestehen alle aus Füllwörtern, bleiben sie erhalten. */
export function tokenize(text, { keepStopwords = false } = {}) {
  const words = normalize(String(text ?? '').slice(0, MAX_QUERY_LENGTH)).split(' ').filter(Boolean);
  const unique = [...new Set(words)];
  if (keepStopwords) return unique.slice(0, MAX_TOKENS);
  const meaningful = unique.filter((word) => !STOPWORDS.has(word));
  return (meaningful.length ? meaningful : unique).slice(0, MAX_TOKENS);
}

export function synonymsOf(token) {
  return SYNONYMS.get(token) ?? new Set();
}

/** Grober deutscher/englischer Wortstamm: häufige Endungen weg (nur bei Wörtern ab 5 Buchstaben). */
export function stem(word) {
  if (word.length < 5) return word;
  for (const ending of ['ern', 'en', 'er', 'es', 'em', 'e', 'n', 's']) {
    if (word.endsWith(ending) && word.length - ending.length >= 4) return word.slice(0, -ending.length);
  }
  return word;
}

/** Damerau-Levenshtein (eingeschränkt, „optimal string alignment“); bricht ab, sobald max überschritten ist. */
export function damerauLevenshtein(a, b, max = Infinity) {
  if (a === b) return 0;
  if (Math.abs(a.length - b.length) > max) return max + 1;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prevPrev = null;
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const row = new Array(b.length + 1);
    row[0] = i;
    let rowMin = row[0];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let value = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost);
      if (prevPrev && i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) value = Math.min(value, prevPrev[j - 2] + 1);
      row[j] = value;
      if (value < rowMin) rowMin = value;
    }
    if (rowMin > max) return max + 1;
    prevPrev = prev;
    prev = row;
  }
  return prev[b.length];
}

/** Erlaubte Tippfehler je Wortlänge: bis 4 Buchstaben keine, bis 7 einer, sonst zwei. */
export function allowedTypos(length) {
  if (length <= 4) return 0;
  if (length <= 7) return 1;
  return 2;
}

// Güte, mit der ein Suchwort ein Feldwort trifft (0 … 1) und die Art des Treffers
function wordMatch(query, word) {
  if (query === word) return [1, 'exact'];
  if (synonymsOf(query).has(word)) return [0.9, 'synonym'];
  if (query.length >= 5 && word.length >= 5 && stem(query) === stem(word)) return [0.9, 'stem'];
  if (query.length >= 3 && word.startsWith(query)) return [query.length >= 5 ? 0.85 : 0.75, 'prefix'];
  if (query.length >= 4 && word.length > query.length && word.includes(query)) return [0.6, 'part'];
  const allowed = allowedTypos(Math.min(query.length, word.length));
  if (allowed > 0 && query[0] === word[0]) {
    const distance = damerauLevenshtein(query, word, allowed);
    if (distance <= allowed) return [distance === 1 ? 0.75 : 0.6, 'typo'];
  }
  return [0, null];
}

function bestWordMatch(query, words) {
  let best = [0, null];
  for (const word of words) {
    const match = wordMatch(query, word);
    if (match[0] > best[0]) best = match;
    if (best[0] === 1) break;
  }
  return best;
}

function fieldTexts(entry) {
  const out = [];
  const add = (field, value) => {
    if (typeof value === 'string' && value.trim()) out.push([field, value]);
  };
  add('title', entry.title);
  if (typeof entry.id === 'string') add('id', entry.id.replace(/^spiel-/, '').replace(/-/g, ' '));
  for (const alias of Array.isArray(entry.aliases) ? entry.aliases : []) add('aliases', alias);
  for (const tag of Array.isArray(entry.tags) ? entry.tags : []) add('tags', tag);
  add('subtitle', entry.subtitle);
  if (typeof entry.category === 'string') {
    add('category', entry.category);
    if (Object.hasOwn(CATEGORY_TEXT, entry.category)) add('category', CATEGORY_TEXT[entry.category]);
  }
  return out;
}

const fieldCache = new WeakMap();

function searchFields(entry) {
  let fields = fieldCache.get(entry);
  if (!fields) {
    fields = fieldTexts(entry).map(([field, text]) => {
      const normalized = normalize(text);
      const words = normalized.split(' ').filter(Boolean);
      const meaningful = words.filter((w) => !STOPWORDS.has(w));
      return { field, weight: FIELD_WEIGHTS[field], text, words, compact: (meaningful.length ? meaningful : words).join('') };
    }).filter((f) => f.words.length);
    fieldCache.set(entry, fields);
  }
  return fields;
}

/** Einträge aus einem Katalog-Objekt ({ builds }) oder einer Liste. */
export function catalogEntries(catalog) {
  const list = Array.isArray(catalog) ? catalog : Array.isArray(catalog?.builds) ? catalog.builds : [];
  return list.filter((entry) => entry && typeof entry === 'object' && typeof entry.id === 'string' && typeof entry.title === 'string');
}

/** Bewertet einen Eintrag für die Suchwörter → { score, matched, exact } (exact: Suche = ganzer Titel, Alias oder ID). */
export function scoreEntry(entry, tokens) {
  if (!tokens.length) return { score: 0, matched: [], exact: false };
  const fields = searchFields(entry);
  const matched = [];
  let total = 0;
  for (const token of tokens) {
    let best = 0;
    let hit = null;
    for (const field of fields) {
      const [quality, kind] = bestWordMatch(token, field.words);
      const value = quality * field.weight;
      if (value > best) {
        best = value;
        hit = { token, field: field.field, kind, text: field.text };
      }
    }
    total += best;
    if (hit) matched.push(hit);
  }
  let score = total / (tokens.length * 10);
  let exact = false;
  // ganze Wortgruppe am Stück („tokyo sky tree“ = „Tokyo Skytree“)
  const compactQuery = tokens.join('');
  for (const field of fields) {
    if (field.compact === compactQuery && EXACT_FIELDS.has(field.field)) {
      exact = true;
      score = 1;
    }
  }
  if (compactQuery.length >= 5) {
    for (const field of fields) {
      if (field.compact === compactQuery) score = Math.max(score, field.weight / 10);
      else if (field.compact.includes(compactQuery)) score = Math.max(score, (0.75 * field.weight) / 10);
      else if (tokens.length > 1) {
        const allowed = allowedTypos(compactQuery.length);
        if (compactQuery[0] === field.compact[0] && damerauLevenshtein(compactQuery, field.compact, allowed) <= allowed) {
          score = Math.max(score, (0.8 * field.weight) / 10);
        }
      }
    }
  }
  return { score: Math.round(Math.min(score, 1) * 1000) / 1000, matched, exact };
}

/**
 * Durchsucht den Katalog → [{ entry, score, matched }], beste zuerst.
 * Leere Suche: alle Einträge (score 0) – praktisch für Textfilter.
 * Optionen: limit, category (Slug), threshold (Mindestwert, Standard MATCH_THRESHOLD), relative (0 … 1: nur Treffer ≥ relative · bester;
 * gibt es dann einen Eintrag, dessen Titel, Alias oder ID genau der Suche entspricht, bleiben nur solche).
 */
export function searchCatalog(catalog, query, { limit = 20, category = null, threshold = MATCH_THRESHOLD, relative = 0 } = {}) {
  const max = Number.isInteger(limit) && limit > 0 ? Math.min(limit, 1000) : 20;
  let entries = catalogEntries(catalog);
  if (typeof category === 'string' && category) entries = entries.filter((entry) => entry.category === category);
  const tokens = Array.isArray(query) ? query.filter((t) => typeof t === 'string' && t) : tokenize(query);
  if (!tokens.length) return entries.slice(0, max).map((entry) => ({ entry, score: 0, matched: [] }));
  const results = [];
  for (const entry of entries) {
    const { score, matched, exact } = scoreEntry(entry, tokens);
    if (score >= threshold) results.push({ entry, score, matched, exact });
  }
  results.sort((a, b) => b.score - a.score || Number(b.exact) - Number(a.exact) || a.entry.title.localeCompare(b.entry.title, 'de'));
  let kept = results;
  if (relative > 0 && results.length) {
    const cut = results[0].score * relative;
    kept = results.some((r) => r.exact) ? results.filter((r) => r.exact) : results.filter((r) => r.score >= cut);
  }
  return kept.slice(0, max).map(({ entry, score, matched }) => ({ entry, score, matched }));
}
