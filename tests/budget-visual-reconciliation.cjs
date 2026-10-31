
'use strict';
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),art=path.join(root,'qa-artifacts','budget-visual-reconciliation');
const base='http://127.0.0.1:8972';fs.mkdirSync(art,{recursive:true});
const sleep=x=>new Promise(r=>setTimeout(r,x));
async function main(){
 const srv=spawn('python3',['-m','http.server','8972','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
 let browser;const passed=[],failed=[],errors=[];
 const check=async(name,fn)=>{try{await fn();passed.push(name);console.log('PASS:',name)}catch(e){failed.push({name,error:String(e)});console.log('FAIL:',name,String(e).slice(0,600))}};
 try{
   for(let i=0;i<40;i++){try{if((await fetch(base)).ok)break}catch{}await sleep(120)}
   browser=await chromium.launch({headless:true,args:['--no-sandbox']});
   const page=await browser.newPage({viewport:{width:1536,height:1024},acceptDownloads:true});page.setDefaultTimeout(5000);
   page.on('pageerror',e=>errors.push(e.message));
   const go=async n=>{await page.goto(base+'/rebuild.html#screen/'+n);await page.locator(n===22?'.be22-hero h1':'.banner h1').first().waitFor()};
   const state=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('finance-os-exact-rebuild-demo-v1')));
   await check('Approved editor styling loads only once',async()=>{
     await go(21);assert.equal(await page.locator('link[href="rebuild/budget-editor22.css"]').count(),1);
     assert.equal(await page.locator('script[src="rebuild/budget-editor22.js"]').count(),1);
     assert.equal(await page.locator('link[href="rebuild/budget-visual-parity.css"]').count(),1);
   });
   await check('Screen 21 recreates the original four-step budget editor geometry',async()=>{
     await go(21);assert.equal(await page.locator('.sp-budget-steps .sp-step').count(),4);
     assert.equal(await page.locator('.sp-budget-category').count(),10);
     assert.ok(await page.locator('.sp-budget-preview-legend > div').count()===10);
     const box=await page.locator('.sp-budget-reference-layout').boundingBox();
     const left=await page.locator('.sp-budget-reference-layout .sp-left').boundingBox();
     const right=await page.locator('.sp-budget-reference-layout .sp-right').boundingBox();
     assert.ok(right.x>left.x+left.width-3,'preview right column');
     assert.ok(left.width>right.width*1.65&&left.width<right.width*2.1,'source column ratio');
     assert.ok(box.x>=180&&box.x<=230,'source left origin');
     await page.screenshot({path:path.join(art,'screen-21-desktop.png'),fullPage:true});
   });
   await check('Screen 22 uses the same approved budget visual language',async()=>{
     await go(22);assert.equal(await page.locator('.be22-stepper button').count(),4);
     assert.equal(await page.locator('input[data-be22-cat]').count(),10);
     assert.equal(await page.locator('.be22-legend > div').count(),10);
     assert.ok(await page.getByText(/No separate Screen 22 screenshot was supplied/i).count()>0);
     const left=await page.locator('.be22-left').boundingBox();
     const right=await page.locator('.be22-right').boundingBox();
     assert.ok(left.width>right.width*1.65&&left.width<right.width*2.1,'same budget column geometry');
     await page.screenshot({path:path.join(art,'screen-22-desktop.png'),fullPage:true});
   });
   await check('Rollover preference from Screen 21 is visible and persists on Screen 22',async()=>{
     await go(21);
     const chk=page.locator('[data-sprollover="Transport"]');
     await chk.check();
     assert.equal((await state()).spendV2.budgetRollover.Transport,true);
     await go(22);assert.equal(await page.locator('[data-be22-rollover="Transport"]').isChecked(),true);
     await page.locator('[data-be22-rollover="Transport"]').uncheck();
     await page.locator('[data-be22="save"]').click();
     assert.equal((await state()).spendV2.budgetRollover.Transport,false);
   });
   await check('Budget allocations propagate both directions through saved shared state',async()=>{
     await go(22);await page.locator('[data-be22-cat="Housing"]').fill('110000');
     await page.locator('[data-be22-cat="Food & Dining"]').fill('55000');
     await page.locator('[data-be22="save"]').click();
     let s=(await state()).spendV2;assert.equal(s.categories.Housing,110000);assert.equal(s.categories['Food & Dining'],55000);
     await go(21);assert.equal(await page.locator('[data-spcat="Housing"]').inputValue(),'110000');
     await page.locator('[data-spcat="Transport"]').fill('31000');await page.locator('[data-spcat="Transport"]').press('Tab');
     await go(22);assert.equal(await page.locator('[data-be22-cat="Transport"]').inputValue(),'31000');
   });
   await check('Screen 22 saves a reusable local budget template',async()=>{
     await go(22);const before=(await state()).spendV2.budgetTemplates?.length||0;
     await page.locator('[data-be22="template"]').first().click();
     assert.equal((await state()).spendV2.budgetTemplates.length,before+1);
     assert.ok((await state()).spendV2.budgetTemplates.at(-1).categories.Housing>0);
   });
   await check('Both budget editors remain usable on a 390px viewport',async()=>{
     await page.setViewportSize({width:390,height:844});
     for(const n of [21,22]){await go(n);
       const dim=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:window.innerWidth}));
       assert.ok(dim.width<=dim.viewport+2,'overflow '+n+': '+JSON.stringify(dim));
       assert.ok(await page.locator(n===22?'[data-be22-cat="Housing"]':'[data-spcat="Housing"]').isVisible());
       await page.screenshot({path:path.join(art,'screen-'+n+'-mobile.png'),fullPage:true});
     }
   });

   await check('Screen 40 summary, calculator and charts follow three-column reference structure',async()=>{
     await page.setViewportSize({width:1536,height:1024});
     await go(40);
     assert.equal(await page.locator('.cap40-layout').count(),1);
     const [left,center,right]=await Promise.all(['.cap40-left','.cap40-center','.cap40-right'].map(q=>page.locator(q).boundingBox()));
     assert.ok(center.x>=left.x+left.width-4,'results should be next to calculator');
     assert.ok(right.x>=center.x+center.width-4,'summary should be at far right');
     const [afford,summary]=await Promise.all([page.locator('.cap40-center>.cap-panel').first().boundingBox(),page.locator('.cap40-right>.cap-panel').first().boundingBox()]);
     assert.ok(Math.abs(afford.y-summary.y)<12,'summary and calculator output must align vertically');
     assert.equal(await page.locator('.cap40-results-metrics > div').count(),4);
     assert.equal(await page.locator('.cap40-car-visual').count(),1);
     await page.screenshot({path:path.join(art,'screen-40-desktop.png'),fullPage:true});
   });
   await check('Screen 40 still computes and saves affordability examples',async()=>{
     await go(40);
     await page.locator('[data-capform="purchase"] input[name="price"]').fill('2400000');
     await page.locator('[data-capform="purchase"] input[name="down"]').fill('600000');
     await page.locator('[data-capform="purchase"] button[type="submit"]').click();
     assert.equal((await state()).capitalV2.purchase.price,2400000);
     await page.locator('[data-cap="savePurchase"]').click();
     assert.ok((await state()).capitalV2.purchaseSaved.length>0);
   });
   await check('Screen 40 retains mobile simulator and safe responsive width',async()=>{
     await page.setViewportSize({width:390,height:844});
     await go(40);
     const d=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth}));
     assert.ok(d.page<=d.viewport+2,'affordability overflow '+JSON.stringify(d));
     assert.ok(await page.locator('[data-capform="purchase"]').isVisible());
     await page.screenshot({path:path.join(art,'screen-40-mobile.png'),fullPage:true});
   });

   await check('Screen 33 now matches forecast/runway columns and bottom information hierarchy',async()=>{
     await page.setViewportSize({width:1536,height:1024});
     await go(33);
     assert.equal(await page.locator('.cf33-lead > .cf-panel').count(),2);
     assert.equal(await page.locator('.cf33-bottom > .cf33-column').count(),3);
     assert.equal(await page.locator('.cf33-forecast-plot').count(),1);
     assert.equal(await page.locator('.cf33-runway-plot').count(),1);
     assert.equal(await page.locator('.cf33-toolbar .cf-tabs button').count(),5);
     const [left,right]=await Promise.all([page.locator('.cf33-lead>.cf-panel').nth(0).boundingBox(),page.locator('.cf33-lead>.cf-panel').nth(1).boundingBox()]);
     assert.ok(right.x>left.x+left.width-4,'runway should be the right-hand top panel');
     assert.ok(left.width>right.width*1.5,'forecast takes wider column');
     await page.screenshot({path:path.join(art,'screen-33-desktop.png'),fullPage:true});
   });
   await check('Screen 33 still recalculates editable financial forecast assumptions',async()=>{
     await go(33);
     await page.locator('[data-cfform="scenario"] [name="incomeGrowth"]').fill('8');
     await page.locator('[data-cfform="scenario"] button[type="submit"]').click();
     assert.equal((await state()).incomeFlowV2.scenario.incomeGrowth,8);
     assert.ok(await page.locator('.cf33-runway-callout').count()>0);
   });
   await check('Screen 33 remains usable without horizontal overflow at mobile width',async()=>{
     await page.setViewportSize({width:390,height:844});
     await go(33);
     const dim=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));
     assert.ok(dim.width<=dim.viewport+2,'runway viewport overflow '+JSON.stringify(dim));
     assert.ok(await page.locator('[data-cfform="scenario"]').isVisible());
     await page.screenshot({path:path.join(art,'screen-33-mobile.png'),fullPage:true});
   });
   await check('No runtime JavaScript errors',async()=>assert.deepEqual(errors,[]));
   fs.writeFileSync(path.join(art,'results.json'),JSON.stringify({passed,failed,errors},null,2));
   console.log('RESULT:',passed.length,'passed;',failed.length,'failed');
   if(failed.length)process.exitCode=1;
 }finally{await browser?.close();srv.kill('SIGTERM')}
}
main().catch(e=>{console.error(e);process.exitCode=1});
