
'use strict';
const {chromium}=require('playwright'),{spawn}=require('node:child_process'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8988',out=path.join(root,'qa-artifacts','visual-screen22');fs.mkdirSync(out,{recursive:true});
const nap=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const srv=spawn('python3',['-m','http.server','8988','--bind','127.0.0.1','--directory',root],{stdio:'ignore'}),passed=[],failed=[],errors=[];let browser;
 const check=async(name,fn)=>{try{await fn();passed.push(name);console.log('PASS:',name)}catch(e){failed.push({name,error:String(e)});console.log('FAIL:',name,String(e).slice(0,650))}};
 try{
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break}catch{}await nap(130)}
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1536,height:1024},acceptDownloads:true});page.setDefaultTimeout(5000);page.on('pageerror',x=>errors.push(x.message));
 const go=async n=>{await page.goto(base+'/rebuild.html#screen/'+n);await page.locator('#app').first().waitFor()};
 const store=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('finance-os-exact-rebuild-demo-v1')));
 await check('Screen 01 responsive desktop/tablet/mobile/state showcase',async()=>{await go(1);assert.equal(await page.locator('.auth-showcase>section').count(),3);assert.equal(await page.locator('.auth-state-examples>div').count(),4);assert.equal(await page.locator('#auth-form').count(),1);await page.screenshot({path:path.join(out,'screen-01-desktop.png'),fullPage:true})});
 await check('Screen 22 restores source-aligned budget composition',async()=>{await go(22);assert.equal(await page.locator('.be22-stepper button').count(),4);assert.equal(await page.locator('.be22-table tbody tr').count(),11);assert.equal(await page.locator('.be22-right .be22-card').count(),4);await page.screenshot({path:path.join(out,'screen-22-desktop.png'),fullPage:true})});
 await check('Screen 22 category edits recalculate and show mismatch validation',async()=>{await go(22);await page.locator('[data-be22-cat="Housing"]').fill('140000');await page.locator('[data-be22-cat="Housing"]').press('Tab');await page.locator('[data-be22="save"]').click();assert.match(await page.locator('[role="status"]').innerText(),/must equal.*target/i);assert.notEqual((await store()).spendV2.categories.Housing,140000)});
 await check('Even distribution and persistence to Screen 21',async()=>{await go(22);await page.locator('[data-be22="even"]').click();await page.locator('[data-be22="save"]').click();assert.match(await page.locator('[role="status"]').innerText(),/Budget saved/i);const st=(await store()).spendV2;assert.equal(Object.values(st.categories).reduce((a,b)=>a+b,0),st.budgetLimit);await go(21);assert.equal(Number(await page.locator('[data-spcat="Housing"]').inputValue()),st.categories.Housing)});
 await check('Screen 22 rollover and alert preferences save correctly',async()=>{await go(22);await page.locator('[data-be22-rollover="Food & Dining"]').check();await page.locator('[data-be22-rule="weeklyDigest"]').uncheck();await page.locator('[data-be22="save"]').click();let st=(await store()).spendV2;assert.equal(st.rollover['Food & Dining'],true);assert.equal(st.rules.weeklyDigest,false)});
 await check('Screen 22 compare shows approved budget editor and navigation survives',async()=>{await go(22);await page.locator('[data-action="compare"]').click();assert.equal(await page.locator('.reference-dialog img').count(),1);assert.ok((await page.locator('.reference-dialog img').getAttribute('src')).includes('screen-21.webp'));await page.locator('[data-action="compare"]').last().click();await page.locator('[data-be22="goals"]').click();assert.equal(new URL(page.url()).hash,'#screen/37')});
 await check('Existing 60 routes still render meaningful content',async()=>{for(let n=1;n<=60;n++){await go(n);assert.ok((await page.locator('#app').innerHTML()).length>500,'Blank page '+n)}});
 await check('Mobile 390px Screen 01 and Screen 22 do not overflow',async()=>{await page.setViewportSize({width:390,height:844});for(const n of [1,22]){await go(n);const d=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth}));assert.ok(d.page<=d.viewport+2,'Overflow '+n+' '+JSON.stringify(d));await page.screenshot({path:path.join(out,'screen-'+String(n).padStart(2,'0')+'-mobile.png'),fullPage:true})}});
 await check('No uncaught frontend errors',async()=>assert.deepEqual(errors,[]));
 fs.writeFileSync(path.join(out,'results.json'),JSON.stringify({passed,failed,errors},null,2));console.log('RESULT:',passed.length,'passed',failed.length,'failed');if(failed.length)process.exitCode=1;
 }finally{await browser?.close();srv.kill('SIGTERM')}
}
main().catch(e=>{console.error(e);process.exitCode=1});
