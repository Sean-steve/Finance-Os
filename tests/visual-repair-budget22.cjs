
'use strict';
const {chromium}=require('playwright'),{spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8964',out=path.join(root,'qa-artifacts','visual-pass-1');fs.mkdirSync(out,{recursive:true});
const pause=t=>new Promise(r=>setTimeout(r,t));
async function main(){
const srv=spawn('python3',['-m','http.server','8964','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});let browser;const passes=[],fails=[],jsErrors=[];
const check=async(n,fn)=>{try{await fn();passes.push(n);console.log('PASS:',n)}catch(e){fails.push({name:n,error:String(e)});console.log('FAIL:',n,String(e).slice(0,650))}};
try{
for(let i=0;i<45;i++){try{if((await fetch(base)).ok)break}catch(e){}await pause(180)}
browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1536,height:1024},acceptDownloads:true});page.setDefaultTimeout(6000);page.on('pageerror',e=>jsErrors.push(e.message));
const go=async n=>{await page.goto(base+'/rebuild.html#screen/'+n);await page.locator('#app').waitFor()};
const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('finance-os-exact-rebuild-demo-v1')));
await check('New Screen 22 exists as a unique full native budget editor',async()=>{
await go(22);assert.equal(await page.locator('.bd22-screen').count(),1);
assert.equal(await page.locator('.bd22-catrow:not(.bd22-total)').count(),10);
assert.ok(await page.locator('.bd22-donut').count()>0);
assert.ok(await page.locator('.bd22-step').count()===4);
await page.screenshot({path:path.join(out,'screen-22-desktop.png'),fullPage:true});
});
await check('Screen 21 retains original layout, now with source-aligned Quick Setup panel',async()=>{
await go(21);assert.ok(await page.locator('.sp-budget-form').count()>0);
assert.ok(await page.locator('.sp-left>.sp-panel:first-child>.sp-panel').count()>0);
assert.equal(await page.locator('.sp-right>.sp-panel').first().locator('h2').innerText(),'Budget Preview');
await page.screenshot({path:path.join(out,'screen-21-desktop.png'),fullPage:true});
});
await check('Screen 21 Budget Studio link opens Screen 22',async()=>{
await go(21);await page.locator('[data-spnav="22"]').first().click();
assert.equal(new URL(page.url()).hash,'#screen/22');
assert.equal(await page.locator('.bd22-screen').count(),1);
});
await check('Screen 22 validates mismatched allocation total before saving',async()=>{
await go(22);
const original=(await saved()).spendV2.budgetLimit;
await page.locator('[data-budget22="amount:500000"]').click();
await page.locator('[data-budget22="save"]').click();
assert.match(await page.locator('.bd22-message').innerText(),/must equal/i);
assert.equal((await saved()).spendV2.budgetLimit,original);
});
await check('Screen 22 balances a draft and saves into shared spending model',async()=>{
await go(22);
await page.locator('[data-budget22="amount:500000"]').click();
await page.locator('[data-budget22="balance"]').click();
const catSum=await page.evaluate(()=>Array.from(document.querySelectorAll('.bd22-catrow [data-budget22cat]')).reduce((s,x)=>s+Number(x.value),0));
assert.equal(catSum,500000);
await page.locator('[data-budget22="save"]').click();
const s=(await saved()).spendV2;assert.equal(s.budgetLimit,500000);
assert.equal(Object.values(s.categories).reduce((a,v)=>a+Number(v),0),500000);
assert.equal(new URL(page.url()).hash,'#screen/21');
});
await check('Budget updates reflect on existing Screen 21',async()=>{
await go(21);assert.ok((await page.locator('.spend-page').innerText()).includes('KES 500,000'));
});
await check('Budget draft can be discarded without altering saved values',async()=>{
await go(22);await page.locator('[data-budget22="amount:100000"]').click();
await page.locator('[data-budget22="discard"]').click();
assert.equal((await saved()).spendV2.budgetLimit,500000);
});
await check('Category edits, threshold and rollover persist from new Studio',async()=>{
await go(22);
let v=page.locator('[data-budget22cat="Housing"]');await v.fill('200000');await v.press('Tab');
await page.locator('[data-budget22="balance"]').click();
await page.locator('[data-budget22change="threshold"]').selectOption('90');
await page.locator('[data-budget22roll="Housing"]').check();
await page.locator('[data-budget22="save"]').click();
const s=(await saved()).spendV2;
assert.equal(s.rules.alertThreshold,90);
assert.equal(s.rollover.Housing,true);
assert.equal(s.categories.Housing,200000);
});
await check('Screen 08 shows one account hero and no duplicate KPI strip',async()=>{
await go(8);
assert.equal(await page.locator('.bscreen-8 .b8-hero').count(),1);
assert.equal(await page.locator('.bscreen-8>.banner').count(),0);
assert.equal(await page.locator('.b8-panels>.b-panel').count(),4);
assert.ok(await page.locator('.b8-bottom>.b-panel').count()>=3);
await page.screenshot({path:path.join(out,'screen-08-desktop.png'),fullPage:true});
});
await check('Screen 11 shows reference-aligned transaction details and actions',async()=>{
await go(11);
assert.equal(await page.locator('.b11-hero').count(),1);
assert.equal(await page.locator('.b11-identity').count(),1);
assert.equal(await page.locator('.b11-facts>div').count(),6);
assert.equal(await page.locator('.b11-action-grid>button').count(),8);
await page.screenshot({path:path.join(out,'screen-11-desktop.png'),fullPage:true});
});
await check('Screen 40 matches simulator/results/summary three-column hierarchy',async()=>{
await go(40);
assert.ok(await page.locator('#cap-purchase').count()>0);
const boxes=await page.evaluate(()=>[...document.querySelectorAll('.cap-page:has(#cap-purchase) .cap-grid > :nth-child(-n+3)')].map(x=>({x:Math.round(x.getBoundingClientRect().x),y:Math.round(x.getBoundingClientRect().y)})));
assert.equal(boxes.length,3);assert.equal(boxes[0].y,boxes[1].y);assert.equal(boxes[1].y,boxes[2].y);assert.ok(boxes[0].x<boxes[1].x&&boxes[1].x<boxes[2].x);
await page.screenshot({path:path.join(out,'screen-40-desktop.png'),fullPage:true});
});
await check('Existing transaction edit action still navigates to Screen 12',async()=>{
await go(11);await page.locator('[data-baction="editTx"]').first().click();
assert.equal(new URL(page.url()).hash,'#screen/12');
});
await check('Every screen 01–60 retains an accessible nonempty coded route',async()=>{
for(let i=1;i<=60;i++){await go(i);const html=await page.locator('#app').innerHTML();assert.ok(html.length>400,'Screen '+i);}
});
await check('Screen 22, 08, 11 fit a mobile 390px viewport',async()=>{
await page.setViewportSize({width:390,height:844});
for(const n of [8,11,21,22]){
await go(n);const d=await page.evaluate(()=>({viewport:innerWidth,body:document.documentElement.scrollWidth}));
assert.ok(d.body<=d.viewport+2,'Screen '+n+' overflow: '+JSON.stringify(d));
await page.screenshot({path:path.join(out,'screen-'+String(n).padStart(2,'0')+'-mobile.png'),fullPage:true});
}
});
await check('No uncaught page errors',async()=>assert.deepEqual(jsErrors,[]));
fs.writeFileSync(path.join(out,'qa-results.json'),JSON.stringify({passes,fails,jsErrors},null,2));
console.log('RESULT:',passes.length,'passed;',fails.length,'failed');
if(fails.length)process.exitCode=1;
}finally{await browser?.close();srv.kill('SIGTERM')}
}
main().catch(e=>{console.error(e);process.exitCode=1});
