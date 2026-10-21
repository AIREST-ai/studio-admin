const assert = require('node:assert/strict');
const fs = require('node:fs');
const puppeteer = require('/Users/ali/server-work/ai-home/manychat-design/node_modules/puppeteer-core');

const output = '/tmp/cmp250-secondary-dialogs';
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  const results = [];
  const pageErrors = [];
  const blockedWrites = [];
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => pageErrors.push(error.message));
    await page.setRequestInterception(true);
    page.on('request', request => {
      const path = new URL(request.url()).pathname;
      if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
        blockedWrites.push({ method: request.method(), path });
        return request.abort();
      }
      if (path === '/api/cw/portals') {
        return request.respond({ status: 200, contentType: 'application/json', body: JSON.stringify({
          payload: [{ id: 987654, name: 'UI test fixture', slug: 'ui-fixture' }],
        }) });
      }
      if (path.startsWith('/api/cw/portals/987654/')) {
        return request.respond({ status: 200, contentType: 'application/json', body: '{"payload":[]}' });
      }
      return request.continue();
    });

    for (const [width, height] of [[568, 320], [320, 568], [390, 844], [1440, 900]]) {
      await page.setViewport({ width, height });
      for (const [route, label] of [['categories', 'New category|فئة جديدة'], ['locales', 'New locale|لغة جديدة']]) {
        await page.goto(`http://127.0.0.1:8824/dashboard/help-center/${route}`, { waitUntil: 'domcontentloaded', timeout: 60000 });
        await page.waitForFunction(() => document.body.textContent.includes('UI test fixture'));
        await page.waitForFunction(pattern => [...document.querySelectorAll('button')].some(el => new RegExp(pattern).test(el.textContent)), {}, label);
        async function openDialog() {
          for (const button of await page.$$('button')) {
            if (await button.evaluate((el, pattern) => new RegExp(pattern).test(el.textContent), label)) {
              await button.click();
              break;
            }
          }
          await page.waitForSelector('[role=dialog]');
          await page.waitForFunction(() => document.querySelector('[role=dialog]').getAnimations().every(animation => animation.playState === 'finished'));
        }
        await openDialog();
        const geometry = await page.$eval('[role=dialog]', el => {
          const rect = el.getBoundingClientRect();
          return { top: rect.top, bottom: rect.bottom, left: rect.left, right: rect.right, client: el.clientHeight, scroll: el.scrollHeight, overflow: getComputedStyle(el).overflowY };
        });
        assert(geometry.top >= 15 && geometry.bottom <= height - 15, `${route} ${width}x${height}: ${JSON.stringify(geometry)}`);
        assert(geometry.left >= 15 && geometry.right <= width - 15, 'Dialog must fit the viewport width');
        assert.equal(geometry.overflow, 'auto');
        const cancel = await page.$('[role=dialog] [data-slot=dialog-footer] button');
        await cancel.focus();
        assert(await cancel.evaluate(el => {
          const rect = el.getBoundingClientRect();
          return rect.top >= 0 && rect.bottom <= innerHeight;
        }), 'Keyboard focus must scroll Cancel into view');
        await page.screenshot({ path: `${output}/${route}-${width}x${height}.png` });
        await page.keyboard.press('Enter');
        await page.waitForSelector('[role=dialog]', { hidden: true });
        await openDialog();
        await page.keyboard.press('Escape');
        await page.waitForSelector('[role=dialog]', { hidden: true });
        results.push({ route, width, height, geometry, keyboardCancel: true, escapeCloses: true });
      }
    }
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(blockedWrites, []);
    fs.writeFileSync(`${output}/results.json`, JSON.stringify({ results, pageErrors, blockedWrites, portalData: 'browser fixture only' }, null, 2));
    console.log(JSON.stringify({ cases: results.length, pageErrors, blockedWrites }));
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
