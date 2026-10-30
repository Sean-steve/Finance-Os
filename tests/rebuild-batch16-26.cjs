
'use strict';
const {chromium}=require('playwright'),{spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8903',art=path.join(root,'qa-artifacts','batch16-26');
fs.mkdirSync(art,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const server=spawn('python3',['-m','http.server','8903','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
 let browser;let passes=[],fails=[],errors=[];
 const check=async(name,fn)=>{try{await fn();passes.push(name);console.log('PASS:',name)}catch(e){fails.push({name,error:String(e)});console.error('FAIL:',name,String(e).slice(0,600))}};
 try{
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break}catch(e){}await sleep(180)}
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1536,height:1024},acceptDownloads:true});
 page.setDefaultTimeout(3500);
 page.on('pageerror',e=>errors.push(e.message));
 const route=async i=>{await page.goto(base+'/rebuild.html#screen/'+i);await page.locator(i===22?'.be22-hero h1':'.banner h1').first().waitFor()};
 const persisted=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('finance-os-exact-rebuild-demo-v1')));
 await check('Screens 01–15 remain intact',async()=>{
   for(let n of [1,2,3,4,5,6,7,10,12,13,14,15]){await page.goto(base+'/rebuild.html#screen/'+n);assert.ok(await page.locator('#app').innerHTML().then(s=>s.length>700),'Screen '+n)}
 });
 await check('Screens 16–26 have distinct real-DOM layouts',async()=>{
  const headings=new Set();
  for(let n=16;n<=26;n++){
   await route(n);
   assert.equal(await page.locator(n===22?'.be22':'.spend-page').count(),1);
   assert.ok(await page.locator(n===22?'.be22-card':'.sp-panel').count()>=3,'not enough components screen '+n);
   assert.equal(await page.locator('.reference-shade').count(),0);
   headings.add(await page.locator(n===22?'.be22-hero h1':'.banner h1').innerText());
   await page.screenshot({path:path.join(art,'screen-'+n+'-desktop.png'),fullPage:true});
  }
  assert.ok(headings.size>=10,'Reference 21/22 may share budget editor title');
 });
 await check('Period and category filters change interactively',async()=>{
  await route(16);
  await page.locator('[data-spchange="period"]').selectOption('Last 30 days');
  assert.equal(await page.locator('[data-spchange="period"]').inputValue(),'Last 30 days');
  await page.locator('[data-spchange="category"]').selectOption('Transport');
  assert.equal(await page.locator('[data-spchange="category"]').inputValue(),'Transport');
 });
 await check('Budget category edits persist and totals recalculate',async()=>{
  await route(21);
  const original=await persisted();
  assert.equal(original.spendV2.categories.Housing,120000);
  await page.locator('input[data-spcat="Housing"]').fill('130000');
  await page.locator('input[data-spcat="Housing"]').press('Tab');
  assert.equal((await persisted()).spendV2.categories.Housing,130000);
  await page.locator('[data-sp="saveBudget"]').click();
  await route(22);
  assert.equal(await page.locator('input[data-be22-cat="Housing"]').inputValue(),'130000');
  assert.ok(await page.getByText(/no separate Screen 22 screenshot was supplied/i).count()>0);
 });
 await check('Budget allocations distribute evenly and settings persist',async()=>{
  await route(21);
  await page.locator('[data-sp="spreadBudget"]').click();
  const state=(await persisted()).spendV2;
  assert.equal(Object.values(state.categories).reduce((a,b)=>a+b,0),state.budgetLimit);
  await page.locator('[data-sprule="weeklyDigest"]').uncheck();
  assert.equal((await persisted()).spendV2.rules.weeklyDigest,false);
 });
 await check('Allowance updates in browser and survives refresh',async()=>{
  await route(23);
  await page.locator('[data-spform="allowance"] [name="daily"]').fill('6000');
  await page.locator('[data-spform="allowance"] [name="weekly"]').fill('35000');
  await page.locator('[data-spform="allowance"] button[type="submit"]').click();
  await page.reload();
  assert.equal(await page.locator('[data-spform="allowance"] [name="daily"]').inputValue(),'6000');
  assert.equal((await persisted()).spendV2.allowance.weekly,35000);
 });
 await check('Guardrails and purchase simulator use configured limits',async()=>{
  await route(24);
  const active=(await persisted()).spendV2.guardrails.filter(x=>x.active).length;
  await page.locator('[data-spguard="rule1"]').uncheck();
  assert.equal((await persisted()).spendV2.guardrails.filter(x=>x.active).length,active-1);
  await page.locator('[data-spform="purchase"] [name="amount"]').fill('55000');
  await page.locator('[data-spform="purchase"] button[type="submit"]').click();
  const result=(await persisted()).spendV2.lastPurchase;
  assert.equal(result.amt,55000);assert.match(result.decision,/Review required/);
 });
 await check('Subscriptions add, edit and locally pause',async()=>{
  await route(25);
  await page.locator('[data-sp="newSub"]').first().click();
  await page.locator('[data-spform="subscription"] [name="name"]').fill('QA Weekly Membership');
  await page.locator('[data-spform="subscription"] [name="amount"]').fill('2200');
  await page.locator('[data-spform="subscription"] button[type="submit"]').click();
  let added=(await persisted()).spendV2.subscriptions.find(x=>x.name==='QA Weekly Membership');
  assert.ok(added);assert.equal(added.cost,2200);
  await page.locator('[data-sp="editSub:'+added.id+'"]').first().click();
  await page.locator('[data-sp="subStatus:Paused"]').click();
  const updated=(await persisted()).spendV2.subscriptions.find(x=>x.id===added.id);
  assert.equal(updated.status,'Paused');
 });
 await check('Recovery tasks and monthly target persist',async()=>{
  await route(26);
  await page.locator('[data-sprecovery="subscriptions"]').check();
  await page.locator('[data-spform="recovery"] [name="target"]').fill('50000');
  await page.locator('[data-spform="recovery"] button[type="submit"]').click();
  const s=(await persisted()).spendV2;
  assert.ok(s.recovery.completed.includes('subscriptions'));assert.equal(s.recovery.targetReduction,50000);
 });
 await check('Spending dashboard exports an actual CSV',async()=>{
  await route(16);
  const downloading=page.waitForEvent('download');
  await page.locator('[data-sp="export"]').first().click();
  assert.match((await downloading).suggestedFilename(),/\.csv$/);
 });
 await check('All eleven coded screens fit 390px mobile viewport',async()=>{
  await page.setViewportSize({width:390,height:844});
  for(let n=16;n<=26;n++){
   await route(n);
   const dimensions=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:window.innerWidth}));
   if(dimensions.width>dimensions.viewport+2){const offenders=await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).map(el=>({tag:el.tagName,cls:el.className?.toString().slice(0,65),width:Math.round(el.getBoundingClientRect().width),right:Math.round(el.getBoundingClientRect().right)})).filter(x=>x.right>innerWidth+3&&x.width>0).slice(0,20));console.log('OVERFLOW DETAILS',n,JSON.stringify(offenders));}assert.ok(dimensions.width<=dimensions.viewport+2,'Horizontal overflow screen '+n+': '+JSON.stringify(dimensions));
   if([16,20,21,23,24,25,26].includes(n))await page.screenshot({path:path.join(art,'screen-'+n+'-mobile.png'),fullPage:true});
  }
 });
 await check('No JavaScript exceptions',async()=>assert.deepEqual(errors,[]));
 fs.writeFileSync(path.join(art,'results.json'),JSON.stringify({passes,fails,errors},null,2));
 console.log('RESULT:',passes.length,'passed;',fails.length,'failed');
 if(fails.length)process.exitCode=1;
 }finally{await browser?.close();server.kill('SIGTERM')}
}
main().catch(e=>{console.error(e);process.exitCode=1});
