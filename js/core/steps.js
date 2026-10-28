// Schrittplan (§6.4): Kapitel in Modul-Reihenfolge; Kapitel mit b.step() → genau diese Schritte
// (Blöcke vor dem ersten step() bilden einen eigenen ersten Schritt); Kapitel ohne b.step() → ein Schritt
// pro belegter Ebene von unten nach oben. Schritte haben keinen Titel und keinen Text.

export const MAX_STEPS = 65535; // Schrittnummern 0 … 65534, 65535 ist reserviert

// phases: [{ title, stepCount }] (stepCount = Zahl der b.step()-Aufrufe im Kapitel)
// occupancy: je Kapitel { pre: boolean, layers: Set<number> } (layers in Welt-y)
// minY, height: unterste Ebene und Höhe des Baus (für die Umrechnung auf Ebene 1 = y 0)
// → steps: [{ index, phase, layerY }] (layerY = null bei Schritten aus b.step())
export function planSteps(phases, occupancy, minY, height) {
  const steps = [];
  const phaseSteps = phases.map(() => []);
  const pre = phases.map(() => -1);
  const explicit = phases.map(() => []);
  const layers = phases.map(() => null);

  const push = (phase, layerY) => {
    const index = steps.length;
    steps.push({ index, phase, layerY });
    phaseSteps[phase].push(index);
    return index;
  };

  phases.forEach((phase, p) => {
    const occ = occupancy[p] ?? { pre: false, layers: new Set() };
    if (phase.stepCount > 0) {
      if (occ.pre) pre[p] = push(p, null);
      for (let k = 0; k < phase.stepCount; k++) explicit[p][k] = push(p, null);
      return;
    }
    const table = new Int32Array(Math.max(height, 0)).fill(-1);
    for (const y of [...occ.layers].sort((a, b) => a - b)) {
      const layerY = y - minY;
      table[layerY] = push(p, layerY);
    }
    layers[p] = table;
  });

  if (steps.length > MAX_STEPS) {
    throw new Error(`Zu viele Schritte (${steps.length}); erlaubt sind höchstens ${MAX_STEPS}.`);
  }

  // Schritt eines Blocks: Kapitel p, expliziter Schritt k (−1 = vor dem ersten step()), Welt-y.
  function stepFor(p, k, y) {
    if (layers[p]) return layers[p][y - minY];
    return k < 0 ? pre[p] : explicit[p][k];
  }

  return { steps, phaseSteps, stepFor };
}
