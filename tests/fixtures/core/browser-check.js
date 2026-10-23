// Testseite: Kern im Hauptthread und im Modul-Worker ausführen, Ergebnis in data-result ablegen.
import { setBlockData } from '../../../js/core/block-data.js';
import { setNames, describeState } from '../../../js/core/describe.js';
import { Builder } from '../../../js/core/builder.js';
import { BlockVolume } from '../../../js/core/volume.js';
import build from './example-house.js';
import { summarize, hashVolume } from './browser-summary.js';

async function loadJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: HTTP ${res.status}`);
  return res.json();
}

function runInWorker(blocks) {
  const worker = new Worker(new URL('./browser-worker.js', import.meta.url), { type: 'module' });
  return new Promise((resolve, reject) => {
    worker.onmessage = ({ data }) => {
      worker.terminate();
      if (data.error) reject(new Error(data.error));
      else resolve(data);
    };
    worker.onerror = (event) => {
      worker.terminate();
      reject(new Error(event.message || 'Worker-Fehler'));
    };
    worker.postMessage({ blocks });
  });
}

async function main() {
  const [blocks, names] = await Promise.all([loadJson('blocks.json'), loadJson('names.json')]);
  setBlockData(blocks);
  setNames(names);
  const b = new Builder();
  build(b);
  const result = b.finalize();
  const fromWorker = await runInWorker(blocks);
  const rebuilt = BlockVolume.fromTransfer(fromWorker.transfer);
  document.body.dataset.result = JSON.stringify({
    main: summarize(result),
    worker: fromWorker.summary,
    rebuilt: { count: rebuilt.count, hash: hashVolume(rebuilt) },
    describe: describeState('repeater[delay=2,facing=south]'),
  });
}

main().catch((error) => {
  document.body.dataset.error = error.message;
  console.error(error);
});
