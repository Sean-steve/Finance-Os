'use strict';
const assert=require('node:assert/strict');
const {chromium}=require('playwright');
const {spawn}=require('node:child_process');
const path=require('node:path');
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const root=path.resolve(__dirname,'..'),port=8893;
const workspace='00000000-0000-4000-8000-000000000001';
let number=100,settings={advisorEnabled:false,analyticsSharingEnabled:false,monthlyReviewDay:1,periodMonths:6,
 configurationSource:'SECURE_DEFAULT',externalAiConfigured:false,providerSyncEnabled:false};
const uuid=()=> '00000000-0000-4000-8000-'+String(number++).padStart(12,'0');
const state={intents:[],privacy:[],audit:[]};
const period=(new Date()).toISOString().slice(0,7);
function api(url,method,body){
 if(url==='/v1/meta')return {financialEndpointsAvailable:true,authenticationAvailable:true,authenticationScope:'LOCAL_TEST_ONLY'};
 if(url==='/v1/auth/login')return {accessToken:'CI-B7-TOKEN'};
 if(url==='/v1/me')return {id:workspace,displayName:'CI B7 User'};
 if(url==='/v1/workspaces')return {items:[{id:workspace,name:'CI personal',kind:'PERSONAL',role:'OWNER',baseCurrency:'KES'}]};
 const p=url.replace('/v1/workspaces/'+workspace,'').split('?')[0];
 if(p==='/financial-health')return {
  status:'POSITIVE_MANUAL_CASHFLOW',score:null,scoreReason:'No calibrated financial-health scoring or provider verified evidence',
  currency:'KES',incomeMinor:500000,expenseMinor:200000,netCashFlowMinor:300000,
  estimatedNetWorthMinor:1000000,postedTransactionCount:5,monthsWithRecords:1,
  dataQuality:'MANUAL_POSTED_INCOMPLETE_COVERAGE',savingsRateBasisPoints:6000,
  providerVerified:false,notFinancialAdvice:true};
 if(p==='/advisor')return settings.advisorEnabled?
  {enabled:true,mode:'EXPLAINABLE_RULES_NOT_GENERATIVE_AI',externalAiUsed:false,providerDataSent:false,
   items:[{code:'REVIEW_GOALS',priority:'INFO',message:'Review manual savings goals against confirmed cash.',
    evidence:'Posted manual cash flow is positive'}],notFinancialAdvice:true}:
  {enabled:false,mode:'DISABLED_BY_DEFAULT',externalAiUsed:false,providerDataSent:false,items:[]};
 if(p==='/reports/monthly')return {months:6,currency:'KES',providerVerified:false,
  periods:[{month:period,incomeMinor:500000,expenseMinor:200000,netMinor:300000,transactionCount:5}],
  totals:{incomeMinor:500000,expenseMinor:200000,netMinor:300000}};
 if(p==='/reports/categories')return {months:6,currency:'KES',providerVerified:false,
  items:[{name:'Manual groceries',kind:'EXPENSE',amountMinor:200000,recordCount:3}]};
 if(p==='/integrations/catalog')return {allConnectionsActive:false,externalSyncConfigured:false,
  items:['BANK','MOBILE_MONEY','BROKER','TAX','OTHER'].map(v=>({providerKind:v,capability:v+' feed',
    connectionStatus:'NOT_CONFIGURED',canConnect:false}))};
 if(p==='/settings'){
  if(method==='POST'){settings={...settings,...body,externalAiConfigured:false,
   analyticsSharingEnabled:false,configurationSource:'OWNER_SNAPSHOT'};
   state.audit.unshift({id:uuid(),eventType:'b7.settings',entityType:'b7_settings_snapshots',occurredAt:new Date().toISOString()});
   return {id:uuid(),replayed:false};}
  return settings;
 }
 if(p==='/integrations/requests'){
  if(method==='POST'){state.intents.push({id:uuid(),...body,connectionStatus:'NOT_CONNECTED'});
   state.audit.unshift({id:uuid(),eventType:'b7.integration.info',entityType:'b7_integration_intents',occurredAt:new Date().toISOString()});
   return {id:state.intents.at(-1).id,connectionStatus:'NOT_CONNECTED'};}
  return {items:state.intents};
 }
 if(p==='/privacy/requests'){
  if(method==='POST'){state.privacy.push({id:uuid(),...body,status:'REQUESTED',createdAt:new Date().toISOString()});
   state.audit.unshift({id:uuid(),eventType:'b7.privacy.request',entityType:'b7_privacy_requests',occurredAt:new Date().toISOString()});
   return {id:state.privacy.at(-1).id,fulfilled:false,status:'REQUESTED'};}
  return {items:state.privacy};
 }
 if(p==='/privacy/status')return {unresolvedRequests:state.privacy.length,erasureAutomatic:false,
  exportAutomatic:false,advisorEnabled:settings.advisorEnabled,externalAiSharing:false,bankSyncActive:false};
 if(p==='/security/audit')return {items:state.audit,truncatedTo:50};
 if(p==='/transactions')return {items:[],nextCursor:null};
 if(p==='/ledger/summary')return {accounts:[],totalByCurrency:[]};
 if(p.startsWith('/spending/insights'))return {categories:[],monthlyTotals:[]};
 return {items:[],nextCursor:null};
}
async function main(){
 const server=spawn('python3',['-m','http.server',String(port),'--bind','127.0.0.1','--directory',root],{stdio:'ignore'});
 let browser;
 try{
  for(let i=0;i<80;i++){try{if((await fetch('http://127.0.0.1:'+port+'/connected.html')).ok)break;}
   catch{}await sleep(100);}
  browser=await chromium.launch({headless:true,args:['--no-sandbox']});
  const page=await browser.newPage({viewport:{width:1366,height:900},acceptDownloads:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('http://127.0.0.1:3101/**',async route=>{
   const req=route.request(),url=new URL(req.url());let body={};
   try{if(req.postData())body=req.postDataJSON();}catch{}
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
  for(const n of [56,57,58,59,60]){
   await page.locator('.connected-side button[data-go="'+n+'"]').click();
   await page.locator('.connected-hero h1').waitFor();
   const text=await page.locator('main').innerText();
   assert.ok(text.length>150);
   assert.ok(!text.includes('domain not activated'),'Screen '+n+' must be connected');
   assert.ok(!text.includes('KCB Main Account'),'Prototype balances may not appear in '+n);
  }
  await page.locator('.connected-side button[data-go="56"]').click();
  await page.getByText('No synthetic 0–100 score').waitFor();
  assert.ok((await page.locator('main').innerText()).includes('MANUAL_POSTED_INCOMPLETE_COVERAGE'));
  await page.locator('.connected-side button[data-go="57"]').click();
  await page.getByText('Guidance is switched off by default').waitFor();
  await page.locator('.connected-side button[data-go="58"]').click();
  const download=page.waitForEvent('download');
  await page.locator('[data-b7-csv="monthly"]').click();
  const file=await download;assert.equal(file.suggestedFilename(),'finance-os-manual-monthly.csv');
  const categoryDownload=page.waitForEvent('download');
  await page.locator('[data-b7-csv="categories"]').click();
  const other=await categoryDownload;assert.equal(other.suggestedFilename(),'finance-os-manual-categories.csv');
  await page.locator('.connected-side button[data-go="59"]').click();
  const integration=page.locator('form[data-form=b7-integration]');
  await integration.locator('select[name=providerKind]').selectOption('MOBILE_MONEY');
  await integration.locator('button[type=submit]').click();
  await page.getByText('Provider connection remains NOT_CONNECTED').waitFor();
  assert.equal(state.intents.length,1);
  await page.locator('.connected-side button[data-go="60"]').click();
  const consent=page.locator('form[data-form=b7-settings]');
  await consent.locator('input[name=advisorEnabled]').check();
  await consent.locator('button[type=submit]').click();
  await page.getByText('Privacy-first preferences saved').waitFor();
  assert.equal(settings.advisorEnabled,true);
  assert.equal(settings.analyticsSharingEnabled,false);
  const privacy=page.locator('form[data-form=b7-privacy]');
  await privacy.locator('select[name=requestKind]').selectOption('ERASURE_REVIEW');
  await privacy.locator('button[type=submit]').click();
  await page.getByText('Privacy request logged for authorized review').waitFor();
  assert.equal(state.privacy.length,1);
  assert.equal(state.privacy[0].status,'REQUESTED');
  await page.locator('.connected-side button[data-go="57"]').click();
  await page.getByText('Review manual savings goals against confirmed cash.').waitFor();
  assert.ok((await page.locator('main').innerText()).includes('EXPLAINABLE_RULES_NOT_GENERATIVE_AI'));
  assert.deepEqual(errors,[],'No runtime JS exceptions');
  assert.deepEqual(await page.evaluate(()=>Object.keys(localStorage)),[],'No wealth or privacy stored in localStorage');
  await page.setViewportSize({width:390,height:844});
  const size=await page.evaluate(()=>({page:document.documentElement.scrollWidth,viewport:innerWidth}));
  assert.ok(size.page<=size.viewport+3,'Mobile overflow '+JSON.stringify(size));
  console.log('PASS B7 connected Screens 56–60, consent, reports, audit, privacy and integration information');
 }finally{if(browser)await browser.close();server.kill('SIGTERM');}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
