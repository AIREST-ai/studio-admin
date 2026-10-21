const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const puppeteer = require('/Users/ali/server-work/ai-home/manychat-design/node_modules/puppeteer-core');
const dictionary = require('../../src/lingo/dom-ar.json');

const origin = process.env.CMP250_ORIGIN || 'http://127.0.0.1:8824';
const output = path.join(__dirname, 'evidence/global-hydration');
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await puppeteer.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  const results = [];
  const pageErrors = [];
  const blockedWrites = [];
  try {
    for (const slow of [false, true]) {
      for (const width of [1440, 390]) {
        for (const route of ['/auth/v2/login', '/dashboard/contacts']) {
          const page = await browser.newPage();
          const startErrors = pageErrors.length;
          let delayedScripts = 0;
          page.on('pageerror', error => pageErrors.push({ route, width, slow, message: error.message }));
          await page.setViewport({ width, height: width === 390 ? 844 : 900 });
          await page.setCacheEnabled(false);
          if (slow) await page.emulateCPUThrottling(4);
          await page.setRequestInterception(true);
          page.on('request', request => {
            if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method())) {
              blockedWrites.push({ method: request.method(), path: new URL(request.url()).pathname });
              return request.abort();
            }
            const pathname = new URL(request.url()).pathname;
            if (slow && request.resourceType() === 'script' && pathname.includes('/chunks/src_')) {
              delayedScripts++;
              const delay = 200 + [...pathname].reduce((sum, c) => sum + c.charCodeAt(0), 0) % 1000;
              return setTimeout(() => request.continue(), delay);
            }
            return request.continue();
          });
          const response = await page.goto(origin + route, { waitUntil: 'domcontentloaded', timeout: 60000 });
          assert.equal(response.status(), 200);
          const heading = dictionary[route.includes('/auth/') ? 'Login to your account' : 'Contacts'];
          await page.waitForFunction(text => [...document.querySelectorAll('h1')].some(el => el.textContent === text), { timeout: 60000 }, heading);
          if (route.includes('/auth/')) {
            await page.waitForFunction(text => document.querySelector('label[for="login-email"]')?.textContent === text, {}, dictionary['Email Address']);
            await page.click('form button[type="submit"]');
            await page.waitForFunction(() => document.querySelector('#login-email')?.getAttribute('aria-invalid') === 'true');
            await page.waitForFunction(text => document.body.textContent.includes(text), {}, dictionary['Please enter a valid email address.']);
            await page.click('#login-remember');
            assert.equal(await page.$eval('#login-remember', el => el.getAttribute('aria-checked')), 'true');
            await page.click('#login-remember');
            assert.equal(await page.$eval('#login-remember', el => el.getAttribute('aria-checked')), 'false');
          } else {
            const searchLabel = dictionary['Search contacts'];
            await page.waitForSelector(`button[aria-label="${searchLabel}"]`);
            await page.click(`button[aria-label="${searchLabel}"]`);
            const selector = 'input[data-cmp250-search]';
            await page.waitForFunction(() => {
              const input = [...document.querySelectorAll('input')].find(el => /Search contacts|بحث.*جهات الاتصال/.test(el.placeholder));
              if (input) input.setAttribute('data-cmp250-search', '');
              return Boolean(input);
            });
            await page.type(selector, 'cmp250-no-match');
            assert.equal(await page.$eval(selector, el => el.value), 'cmp250-no-match');
          }
          await page.waitForNetworkIdle({ idleTime: 500, timeout: 20000 });
          const geometry = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
          await page.screenshot({ path: path.join(output, `${route.includes('/auth/') ? 'login' : 'contacts'}-${width}-${slow ? 'slow' : 'normal'}.png`) });
          assert.equal(pageErrors.length, startErrors, 'No hydration or other JavaScript errors');
          if (slow) assert(delayedScripts > 0, 'Slow cases must delay actual route scripts');
          results.push({ route, width, slow, delayedScripts, translatedHeading: heading, interaction: route.includes('/auth/') ? 'empty form validation translated; checkbox toggled twice' : 'search accepts input', geometry, pageErrors: [] });
          console.log('PASS', route, width, slow ? 'slow' : 'normal');
          await page.close();
        }
      }
    }
    assert.deepEqual(blockedWrites, []);
  } finally {
    fs.writeFileSync(path.join(output, 'results.json'), JSON.stringify({ origin, results, pageErrors, blockedWrites }, null, 2));
    await browser.close();
  }
  console.log(JSON.stringify({ cases: results.length, pageErrors, blockedWrites }));
})().catch(error => { console.error(error); process.exitCode = 1; });
