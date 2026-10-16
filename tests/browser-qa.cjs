
'use strict';
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),artifacts=path.join(root,'qa-artifacts'),base='http://127.0.0.1:8879';
fs.mkdirSync(artifacts,{recursive:true});
const pause=t=>new Promise(r=>setTimeout(r,t));
async function waitServer(){for(let i=0;i<50;i++){try{if((await fetch(base)).status===200)return}catch(e){}await pause(150)}throw Error('Local server did not start')}
async function main(){
 const server=spawn('python3',['-m','http.server','8879','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});let browser;
 const passes=[],failures=[],errors=[];
 const check=async(label,fn)=>{try{await fn();passes.push(label);console.log('PASS:',label)}catch(e){failures.push({label,error:String(e)});console.error('FAIL:',label,e.message)}};
 try{
  await waitServer();
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1536,height:1024},deviceScaleFactor:1,acceptDownloads:true});
  page.on('pageerror',e=>errors.push('JS: '+e.message));
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('favicon'))errors.push('Console: '+m.text())});
  await page.goto(base+'/#screen/4');
  await check('Command centre and 60 sidebar routes',async()=>{assert.match(await page.locator('.hero h1').innerText(),/Financial Command Centre/);assert.equal(await page.locator('aside .navbtn').count(),60)});
  await check('All 60 screens render with distinct headings and tabs',async()=>{
   const headings=new Set();
   for(let i=1;i<=60;i++){
    await page.evaluate(i=>location.hash='#screen/'+i,i);
    await page.waitForFunction(i=>document.querySelector('.hero small')?.textContent?.includes('SCREEN '+String(i).padStart(2,'0')),i,{timeout:2000});
    headings.add(await page.locator('.hero h1').innerText());
    assert.ok(await page.locator('.tabs button').count()>=2,'Missing tabs screen '+i);
    assert.ok(await page.locator('.grid > .card').count()>=1,'Missing content screen '+i);
    assert.equal(await page.locator('aside .navbtn[aria-current="page"]').count(),1,'Bad active link '+i);
    if([4,5,10,16,21,30,37,43,50,53,56,57,58,59,60].includes(i))await page.screenshot({path:path.join(artifacts,'screen-'+String(i).padStart(2,'0')+'-desktop.png'),fullPage:true});
   }
   assert.equal(headings.size,60);
  });
  await check('Contextual sub-tabs render shared content',async()=>{await page.evaluate(()=>location.hash='#screen/21');await page.locator('.tabs [data-tab="Categories"]').click();assert.match(await page.locator('.grid').innerText(),/category|spending/i)});
  await check('Budget edits persist across screen changes',async()=>{
   await page.evaluate(()=>location.hash='#screen/22');
   await page.locator('#budgetForm input[name="Housing"]').fill('51000');
   await page.locator('[data-action="submitBudget"]').click();
   await page.evaluate(()=>location.hash='#screen/21');
   await page.evaluate(()=>location.hash='#screen/22');
   assert.equal(await page.locator('#budgetForm input[name="Housing"]').inputValue(),'51000');
  });
  await check('Inline transaction updates the ledger',async()=>{
   await page.evaluate(()=>location.hash='#screen/12');
   await page.locator('#inlineTxForm input[name="name"]').fill('QA grocery');
   await page.locator('#inlineTxForm input[name="merchant"]').fill('Sample shop');
   await page.locator('#inlineTxForm input[name="amount"]').fill('1250');
   await page.locator('#inlineTxForm button[type="submit"]').click();
   await page.evaluate(()=>location.hash='#screen/10');
   assert.ok(await page.getByText('QA grocery',{exact:true}).count()>0);
  });
  await check('Global search locates records and opens details',async()=>{
   await page.locator('#search').fill('QA grocery');
   assert.ok(await page.locator('#searchhits [data-action="selectTx"]').count()>0);
   await page.locator('#searchhits [data-action="selectTx"]').first().click();
   assert.ok(await page.locator('[role="dialog"]').count()>0);
   await page.keyboard.press('Escape');
   assert.equal(await page.locator('[role="dialog"]').count(),0);
   await page.locator('#search').fill('budget');
   assert.ok(await page.locator('#searchhits [data-nav="22"]').count()>0);
   await page.locator('#searchhits [data-nav="22"]').first().click();
   assert.match(await page.locator('.hero h1').innerText(),/Create \/ Edit Budget/);
  });
  await check('Own-account transfers conserve cash and ledger count',async()=>{
   await page.evaluate(()=>location.hash='#screen/14');
   const summary=()=>page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('finance-os-v2-phase2-demo'));return {sum:s.accounts.filter(a=>a.scope==='personal').reduce((v,a)=>v+a.balance,0),num:s.transactions.length,transfers:s.transfers.length}});
   const before=await summary();
   await page.locator('#transferForm input[name="amount"]').fill('1700');
   await page.locator('#transferForm button[type="submit"]').click();
   const after=await summary();
   assert.equal(after.sum,before.sum);assert.equal(after.num,before.num);assert.equal(after.transfers,before.transfers+1);
  });
  await check('CSV reporting downloads a real file',async()=>{
   await page.evaluate(()=>location.hash='#screen/58');
   const downloading=page.waitForEvent('download');
   await page.locator('[data-action="export"]').first().click();
   const download=await downloading;
   assert.match(download.suggestedFilename(),/\.csv$/);
  });
  await check('Theme and provider connectivity disclaimers',async()=>{
   await page.evaluate(()=>location.hash='#screen/59');
   assert.match(await page.locator('main').innerText(),/Verified live connections/);
   await page.locator('[data-action="theme"]').click();
   assert.ok(await page.evaluate(()=>document.body.classList.contains('dark')));
   await page.screenshot({path:path.join(artifacts,'integrations-dark.png'),fullPage:true});
   await page.locator('[data-action="theme"]').click();
  });
  await check('No whole-page horizontal overflow at five viewport widths',async()=>{
   for(const w of [1536,1024,768,390,320]){
    await page.setViewportSize({width:w,height:w<=390?780:1024});
    for(const n of [4,5,10,21,22,30,40,53,57,60]){
     await page.evaluate(n=>location.hash='#screen/'+n,n);
     const measure=await page.evaluate(()=>({scrollWidth:document.documentElement.scrollWidth,viewport:window.innerWidth}));
     assert.ok(measure.scrollWidth<=measure.viewport+2,'Overflow at '+w+'px screen '+n+': '+JSON.stringify(measure));
    }
    await page.evaluate(()=>location.hash='#screen/4');
    await page.screenshot({path:path.join(artifacts,'dashboard-'+w+'px.png'),fullPage:true});
   }
  });
  await check('Mobile drawer uses scrim and keyboard dismissal',async()=>{
   await page.setViewportSize({width:390,height:820});
   const button=page.locator('#menuButton');
   await button.click();assert.equal(await button.getAttribute('aria-expanded'),'true');
   assert.ok(await page.locator('#navScrim').isVisible());
   await page.keyboard.press('Escape');assert.equal(await button.getAttribute('aria-expanded'),'false');
  });
  await check('Skip link and modal initial focus',async()=>{
   await page.goto(base+'/#screen/4');await page.keyboard.press('Tab');
   assert.match(await page.locator(':focus').innerText(),/Skip to main content/);
   await page.locator('[data-action="newTx"]').first().click();
   assert.equal(await page.locator('[role="dialog"]').count(),1);
   assert.ok(await page.locator('[role="dialog"] :focus').count()>=1);
   await page.keyboard.press('Escape');assert.equal(await page.locator('[role="dialog"]').count(),0);
  });
  await check('No uncaught browser exceptions',async()=>assert.deepEqual(errors,[]));
  fs.writeFileSync(path.join(artifacts,'qa-results.json'),JSON.stringify({passes,failures,consoleErrors:errors},null,2));
  console.log('Browser QA:',passes.length,'passed /',failures.length,'failed');
  if(failures.length)process.exitCode=1;
 }finally{if(browser)await browser.close();server.kill('SIGTERM')}
}
main().catch(e=>{console.error(e);process.exitCode=1});
