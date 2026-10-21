const assert = require('node:assert/strict');
const fs = require('node:fs');
const p = require('/Users/ali/server-work/ai-home/manychat-design/node_modules/puppeteer-core');

const output = '/tmp/cmp250-help-dialog';
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await p.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  const results = [];
  const pageErrors = [];
  const blockedWrites = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', request => {
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        blockedWrites.push({ method: request.method(), path: new URL(request.url()).pathname });
        return request.abort();
      }
      return request.continue();
    });
    for (const [width, height] of [[568, 320], [320, 568], [390, 844], [1440, 900]]) {
      await page.setViewport({ width, height });
      await page.goto('http://127.0.0.1:8824/dashboard/help-center/settings', { waitUntil: 'networkidle2' });
      await page.waitForFunction(() => [...document.querySelectorAll('button')].some(el => el.textContent.includes('إنشاء بوابة')));
      const buttons = await page.$$('button');
      for (const button of buttons) {
        if (await button.evaluate(el => el.textContent.includes('إنشاء بوابة'))) {
          await button.click();
          break;
        }
      }
      await page.waitForSelector('#portal-name');
      await page.waitForFunction(() => {
        const dialog = document.querySelector('[role=dialog]');
        return dialog && dialog.getAnimations().every(animation => animation.playState === 'finished');
      });
      const geometry = await page.$eval('[role=dialog]', el => {
        const rect = el.getBoundingClientRect();
        return { top: rect.top, bottom: rect.bottom, client: el.clientHeight, scroll: el.scrollHeight, overflow: getComputedStyle(el).overflowY };
      });
      assert(geometry.top >= 15 && geometry.bottom <= height - 15, JSON.stringify(geometry));
      assert.equal(geometry.overflow, 'auto');
      await page.focus('#portal-name');
      await page.keyboard.type('Responsive check');
      const cancel = await page.$('[role=dialog] [data-slot=dialog-footer] button');
      await cancel.focus();
      const visible = await cancel.evaluate(el => {
        const rect = el.getBoundingClientRect();
        return rect.top >= 0 && rect.bottom <= innerHeight;
      });
      assert(visible, 'Cancel must be reachable by keyboard');
      await page.screenshot({ path: `${output}/help-dialog-${width}x${height}.png` });
      await cancel.click();
      await page.waitForSelector('[role=dialog]', { hidden: true });
      results.push({ width, height, geometry, keyboardReachedCancel: true, cancelCloses: true });
    }
    assert.deepEqual(pageErrors, []);
    fs.writeFileSync(`${output}/results.json`, JSON.stringify({ results, pageErrors, blockedWrites }, null, 2));
    console.log(JSON.stringify({ results, pageErrors, blockedWrites }, null, 2));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
