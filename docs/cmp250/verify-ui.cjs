const p = require('/Users/ali/server-work/ai-home/manychat-design/node_modules/puppeteer-core');
const fs = require('node:fs');
const assert = require('node:assert/strict');
const out='/tmp/cmp250-ui';fs.mkdirSync(out,{recursive:true});
(async()=>{
 const browser=await p.launch({executablePath:'/usr/bin/google-chrome',headless:true});
 const results=[];
 try {
  const page=await browser.newPage();
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.log('PAGE_ERROR',e.message.slice(0,350));});
  for (const width of [320,390,768,1440]) {
   await page.setViewport({width,height:900,deviceScaleFactor:1});
   let response=await page.goto('http://127.0.0.1:8824/dashboard/settings',{waitUntil:'networkidle2',timeout:60000});
   assert.equal(response.status(),200);
   await page.waitForSelector('[data-settings-parts]');
   await page.click('[data-settings-search-trigger]'); await page.waitForSelector('[data-settings-search-input]');
   await page.type('[data-settings-search-input]','الفريق');
   await page.waitForFunction(()=>document.querySelectorAll('[data-settings-part="Team"] li').length===4);
   const titleWidth=await page.$eval('[data-settings-header] h1',e=>e.getBoundingClientRect().width); if(width<768)assert(titleWidth>width*0.7); const links=await page.$$eval('[data-settings-part="Team"] a',els=>els.map(e=>e.getAttribute('href')));
   assert.equal(links.length,4);
   await page.screenshot({path:`${out}/search-ar-${width}.png`});
   await page.focus('[data-settings-search-input]');
   await page.keyboard.press('Escape');
   assert.equal(await page.$$eval('[data-settings-part]',els=>els.length),7);
   await page.click('[data-settings-search-trigger]'); await page.waitForSelector('[data-settings-search-input]');
   await page.type('[data-settings-search-input]','tag');
   await page.waitForFunction(()=>document.querySelector('[data-settings-part="Conversations"] a[href="/dashboard/settings/labels"]'));
   await page.click('[data-settings-part="Conversations"] a[href="/dashboard/settings/labels"]');
   await page.waitForFunction(()=>location.pathname==='/dashboard/settings/labels');
   await page.waitForNetworkIdle({idleTime:500,timeout:15000}).catch(()=>{});
   response=await page.goto('http://127.0.0.1:8824/dashboard/settings/profile?tab=preferences',{waitUntil:'networkidle2',timeout:60000});
   assert.equal(response.status(),200);
   await page.waitForSelector('[data-settings-tabs-scroll]');
   await page.waitForFunction(()=>document.querySelector('[data-slot="tabs"]').getAttribute('dir')==='rtl');
   const geom=await page.evaluate(()=>{
     const s=document.querySelector('[data-settings-tabs-scroll]');
     return {window:innerWidth,document:document.documentElement.scrollWidth,scrollClient:s.clientWidth,scrollWidth:s.scrollWidth,overflow:getComputedStyle(s).overflowX};
   });
   assert.equal(geom.window,geom.document);assert.equal(geom.overflow,'auto');
   const tabs=await page.$$('[role=tab]');
   await tabs[0].focus();await page.keyboard.press('ArrowLeft');
   await page.waitForFunction(()=>document.querySelectorAll('[role=tab]')[1].getAttribute('aria-selected')==='true');
   await tabs[3].evaluate(e=>e.scrollIntoView({block:'nearest',inline:'nearest'}));
   await tabs[3].click();
   await page.waitForFunction(()=>document.querySelectorAll('[role=tab]')[3].getAttribute('aria-selected')==='true');
   const visible=await tabs[3].evaluate(e=>{const b=e.getBoundingClientRect();return b.left>=0&&b.right<=innerWidth});assert(visible);
   await tabs[1].evaluate(e=>e.scrollIntoView({block:'nearest',inline:'nearest'}));await tabs[1].click();
   await page.waitForNetworkIdle({idleTime:400,timeout:15000}).catch(()=>{});
   await page.screenshot({path:`${out}/preferences-${width}.png`});
   console.log('PASS_WIDTH',width);results.push({width,searchArabic:links,searchEnglish:true,linkNavigation:true,tabsKeyboardRTL:true,notificationsClick:true,geometry:geom});
  }
  console.log(JSON.stringify({results,pageErrors:errors},null,2));
  fs.writeFileSync(`${out}/results.json`,JSON.stringify({results,pageErrors:errors},null,2));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
