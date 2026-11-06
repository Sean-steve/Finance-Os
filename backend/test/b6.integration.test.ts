import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {buildApp} from '../src/app.js';
import {loadConfig} from '../src/config.js';

const appUrl=process.env.TEST_APP_DATABASE_URL,authUrl=process.env.TEST_AUTH_DATABASE_URL,
 adminUrl=process.env.MIGRATION_DATABASE_URL;
if(!appUrl||!authUrl||!adminUrl)throw new Error('B6 requires disposable PostgreSQL 17 and restricted finance/auth roles');
const config=loadConfig({NODE_ENV:'test',DATABASE_URL:appUrl,AUTH_DATABASE_URL:authUrl,
 LOCAL_AUTH_ENABLED:'true',CORS_ALLOWED_ORIGINS:'http://localhost:8080',LOG_LEVEL:'silent'});
const key=()=>randomUUID()+'-'+randomUUID();
test('B6: current estimated net worth excludes virtual balances, user valuations are immutable and isolated',async()=>{
 const financial=new pg.Pool({connectionString:appUrl,max:5});
 const auth=new pg.Pool({connectionString:authUrl,max:5});
 const admin=new pg.Client({connectionString:adminUrl});await admin.connect();
 const app=await buildApp({config,database:financial,financePool:financial,authPool:auth});
 const ask=(method:'GET'|'POST',url:string,token?:string,body?:unknown,idem?:string)=>app.inject({
  method,url,headers:{...(token?{authorization:'Bearer '+token}:{}),...(idem?{'idempotency-key':idem}:{})},
  ...(body===undefined?{}:{payload:body})});
 const signup=async()=>{
  const x=await ask('POST','/v1/auth/register',undefined,{
   email:'b6-'+randomUUID()+'@example.invalid',displayName:'B6 Disposable User',
   password:'TestOnlyLongStrongPassword!265'});
  assert.equal(x.statusCode,201,x.body);return x.json();
 };
 try{
  const owner=await signup(),viewer=await signup(),outsider=await signup();
  const w=owner.workspace.id,base='/v1/workspaces/'+w,t=owner.accessToken;
  await admin.query("INSERT INTO workspace_members(workspace_id,user_id,role,status) VALUES($1,$2,'VIEWER','ACTIVE')",[w,viewer.user.id]);
  const empty=await ask('GET',base+'/wealth/summary',t);
  assert.equal(empty.statusCode,200,empty.body);
  assert.equal(empty.json().estimatedNetWorthMinor,0);
  assert.equal(empty.json().includesProviderVerifiedData,false);
  assert.equal((await ask('GET',base+'/wealth/summary',outsider.accessToken)).statusCode,404);
  assert.equal((await ask('GET',base+'/wealth/summary')).statusCode,401);
  const assetBody={name:'Property estimate',assetKind:'PROPERTY',
   initialValueMinor:2000000,currency:'KES',acquiredOn:null};
  const assetKey=key(),asset=await ask('POST',base+'/wealth/assets',t,assetBody,assetKey);
  assert.equal(asset.statusCode,201,asset.body);
  assert.equal((await ask('POST',base+'/wealth/assets',t,assetBody,assetKey)).statusCode,200);
  assert.equal((await ask('POST',base+'/wealth/assets',t,{...assetBody,name:'Another property'},assetKey)).statusCode,409);
  assert.equal((await ask('POST',base+'/wealth/assets',viewer.accessToken,assetBody,key())).statusCode,403);
  assert.equal((await ask('POST',base+'/wealth/assets',t,assetBody)).statusCode,428);
  assert.equal((await ask('POST',base+'/wealth/assets',t,{...assetBody,currency:'USD'},key())).statusCode,422);
  assert.equal((await ask('POST',base+'/wealth/assets',t,{...assetBody,providerVerified:true},key())).statusCode,422);
  const assetId=asset.json().id;
  const holdingBody={name:'Reported index holdings',investmentKind:'FUND',
   quantityMicros:2000000,costBasisMinor:400000,initialValueMinor:500000,currency:'KES'};
  const holding=await ask('POST',base+'/wealth/investments',t,holdingBody,key());
  assert.equal(holding.statusCode,201,holding.body);
  const holdingId=holding.json().id;
  const liability=await ask('POST',base+'/wealth/liabilities',t,{
   name:'Nonloan obligation',liabilityKind:'OTHER',initialValueMinor:100000,currency:'KES'},key());
  assert.equal(liability.statusCode,201,liability.body);
  const liabilityId=liability.json().id;
  const debt=await ask('POST',base+'/debts',t,{name:'Existing B5 loan',lenderName:'User creditor',
   originalMinor:500000,outstandingMinor:500000,aprBasisPoints:0,
   minimumPaymentMinor:10000,nextDueOn:null,currency:'KES'},key());
  assert.equal(debt.statusCode,201,debt.body);
  // Future obligations, virtual goal funding and modeled pension values are not wealth balances.
  const tax=await ask('POST',base+'/tax/obligations',t,{label:'Tax user estimate',taxKind:'INCOME_TAX',
   taxYear:2026,estimatedMinor:1000000,dueOn:'2026-12-30',currency:'KES'},key());
  assert.equal(tax.statusCode,201,tax.body);
  const retirement=await ask('POST',base+'/retirement/scenarios',t,{
   name:'Hypothetical retirement',currentMinor:20000000,monthlyContributionMinor:2000,
   targetMinor:30000000,horizonMonths:12,annualReturnBasisPoints:100,currency:'KES'},key());
  assert.equal(retirement.statusCode,201,retirement.body);
  const account=await ask('POST',base+'/accounts',t,{displayName:'Manual bank',kind:'BANK',currency:'KES'},key());
  const category=await ask('POST',base+'/categories',t,{name:'Recorded income',kind:'INCOME'},key());
  const expenseCategory=await ask('POST',base+'/categories',t,{name:'Recorded expense',kind:'EXPENSE'},key());
  for(const x of [account,category,expenseCategory])assert.equal(x.statusCode,201,x.body);
  const date=new Date().toISOString().slice(0,10);
  const transaction={financialAccountId:account.json().id,categoryId:category.json().id,
   kind:'INCOME',amountMinor:1000000,currency:'KES',description:'Posted manual income',effectiveOn:date};
  assert.equal((await ask('POST',base+'/transactions',t,transaction,key())).statusCode,201);
  assert.equal((await ask('POST',base+'/transactions',t,{...transaction,
   categoryId:expenseCategory.json().id,kind:'EXPENSE',amountMinor:200000,
   description:'Posted manual expense'},key())).statusCode,201);
  const before=await ask('GET',base+'/wealth/summary',t);
  assert.equal(before.statusCode,200,before.body);
  assert.deepEqual(before.json().breakdown,{
   manualCashAssetsMinor:800000,manualCashOverdraftMinor:0,otherAssetsMinor:2000000,
   investmentEstimatesMinor:500000,reportedDebtsMinor:500000,otherLiabilitiesMinor:100000});
  assert.equal(before.json().assetTotalMinor,3300000);
  assert.equal(before.json().liabilityTotalMinor,600000);
  assert.equal(before.json().estimatedNetWorthMinor,2700000);
  assert.equal(before.json().retirementScenariosCounted,false);
  assert.equal(before.json().capitalGoalsCounted,false);
  assert.equal(before.json().projectedTaxCounted,false);
  assert.equal(before.json().cash.length,1);
  const beforeJournal=(await admin.query('SELECT count(*)::int AS n FROM journal_entries WHERE workspace_id=$1',[w])).rows[0].n;
  const value={valueMinor:2500000,currency:'KES',note:'User revisited property value',recordedOn:date};
  const newKey=key();
  const valuation=await ask('POST',base+'/wealth/assets/'+assetId+'/valuations',t,value,newKey);
  assert.equal(valuation.statusCode,201,valuation.body);
  assert.equal((await ask('POST',base+'/wealth/assets/'+assetId+'/valuations',t,value,newKey)).statusCode,200);
  assert.equal((await ask('POST',base+'/wealth/assets/'+randomUUID()+'/valuations',t,value,key())).statusCode,404);
  assert.equal((await ask('POST',base+'/wealth/assets/'+assetId+'/valuations',t,
   {...value,recordedOn:'2099-01-01'},key())).statusCode,422);
  assert.equal((await ask('POST',base+'/wealth/assets/'+assetId+'/valuations',viewer.accessToken,value,key())).statusCode,403);
  assert.equal((await ask('GET',base+'/wealth/assets/'+assetId+'/valuations',outsider.accessToken)).statusCode,404);
  const history=(await ask('GET',base+'/wealth/assets/'+assetId+'/valuations',t)).json();
  assert.equal(history.items.length,1);
  assert.equal(history.items[0].valueMinor,2500000);
  const invValue=await ask('POST',base+'/wealth/investments/'+holdingId+'/valuations',t,{
   valueMinor:600000,currency:'KES',note:'Estimated fund value adjusted',recordedOn:date},key());
  assert.equal(invValue.statusCode,201,invValue.body);
  const liabValue=await ask('POST',base+'/wealth/liabilities/'+liabilityId+'/valuations',t,{
   valueMinor:0,currency:'KES',note:'User-reported obligation settled externally',recordedOn:date},key());
  assert.equal(liabValue.statusCode,201,liabValue.body);
  const after=(await ask('GET',base+'/wealth/summary',t)).json();
  assert.equal(after.assetTotalMinor,3900000);
  assert.equal(after.liabilityTotalMinor,500000);
  assert.equal(after.estimatedNetWorthMinor,3400000);
  assert.equal(after.assets[0].estimatedValueMinor,2500000);
  assert.equal(after.investments[0].estimatedValueMinor,600000);
  assert.equal(after.investments[0].nominalUnrealizedDifferenceMinor,200000);
  const analytics=(await ask('GET',base+'/wealth/analytics',t)).json();
  assert.equal(analytics.noBrokerConnection,true);
  assert.equal(analytics.noExecutedTrades,true);
  assert.equal(analytics.estimatedInvestmentCostMinor,400000);
  assert.equal(analytics.nominalUnrealizedDifferenceMinor,200000);
  assert.equal(analytics.assetsByClass.length,3);
  assert.equal((await admin.query('SELECT count(*)::int AS n FROM journal_entries WHERE workspace_id=$1',[w])).rows[0].n,
   beforeJournal,'B6 valuations, assets, investments and analytics must never post money');
  await assert.rejects(admin.query('UPDATE b6_assets SET initial_value_minor=1 WHERE id=$1',[assetId]),/append-only/i);
  await assert.rejects(admin.query('DELETE FROM b6_valuations WHERE id=$1',[valuation.json().id]),/append-only/i);
  const otherWorkspace=await ask('GET','/v1/workspaces/'+outsider.workspace.id+'/wealth/assets',t);
  assert.equal(otherWorkspace.statusCode,404);
  const reader=await ask('GET',base+'/wealth/assets',viewer.accessToken);
  assert.equal(reader.statusCode,200,reader.body);
  assert.equal(reader.json().items.length,1);
  const rls=await financial.query('SELECT count(*)::int AS n FROM b6_assets');
  assert.equal(rls.rows[0].n,0,'No workspace SET LOCAL should expose asset data to app role');
 }finally{await app.close();await financial.end();await auth.end();await admin.end();}
});
