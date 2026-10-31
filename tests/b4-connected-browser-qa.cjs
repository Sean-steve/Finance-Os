'use strict';
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const path=require('node:path');
const sleep=n=>new Promise(done=>setTimeout(done,n));
const uuid='00000000-0000-4000-8000-000000000001';
const bucketId='00000000-0000-4000-8000-000000000002';
const goalId='00000000-0000-4000-8000-000000000003';
const root=path.resolve(__dirname,'..');
const bucket={id:bucketId,name:'TEST FIXTURE essentials',purpose:'ESSENTIALS',
 priority:1,status:'ACTIVE',currency:'KES',allocatedMinor:500000,planningOnly:true};
const goal={id:goalId,name:'TEST FIXTURE emergency',kind:'EMERGENCY',status:'ACTIVE',
 currency:'KES',targetMinor:2000000,allocatedMinor:500000,remainingMinor:1500000,
 monthlyEssentialMinor:250000,emergencyCoverageMonths:2,dueOn:null,planningOnly:true};
const state={buckets:[bucket],goals:[goal],allocations:[],requests:[],scenarios:[]};
function response(endpoint,method,body){
 if(endpoint==='/v1/meta')return {financialEndpointsAvailable:true,authenticationAvailable:true,authenticationScope:'LOCAL_TEST_ONLY'};
 if(endpoint==='/v1/auth/login')return {accessToken:'CI-ONLY-TEST-JWT'};
 if(endpoint==='/v1/me')return {id:uuid,displayName:'B4 CI fixture operator',email:'ci@example.invalid'};
 if(endpoint==='/v1/workspaces')return {items:[{id:uuid,name:'CI data only',role:'OWNER',kind:'PERSONAL',baseCurrency:'KES'}]};
 const short=endpoint.replace('/v1/workspaces/'+uuid,'');
 if(short==='/capital/summary')return {manualPostedLiquidityMinor:2000000,virtualReservedMinor:1000000,
  unassignedMinor:1000000,unassignedNegative:false,buckets:state.buckets,goals:state.goals,
  sourceQuality:'POSTED_MANUAL_LEDGER_AND_VIRTUAL_PLANNING',isProviderVerified:false,fundsMoved:false,isBankReservation:false};
 if(short==='/money-buckets'||short==='/savings-goals'||short==='/capital/allocations'||
    short==='/capital/requests'||short==='/planning/scenarios'){
  const key={'/money-buckets':'buckets','/savings-goals':'goals','/capital/allocations':'allocations',
   '/capital/requests':'requests','/planning/scenarios':'scenarios'}[short];
  if(method==='POST'){
   if(key==='buckets')state.buckets.push({...body,id:'00000000-0000-4000-8000-000000000004',status:'ACTIVE',allocatedMinor:0});
   if(key==='goals')state.goals.push({...body,id:'00000000-0000-4000-8000-000000000005',status:'ACTIVE',allocatedMinor:0,remainingMinor:body.targetMinor});
   if(key==='requests')state.requests.push({...body,id:'00000000-0000-4000-8000-000000000006',status:'PENDING',requestedBy:uuid});
   if(key==='allocations')state.allocations.push({...body,id:'00000000-0000-4000-8000-000000000007'});
   if(key==='scenarios')return {id:'00000000-0000-4000-8000-000000000008',name:body.name,
    modelVersion:'B4_DETERMINISTIC_V1',
    simulation:{endingCashAfterExpensesMinor:2000000,endingDiscretionaryAfterPlannedSavingsMinor:1500000,
     months:[{month:1,incomeMinor:10000,expensesMinor:8000,cashAfterExpensesMinor:2002000,discretionaryAfterPlannedSavingsMinor:1802000}]}};
   return state[key][state[key].length-1];
  }
  return {items:state[key],nextCursor:null};
 }
 if(short==='/capital/affordability')return {unassignedMinor:1000000,purchaseAmountMinor:body.purchaseAmountMinor,
  remainingAfterPurchaseMinor:1000000-body.purchaseAmountMinor,upcoming90DayBillsUnverifiedMinor:500000,
  overdueBillsUnverifiedMinor:0,insufficientManualUnassigned:false,verdict:'CANNOT_CONFIRM_AFFORDABILITY',
  doesNotAuthorizePurchase:true,isProviderVerified:false};
 if(short.startsWith('/planning/scenarios/'))return {id:short.split('/').pop(),name:'CI saved scenario',modelVersion:'B4_DETERMINISTIC_V1',
  simulation:{endingCashAfterExpensesMinor:2000000,endingDiscretionaryAfterPlannedSavingsMinor:1800000,months:[]}};
 if(short==='/spending/insights')return {categories:[],monthlyTotals:[]};
 if(short.startsWith('/spending/insights'))return {categories:[],monthlyTotals:[]};
 if(short==='/ledger/summary')return {balanceMinor:0};
 return {items:[],nextCursor:null};
}
async function main(){
 const server=spawn('python3',['-m','http.server','8896','--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
 let browser;
 try{
  for(let n=0;n<60;n++){try{if((await fetch('http://127.0.0.1:8896/connected.html')).ok)break;}catch{}await sleep(100);}
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1366,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://127.0.0.1:3101/**',async route=>{
   const req=route.request(),url=new URL(req.url()),method=req.method();
   let body={};try{if(req.postData())body=req.postDataJSON();}catch{}
   const reply=response(url.pathname+url.search,method,body);
   await route.fulfill({status:200,contentType:'application/json',
     headers:{'Access-Control-Allow-Origin':'http://127.0.0.1:8896',
      'Access-Control-Allow-Headers':'Authorization,Content-Type,Idempotency-Key',
      'Access-Control-Allow-Methods':'GET,POST,OPTIONS'},
     body:JSON.stringify(reply)});
  });
  await page.goto('http://127.0.0.1:8896/connected.html#screen/1');
  await page.locator('form[data-form=login] input[name=email]').fill('ci@example.invalid');
  await page.locator('form[data-form=login] input[name=password]').fill('CI-ONLY-NOT-A-SECRET');
  await page.locator('form[data-form=login] button[type=submit]').click();
  await page.locator('.connected-top-actions button[data-logout]').waitFor();
  await page.locator('.connected-side button[data-go="35"]').click();
  await page.getByText('Manually posted liquidity').first().waitFor();
  assert.ok((await page.locator('main').innerText()).includes('Virtual capital assigned'));
  for(const id of [36,37,38,39,40,41,42]){
   await page.locator('.connected-side button[data-go="'+id+'"]').click();
   await page.locator('.connected-hero h1').waitFor();
   const text=await page.locator('main').innerText();
   assert.ok(text.length>140,'screen '+id+' should render verified-workspace-backed or advisory content');
   assert.ok(!text.includes('KCB Main Account'),'no demo financial records on screen '+id);
  }
  await page.locator('form[data-form=b4-scenario] input[name=name]').fill('CI hypothetical');
  await page.locator('form[data-form=b4-scenario] input[name=monthlyIncome]').fill('100');
  await page.locator('form[data-form=b4-scenario] input[name=monthlyExpense]').fill('80');
  const validity=await page.locator('form[data-form=b4-scenario]').evaluate(form=>({
    valid:form.checkValidity(),fields:[...form.elements].filter(x=>x.name).map(x=>({
      name:x.name,value:x.value,valid:x.validity.valid,patternMismatch:x.validity.patternMismatch,
      validationMessage:x.validationMessage,outerHTML:x.outerHTML.slice(0,280)}))}));
  console.log('B4 scenario form validation: '+JSON.stringify(validity));
  await page.locator('form[data-form=b4-scenario] button[type=submit]').click();
  try{await page.getByText('Hypothetical end cash:').first().waitFor({timeout:10000});}
  catch(e){
    console.error('B4 scenario after submit: '+JSON.stringify({
      main:(await page.locator('main').innerText()).slice(0,5000),
      errors,route:page.url(),saved:state.scenarios.length}));
    throw e;
  }
  assert.deepEqual(errors,[],'Authenticated B4 views should not throw runtime errors');
  assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[],'No finance state in localStorage');
  await page.setViewportSize({width:390,height:844});
  const size=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(size.width<=size.viewport+3,'Mobile B4 should not overflow viewport: '+JSON.stringify(size));
  console.log('PASS B4 connected authenticated screens 35–42 with CI-only intercepted API and no demo leaks');
 }finally{if(browser)await browser.close();server.kill('SIGTERM');}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
