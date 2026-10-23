// Deterministischer Zufall: gleicher Startwert → gleiche Folge, in Browser und Node identisch.
// Hash: cyrb128, Generator: sfc32 (beide gemeinfrei, 32-Bit-Ganzzahlarithmetik).

export function hashSeed(text) {
  const str = String(text);
  let h1 = 1779033703;
  let h2 = 3144134277;
  let h3 = 1013904242;
  let h4 = 2773480762;
  for (let i = 0; i < str.length; i++) {
    const k = str.charCodeAt(i);
    h1 = h2 ^ Math.imul(h1 ^ k, 597399067);
    h2 = h3 ^ Math.imul(h2 ^ k, 2869860233);
    h3 = h4 ^ Math.imul(h3 ^ k, 951274213);
    h4 = h1 ^ Math.imul(h4 ^ k, 2716044179);
  }
  h1 = Math.imul(h3 ^ (h1 >>> 18), 597399067);
  h2 = Math.imul(h4 ^ (h2 >>> 22), 2869860233);
  h3 = Math.imul(h1 ^ (h3 >>> 17), 951274213);
  h4 = Math.imul(h2 ^ (h4 >>> 19), 2716044179);
  h1 ^= h2 ^ h3 ^ h4;
  h2 ^= h1;
  h3 ^= h1;
  h4 ^= h1;
  return [h1 >>> 0, h2 >>> 0, h3 >>> 0, h4 >>> 0];
}

// Positions-Hash (uint32), unabhängig von der Aufruf-Reihenfolge – z. B. für Material-Mischungen.
export function hashPosition(x, y, z, salt = 0) {
  let h = Math.imul(x | 0, 0x8da6b343) ^ Math.imul(y | 0, 0xd8163841) ^ Math.imul(z | 0, 0xcb1ab31f) ^ Math.imul(salt | 0, 0x165667b1);
  h ^= h >>> 16;
  h = Math.imul(h, 0x85ebca6b);
  h ^= h >>> 13;
  h = Math.imul(h, 0xc2b2ae35);
  h ^= h >>> 16;
  return h >>> 0;
}

function checkWeightedEntries(entries) {
  if (!Array.isArray(entries) || entries.length === 0) throw new Error('pickWeighted braucht eine nicht leere Liste [[wert, gewicht], …].');
  let total = 0;
  for (const entry of entries) {
    const weight = Array.isArray(entry) ? entry[1] : NaN;
    if (!Number.isFinite(weight) || weight < 0) throw new Error('pickWeighted: jedes Gewicht muss eine Zahl ≥ 0 sein.');
    total += weight;
  }
  if (total <= 0) throw new Error('pickWeighted: die Summe der Gewichte muss größer als 0 sein.');
  return total;
}

export function createRandom(seed = 'block-kompass') {
  let [a, b, c, d] = hashSeed(seed);

  function next() {
    const t = (((a + b) | 0) + d) | 0;
    d = (d + 1) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  }

  for (let i = 0; i < 15; i++) next();

  function int(min, max) {
    if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
      throw new Error(`rngInt braucht ganze Zahlen mit min ≤ max (bekommen: ${min}, ${max}).`);
    }
    const range = max - min + 1;
    if (range > 4294967296) throw new Error('rngInt: der Bereich ist zu groß (höchstens 2³² Werte).');
    return min + Math.floor(next() * range);
  }

  function pick(array) {
    if (!Array.isArray(array) || array.length === 0) throw new Error('pick braucht eine nicht leere Liste.');
    return array[Math.floor(next() * array.length)];
  }

  function pickWeighted(entries) {
    const total = checkWeightedEntries(entries);
    let r = next() * total;
    for (const [value, weight] of entries) {
      if (r < weight) return value;
      r -= weight;
    }
    for (let i = entries.length - 1; i >= 0; i--) if (entries[i][1] > 0) return entries[i][0];
    return entries[entries.length - 1][0];
  }

  function chance(p) {
    if (!Number.isFinite(p) || p < 0 || p > 1) throw new Error(`chance braucht eine Wahrscheinlichkeit von 0 bis 1 (bekommen: ${p}).`);
    return next() < p;
  }

  return { next, int, pick, pickWeighted, chance };
}
