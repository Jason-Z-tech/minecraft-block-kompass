// Schrittplan (§6.4): Kapitel in Modul-Reihenfolge; Kapitel mit b.step() → genau diese Schritte
// (Blöcke vor dem ersten step() bilden einen ersten Schritt mit dem Kapiteltitel); Kapitel ohne
// b.step() → ein Schritt pro belegter Ebene von unten nach oben („Ebene N“, N = y + 1).

export const MAX_STEPS = 65535; // Schrittnummern 0 … 65534, 65535 ist reserviert

export function layerTitle(layerY) {
  return `Ebene ${layerY + 1}`;
}

// phases: [{ title, text, tips, steps: [{ title, text }] }]
// occupancy: je Kapitel { pre: boolean, layers: Set<number> } (layers in Welt-y)
// minY, height: unterste Ebene und Höhe des Baus (für die Umrechnung auf Ebene 1 = y 0)
export function planSteps(phases, occupancy, minY, height) {
  const steps = [];
  const phaseSteps = phases.map(() => []);
  const pre = phases.map(() => -1);
  const explicit = phases.map(() => []);
  const layers = phases.map(() => null);

  const push = (phase, title, text, layerY) => {
    const index = steps.length;
    steps.push({ index, phase, title, text, layerY });
    phaseSteps[phase].push(index);
    return index;
  };

  phases.forEach((phase, p) => {
    const occ = occupancy[p] ?? { pre: false, layers: new Set() };
    if (phase.steps.length > 0) {
      if (occ.pre) pre[p] = push(p, phase.title, '', null);
      phase.steps.forEach((s, k) => {
        explicit[p][k] = push(p, s.title, s.text, null);
      });
      return;
    }
    const table = new Int32Array(Math.max(height, 0)).fill(-1);
    for (const y of [...occ.layers].sort((a, b) => a - b)) {
      const layerY = y - minY;
      table[layerY] = push(p, layerTitle(layerY), '', layerY);
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

  // Schritt einer Markierung: wie stepFor, sonst nächstliegender sinnvoller Schritt (oder null).
  function noteStep(p, k, y) {
    const direct = p >= 0 && p < phases.length ? stepFor(p, k, y) : undefined;
    if (direct !== undefined && direct >= 0) return direct;
    if (p >= 0 && layers[p]) {
      const table = layers[p];
      const start = Math.min(Math.max(y - minY, 0), table.length - 1);
      for (let i = start; i >= 0; i--) if (table[i] >= 0) return table[i];
    }
    if (p >= 0 && phaseSteps[p]?.length) return phaseSteps[p][0];
    for (let q = Math.min(p, phases.length) - 1; q >= 0; q--) {
      if (phaseSteps[q].length) return phaseSteps[q][phaseSteps[q].length - 1];
    }
    return steps.length ? 0 : null;
  }

  return { steps, phaseSteps, stepFor, noteStep };
}
