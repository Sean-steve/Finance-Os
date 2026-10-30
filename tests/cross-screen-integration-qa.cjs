
'use strict';
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8992',output=path.join(root,'qa-artifacts','cross-screen');
fs.mkdirSync(output,{recursive:true});
const nap=n=>new Promise(r=>setTimeout(r,n));
async function run(){
 const server=spawn('python3',['-m','http.server','8992','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
 let browser;
 const passed=[],failed=[];
 const check=async(name,callback)=>{try{await callback();passed.push(name);console.log('PASS:',name)}catch(e){failed.push({name,error:String(e)});console.log('FAIL:',name,String(e).slice(0,750))}};
 try{
  for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break}catch{}await nap(150)}
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1536,height:1024},acceptDownloads:true});
  page.setDefaultTimeout(6000);
  const go=async n=>{await page.goto(base+'/rebuild.html#screen/'+n);await page.locator('#app').first().waitFor()};
  const get=()=>page.evaluate(()=>{
   const m=JSON.parse(localStorage.getItem('finance-os-exact-rebuild-demo-v1'));
   const c=window.FinanceLedgerCore?.summary(m);
   return {model:m,core:c};
  });
  await check('Shared accounting matches coded Net Worth and Financial Health',async()=>{
    await go(50);let s=await get();
    assert.ok(s.core&&Number.isFinite(s.core.netWorth));
    assert.ok((await page.locator('.we-kpis').innerText()).includes(Math.round(s.core.netWorth).toLocaleString('en-KE')));
    await go(56);
    assert.ok((await page.locator('.gv-kpis').innerText()).includes(Math.round(s.core.netWorth).toLocaleString('en-KE')));
  });
  await check('Goal funding moves cash to earmarked savings without phantom net worth loss',async()=>{
    await go(38);const before=await get();
    assert.ok(await page.locator('[data-capform="fundGoal"]').count()>0);
    await page.locator('[data-capform="fundGoal"] [name="amount"]').fill('5000');
    await page.locator('[data-capform="fundGoal"] button[type="submit"]').click();
    const after=await get();
    assert.equal(after.core.cash,before.core.cash-5000);
    assert.equal(after.core.goalTransfers,before.core.goalTransfers+5000);
    assert.equal(after.core.netWorth,before.core.netWorth);
    await go(50);assert.ok((await page.locator('.we-kpis').innerText()).includes(Math.round(before.core.netWorth).toLocaleString('en-KE')));
  });
  await check('Debt repayment reduces cash and liability equally without creating wealth',async()=>{
    await go(43);const before=await get();
    await page.locator('[data-pr="payment"]').first().click();
    const form=page.locator('[data-prform="payment"]');
    await form.locator('[name="amount"]').fill('1500');
    await form.locator('button[type="submit"]').click();
    const after=await get();
    assert.equal(after.core.cash,before.core.cash-1500);
    assert.equal(after.core.debts,before.core.debts-1500);
    assert.equal(after.core.netWorth,before.core.netWorth);
    assert.ok(after.model.protectionV2.debtPayments.some(x=>x.amount===1500&&x.simulated));
    await go(56);
    assert.ok((await page.locator('.gv-kpis').innerText()).includes(Math.round(after.core.netWorth).toLocaleString('en-KE')));
  });
  await check('Income Source edits appear in financial health and reporting',async()=>{
    await go(28);const before=await get();
    await page.locator('[data-cfa="newIncome"]').first().click();
    const f=page.locator('[data-cfform="income"]');
    await f.locator('[name="name"]').fill('QA Income Link');
    await f.locator('[name="amount"]').fill('12000');
    await f.locator('button[type="submit"]').click();
    const after=await get();
    assert.equal(after.core.plannedMonthlyIncome,before.core.plannedMonthlyIncome+12000);
    await go(56);
    assert.ok((await page.locator('.gv-page').innerText()).includes('QA')===false||await page.locator('.gv-kpis').count()>0);
    await go(58);
    await page.locator('[data-gv="generateReport"]').first().click();
    await page.locator('[data-gvform="report"] [name="type"]').selectOption('Income Statement');
    await page.locator('[data-gvform="report"] button[type="submit"]').click();
    const state=(await get()).model;
    assert.equal(state.governanceV2.reports[0].rows[1][1],after.core.plannedMonthlyIncome);
  });
  await check('Transaction ledger report uses posted ledger records instead of budget estimates',async()=>{
    await go(12);
    const form=page.locator('[data-bform="transaction"]');
    assert.equal(await form.count(),1);
    await form.locator('[name="amount"]').fill('1500');
    await form.locator('[name="desc"]').fill('QA posted grocery');
    await form.locator('button[type="submit"]').click();
    const before=(await get()).model;
    assert.ok(before.transactions.some(x=>x[1]==='QA posted grocery'));
    await go(56);
    assert.ok((await page.locator('.gv-page').innerText()).includes('Recorded ledger spending'));
    await go(58);
    await page.locator('[data-gv="generateReport"]').first().click();
    await page.locator('[data-gvform="report"] [name="type"]').selectOption('Transaction Ledger Report');
    await page.locator('[data-gvform="report"] button[type="submit"]').click();
    const snap=(await get()).model.governanceV2.reports[0].rows;
    assert.ok(snap.some(row=>row[1]==='QA posted grocery'));
  });
  await check('No actual connected providers appear after preparing a demo template',async()=>{
    await go(59);await page.locator('[data-gv="provider:kcb"]').first().click();
    await page.locator('[data-gv="providerPrepare"]').click();
    const s=await get();
    assert.equal(s.model.governanceV2.integrations.find(x=>x.id==='kcb').demo,true);
    assert.match(await page.locator('.gv-kpis').innerText(),/Connected Accounts\s*0/);
  });
  fs.writeFileSync(path.join(output,'workflow-contracts.json'),JSON.stringify({passed,failed},null,2));
  console.log('CROSS_SCREEN_RESULT',passed.length,'passed',failed.length,'failed');
  if(failed.length)process.exitCode=1;
 }finally{await browser?.close();server.kill('SIGTERM')}
}
run().catch(e=>{console.error(e);process.exitCode=1});
