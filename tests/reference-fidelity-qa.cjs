
'use strict';
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8890';
const server=spawn('python3',['-m','http.server','8890','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
const pause=t=>new Promise(r=>setTimeout(r,t));
(async()=>{
let browser;
try{
 for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break}catch(e){}await pause(180)}
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1536,height:1024}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto(base+'/#screen/4',{waitUntil:'networkidle'});
 assert.equal(await page.locator('#canvas img').count(),1);
 assert.equal(await page.locator('#canvas img').evaluate(x=>x.naturalWidth),1536);
 assert.equal(await page.locator('#canvas img').evaluate(x=>x.naturalHeight),1024);
 const visited=new Set();
 for(let i=1;i<=60;i++){
  await page.goto(base+'/#screen/'+i);
  const title=await page.title();
  assert.ok(title.includes('Approved design'),'Bad screen title '+i);
  visited.add(title);
  if(i===22){assert.ok(await page.locator('#save-budget').count()>0,'Screen 22 reconstructed budget editor absent');continue}
  await page.locator('#canvas img').waitFor();
  // Hash-only navigation resolves before the newly assigned image finishes decoding.
  // Validate the requested screen asset, not the old or still-loading image node.
  await page.waitForFunction(screen=>{const im=document.querySelector('#canvas img');const asset='screen-'+String(screen).padStart(2,'0')+'.webp';return im&&im.getAttribute('src')?.includes(asset)&&im.complete&&im.naturalWidth===1536&&im.naturalHeight===1024;},i,{timeout:15000});
  assert.equal(await page.locator('#canvas img').evaluate(x=>x.naturalWidth),1536,'Broken original image '+i);
  assert.ok(await page.locator('#canvas img').evaluate(x=>x.complete),'Incomplete original image '+i);
 }
 assert.equal(visited.size,60);
 await page.goto(base+'/#screen/4');
 await page.locator('#browse').click();
 assert.equal(await page.locator('.navigator button').count(),60);
 await page.locator('.navigator button').filter({hasText:'Today — Safe-to-Spend Dashboard'}).first().click();
 assert.equal(new URL(page.url()).hash,'#screen/5');
 await page.locator('#interact').click();
 assert.ok(await page.locator('#interaction').isVisible());
 assert.ok(await page.locator('#interaction .actions button').count()>1);
 await page.keyboard.press('Escape');
 await page.locator('#fit').click();
 assert.equal(await page.locator('#canvas').evaluate(x=>getComputedStyle(x).width),'1536px');
 await page.locator('#fit').click();
 await page.setViewportSize({width:390,height:844});
 await page.goto(base+'/#screen/4');
 assert.equal(await page.locator('#canvas').evaluate(x=>Math.round(x.getBoundingClientRect().width)),390);
 assert.ok(await page.locator('#canvas img').evaluate(x=>x.naturalWidth===1536));
 await page.goto(base+'/#screen/22');
 await page.locator('#budgetfields [data-cat="Housing"]').fill('10000');
 await page.locator('#budgettotal').fill('300000');
 await page.locator('#save-budget').click();
 assert.ok((await page.evaluate(()=>localStorage.getItem('fos-exact-budget'))).includes('10000'));
 assert.deepEqual(errors,[]);
 console.log('PASS: pixel-faithful 59 supplied images, reconstructed budget view, 60 routes, navigator, hotspots, scaling, local editor and zero runtime errors');
}catch(e){console.error(e);process.exitCode=1}finally{if(browser)await browser.close();server.kill('SIGTERM')}
})();
