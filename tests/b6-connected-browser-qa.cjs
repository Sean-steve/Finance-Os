'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const path=require('node:path');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const root=path.resolve(__dirname,'..'),port=8894;
const ws='00000000-0000-4000-8000-000000000001';
let idSeq=10;
const uuid=()=> '00000000-0000-4000-8000-'+String(idSeq++).padStart(12,'0');
const data={assets:[],investments:[],liabilities:[],valuations:[]};
let writes=0;
function latest(kind,id,initial){
 const vals=data.valuations.filter(v=>v.kind===kind&&v.targetId===id)
  .sort((a,b)=>b.recordedOn.localeCompare(a.recordedOn));
 return vals[0]?.valueMinor??initial;
}
function wealth(){
 const assets=data.assets.map(a=>({...a,estimatedValueMinor:latest('ASSET',a.id,a.initialValueMinor),
  originalEstimateMinor:a.initialValueMinor,evidence:'USER_ESTIMATE',verified:false}));
 const investments=data.investments.map(a=>{const estimatedValueMinor=latest('INVESTMENT',a.id,a.initialValueMinor);
  return {...a,estimatedValueMinor,originalEstimateMinor:a.initialValueMinor,
   nominalUnrealizedDifferenceMinor:estimatedValueMinor-a.costBasisMinor,verified:false}});
 const liabilities=data.liabilities.map(a=>({...a,
  estimatedValueMinor:latest('LIABILITY',a.id,a.initialValueMinor),
  originalEstimateMinor:a.initialValueMinor,evidence:'USER_ESTIMATE',verified:false}));
 const other=assets.reduce((a,x)=>a+x.estimatedValueMinor,0);
 const portfolio=investments.reduce((a,x)=>a+x.estimatedValueMinor,0);
 const liab=liabilities.reduce((a,x)=>a+x.estimatedValueMinor,0);
 const sum=other+portfolio;
 return {currency:'KES',assetTotalMinor:sum,liabilityTotalMinor:liab,
  estimatedNetWorthMinor:sum-liab,breakdown:{
   manualCashAssetsMinor:0,manualCashOverdraftMinor:0,otherAssetsMinor:other,
   investmentEstimatesMinor:portfolio,reportedDebtsMinor:0,otherLiabilitiesMinor:liab},
  assets,investments,otherLiabilities:liabilities,debts:[],cash:[],sourceCounts:{},capitalGoalsCounted:false,
  retirementScenariosCounted:false,projectedTaxCounted:false,includesProviderVerifiedData:false};
}
function api(endpoint,method,body){
 if(endpoint==='/v1/meta')return {financialEndpointsAvailable:true,authenticationAvailable:true,authenticationScope:'LOCAL_TEST_ONLY'};
 if(endpoint==='/v1/auth/login')return {accessToken:'CI-B6-SESSION'};
 if(endpoint==='/v1/me')return {id:ws,displayName:'CI B6 operator'};
 if(endpoint==='/v1/workspaces')return {items:[{id:ws,name:'Isolated B6 CI',kind:'PERSONAL',role:'OWNER',baseCurrency:'KES'}]};
 const part=endpoint.replace('/v1/workspaces/'+ws,'').split('?')[0];
 if(part==='/wealth/summary')return wealth();
 if(part==='/wealth/analytics'){
  const s=wealth(),b=s.breakdown,all=s.assetTotalMinor;
  const investments=s.investments;
  return {currency:'KES',estimatedNetWorthMinor:s.estimatedNetWorthMinor,
   estimatedInvestmentCostMinor:investments.reduce((a,x)=>a+x.costBasisMinor,0),
   estimatedInvestmentValueMinor:b.investmentEstimatesMinor,
   nominalUnrealizedDifferenceMinor:investments.reduce((a,x)=>a+x.nominalUnrealizedDifferenceMinor,0),
   assetsByClass:[['CASH',0],['PHYSICAL_ASSETS',b.otherAssetsMinor],['INVESTMENTS',b.investmentEstimatesMinor]]
    .map(([name,amountMinor])=>({name,amountMinor,shareBasisPoints:all?Math.round(amountMinor/all*10000):null})),
   largestExposure:investments[0]||null,noBrokerConnection:true,noExecutedTrades:true};
 }
 const section={'/wealth/assets':'assets','/wealth/investments':'investments','/wealth/liabilities':'liabilities'}[part];
 if(section){
  if(method==='POST'){
   const value={...body,id:uuid(),evidence:'USER_ESTIMATE'};data[section].push(value);writes++;
   return {id:value.id,replayed:false};
  }
  return {items:wealth()[section],nextCursor:null};
 }
 const m=/^\/wealth\/(assets|investments|liabilities)\/([0-9a-f-]+)\/valuations$/.exec(part);
 if(m){
  const kind={assets:'ASSET',investments:'INVESTMENT',liabilities:'LIABILITY'}[m[1]];
  if(method==='POST'){
   data.valuations.push({...body,id:uuid(),kind,targetId:m[2]});writes++;
   return {id:data.valuations.at(-1).id,replayed:false};
  }
  return {items:data.valuations.filter(x=>x.kind===kind&&x.targetId===m[2])
   .map(x=>({id:x.id,note:x.note,recordedOn:x.recordedOn,valueMinor:x.valueMinor,evidence:'USER_ESTIMATE'})),nextCursor:null};
 }
 if(part==='/transactions')return {items:[],nextCursor:null};
 if(part==='/ledger/summary')return {accounts:[],totalByCurrency:[]};
 if(part.startsWith('/spending/insights'))return {categories:[],monthlyTotals:[]};
 return {items:[],nextCursor:null};
}
async function main(){
 const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
 let browser;
 try{
  for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:'+port+'/connected.html')).ok)break;}
   catch{}await sleep(100);}
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1366,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://127.0.0.1:3101/**',async route=>{
   const req=route.request(),url=new URL(req.url());
   let body={};try{if(req.postData())body=req.postDataJSON();}catch{}
   await route.fulfill({status:200,contentType:'application/json',
    headers:{'Access-Control-Allow-Origin':'http://127.0.0.1:'+port,
     'Access-Control-Allow-Headers':'Authorization,Content-Type,Idempotency-Key',
     'Access-Control-Allow-Methods':'GET,POST,OPTIONS'},
    body:JSON.stringify(api(url.pathname+url.search,req.method(),body))});
  });
  await page.goto('http://127.0.0.1:'+port+'/connected.html#screen/1');
  await page.locator('form[data-form=login] input[name=email]').fill('ci@example.invalid');
  await page.locator('form[data-form=login] input[name=password]').fill('CI-ONLY-TEST-SECRET');
  await page.locator('form[data-form=login] button[type=submit]').click();
  await page.locator('.connected-top-actions button[data-logout]').waitFor();
  for(const n of [50,51,52,53,54,55]){
   await page.locator('.connected-side button[data-go="'+n+'"]').click();
   await page.locator('.connected-hero h1').waitFor();
   const main=await page.locator('main').innerText();
   assert.ok(main.length>100,'Screen '+n+' must render');
   assert.ok(!main.includes('domain not activated'),'Screen '+n+' must not be a placeholder');
   assert.ok(!main.includes('KCB Main Account'),'No imported prototype balance on '+n);
  }
  await page.locator('.connected-side button[data-go="51"]').click();
  const asset=page.locator('form[data-form=b6-asset]');
  await asset.locator('input[name=name]').fill('CI user-estimated property');
  await asset.locator('input[name=initial]').fill('20000');
  await asset.locator('button[type=submit]').click();
  await page.getByText('CI user-estimated property').first().waitFor();
  assert.equal(data.assets.length,1);
  const liability=page.locator('form[data-form=b6-liability]');
  await liability.locator('input[name=name]').fill('CI nonloan payable');
  await liability.locator('input[name=initial]').fill('1000');
  await liability.locator('button[type=submit]').click();
  await page.getByText('CI nonloan payable').first().waitFor();
  assert.equal(data.liabilities.length,1);
  await page.locator('.connected-side button[data-go="52"]').click();
  const valuation=page.locator('form[data-form=b6-asset-value]');
  await valuation.locator('input[name=value]').fill('25000');
  await valuation.locator('input[name=note]').fill('Observed manual property estimate');
  await valuation.locator('button[type=submit]').click();
  await page.getByText('Append-only user valuation saved').waitFor();
  await page.locator('button[data-b6-history^="ASSET:"]').first().click();
  await page.getByText('Observed manual property estimate').waitFor();
  assert.equal(data.valuations.length,1);
  await page.locator('.connected-side button[data-go="53"]').click();
  const holding=page.locator('form[data-form=b6-investment]');
  await holding.locator('input[name=name]').fill('CI reported holdings');
  await holding.locator('input[name=quantity]').fill('1.500000');
  await holding.locator('input[name=cost]').fill('5000');
  await holding.locator('input[name=initial]').fill('6500');
  await holding.locator('button[type=submit]').click();
  await page.getByText('CI reported holdings').first().waitFor();
  assert.equal(data.investments[0].quantityMicros,1500000);
  await page.locator('.connected-side button[data-go="54"]').click();
  const investmentValue=page.locator('form[data-form=b6-investment-value]');
  await investmentValue.locator('input[name=value]').fill('7000');
  await investmentValue.locator('input[name=note]').fill('Observed user-held position total');
  await investmentValue.locator('button[type=submit]').click();
  await page.getByText('Append-only user valuation saved').waitFor();
  await page.locator('.connected-side button[data-go="55"]').click();
  await page.getByText('Wealth analytics').first().waitFor();
  assert.ok((await page.locator('main').innerText()).includes('Not a verified return'));
  assert.equal(writes,5,'B6 writes exactly asset, liability, investment and two valuations');
  assert.deepEqual(errors,[],'No JS errors across B6 screens');
  assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[],'No wealth state in localStorage');
  await page.setViewportSize({width:390,height:844});
  const size=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(size.page<=size.viewport+3,'B6 mobile viewport overflows '+JSON.stringify(size));
  console.log('PASS Finance OS B6 connected screens 50–55; no fake money, no provider execution');
 }finally{if(browser)await browser.close();server.kill('SIGTERM');}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
