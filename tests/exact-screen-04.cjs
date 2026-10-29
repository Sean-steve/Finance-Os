
'use strict';
const {chromium}=require('playwright'),{spawn}=require('node:child_process'),fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const out=path.resolve(__dirname,'../qa-exact');fs.mkdirSync(out,{recursive:true});
const server=spawn('python3',['-m','http.server','8891'],{stdio:'ignore'});
const sleep=n=>new Promise(r=>setTimeout(r,n));
(async()=>{
 let browser;
 try{
  for(let i=0;i<45;i++){try{if((await fetch('http://127.0.0.1:8891/exact.html')).ok)break}catch{}await sleep(150)}
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1536,height:1024}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto('http://127.0.0.1:8891/exact.html');
  assert.match(await page.locator('.banner h1').innerText(),/Good morning/);
  assert.equal(await page.locator('.metric').count(),4);
  assert.equal(await page.locator('.dashboard > .panel').count(),10);
  assert.ok(await page.locator('.dashboard .bars rect').count()>20);
  await page.screenshot({path:path.join(out,'screen-04-dom-desktop.png'),fullPage:true});
  await page.getByRole('button',{name:'Add Transaction'}).first().click();
  await page.locator('#dialogBody [name="desc"]').fill('QA grocery');
  await page.locator('#dialogBody [name="amount"]').fill('1200');
  await page.locator('#save').click();
  assert.ok(await page.getByText('QA grocery').count()>0);
  await page.reload();
  assert.ok(await page.getByText('QA grocery').count()>0,'Demo state must persist');
  await page.locator('.edit').click();
  await page.locator('#dialogBody [name="amount"]').fill('460000');
  await page.locator('#save').click();
  assert.match(await page.locator('.metrics').innerText(),/460,000/);
  for(let w of [1536,1024,768,390]){
   await page.setViewportSize({width:w,height:850});
   const dimensions=await page.evaluate(()=>({body:document.documentElement.scrollWidth,viewport:window.innerWidth}));
   assert.ok(dimensions.body<=dimensions.viewport+2,JSON.stringify(dimensions));
   await page.screenshot({path:path.join(out,'screen-04-dom-'+w+'.png'),fullPage:true});
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: coded screen 04 DOM; editable transaction; persistence; KPI edits; layout; 4 viewports; no exceptions');
 }finally{await browser?.close();server.kill('SIGTERM')}
})().catch(e=>{console.error(e);process.exitCode=1});
