'use strict';
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const sleep=n=>new Promise(done=>setTimeout(done,n));
async function main(){
 const processServer=spawn('python3',['-m','http.server','8895','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
 let browser;
 try{
  for(let i=0;i<50;i++){try{if((await fetch('http://127.0.0.1:8895/connected.html')).ok)break;}catch{}await sleep(100);}
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1366,height:900}});
  const errorPages=[];page.on('pageerror',err=>errorPages.push(err.message));
  await page.goto('http://127.0.0.1:8895/connected.html#screen/1');
  await page.locator('.connected-hero h1').waitFor({timeout:12000});
  assert.match(await page.locator('.connected-hero h1').innerText(),/Welcome & Authentication/);
  assert.equal(await page.locator('.connected-side button[data-go]').count(),60);
  assert.equal(await page.locator('.connected-card').count()>=1,true);
  assert.equal(await page.locator('.connected-main').innerText().then(s=>s.includes('KES 1,245,800')),false);
  assert.deepEqual(await page.evaluate(()=>({keys:Object.keys(localStorage),session:Object.keys(sessionStorage)})),
   {keys:[],session:[]},'Connected startup must never create persistent financial/user data');
  for(const n of [4,5,7,10,15,24,27,28,29,30,31,32,33,34,42,43,60]){
   await page.goto('http://127.0.0.1:8895/connected.html#screen/'+n);
   await page.locator('.connected-hero h1').waitFor();
   const screen=await page.locator('.connected-hero h1').innerText();
   assert.ok(screen.length>3,'screen '+n);
   const body=await page.locator('main').innerText();
   assert.ok(!body.includes('KCB Main Account')&&!body.includes('Nflake (Tech Business)'),'demo leaked in '+n);
  }
  await page.setViewportSize({width:390,height:844});
  await page.goto('http://127.0.0.1:8895/connected.html#screen/1');
  assert.ok(await page.locator('main').count());
  const size=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:window.innerWidth}));
  assert.ok(size.width<=size.viewport+3,JSON.stringify(size));
  assert.deepEqual(errorPages,[]);
  console.log('PASS connected 60-route shell, authentication fail-closed, responsive and no demo leakage');
 }finally{if(browser)await browser.close();processServer.kill('SIGTERM');}
}
main().catch(err=>{console.error(err);process.exitCode=1;});
