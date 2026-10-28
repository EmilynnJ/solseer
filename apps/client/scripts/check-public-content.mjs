import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { JSDOM } from 'jsdom';
const dist = new URL('../dist/', import.meta.url);
function page(path) { return new JSDOM(readFileSync(new URL(path, dist), 'utf8')).window.document; }
const home = page('index.html');
assert.ok(home.documentElement.classList.contains('dark'), 'initial theme missing');
assert.match(home.querySelector('h1').textContent, /Guidance that meets you.*heart to heart/s);
assert.match(home.body.textContent, /Come sit with the SoulSeer community/);
assert.ok(home.querySelector('form input[type="email"]'), 'real newsletter form missing');
assert.ok(home.querySelector('form input[type="email"]').disabled, 'static form must wait for React handlers');
assert.ok(home.querySelector('header nav a[href="/readers/"]'), 'public navigation missing');
assert.equal(home.querySelectorAll('img[src*="-preview.jpg"]').length, 0, 'screenshot gallery returned');
for (const path of ['/images/soulseer-hero-logo.jpg', '/images/soulseer-ethereal-background.webp']) {
 assert.ok(home.querySelector(`img[src="${path}"]`), `actual artwork missing: ${path}`);
 assert.ok(existsSync(new URL(`.${path}`, dist)));
}
assert.match(page('about/index.html').body.textContent, /Founded by psychic medium Emilynn/);
assert.ok(page('readers/index.html').querySelector('select'), 'reader filters missing');
assert.match(page('help/index.html').body.textContent, /Billing begins only after both assigned participants/);
assert.match(page('community/index.html').body.textContent, /Join our Discord Server/);
assert.equal(page('_app.html').querySelector('#root').children.length, 0);
console.log('Verified actual public page content, navigation, forms and artwork without JavaScript; no screenshot gallery.');
