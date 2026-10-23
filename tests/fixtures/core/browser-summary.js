// Kurzfassung eines BuildResult/Volumens zum Vergleich zwischen Node, Browser und Worker.

export function hashVolume(volume) {
  let h = 2166136261;
  const mix = (n) => {
    h = Math.imul(h ^ n, 16777619);
  };
  for (const state of volume.palette) for (let i = 0; i < state.length; i++) mix(state.charCodeAt(i));
  for (const chunk of volume.chunkList()) {
    mix(chunk.cx);
    mix(chunk.cy);
    mix(chunk.cz);
    for (let i = 0; i < 4096; i++) mix(chunk.blocks[i] * 65536 + chunk.steps[i]);
  }
  return h >>> 0;
}

export function summarize(result) {
  return {
    blockCount: result.blockCount,
    size: result.size,
    phases: result.phases.length,
    steps: result.steps.map((s) => `${s.title}:${s.blockCount}`),
    materials: result.materials,
    paletteSize: result.volume.palette.length,
    hash: hashVolume(result.volume),
  };
}
