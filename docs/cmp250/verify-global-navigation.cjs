const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const p = require('/Users/ali/server-work/ai-home/manychat-design/node_modules/puppeteer-core');
(async () => {
  const browser = await p.launch({ executablePath: '/usr/bin/google-chrome', headless: true });
  const results = [];
  const pageErrors = [];
  const blockedWrites = [];
  try {
    for (const width of [1440, 390]) {
      const page = await browser.newPage();
      await page.setViewport({ width, height: 900 });
      page.on('pageerror', e => pageErrors.push(e.message));
      await page.setRequestInterception(true);
      page.on('request', r => {
        if (!['GET', 'HEAD', 'OPTIONS'].includes(r.method())) {
          blockedWrites.push({ method: r.method(), path: new URL(r.url()).pathname });
          return r.abort();
        }
        return r.continue();
      });
      await page.goto('http://127.0.0.1:8824/dashboard/settings', { waitUntil: 'networkidle2', timeout: 60000 });
      await page.click('[data-settings-search-trigger]');
      await page.waitForSelector('[data-settings-search-input]');
      await page.type('[data-settings-search-input]', 'profile');
      await page.waitForSelector('[data-settings-parts] a[href="/dashboard/settings/profile"]');
      await page.click('[data-settings-parts] a[href="/dashboard/settings/profile"]');
      await page.waitForFunction(() => location.pathname === '/dashboard/settings/profile' && document.querySelector('h1')?.textContent === 'إعدادات الملف الشخصي');
      await page.waitForSelector('[data-settings-tabs-scroll]');
      const tabs = await page.$$('[role=tab]');
      await tabs[1].evaluate(el => el.scrollIntoView({ block: 'nearest', inline: 'nearest' }));
      await tabs[1].click();
      await page.waitForFunction(() => document.querySelectorAll('[role=tab]')[1]?.getAttribute('aria-selected') === 'true');
      await page.waitForNetworkIdle({ idleTime: 500, timeout: 20000 });
      assert.deepEqual(pageErrors, []);
      results.push({ width, settingsToProfile: true, preferencesTab: true });
      await page.close();
    }
    assert.deepEqual(blockedWrites, []);
    console.log(JSON.stringify({ results, pageErrors, blockedWrites }));
  } finally {
    fs.writeFileSync(path.join(__dirname, 'evidence/global-hydration/navigation-results.json'), JSON.stringify({ results, pageErrors, blockedWrites }, null, 2));
    await browser.close();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
