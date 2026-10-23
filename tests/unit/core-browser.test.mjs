import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startServer } from '../../scripts/serve.mjs';
import { launchBrowser } from '../browser.mjs';
import { Builder } from '../../js/core/builder.js';
import { describeState } from '../../js/core/describe.js';
import build from '../fixtures/core/example-house.js';
import { summarize } from '../fixtures/core/browser-summary.js';
import { loadFixtureData } from '../fixtures/core/setup.mjs';

test('Kern läuft im Browser und im Modul-Worker genau wie in Node (inkl. Transfer)', async (t) => {
  let browser;
  try {
    browser = await launchBrowser({ gpu: 'swiftshader' });
  } catch (error) {
    if (/Kein Chrome/.test(error.message)) {
      t.skip(error.message);
      return;
    }
    throw error;
  }
  const server = await startServer({ port: 0 });
  try {
    await browser.goto(`${server.url}/tests/fixtures/core/browser-check.html`);
    await browser.waitFor('document.body.dataset.result || document.body.dataset.error', 20000);
    assert.equal(await browser.eval('document.body.dataset.error ?? null'), null);
    const result = JSON.parse(await browser.eval('document.body.dataset.result'));

    loadFixtureData();
    const b = new Builder();
    build(b);
    const expected = summarize(b.finalize());
    assert.deepEqual(result.main, expected);
    assert.deepEqual(result.worker, expected);
    assert.deepEqual(result.rebuilt, { count: expected.blockCount, hash: expected.hash });
    assert.deepEqual(result.describe, describeState('repeater[delay=2,facing=south]'));
    assert.deepEqual(browser.errors, []);
  } finally {
    await browser.close();
    await server.close();
  }
});
