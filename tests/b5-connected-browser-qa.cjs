'use strict';
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const assert=require('node:assert/strict');
const path=require('node:path');
const sleep=n=>new Promise(resolve=>setTimeout(resolve,n));
const root=path.resolve(__dirname,'..');
const workspace='00000000-0000-4000-8000-000000000001';
const expenseId='00000000-0000-4000-8000-000000000002';
let next=4;
const uuid=()=>`00000000-0000-4000-8000-${String(next++).padStart(12,'0')}`;
const state={debts:[],taxes:[],policies:[],retirement:[],estate:[]};
const payments=[];
function api(endpoint,method,body){
 if(endpoint==='/v1/meta')return {financialEndpointsAvailable:true,authenticationAvailable:true,authenticationScope:'LOCAL_TEST_ONLY'};
 if(endpoint==='/v1/auth/login')return {accessToken:'CI-B5-SESSION'};
 if(endpoint==='/v1/me')return {id:workspace,displayName:'CI B5 operator'};
 if(endpoint==='/v1/workspaces')return {items:[{id:workspace,name:'Isolated B5 CI',kind:'PERSONAL',role:'OWNER',baseCurrency:'KES'}]};
 const url=endpoint.replace('/v1/workspaces/'+workspace,'').split('?')[0];
 const keys={'/debts':'debts','/tax/obligations':'taxes','/insurance/policies':'policies',
  '/retirement/scenarios':'retirement','/estate/checklists':'estate'};
 if(keys[url]){
  const name=keys[url];
  if(method==='POST'){
   const id=uuid();let value={...body,id};
   if(name==='debts')value={...value,startingOutstandingMinor:body.outstandingMinor,
    estimatedOutstandingMinor:body.outstandingMinor,linkedPrincipalMinor:0,evidence:'USER_REPORTED',
    payoffIllustration:null};
   if(name==='taxes')value={...value,estimatedRemainingMinor:body.estimatedMinor,
    filingStatus:'NOT_FILED_BY_FINANCE_OS'};
   if(name==='policies')value={...value,coverageVerified:false};
   if(name==='retirement')value={...value,simulation:{
    endingMinor:body.currentMinor+body.monthlyContributionMinor*body.horizonMonths,
    targetMet:false,providerVerified:false,moneyMoved:false}};
   if(name==='estate'){
    const flags=['willPrepared','beneficiariesReviewed','executorNominated','dependantsConsidered','recordsSecured'];
    value={...value,completedCount:flags.filter(k=>body[k]).length,totalItems:5};
   }
   state[name].unshift(value);
   return {id};
  }
  return {items:state[name],nextCursor:null};
 }
 if(method==='POST'&&/\/(debts|tax\/obligations)\/[^/]+\/payments$/.test(url)){
  payments.push({...body,url});return {id:uuid(),quality:'MANUAL_CROSS_REFERENCE_NOT_PROVIDER_VERIFIED'};
 }
 if(url==='/transactions')return {items:[{
  id:expenseId,kind:'EXPENSE',amountMinor:-100000,description:'CI manual expense',
  reversesTransactionId:null,currency:'KES',categoryId:uuid(),financialAccountId:uuid()}],nextCursor:null};
 if(url==='/ledger/summary')return {accounts:[],totalByCurrency:[]};
 if(url.startsWith('/spending/insights'))return {categories:[],monthlyTotals:[]};
 return {items:[],nextCursor:null};
}
async function main(){
 const port=8895;
 const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
 let browser;
 try{
  for(let i=0;i<60;i++){
   try{if((await fetch('http://127.0.0.1:'+port+'/connected.html')).ok)break;}
   catch{}await sleep(100);
  }
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1366,height:900}});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://127.0.0.1:3101/**',async route=>{
   const req=route.request();const url=new URL(req.url());
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
  for(const n of [43,44,45,46,47,48,49]){
   await page.locator('.connected-side button[data-go="'+n+'"]').click();
   await page.locator('.connected-hero h1').waitFor();
   const main=await page.locator('main').innerText();
   assert.ok(main.length>120,'B5 screen '+n+' must have a connected page');
   assert.ok(!main.includes('domain not activated'),'B5 screen '+n+' must no longer show placeholder');
   assert.ok(!main.includes('KCB Main Account'),'B5 screen '+n+' may not import prototype data');
  }
  await page.locator('.connected-side button[data-go="43"]').click();
  const debt=page.locator('form[data-form=b5-debt]');
  await debt.locator('input[name=name]').fill('CI education credit');
  await debt.locator('input[name=lenderName]').fill('CI creditor label');
  await debt.locator('input[name=original]').fill('10000');
  await debt.locator('input[name=outstanding]').fill('8000');
  await debt.locator('button[type=submit]').click();
  await page.getByText('CI education credit').first().waitFor();
  assert.equal(state.debts.length,1);
  await page.locator('.connected-side button[data-go="44"]').click();
  const debtPayment=page.locator('form[data-form=b5-debt-payment]');
  await debtPayment.waitFor();
  await debtPayment.locator('input[name=amount]').fill('100');
  await debtPayment.locator('button[type=submit]').click();
  await page.getByText('Existing manual expense linked').first().waitFor();
  assert.equal(payments.length,1,'manual repayment link must call API');
  await page.locator('.connected-side button[data-go="46"]').click();
  const tax=page.locator('form[data-form=b5-tax]');
  await tax.locator('input[name=label]').fill('CI estimated tax');
  await tax.locator('input[name=dueOn]').fill('2026-12-31');
  await tax.locator('button[type=submit]').click();
  await page.getByText('CI estimated tax').first().waitFor();
  assert.equal(state.taxes.length,1);
  await page.locator('.connected-side button[data-go="47"]').click();
  const policy=page.locator('form[data-form=b5-insurance]');
  await policy.locator('input[name=name]').fill('CI cover');
  await policy.locator('input[name=insurerLabel]').fill('CI insurance');
  await policy.locator('input[name=startOn]').fill('2026-01-01');
  await policy.locator('input[name=expiresOn]').fill('2027-01-01');
  await policy.locator('button[type=submit]').click();
  await page.getByText('CI cover').first().waitFor();
  assert.equal(state.policies.length,1);
  await page.locator('.connected-side button[data-go="48"]').click();
  const retirement=page.locator('form[data-form=b5-retirement]');
  await retirement.locator('input[name=name]').fill('CI retirement');
  await retirement.locator('input[name=target]').fill('100000');
  await retirement.locator('button[type=submit]').click();
  await page.getByText('CI retirement').first().waitFor();
  assert.equal(state.retirement.length,1);
  await page.locator('.connected-side button[data-go="49"]').click();
  const estate=page.locator('form[data-form=b5-estate]');
  await estate.locator('input[name=willPrepared]').check();
  await estate.locator('button[type=submit]').click();
  await page.getByText('1 of 5 marked complete').waitFor();
  assert.equal(state.estate.length,1);
  assert.deepEqual(errors,[],'B5 connected screens must not throw JS errors');
  assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[],'No B5 finance data in localStorage');
  await page.setViewportSize({width:390,height:844});
  const measure=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(measure.page<=measure.viewport+3,'B5 mobile viewport overflows: '+JSON.stringify(measure));
  console.log('PASS authenticated B5 Screens 43–49 with isolated CI-only API and no demo data');
 }finally{if(browser)await browser.close();server.kill('SIGTERM');}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
