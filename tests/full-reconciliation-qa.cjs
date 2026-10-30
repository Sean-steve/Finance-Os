
'use strict';
const {chromium}=require('playwright');
const axe=require('axe-core');
const {spawn}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const output=path.resolve(__dirname,'../qa-artifacts/full-reconciliation');
const root=path.resolve(__dirname,'..');
const BASE='http://127.0.0.1:8977';
const ART=path.join(output,'screens');
fs.mkdirSync(ART,{recursive:true});
const REF=path.resolve(root,'assets');
const ACCESSIBILITY_SAMPLE=[1,4,5,7,10,12,16,21,22,27,30,34,35,37,40,43,45,46,49,50,52,53,55,56,57,58,59,60];
const sleep=n=>new Promise(r=>setTimeout(r,n));
async function main(){
const server=spawn('python3',['-m','http.server','8977','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
let browser;
const results=[],fatal=[],missing=[],errors=[],a11y=[];
try{
 let started=false;
 for(let i=0;i<60;i++){
   try{if((await fetch(BASE)).ok){started=true;break}}catch{}
   await sleep(180);
 }
 if(!started)throw new Error('Unable to start QA local server');
 browser=await chromium.launch({headless:true,args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:1536,height:1024},deviceScaleFactor:1,reducedMotion:'reduce',acceptDownloads:true});
 page.setDefaultTimeout(6500);
 let active=0;
 page.on('pageerror',e=>errors.push({screen:active,message:e.message}));
 page.on('console',m=>{if(m.type()==='error')errors.push({screen:active,message:m.text().slice(0,300)})});
 for(let n=1;n<=60;n++){
  active=n;
  const reference=path.join(REF,'screen-'+String(n).padStart(2,'0')+'.webp');
  const entry={screen:n,referenceExists:fs.existsSync(reference),desktop:{},mobile:{},accessibility:null,errors:[]};
  if(!entry.referenceExists)missing.push(n);
  try{
   await page.goto(BASE+'/rebuild.html#screen/'+n,{waitUntil:'domcontentloaded'});
   await page.waitForTimeout(65);
   const stats=await page.evaluate(()=>{
     const app=document.querySelector('#app');
     const main=document.querySelector('main');
     const h1=Array.from(document.querySelectorAll('h1')).map(x=>x.innerText?.trim()).filter(Boolean);
     const interactive=Array.from(document.querySelectorAll('button,input,select,textarea,a[href]')).filter(x=>x.offsetWidth&&x.offsetHeight);
     const bad=Array.from(document.querySelectorAll('a[href]')).filter(a=>(a.getAttribute('href')||'').startsWith('#screen/')).map(a=>a.getAttribute('href'));
     return {
       title:document.title,hasMain:!!main,headings:h1,screenTextLength:app?.innerText?.length||0,
       width:document.documentElement.scrollWidth,viewport:innerWidth,
       buttons:interactive.length,brokenImageCount:Array.from(document.images).filter(im=>!im.complete||(im.naturalWidth===0&&im.getAttribute('src'))).length,
       referenceOverlayOpen:!!document.querySelector('.reference-shade'),
       hash:location.hash,links:bad,
       formCount:document.querySelectorAll('form').length
     };
   });
   entry.desktop=stats;
   if(stats.screenTextLength<250||!stats.hasMain||!stats.hash.endsWith('/'+n)||stats.referenceOverlayOpen)
       fatal.push({screen:n,type:'route',details:stats});
   await page.screenshot({path:path.join(ART,'screen-'+String(n).padStart(2,'0')+'-desktop.png'),fullPage:false,animations:'disabled',caret:'hide'});
   if(ACCESSIBILITY_SAMPLE.includes(n)){
     await page.addScriptTag({content:axe.source});
     const audit=await page.evaluate(async()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
     entry.accessibility={
       ruleViolations:audit.violations.map(v=>({id:v.id,impact:v.impact,affected:v.nodes.length,examples:v.nodes.slice(0,3).map(x=>x.target)})),
       incomplete:audit.incomplete.length
     };
     a11y.push({screen:n,...entry.accessibility});
   }
   await page.setViewportSize({width:390,height:844});
   await page.waitForTimeout(20);
   entry.mobile=await page.evaluate(()=>{
     const vw=innerWidth,els=Array.from(document.querySelectorAll('main *'));
     return {viewport:vw,documentWidth:document.documentElement.scrollWidth,
       horizontallyOverflowing:els.filter(el=>el.getBoundingClientRect().right>vw+3&&el.getBoundingClientRect().width>0).slice(0,7)
         .map(el=>({tag:el.tagName,className:String(el.className).slice(0,45),right:Math.round(el.getBoundingClientRect().right)}))}
   });
   await page.screenshot({path:path.join(ART,'screen-'+String(n).padStart(2,'0')+'-mobile.png'),fullPage:false,animations:'disabled',caret:'hide'});
   if(entry.mobile.documentWidth>392)fatal.push({screen:n,type:'mobile-overflow',details:entry.mobile});
   await page.setViewportSize({width:1536,height:1024});
  }catch(err){entry.errors.push(String(err));fatal.push({screen:n,type:'exception',details:String(err)});await page.setViewportSize({width:1536,height:1024})}
  results.push(entry);
  if(n%10===0)console.log('AUDIT_PROGRESS',n,'/60', 'fatal',fatal.length, 'missing_references',missing.length);
 }
 const severity=a11y.flatMap(x=>x.ruleViolations.filter(v=>['serious','critical'].includes(v.impact)).map(v=>({screen:x.screen,...v})));
 const summary={generatedAt:new Date().toISOString(),title:'Finance OS Full 60-Screen Visual / Functional Reconnaissance',
   screenCount:results.length,referenceCount:60-missing.length,missingReferenceScreens:missing,
   desktopScreenshots:results.filter(r=>fs.existsSync(path.join(ART,'screen-'+String(r.screen).padStart(2,'0')+'-desktop.png'))).length,
   mobileScreenshots:results.filter(r=>fs.existsSync(path.join(ART,'screen-'+String(r.screen).padStart(2,'0')+'-mobile.png'))).length,
   layoutOverflows:results.filter(r=>r.mobile.documentWidth>392).map(r=>r.screen),
   routesWithErrors:results.filter(r=>r.errors.length).map(r=>r.screen),
   severeAccessibilityFindings:severity,uncaughtConsoleErrors:errors,
   fatalFindings:fatal,fullPixelMatchCertified:false,
   note:'Reference comparisons generated by scripts/visual-reconciliation-metrics.py. Accessibility sampled; visual metrics are indicators, not human acceptance.'};
 fs.writeFileSync(path.join(output,'reconciliation-browser-results.json'),JSON.stringify({summary,screens:results},null,2));
 console.log('FULL_RECONCILIATION_SUMMARY',JSON.stringify({screens:results.length,references:summary.referenceCount,missing,overflow:summary.layoutOverflows,severeAccess:severity.length,errors:errors.length,fatal:fatal.length}));
 if(fatal.length||errors.length)process.exitCode=1;
}finally{await browser?.close();server.kill('SIGTERM')}
}
main().catch(err=>{console.error(err);process.exitCode=1});
