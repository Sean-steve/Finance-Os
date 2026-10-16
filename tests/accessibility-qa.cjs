
'use strict';
const {chromium}=require('playwright'),axe=require('axe-core');
const {spawn}=require('node:child_process');
const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),output=path.join(root,'qa-artifacts'),origin='http://127.0.0.1:8880';
fs.mkdirSync(output,{recursive:true});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function main(){
 const server=spawn('python3',['-m','http.server','8880','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});let browser;
 try{
  for(let i=0;i<50;i++){try{if((await fetch(origin)).ok)break}catch(e){}await delay(150)}
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1536,height:1024},deviceScaleFactor:1});
  const result=[];
  for(const n of [4,5,10,22,40,57,60]){
   await page.goto(origin+'/app.html#screen/'+n);
   await page.addScriptTag({content:axe.source});
   const test=await page.evaluate(async()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
   result.push({screen:n,viewport:'desktop',violations:test.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,nodes:v.nodes.slice(0,8).map(node=>({selector:node.target,summary:node.failureSummary}))}))});
  }
  for(const mode of ['mobile','dark']){
   await page.setViewportSize({width:390,height:844});
   await page.goto(origin+'/app.html#screen/4');
   if(mode==='dark')await page.locator('[data-action="theme"]').click();
   await page.addScriptTag({content:axe.source});
   const test=await page.evaluate(async()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}}));
   result.push({screen:4,viewport:mode,violations:test.violations.map(v=>({id:v.id,impact:v.impact,help:v.help,nodes:v.nodes.slice(0,8).map(node=>({selector:node.target,summary:node.failureSummary}))}))});
  }
  fs.writeFileSync(path.join(output,'accessibility-results.json'),JSON.stringify(result,null,2));
  const severe=result.flatMap(r=>r.violations.filter(v=>['critical','serious'].includes(v.impact)).map(v=>({screen:r.screen,viewport:r.viewport,id:v.id,impact:v.impact,targets:v.nodes.map(n=>n.selector)})));
  console.log('Accessibility audits:',result.length,'scenarios,',result.reduce((n,r)=>n+r.violations.length,0),'rule violations,',severe.length,'serious/critical.');
  severe.forEach(v=>console.log('A11Y:',JSON.stringify(v)));
  if(severe.length)process.exitCode=1;
 }finally{if(browser)await browser.close();server.kill('SIGTERM')}
}
main().catch(e=>{console.error(e);process.exitCode=1});
