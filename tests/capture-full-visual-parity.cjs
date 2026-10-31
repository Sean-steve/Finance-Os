
'use strict';
const {chromium}=require('playwright'),{spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),dir=path.join(root,'qa-artifacts','full-visual-parity');
fs.mkdirSync(dir,{recursive:true});
async function main(){
 const server=spawn('python3',['-m','http.server','8973','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
 let browser,errors=[];
 try{
   for(let i=0;i<60;i++){try{const r=await fetch('http://127.0.0.1:8973');if(r.ok)break}catch{}await new Promise(r=>setTimeout(r,100))}
   browser=await chromium.launch({headless:true,args:['--no-sandbox']});
   const page=await browser.newPage({viewport:{width:1536,height:1024},deviceScaleFactor:1});page.setDefaultTimeout(7000);
   page.on('pageerror',e=>errors.push(e.message));
   for(let id=1;id<=60;id++){
     await page.goto('http://127.0.0.1:8973/rebuild.html#screen/'+id,{waitUntil:'load'});
     await page.locator('#app').first().waitFor({state:'visible'});
     await page.evaluate(()=>document.fonts.ready);
     await page.screenshot({path:path.join(dir,'screen-'+String(id).padStart(2,'0')+'.png'),fullPage:false});
     console.log('CAPTURE',id);
   }
   fs.writeFileSync(path.join(dir,'browser-errors.json'),JSON.stringify(errors,null,2));
   if(errors.length){console.error('UNCAUGHT_BROWSER_ERRORS',errors);process.exitCode=1}
 }finally{await browser?.close();server.kill('SIGTERM')}
}
main().catch(e=>{console.error(e);process.exitCode=1});
