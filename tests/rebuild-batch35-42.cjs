
'use strict';
const {chromium}=require('playwright'),{spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8918',art=path.join(root,'qa-artifacts','batch35-42');fs.mkdirSync(art,{recursive:true});
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function main(){
 const srv=spawn('python3',['-m','http.server','8918','--directory',root,'--bind','127.0.0.1'],{stdio:'ignore'});let browser;
 const passes=[],fails=[],errors=[];
 const check=async(name,fn)=>{try{await fn();console.log('PASS:',name);passes.push(name)}catch(e){console.error('FAIL:',name,String(e).slice(0,1200));fails.push({name,message:String(e)})}};
 try{
  for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break}catch{}await wait(130)}
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1536,height:1024},acceptDownloads:true});
  page.setDefaultTimeout(5000);page.on('pageerror',e=>errors.push(e.message));
  const go=async n=>{await page.goto(base+'/rebuild.html#screen/'+n);await page.locator('.banner h1').first().waitFor()};
  const data=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('finance-os-exact-rebuild-demo-v1')));
  await check('Prior 01–34 screens remain accessible',async()=>{
   for(let n of [1,4,6,10,16,21,25,27,30,33,34]){
    await page.goto(base+'/rebuild.html#screen/'+n);assert.ok((await page.locator('#app').innerHTML()).length>650)}
  });
  await check('Eight uniquely titled coded screens 35–42 with reference components',async()=>{
   const headings=new Set();
   for(let n=35;n<=42;n++){await go(n);assert.equal(await page.locator('.cap-page').count(),1);assert.ok(await page.locator('.cap-panel').count()>=3,'Screen '+n+' has too few cards');assert.equal(await page.locator('.reference-shade').count(),0);
    headings.add(await page.locator('.banner h1').innerText());await page.screenshot({path:path.join(art,'screen-'+n+'-desktop.png'),fullPage:true});
   }
   assert.equal(headings.size,8);
  });
  await check('Capital allocation dashboard and strategy controls',async()=>{
   await go(35);assert.equal(await page.locator('.cap-kpi').count(),4);
   await page.locator('[data-cap="editStrategy"]').click();
   await page.locator('[data-capform="strategy"] [name="growth"]').fill('45');
   await page.locator('[data-capform="strategy"] [name="stability"]').fill('30');
   await page.locator('[data-capform="strategy"] button[type="submit"]').click();
   assert.equal((await data()).capitalV2.capitalStrategy.growth,45);
  });
  await check('Money buckets and allocation rules persist; preview never debits cash',async()=>{
   await go(36);let before=(await data()).accounts.reduce((n,a)=>n+a[1],0);
   await page.locator('[data-cap="newBucket"]').click();
   await page.locator('[data-capform="bucket"] [name="name"]').fill('QA Savings Bucket');
   await page.locator('[data-capform="bucket"] button[type="submit"]').click();
   assert.ok((await data()).capitalV2.buckets.some(x=>x.name==='QA Savings Bucket'));
   await page.locator('[data-cap="newRule"]').click();
   await page.locator('[data-capform="rule"] [name="name"]').fill('QA Allocation Rule');
   await page.locator('[data-capform="rule"] button[type="submit"]').click();
   assert.ok((await data()).capitalV2.rules.some(x=>x.name==='QA Allocation Rule'));
   await page.locator('[data-cap="runAllocation"]').click();
   assert.equal((await data()).accounts.reduce((n,a)=>n+a[1],0),before);
  });
  await check('Savings goals can be created and updated in shared goal model',async()=>{
   await go(37);await page.locator('[data-cap="newGoal"]').first().click();
   await page.locator('[data-capform="goal"] [name="name"]').fill('QA School Fees');
   await page.locator('[data-capform="goal"] [name="target"]').fill('200000');
   await page.locator('[data-capform="goal"] [name="saved"]').fill('15000');
   await page.locator('[data-capform="goal"] button[type="submit"]').click();
   assert.ok((await data()).capitalV2.goals.some(x=>x.name==='QA School Fees'));
   assert.ok((await data()).goals.some(x=>x[0]==='QA School Fees'));
  });
  await check('Goal funding is balance-conserving and reflected across screens',async()=>{
   await go(38);const prev=(await data()),bank=prev.accounts[0][1],g=prev.capitalV2.goals.find(x=>x.id===prev.capitalV2.selectedGoal),saved=g.saved;
   await page.locator('[data-capform="fundGoal"] [name="amount"]').fill('1250');
   await page.locator('[data-capform="fundGoal"] button[type="submit"]').click();
   const next=(await data());assert.equal(next.accounts[0][1],bank-1250);
   assert.equal(next.capitalV2.goals.find(x=>x.id===g.id).saved,saved+1250);
   assert.ok(next.goals.some(x=>x[0]===g.name&&x[1]===saved+1250));
  });
  await check('Emergency fund contribution and withdrawal conserve account+goal funds',async()=>{
   await go(39);let d=await data(),bank=d.accounts[0][1],saved=d.capitalV2.goals.find(x=>x.name==='Emergency Fund').saved;
   await page.locator('[data-cap="fundEmergency"]').first().click();
   await page.locator('[data-capform="fundEmergency"] [name="amount"]').fill('4000');
   await page.locator('[data-capform="fundEmergency"] button[type="submit"]').click();
   d=await data();assert.equal(d.accounts[0][1],bank-4000);assert.equal(d.capitalV2.goals.find(x=>x.name==='Emergency Fund').saved,saved+4000);
   await page.locator('[data-cap="withdrawEmergency"]').click();
   await page.locator('[data-capform="withdrawEmergency"] [name="amount"]').fill('1000');
   await page.locator('[data-capform="withdrawEmergency"] button[type="submit"]').click();
   d=await data();assert.equal(d.accounts[0][1],bank-3000);assert.equal(d.capitalV2.goals.find(x=>x.name==='Emergency Fund').saved,saved+3000);
  });
  await check('Affordability calculator uses amortization inputs and saves simulations',async()=>{
   await go(40);
   await page.locator('[data-capform="purchase"] [name="price"]').fill('2400000');
   await page.locator('[data-capform="purchase"] [name="down"]').fill('600000');
   await page.locator('[data-capform="purchase"] [name="interest"]').fill('10.5');
   await page.locator('[data-capform="purchase"] button[type="submit"]').click();
   let d=await data();assert.equal(d.capitalV2.purchase.price,2400000);assert.equal(d.capitalV2.purchase.down,600000);
   await page.locator('[data-cap="savePurchase"]').click();assert.equal((await data()).capitalV2.purchaseSaved.length,1);
  });
  await check('Funding request approval is administrative and does not transfer money',async()=>{
   await go(41);const before=(await data()).accounts.reduce((n,x)=>n+x[1],0);
   await page.locator('[data-cap="newRequest"]').first().click();
   await page.locator('[data-capform="request"] [name="title"]').fill('QA Training Budget');
   await page.locator('[data-capform="request"] [name="amount"]').fill('35000');
   await page.locator('[data-capform="request"] [name="justification"]').fill('Professional development budget');
   await page.locator('[data-capform="request"] button[type="submit"]').click();
   let d=await data(),req=d.capitalV2.requests.find(x=>x.title==='QA Training Budget');assert.equal(req.status,'Pending');
   await page.locator('[data-cap="request:'+req.id+'"]').first().click();
   await page.locator('[data-cap="approveRequest"]').click();
   d=await data();assert.equal(d.capitalV2.requests.find(x=>x.id===req.id).status,'Approved');
   assert.equal(d.accounts.reduce((n,x)=>n+x[1],0),before);
  });
  await check('Financial scenarios update and export actual forecast CSV',async()=>{
   await go(42);await page.locator('[data-capform="scenario"] [name="incomeGrowth"]').fill('8');
   await page.locator('[data-capform="scenario"] [name="horizon"]').selectOption('24');
   await page.locator('[data-capform="scenario"] button[type="submit"]').click();
   assert.equal((await data()).capitalV2.scenario.horizon,24);
   await page.locator('[data-cap="saveScenario"]').first().click();assert.equal((await data()).capitalV2.savedScenarios.length,1);
   const download=page.waitForEvent('download');
   await page.locator('[data-cap="exportScenario"]').click();assert.match((await download).suggestedFilename(),/csv$/);
  });
  await check('Mobile 390px has no document horizontal overflow on 35–42',async()=>{
   await page.setViewportSize({width:390,height:844});
   for(let n=35;n<=42;n++){await go(n);let dimensions=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));
    if(dimensions.width>dimensions.viewport+2){let hits=await page.evaluate(()=>[...document.querySelectorAll('.cap-page *')].filter(el=>el.getBoundingClientRect().right>innerWidth+3).slice(0,12).map(x=>[x.tagName,String(x.className).slice(0,60),Math.round(x.getBoundingClientRect().right)]));console.log('OVERFLOW DETAILS',n,JSON.stringify(hits))}
    assert.ok(dimensions.width<=dimensions.viewport+2,'Screen '+n+': '+JSON.stringify(dimensions));
    if([35,37,39,40,41,42].includes(n))await page.screenshot({path:path.join(art,'screen-'+n+'-mobile.png'),fullPage:true});
   }
  });
  await check('No uncaught browser exceptions',async()=>assert.deepEqual(errors,[]));
  fs.writeFileSync(path.join(art,'results.json'),JSON.stringify({passes,fails,errors},null,2));console.log('RESULT:',passes.length,'passed;',fails.length,'failed');
  if(fails.length)process.exitCode=1;
 }finally{await browser?.close();srv.kill('SIGTERM')}
}
main().catch(e=>{console.error(e);process.exitCode=1});
