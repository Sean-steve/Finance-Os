
'use strict';
const {chromium}=require('playwright');
const {spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8898',art=path.join(root,'qa-artifacts','batch06-15');
fs.mkdirSync(art,{recursive:true});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function go(){
 const srv=spawn('python3',['-m','http.server','8898','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
 let browser;const passed=[],failed=[],errors=[];
 const test=async(name,fn)=>{try{await fn();console.log('PASS:',name);passed.push(name)}catch(e){console.error('FAIL:',name,e.message);failed.push({name,error:e.message})}};
 try{
  for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break}catch{}await sleep(170)}
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1536,height:1024},acceptDownloads:true});
  page.setDefaultTimeout(5000);
  page.on('pageerror',e=>errors.push(e.message));
  const route=async n=>{await page.goto(base+'/rebuild.html#screen/'+n);await page.locator('h1').first().waitFor()};
  await test('Screens 01–05 retained',async()=>{for(let i=1;i<=5;i++){await route(i);assert.equal(await page.locator('.reference-shade').count(),0)}});
  await test('Ten distinct DOM screens',async()=>{let h=new Set();for(let i=6;i<=15;i++){await route(i);assert.equal(await page.locator('.bpage').count(),1);assert.ok(await page.locator('.b-panel').count()>=3);h.add(await page.locator('.banner h1').innerText());await page.screenshot({path:path.join(art,'screen-'+i+'.png'),fullPage:true})}assert.equal(h.size,10)});
  await test('Calendar navigation',async()=>{await route(6);await page.locator('[data-baction="monthNext"]').click();assert.match(await page.locator('.b-calendar-head').innerText(),/November 2026/);await page.locator('[data-baction="calendarToday"]').click();assert.match(await page.locator('.b-calendar-head').innerText(),/October 2026/)});
  await test('Accounts to details and activity',async()=>{await route(7);await page.locator('.b-account-card').first().click();assert.match(await page.locator('.banner h1').innerText(),/Account Details/);await page.locator('[data-baction="tab:accountDetail:Transactions"]').click();assert.ok(await page.locator('.b-table').count()>0)});
  await test('Manual account addition',async()=>{await route(9);await page.locator('[data-baction="addAccount"]').first().click();await page.locator('[data-bform="addAccount"] [name="name"]').fill('QA Fund');await page.locator('[data-bform="addAccount"] [name="balance"]').fill('7500');await page.locator('[data-bform="addAccount"] button[type="submit"]').click();await route(7);assert.ok(await page.getByText('QA Fund',{exact:true}).count()>0)});
  await test('Transaction detail to edit and save',async()=>{await route(10);await page.locator('[data-baction^="openTx:"]').first().click();assert.match(await page.locator('.banner h1').innerText(),/Transaction Details/);await page.locator('[data-baction="editTx"]').click();await page.locator('#batchTxForm [name="desc"]').fill('QA edited entry');await page.locator('#batchTxForm [name="amount"]').fill('2100');await page.locator('#batchTxForm button[type="submit"]').click();assert.match(await page.locator('.banner h1').innerText(),/Transaction Management/);assert.ok(await page.getByText('QA edited entry',{exact:true}).count()>0)});
  await test('Record new transaction and persist',async()=>{await route(12);await page.locator('#batchTxForm [name="desc"]').fill('QA new entry');await page.locator('#batchTxForm [name="amount"]').fill('420');await page.locator('#batchTxForm button[type="submit"]').click();await page.reload();assert.ok(await page.getByText('QA new entry',{exact:true}).count()>0)});
  await test('CSV preview, import and duplicate guard',async()=>{await route(13);const csv='date,description,amount,category,account\n2026-10-02,QA CSV grocery,-1450,Food & Groceries,KCB Main Account';const upload=async()=>{await page.locator('#statementFile').setInputFiles({name:'qa.csv',mimeType:'text/csv',buffer:Buffer.from(csv)});await page.locator('[data-baction="previewImport"]').click();await page.locator('[data-baction="commitImport"]').click()};await upload();await route(10);assert.ok(await page.getByText('QA CSV grocery',{exact:true}).count()>0);await route(13);await upload();assert.match(await page.locator('.b-note[role="status"]').innerText(),/skipped 1 duplicates/i)});
  await test('Simulated transfer conserves funds',async()=>{await route(14);const balance=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('finance-os-exact-rebuild-demo-v1')).accounts.reduce((s,a)=>s+a[1],0));let before=await balance();await page.locator('[data-bform="transfer"] [name="amount"]').fill('1500');await page.locator('[data-bform="transfer"] button[type="submit"]').click();await page.locator('[data-baction="confirmTransfer"]').click();assert.equal(await balance(),before)});
  await test('Manual reconciliation matching',async()=>{await route(15);await page.locator('[data-baction^="reconMatch:"]').first().click();assert.match(await page.locator('.b-note[role="status"]').innerText(),/Locally marked as matched/)});
  await test('CSV export download',async()=>{await route(10);const promise=page.waitForEvent('download');await page.locator('[data-baction="exportCsv"]').click();assert.match((await promise).suggestedFilename(),/csv$/)});
  await test('Responsive overflow and screenshots',async()=>{await page.setViewportSize({width:390,height:820});for(let i=6;i<=15;i++){await route(i);let v=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));assert.ok(v.width<=v.viewport+2,'Overflow on '+i+': '+JSON.stringify(v));if([6,10,12,13,14,15].includes(i))await page.screenshot({path:path.join(art,'mobile-'+i+'.png'),fullPage:true})}});
  await test('No runtime exceptions',async()=>assert.deepEqual(errors,[]));
  fs.writeFileSync(path.join(art,'result.json'),JSON.stringify({passed,failed,errors},null,2));
  console.log(passed.length+' passed / '+failed.length+' failed');
  if(failed.length)process.exitCode=1;
 }finally{await browser?.close();srv.kill('SIGTERM')}
}
go().catch(e=>{console.error(e);process.exitCode=1});
