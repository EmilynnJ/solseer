// Local verification fixture: actual app CSS and installed SDK shadow CSS.
const { chromium } = require('playwright');
const fs = require('node:fs');
const assert = require('node:assert/strict');
(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'msedge' });
  try {
    const appCss = fs.readFileSync('apps/client/src/styles.css', 'utf8');
    const sdkCss = fs.readFileSync('node_modules/@cloudflare/realtimekit-ui/dist/collection/components/rtk-meeting/rtk-meeting.css', 'utf8');
    const source = fs.readFileSync('apps/client/src/pages/reading.tsx', 'utf8');
    assert.match(source, /mode="fill"/);
    for (const width of [1366, 390]) {
      const page = await browser.newPage({ viewport: { width, height: 820 } });
      await page.setContent(`<style>${appCss}</style><div class="live-room"><header class="session-bar"><a>Exit screen</a><div><strong>Reading in progress</strong></div><div class="session-metrics"><span>2:10</span><span>Est. $6.00</span><span>Balance $2.80</span></div><button class="button end-button">End session</button></header><div class="low-balance">Less than two minutes remain at the current rate.</div><div class="meeting-stage"><rtk-meeting mode="fill"></rtk-meeting></div></div>`);
      await page.evaluate(css => {
        const el = document.querySelector('rtk-meeting');
        el.attachShadow({ mode: 'open' }).innerHTML = `<style>${css}</style><div>Meeting content</div>`;
        document.querySelector('button').onclick = () => document.body.dataset.endClicked = 'true';
      }, sdkCss);
      const end = page.getByRole('button', { name: 'End session' });
      await end.click({ timeout: 3000 });
      assert.equal(await page.locator('body').getAttribute('data-end-clicked'), 'true');
      const header = await page.locator('.session-bar').boundingBox();
      const room = await page.locator('rtk-meeting').boundingBox();
      assert.ok(room.y >= header.y + header.height);
      assert.ok(room.y + room.height <= 821);
      await page.screenshot({ path: `.verification/reading-layout-${width}.png` });
      console.log(JSON.stringify({ width, endClickable: true, header, room }));
      await page.close();
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
