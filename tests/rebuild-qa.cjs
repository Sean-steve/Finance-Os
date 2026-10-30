
'use strict';
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const path=require('node:path'),fs=require('node:fs'),assert=require('node:assert/strict');
const base='http://127.0.0.1:8890',art=path.join(__dirname,'../qa-artifacts/rebuild');
fs.mkdirSync(art,{recursive:true});
const nap=ms=>new Promise(r=>setTimeout(r,ms));
async function go(){
 const srv=spawn('python3',['-m','http.server','8890','--bind','127.0.0.1'],{stdio:'ignore'});
 let browser,errors=[],failures=[];
 try{
  for(let i=0;i<50;i++){try{if((await fetch(base)).status===200)break}catch(e){}await nap(200)}
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1536,height:1024},acceptDownloads:true});
  page.setDefaultTimeout(6500);
  page.on('pageerror',e=>errors.push(e.message));
  async function check(label,action){try{await action();console.log('PASS '+label)}catch(e){console.log('FAIL '+label,e.message);failures.push(label+': '+e.message)}}
  await page.goto(base+'/rebuild.html#screen/1');
  await check('Screen 01 login is real form, not full-screen image',async()=>{
    assert.equal(await page.locator('#auth-form input[name="email"]').count(),1);
    assert.equal(await page.locator('.reference-shade').count(),0);
    assert.ok(await page.locator('main img').count()===0);
    await page.screenshot({path:path.join(art,'01-auth-desktop.png'),fullPage:true});
  });
  await check('Screen 01 sign in starts onboarding',async()=>{
    await page.locator('#auth-form input[name="email"]').fill('test@example.invalid');
    await page.locator('#auth-form input[name="password"]').fill('demo-only');
    await page.locator('#auth-form button[type="submit"]').click();
    assert.match(await page.locator('h1').first().innerText(),/Connect your financial accounts/);
  });
  await check('Screen 02 providers and progress work',async()=>{
    assert.equal(await page.locator('.provider-card').count(),9);
    await page.locator('[data-provider="M-Pesa"]').first().click();
    assert.equal(await page.locator('[role="dialog"]').count(),1);
    await page.locator('[data-action="confirmModal"]').click();
    assert.equal(await page.locator('.shade').count(),0,'Provider dialog should close');
    await page.screenshot({path:path.join(art,'02-onboarding-desktop.png'),fullPage:true});
    await page.locator('[data-nav="3"]').last().click();
  });
  await check('Screen 03 financial form is editable',async()=>{
    assert.match(await page.locator('h1').first().innerText(),/Financial Profile & Setup/);
    await page.screenshot({path:path.join(art,'03-profile-desktop.png'),fullPage:true});
    await page.locator('#profile-form input[name="name"]').fill('QA User');
    await page.locator('#profile-form input[name="email"]').fill('qa@example.invalid');
    await page.locator('#profile-form button[type="submit"]').click();
    assert.match(await page.locator('.banner h1').innerText(),/Good morning, QA/);
  });
  await check('Screen 04 matches approved multi-panel organization',async()=>{
    const expected=['Account Overview','Income vs Expenses','Spending by Category','AI Financial Advisor','Budget Progress','Financial Goals','Upcoming Bills & Payments','Quick Actions','Recent Transactions','Cash Flow Forecast'];
    for(const text of expected)assert.ok(await page.getByRole('heading',{name:text,exact:true}).count()>0,'Missing '+text);
    assert.equal(await page.locator('.metric-card').count(),4);
    await page.screenshot({path:path.join(art,'04-command-desktop.png'),fullPage:true});
  });
  await check('Reference toggle shows supplied screenshot ONLY when requested',async()=>{
    await page.locator('[data-action="compare"]').click();
    assert.equal(await page.locator('.reference-dialog img[src*="screen-04.webp"]').count(),1);
    await page.locator('.reference-dialog [data-action="compare"]').click();
    assert.equal(await page.locator('.reference-shade').count(),0);
  });
  await check('Transaction entry changes real DOM ledger',async()=>{
    await page.locator('[data-action="addTx"]').last().click();
    await page.locator('#transaction-form input[name="name"]').fill('QA Groceries');
    await page.locator('#transaction-form input[name="amount"]').fill('900');
    await page.locator('#transaction-form button[type="submit"]').click();
    assert.ok(await page.getByText('QA Groceries').count()>=1);
  });
  await check('Reconstructed budget navigation opens the coded Screen 21',async()=>{
    const nav=await page.locator('[data-nav="21"]').first().count();
    assert.equal(nav,1);
    await page.locator('[data-nav="21"]').first().click();
    assert.ok(page.url().includes('rebuild.html#screen/21'));assert.equal(await page.locator('.spend-page').count(),1);
  });
  await check('Screen 05 Safe-to-Spend matches reference panel structure',async()=>{
   await page.goto(base+'/rebuild.html#screen/5');
   for(const t of ['Today’s Spending','Daily Spending Trend','Spending Pace','Upcoming Obligations (Next 14 Days)','Recent Transactions','AI Financial Insights','Quick Actions']){
    assert.equal(await page.getByRole('heading',{name:t,exact:true}).count(),1,'Missing '+t);
   }
   assert.ok(await page.locator('.safe-main').count()===1);
   assert.equal(await page.locator('.safe-summary .safe-mini').count(),4);
   await page.screenshot({path:path.join(art,'05-safe-to-spend-desktop.png'),fullPage:true});
  });
  await check('Mobile auth uses responsive editable UI',async()=>{
    await page.setViewportSize({width:390,height:844});
    await page.goto(base+'/rebuild.html#screen/1');
    assert.equal(await page.locator('#auth-form').count(),1);
    assert.equal(await page.locator('img').count(),0);
    assert.ok(await page.locator('.auth-login').isVisible());
    const w=await page.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);
    assert.ok(w[0]<=w[1]+2,'Horizontal overflow '+w);
    await page.screenshot({path:path.join(art,'01-auth-mobile.png'),fullPage:true});
  });
  await check('Responsive Command Centre remains within viewport',async()=>{
    for(const w of [390,768,1024,1536]){
      await page.setViewportSize({width:w,height:900});
      await page.goto(base+'/rebuild.html#screen/4');
      const nums=await page.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);
      assert.ok(nums[0]<=nums[1]+2,w+' overflow '+nums+' offending '+JSON.stringify(await page.evaluate(()=>Array.from(document.querySelectorAll('body *')).map(e=>({selector:e.className||e.tagName,right:Math.round(e.getBoundingClientRect().right)})).filter(x=>x.right>innerWidth+3).slice(0,12))));
      if(w===390)await page.screenshot({path:path.join(art,'04-command-mobile.png'),fullPage:true});
      await page.goto(base+'/rebuild.html#screen/5');
      const safeDimensions=await page.evaluate(()=>[document.documentElement.scrollWidth,innerWidth]);
      assert.ok(safeDimensions[0]<=safeDimensions[1]+2,'Safe-to-Spend overflow at '+w+' px '+safeDimensions);
      if(w===390)await page.screenshot({path:path.join(art,'05-safe-to-spend-mobile.png'),fullPage:true});
    }
  });
  assert.deepEqual(errors,[],'Unexpected JS errors '+errors.join('; '));
  fs.writeFileSync(path.join(art,'test-report.json'),JSON.stringify({pass:failures.length===0,failures,errors},null,2));
  console.log('Rebuild QA failures:',failures.length);
  if(failures.length)process.exitCode=1;
 }finally{if(browser)await browser.close();srv.kill('SIGTERM')}
}
go().catch(e=>{console.error(e);process.exitCode=1});
