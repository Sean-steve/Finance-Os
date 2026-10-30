
'use strict';
const {chromium}=require('playwright'),{spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const base='http://127.0.0.1:8914',root=path.resolve(__dirname,'..'),art=path.join(root,'qa-artifacts','batch27-34');
fs.mkdirSync(art,{recursive:true});
const nap=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const srv=spawn('python3',['-m','http.server','8914','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
 let browser;const passes=[],fails=[],errors=[];
 const check=async(n,fn)=>{try{await fn();passes.push(n);console.log('PASS:',n)}catch(e){fails.push({n,error:String(e)});console.log('FAIL:',n,String(e).slice(0,650))}};
 try{
  for(let i=0;i<45;i++){try{if((await fetch(base)).ok)break}catch(e){}await nap(150)}
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1536,height:1024},acceptDownloads:true});page.setDefaultTimeout(4500);
  page.on('pageerror',e=>errors.push(e.message));
  const go=async n=>{await page.goto(base+'/rebuild.html#screen/'+n);await page.locator('.banner h1').first().waitFor()};
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('finance-os-exact-rebuild-demo-v1')));
  await check('Previous 01–26 routes preserved',async()=>{for(const i of [1,3,4,5,7,10,16,21,24,25,26]){await page.goto(base+'/rebuild.html#screen/'+i);assert.ok((await page.locator('#app').innerHTML()).length>600)}});
  await check('Eight distinct coded screens 27–34',async()=>{const headings=new Set();for(let i=27;i<=34;i++){await go(i);assert.equal(await page.locator('.cfpage').count(),1);assert.ok(await page.locator('.cf-panel').count()>=3,'Screen '+i);headings.add(await page.locator('.banner h1').innerText());await page.screenshot({path:path.join(art,'screen-'+i+'-desktop.png'),fullPage:true})}assert.equal(headings.size,8)});
  await check('Income source editor persists across routes',async()=>{
    await go(28);await page.locator('[data-cfa="newIncome"]').click();
    await page.locator('[data-cfform="income"] [name="name"]').fill('QA Income Stream');
    await page.locator('[data-cfform="income"] [name="amount"]').fill('23000');
    await page.locator('[data-cfform="income"] button[type="submit"]').click();
    assert.ok((await saved()).incomeFlowV2.incomes.find(x=>x.name==='QA Income Stream'&&x.amount===23000));
    await go(27);await go(28);await page.locator('[data-cfsearch="income"]').fill('QA Income');
    assert.ok(await page.getByText('QA Income Stream',{exact:true}).count()>0);
  });
  await check('Income forecast assumptions recalculate and persist',async()=>{
    await go(29);await page.locator('[data-cfform="scenario"] [name="incomeGrowth"]').fill('7');
    await page.locator('[data-cfform="scenario"] [name="horizon"]').selectOption('3');
    await page.locator('[data-cfform="scenario"] button[type="submit"]').click();
    assert.equal((await saved()).incomeFlowV2.scenario.incomeGrowth,7);
    assert.equal((await saved()).incomeFlowV2.scenario.horizon,3);
  });
  await check('Create bill, navigate to detail, and locally record a demo payment',async()=>{
    await go(30);await page.locator('[data-cfa="newBill"]').click();
    await page.locator('[data-cfform="bill"] [name="name"]').fill('QA Internet Bill');
    await page.locator('[data-cfform="bill"] [name="amount"]').fill('3200');
    await page.locator('[data-cfform="bill"] button[type="submit"]').click();
    const bill=(await saved()).incomeFlowV2.bills.find(x=>x.name==='QA Internet Bill');assert.ok(bill);
    await page.locator('[data-cfa="bill:'+bill.id+'"]').first().click();
    assert.match(await page.locator('.banner h1').innerText(),/Bill Details/);
    assert.ok(await page.getByText('QA Internet Bill',{exact:true}).count()>0);
    await page.locator('[data-cfform="payBill"] [name="amount"]').fill('3200');
    await page.locator('[data-cfform="payBill"] button[type="submit"]').click();
    let s=(await saved()).incomeFlowV2;assert.equal(s.bills.find(x=>x.id===bill.id).status,'Paid');
    assert.ok(s.paymentHistory.some(x=>x.billId===bill.id));
    assert.match(await page.locator('[role="status"]').innerText(),/simulated.*NOT.*completed/i);
  });
  await check('Bill reminders persist but external autopay is not activated',async()=>{
    await go(31);await page.locator('[data-cfa="billReminder"]').click();
    const flag=(await saved()).incomeFlowV2.bills.find(x=>x.id==='b1').reminder;
    assert.equal(typeof flag,'boolean');
    await page.locator('[data-cfa="billAutopay"]').click();
    assert.match(await page.locator('[role="status"]').innerText(),/No automatic bank payments/i);
  });
  await check('Cash flow timeline has both inflows and outflows',async()=>{
    await go(32);assert.ok(await page.getByText('Upcoming Inflows').count()>0);
    assert.ok(await page.getByText('Upcoming Outflows').count()>0);
    await page.locator('[data-cfa="tab:cashTab:Monthly"]').click();
    assert.ok(await page.locator('.cf-tabs button.on').filter({hasText:'Monthly'}).count()>0);
  });
  await check('Forecast and recovery checklist share scenario data',async()=>{
    await go(33);await page.locator('[data-cfform="scenario"] [name="expenseGrowth"]').fill('9');
    await page.locator('[data-cfform="scenario"] button[type="submit"]').click();
    await go(34);await page.locator('[data-cfrecovery="defer"]').check();
    await page.locator('[data-cfform="recovery"] [name="target"]').fill('90000');
    await page.locator('[data-cfform="recovery"] button[type="submit"]').click();
    const state=(await saved()).incomeFlowV2;
    assert.equal(state.scenario.expenseGrowth,9);assert.ok(state.shortfall.completed.includes('defer'));
    assert.equal(state.shortfall.target,90000);
  });
  await check('Income and forecast CSV exports download',async()=>{
    await go(28);let promise=page.waitForEvent('download');await page.locator('[data-cfa="incomeExport"]').click();assert.match((await promise).suggestedFilename(),/csv$/);
    await go(33);promise=page.waitForEvent('download');await page.locator('[data-cfa="forecastExport"]').click();assert.match((await promise).suggestedFilename(),/csv$/);
  });
  await check('Responsive layouts contain content at 390px',async()=>{
    await page.setViewportSize({width:390,height:844});
    for(let i=27;i<=34;i++){await go(i);const dim=await page.evaluate(()=>({body:document.documentElement.scrollWidth,viewport:innerWidth}));if(dim.body>dim.viewport+2){const offenders=await page.evaluate(()=>Array.from(document.querySelectorAll('.cfpage *')).filter(x=>x.getBoundingClientRect().right>innerWidth+2).slice(0,6).map(x=>({tag:x.tagName,class:x.className,extent:Math.round(x.getBoundingClientRect().right)})));console.log('OVERFLOW',i,JSON.stringify(offenders))}assert.ok(dim.body<=dim.viewport+2,'Overflow '+i+' '+JSON.stringify(dim));if([27,30,31,33,34].includes(i))await page.screenshot({path:path.join(art,'screen-'+i+'-mobile.png'),fullPage:true})}
  });
  await check('No uncaught JavaScript errors',async()=>assert.deepEqual(errors,[]));
  fs.writeFileSync(path.join(art,'results.json'),JSON.stringify({passes,fails,errors},null,2));
  console.log('RESULT:',passes.length,'passed',fails.length,'failed');
  if(fails.length)process.exitCode=1;
 }finally{await browser?.close();srv.kill('SIGTERM')}
}
main().catch(e=>{console.error(e);process.exitCode=1});
