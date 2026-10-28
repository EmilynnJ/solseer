import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';

// Verify the raw build output, as fetched by tools that do not run JavaScript.
test('homepage exposes public app screenshots to image crawlers', () => {
  const dist = new URL('../dist/', import.meta.url);
  const document = new JSDOM(readFileSync(new URL('index.html', dist), 'utf8')).window.document;
  for (const name of ['home', 'readers', 'community']) {
    const path = `/images/soulseer-${name}-preview.jpg`;
    const image = document.querySelector(`img[src="${path}"]`);
    assert.ok(image, `missing screenshot in initial HTML: ${path}`);
    assert.ok(image.alt, `missing description: ${path}`);
    assert.ok(existsSync(new URL(`.${path}`, dist)), `missing image file: ${path}`);
  }
});
