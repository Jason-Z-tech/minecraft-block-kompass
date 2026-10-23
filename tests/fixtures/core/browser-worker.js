// Modul-Worker: baut das Beispielhaus und schickt das Volumen per Transfer zurück.
import { setBlockData } from '../../../js/core/block-data.js';
import { Builder } from '../../../js/core/builder.js';
import { BlockVolume } from '../../../js/core/volume.js';
import build from './example-house.js';
import { summarize } from './browser-summary.js';

self.onmessage = ({ data }) => {
  try {
    setBlockData(data.blocks);
    const b = new Builder();
    build(b);
    const result = b.finalize();
    const transfer = result.volume.toTransfer();
    self.postMessage({ summary: summarize(result), transfer }, BlockVolume.transferList(transfer));
  } catch (error) {
    self.postMessage({ error: error.message });
  }
};
