const { chromium } = require('playwright');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const page = await browser.newPage();
    await page.goto(process.argv[2], { waitUntil: 'networkidle', timeout: 30000 });
    console.log(JSON.stringify({ initialUrl: page.url(), title: await page.title(), body: (await page.locator('body').innerText()).slice(0,1800) }));
    const link = page.getByRole('contentinfo').getByRole('link', { name: 'Accessibility', exact: true });
    await link.click();
    const heading = page.getByRole('heading', { name: 'Accessibility statement', exact: true });
    await heading.waitFor({ state: 'visible' });
    const box = await heading.boundingBox();
    const contact = await page.getByRole('link', { name: 'contact support about accessibility' }).getAttribute('href');
    assert.ok(contact.startsWith('mailto:'));
    console.log(JSON.stringify({ url: page.url(), footerLinkWorks: true, headingViewportY: box.y, contact }));
    await page.screenshot({ path: '.verification/accessibility-live.png', fullPage: true });
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
