
'use strict';
const {chromium}=require('playwright'),{spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8960',art=path.join(root,'qa-artifacts','batch56-60');
fs.mkdirSync(art,{recursive:true});const nap=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const server=spawn('python3',['-m','http.server','8960','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
 let browser;const passes=[],fails=[],errors=[];
 const check=async(name,fn)=>{try{await fn();passes.push(name);console.log('PASS:',name)}catch(e){fails.push({name,error:String(e)});console.log('FAIL:',name,String(e).slice(0,750))}};
 try{
  for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break}catch(e){}await nap(175)}
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1536,height:1024},acceptDownloads:true});page.setDefaultTimeout(6000);
  page.on('pageerror',e=>errors.push(e.message));
  const nav=async i=>{await page.goto(base+'/rebuild.html#screen/'+i);await page.locator('#app').first().waitFor()};
  const persisted=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('finance-os-exact-rebuild-demo-v1')));
  await check('All 60 screen routes load without blank UI',async()=>{
   for(let i=1;i<=60;i++){await nav(i);let html=await page.locator('#app').innerHTML();assert.ok(html.length>540,'screen '+i+' blank or short')}
  });
  await check('Screens 56–60 have distinct coded primary content',async()=>{
   const names=new Set();
   for(let i=56;i<=60;i++){await nav(i);assert.equal(await page.locator('.gv-page').count(),1);assert.ok(await page.locator('.gv-panel').count()>=4,'screen '+i+' lacks panels');assert.equal(await page.locator('.reference-shade').count(),0);
    names.add(await page.locator('.banner h1').innerText());await page.screenshot({path:path.join(art,'screen-'+i+'-desktop.png'),fullPage:true})}
   assert.equal(names.size,5);
  });
  await check('Financial health uses current shared records',async()=>{
   await nav(56);const state=await persisted();
   const net=state.wealthV2.assets.reduce((a,x)=>a+x.value,0)+state.wealthV2.holdings.reduce((a,h)=>a+h.shares*h.price,0)+state.accounts.filter((a,i)=>i<=2||a[0].toLowerCase().includes('cash wallet')).reduce((a,x)=>a+Number(x[1]),0)-state.protectionV2.debts.reduce((a,d)=>a+d.balance,0);
   const nw=net.toLocaleString('en-KE');
   assert.ok((await page.locator('.gv-kpis').innerText()).includes(nw),'health net worth must match underlying ledger');
   assert.ok(await page.locator('.gv-radar').count()>0);
  });
  await check('Local financial advisor answers and saves chat without live AI',async()=>{
   await nav(57);await page.locator('[data-gvform="chat"] input[name="question"]').fill('How much can I save monthly?');
   await page.locator('[data-gvform="chat"] button[type="submit"]').click();
   const st=(await persisted()).governanceV2;assert.ok(st.chat.some(x=>x.kind==='user'&&x.text.includes('save monthly')));
   assert.ok(st.chat.some(x=>x.kind==='assistant'&&x.text.includes('demo monthly income')));
   assert.match(await page.locator('[role="status"]').innerText(),/not a live AI response/i);
  });
  await check('Financial reports create persistent snapshots',async()=>{
   await nav(58);await page.locator('[data-gv="generateReport"]').first().click();
   await page.locator('[data-gvform="report"] select[name="type"]').selectOption('Net Worth Report');
   await page.locator('[data-gvform="report"] input[name="name"]').fill('QA Net Worth Snapshot');
   await page.locator('[data-gvform="report"] button[type="submit"]').click();
   const state=(await persisted()).governanceV2;assert.ok(state.reports.some(x=>x.name==='QA Net Worth Snapshot'&&x.rows.length>=2));
   await page.reload();assert.ok(await page.getByText('QA Net Worth Snapshot',{exact:true}).count()>0);
  });
  await check('Saved report CSV and JSON export are real files',async()=>{
   await nav(58);const report=(await persisted()).governanceV2.reports[0];
   let p=page.waitForEvent('download');await page.locator('[data-gv="reportExport:'+report.id+'"]').first().click();assert.match((await p).suggestedFilename(),/\.csv$/);
   p=page.waitForEvent('download');await page.locator('[data-gv="reportJson"]').first().click();assert.match((await p).suggestedFilename(),/\.json$/);
  });
  await check('Scheduling preferences never claim automated delivery',async()=>{
   await nav(58);const t=page.locator('[data-gvtoggle="reports:weekly"]');
   await t.check();assert.equal((await persisted()).governanceV2.reportsSettings.weekly,true);
   assert.match(await page.locator('[role="status"]').innerText(),/No automatic emails/i);
  });
  await check('Provider preview is not represented as real connected account',async()=>{
   await nav(59);assert.match(await page.locator('.gv-kpis').innerText(),/0/);
   await page.locator('[data-gv="provider:kcb"]').first().click();
   assert.match(await page.locator('[role="dialog"]').innerText(),/NO OAuth/i);
   await page.locator('[data-gv="providerPrepare"]').click();
   const state=(await persisted()).governanceV2;
   assert.equal(state.integrations.find(x=>x.id==='kcb').demo,true);
   assert.ok((await page.locator('.gv-kpis').innerText()).includes('0'));
   assert.match(await page.locator('[role="status"]').innerText(),/No real connection/i);
  });
  await check('Profile updates and local audit history persist',async()=>{
   await nav(60);await page.locator('[data-gv="editProfile"]').first().click();
   await page.locator('[data-gvform="profile"] input[name="name"]').fill('QA Demo Account');
   await page.locator('[data-gvform="profile"] button[type="submit"]').click();
   let st=await persisted();
   assert.equal(st.profile.name,'QA Demo Account');
   assert.ok(st.governanceV2.audit.some(x=>x.event==='Edit Profile'));
   await page.reload();assert.ok((await page.locator('.account-name').innerText()).includes('QA Demo Account'));
  });
  await check('Privacy and export controls work locally',async()=>{
   await nav(60);await page.locator('[data-gvtoggle="settings:personalization"]').check();
   assert.equal((await persisted()).governanceV2.security.personalization,true);
   const p=page.waitForEvent('download');await page.locator('[data-gv="exportData"]').first().click();
   assert.match((await p).suggestedFilename(),/\.json$/);
  });
  await check('Confirm local-data deletion clears demo records only',async()=>{
   await nav(60);await page.locator('[data-gv="deleteData"]').first().click();assert.ok(await page.locator('[role="dialog"]').count()>0);
   await page.locator('[data-gv="deleteConfirm"]').click();
   await page.waitForLoadState('load');
   let current=await persisted();
   assert.ok(current&&!current.governanceV2?.reports.some(x=>x.name==='QA Net Worth Snapshot'));
  });
  await check('All final screens contain content at 390px mobile width',async()=>{
   await page.setViewportSize({width:390,height:844});
   for(let i=56;i<=60;i++){
    await nav(i);
    const d=await page.evaluate(()=>({document:document.documentElement.scrollWidth,viewport:innerWidth}));
    if(d.document>d.viewport+2){const offenders=await page.evaluate(()=>Array.from(document.querySelectorAll('.gv-page *')).filter(x=>x.getBoundingClientRect().right>innerWidth+2).slice(0,8).map(x=>({tag:x.tagName,cls:x.className?.toString().slice(0,35),r:Math.round(x.getBoundingClientRect().right)})));console.log('OVERFLOW',i,JSON.stringify(offenders))}
    assert.ok(d.document<=d.viewport+2,'mobile horizontal overflow screen '+i+': '+JSON.stringify(d));
    await page.screenshot({path:path.join(art,'screen-'+i+'-mobile.png'),fullPage:true});
   }
  });
  await check('No uncaught JavaScript errors',async()=>assert.deepEqual(errors,[]));
  fs.writeFileSync(path.join(art,'results.json'),JSON.stringify({passes,fails,errors},null,2));
  console.log('RESULT:',passes.length,'passed;',fails.length,'failed');if(fails.length)process.exitCode=1;
 }finally{await browser?.close();server.kill('SIGTERM')}
}
main().catch(e=>{console.error(e);process.exitCode=1});
