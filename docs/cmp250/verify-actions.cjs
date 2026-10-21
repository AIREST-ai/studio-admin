const p=require('/Users/ali/server-work/ai-home/manychat-design/node_modules/puppeteer-core');const assert=require('node:assert/strict');const fs=require('node:fs');
const out='/tmp/cmp250-ui';
(async()=>{const b=await p.launch({executablePath:'/usr/bin/google-chrome',headless:true});const results=[];try{
const page=await b.newPage();await page.setViewport({width:390,height:844});
await page.goto('http://127.0.0.1:8824/dashboard/settings',{waitUntil:'networkidle2',timeout:60000});
await page.click('header button:has(svg.lucide-settings)');await page.waitForSelector('[data-slot=popover-content]');
const light=await page.$('[data-slot=popover-content] [data-slot=toggle-group] [data-slot=toggle-group-item]');assert(light);await light.click();
await page.waitForFunction(()=>document.documentElement.dataset.themeMode==='light');await page.keyboard.press('Escape');
await page.reload({waitUntil:'networkidle2'});assert.equal(await page.$eval('html',e=>e.dataset.themeMode),'light');
await page.screenshot({path:`${out}/settings-light-390.png`});results.push({themeChangeAndReload:true});
await page.goto('http://127.0.0.1:8824/dashboard/settings/sla',{waitUntil:'networkidle2',timeout:60000});
await page.waitForSelector('[data-ce-area="sla_policies"]');assert(await page.$eval('[data-settings-header-actions] button',e=>e.disabled));
await page.click('[data-settings-header-actions] button');assert.equal(await page.$$eval('[role=dialog]',e=>e.length),0);
await page.screenshot({path:`${out}/sla-unavailable-390.png`});results.push({slaUnavailableActionDisabled:true});
await page.setRequestInterception(true);let requests=[];let fail=false;
page.on('request',r=>{
 const u=new URL(r.url());
 if(u.pathname==='/api/workspace-hub'&&r.method()==='GET')return r.respond({status:200,contentType:'application/json',body:JSON.stringify({ok:true,roles:[{roleId:'manager',title:'مدير اختبار',subtitle:'بيانات اختبار محلية',viewConversations:true,editEmma:true,viewReports:true,topUpBalance:false,manageInvoices:true}]})});
 if(['/api/workspace-hub','/api/captain-engine'].includes(u.pathname)&&r.method()==='POST'){
   requests.push(u.pathname);return r.respond({status:fail&&u.pathname==='/api/captain-engine'?500:200,contentType:'application/json',body:JSON.stringify({ok:!fail})});
 }
 return r.continue();
});
for(const shouldFail of [false,true]){
 fail=shouldFail;requests=[];
 await page.goto('http://127.0.0.1:8824/dashboard/users?tab=roles',{waitUntil:'networkidle2',timeout:60000});
 await page.waitForSelector('[data-testid=global-roles-matrix] [role=switch]:not([disabled])');
 await page.click('[data-testid=global-roles-matrix] [role=switch]:not([disabled])');
 if(shouldFail){await page.waitForSelector('[data-role-matrix-error]');assert.equal(await page.$$eval('[data-testid=global-roles-matrix] [role=switch]:not([disabled])',e=>e.length),0);assert(!await page.$eval('[data-testid=global-roles-matrix]',e=>e.innerText.includes('حُفظ آخر تغيير')));await page.screenshot({path:`${out}/role-save-failure-mocked.png`});}
 else await page.waitForFunction(()=>document.querySelector('[data-testid=global-roles-matrix]').innerText.includes('حُفظ آخر تغيير'));
 assert.equal(requests.length,2);results.push({mockedRoleSave:shouldFail?'failure shown, no success, controls disabled':'success acknowledged',writesReachedServer:false});
}
console.log(JSON.stringify(results,null,2));fs.writeFileSync(`${out}/actions-results.json`,JSON.stringify(results,null,2));
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
