
'use strict';
const {chromium}=require('playwright'),{spawn}=require('node:child_process'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..'),base='http://127.0.0.1:8989',out=path.join(root,'qa-artifacts','visual-parity');
fs.mkdirSync(out,{recursive:true});
const old={1:72.66,8:37.37,11:34.34,21:23.80,24:29.84,29:30.10,33:31.11,35:29.67,40:32.75,42:29.92,43:29.10,56:26.02,59:24.22};
const pause=t=>new Promise(r=>setTimeout(r,t));
(async()=>{const server=spawn('python3',['-m','http.server','8989','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});let browser;
try{
for(let i=0;i<50;i++){try{if((await fetch(base)).ok)break}catch{}await pause(100)}
browser=await chromium.launch({headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1536,height:1024},deviceScaleFactor:1});page.setDefaultTimeout(6500);
const results=[];
for(let i=1;i<=60;i++){
const proxy=i===22;
await page.goto(base+'/rebuild.html#screen/'+i,{waitUntil:'domcontentloaded'});
await page.locator('#app').first().waitFor();
const screenshot=(await page.screenshot({type:'png'})).toString('base64');
const score=await page.evaluate(async({id,base64})=>{
const load=url=>new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=()=>reject(new Error('Unable to decode '+url));img.src=url});
const ref=await load('assets/screen-'+String(id).padStart(2,'0')+'.webp');
const coded=await load('data:image/png;base64,'+base64);
const cv=document.createElement('canvas');cv.width=384;cv.height=256;
const c=cv.getContext('2d',{willReadFrequently:true});
c.drawImage(ref,0,0,384,256);const a=c.getImageData(0,0,384,256).data;
c.clearRect(0,0,384,256);c.drawImage(coded,0,0,384,256);const b=c.getImageData(0,0,384,256).data;
let total=0,count=0;for(let p=0;p<a.length;p+=4){total+=Math.abs(a[p]-b[p])+Math.abs(a[p+1]-b[p+1])+Math.abs(a[p+2]-b[p+2]);count+=3}
return +(total/count).toFixed(2)
},{id:proxy?21:i,base64:screenshot});
results.push({screen:i,reference:proxy?21:i,proxy,previous:old[i]??null,now:score,change:old[i]===undefined?null:+(score-old[i]).toFixed(2)});
console.log('VISUAL',i,score,old[i]!==undefined?'previous='+old[i]+' delta='+(score-old[i]).toFixed(2):'');
}
const originals=results.filter(x=>!x.proxy),sorted=originals.slice().sort((a,b)=>b.now-a.now),before=originals.filter(x=>x.previous!=null);
const summary={measured:originals.length,mean:+(originals.reduce((a,x)=>a+x.now,0)/originals.length).toFixed(2),screen22AdaptedAgainst21:results.find(x=>x.proxy)?.now,priorityChanges:before,highest:sorted.slice(0,15)};
fs.writeFileSync(path.join(out,'visual-delta-after.json'),JSON.stringify({summary,results},null,2));
console.log('VISUAL SUMMARY',JSON.stringify(summary));
}finally{await browser?.close();server.kill('SIGTERM')}
})().catch(e=>{console.error(e);process.exitCode=1});
