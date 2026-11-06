import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {buildApp} from '../src/app.js';
import {loadConfig} from '../src/config.js';
const appUrl=process.env.TEST_APP_DATABASE_URL,authUrl=process.env.TEST_AUTH_DATABASE_URL,
 adminUrl=process.env.MIGRATION_DATABASE_URL;
if(!appUrl||!authUrl||!adminUrl)throw new Error('B7 certification requires disposable PostgreSQL with finance_app/auth roles');
const config=loadConfig({NODE_ENV:'test',DATABASE_URL:appUrl,AUTH_DATABASE_URL:authUrl,
 LOCAL_AUTH_ENABLED:'true',CORS_ALLOWED_ORIGINS:'http://localhost:8080',LOG_LEVEL:'silent'});
const key=()=>randomUUID()+'-'+randomUUID();

test('B7: complete financial-health, reporting, owner privacy and integration intent workflow on real PostgreSQL',async()=>{
 const finance=new pg.Pool({connectionString:appUrl,max:5});
 const auth=new pg.Pool({connectionString:authUrl,max:5});
 const admin=new pg.Client({connectionString:adminUrl});await admin.connect();
 const app=await buildApp({config,database:finance,financePool:finance,authPool:auth});
 const ask=(method:'GET'|'POST',url:string,token?:string,body?:unknown,idem?:string)=>app.inject({
  method,url,headers:{...(token?{authorization:'Bearer '+token}:{}),
   ...(idem?{'idempotency-key':idem}:{})},...(body===undefined?{}:{payload:body})});
 const signup=async()=>{
  const r=await ask('POST','/v1/auth/register',undefined,{
   email:'b7-'+randomUUID()+'@example.invalid',displayName:'B7 Test User',
   password:'TestOnlyLongStrongPassword!265'});
  assert.equal(r.statusCode,201,r.body);return r.json();
 };
 try{
  const owner=await signup(),viewer=await signup(),outsider=await signup();
  const w=owner.workspace.id,base='/v1/workspaces/'+w,t=owner.accessToken;
  await admin.query("INSERT INTO workspace_members(workspace_id,user_id,role,status) VALUES($1,$2,'VIEWER','ACTIVE')",[w,viewer.user.id]);
  const emptyHealth=await ask('GET',base+'/financial-health',t);
  assert.equal(emptyHealth.statusCode,200,emptyHealth.body);
  assert.equal(emptyHealth.json().status,'INSUFFICIENT_EVIDENCE');
  assert.equal(emptyHealth.json().score,null);
  const disabledAdvisor=(await ask('GET',base+'/advisor',t)).json();
  assert.equal(disabledAdvisor.enabled,false);
  assert.equal(disabledAdvisor.externalAiUsed,false);
  assert.equal((await ask('GET',base+'/settings',viewer.accessToken)).statusCode,403);
  assert.equal((await ask('GET',base+'/privacy/status',viewer.accessToken)).statusCode,403);
  assert.equal((await ask('GET',base+'/privacy/requests',viewer.accessToken)).statusCode,403);
  assert.equal((await ask('GET',base+'/security/audit',viewer.accessToken)).statusCode,403);
  assert.equal((await ask('GET',base+'/integrations/requests',viewer.accessToken)).statusCode,403);
  assert.equal((await ask('POST',base+'/settings',viewer.accessToken,{
   advisorEnabled:true,analyticsSharingEnabled:false,monthlyReviewDay:1,periodMonths:6},key())).statusCode,403);
  assert.equal((await ask('GET',base+'/financial-health',viewer.accessToken)).statusCode,200);
  assert.equal((await ask('GET',base+'/integrations/catalog',viewer.accessToken)).statusCode,200);
  assert.equal((await ask('GET',base+'/settings',outsider.accessToken)).statusCode,404);
  assert.equal((await ask('GET',base+'/financial-health')).statusCode,401);
  const catalog=(await ask('GET',base+'/integrations/catalog',t)).json();
  assert.equal(catalog.allConnectionsActive,false);
  assert.equal(catalog.items.length,5);
  assert.equal(catalog.items.every((x:any)=>x.canConnect===false),true);
  const cfg=(await ask('GET',base+'/settings',t)).json();
  assert.equal(cfg.advisorEnabled,false);
  assert.equal(cfg.analyticsSharingEnabled,false);
  assert.equal(cfg.externalAiConfigured,false);
  const account=await ask('POST',base+'/accounts',t,{displayName:'B7 manual bank',
   kind:'BANK',currency:'KES'},key());
  assert.equal(account.statusCode,201,account.body);
  const incomeCategory=await ask('POST',base+'/categories',t,{name:'B7 test income',kind:'INCOME'},key());
  const expenseCategory=await ask('POST',base+'/categories',t,{name:'B7 test expense',kind:'EXPENSE'},key());
  assert.equal(incomeCategory.statusCode,201,incomeCategory.body);
  assert.equal(expenseCategory.statusCode,201,expenseCategory.body);
  const today=new Date().toISOString().slice(0,10);
  for(const [kind,amount,id] of [
   ['INCOME',1000000,incomeCategory.json().id],
   ['EXPENSE',300000,expenseCategory.json().id],
   ['EXPENSE',200000,expenseCategory.json().id],
   ['EXPENSE',100000,expenseCategory.json().id]
  ] as const){
   const r=await ask('POST',base+'/transactions',t,{financialAccountId:account.json().id,
    categoryId:id,kind,amountMinor:amount,currency:'KES',
    description:'B7 posted manual '+kind,effectiveOn:today},key());
   assert.equal(r.statusCode,201,r.body);
  }
  const health=(await ask('GET',base+'/financial-health',t)).json();
  assert.equal(health.incomeMinor,1000000);
  assert.equal(health.expenseMinor,600000);
  assert.equal(health.netCashFlowMinor,400000);
  assert.equal(health.postedTransactionCount,4);
  assert.equal(health.status,'POSITIVE_MANUAL_CASHFLOW');
  assert.equal(health.savingsRateBasisPoints,4000);
  assert.equal(health.score,null);
  assert.equal(health.providerVerified,false);
  const monthly=(await ask('GET',base+'/reports/monthly?months=3',t)).json();
  assert.equal(monthly.periods.length,3);
  assert.equal(monthly.totals.incomeMinor,1000000);
  assert.equal(monthly.totals.expenseMinor,600000);
  assert.equal(monthly.totals.netMinor,400000);
  assert.equal(monthly.providerVerified,false);
  assert.equal((await ask('GET',base+'/reports/monthly?months=500',t)).statusCode,422);
  assert.equal((await ask('GET',base+'/reports/monthly?months=abc',t)).statusCode,422);
  const grouped=(await ask('GET',base+'/reports/categories?months=3',t)).json();
  assert.equal(grouped.items.length,2);
  assert.equal(grouped.items.find((x:any)=>x.kind==='EXPENSE').amountMinor,600000);
  assert.equal(grouped.items.find((x:any)=>x.kind==='INCOME').amountMinor,1000000);
  const s={advisorEnabled:true,analyticsSharingEnabled:false,monthlyReviewDay:10,periodMonths:6};
  const idem=key(),saved=await ask('POST',base+'/settings',t,s,idem);
  assert.equal(saved.statusCode,201,saved.body);
  assert.equal((await ask('POST',base+'/settings',t,s,idem)).statusCode,200);
  assert.equal((await ask('POST',base+'/settings',t,{...s,periodMonths:3},idem)).statusCode,409);
  assert.equal((await ask('POST',base+'/settings',t,{...s,analyticsSharingEnabled:true},key())).statusCode,422);
  assert.equal((await ask('POST',base+'/settings',t,s)).statusCode,428);
  const savedSettings=(await ask('GET',base+'/settings',t)).json();
  assert.equal(savedSettings.advisorEnabled,true);
  assert.equal(savedSettings.analyticsSharingEnabled,false);
  assert.equal(savedSettings.periodMonths,6);
  const enabledAdvisor=(await ask('GET',base+'/advisor',t)).json();
  assert.equal(enabledAdvisor.enabled,true);
  assert.equal(enabledAdvisor.mode,'EXPLAINABLE_RULES_NOT_GENERATIVE_AI');
  assert.equal(enabledAdvisor.externalAiUsed,false);
  assert.equal(enabledAdvisor.providerDataSent,false);
  assert.equal(enabledAdvisor.items.length>0,true);
  const beforeJournal=(await admin.query('SELECT count(*)::int AS n FROM journal_entries WHERE workspace_id=$1',[w])).rows[0].n;
  const intent=await ask('POST',base+'/integrations/requests',t,
   {providerKind:'MOBILE_MONEY',intentKind:'REQUEST_INFORMATION'},key());
  assert.equal(intent.statusCode,201,intent.body);
  assert.equal(intent.json().connectionStatus,'NOT_CONNECTED');
  assert.equal((await ask('POST',base+'/integrations/requests',t,{
   providerKind:'BANK',intentKind:'CONNECT_NOW'},key())).statusCode,422);
  assert.equal((await ask('POST',base+'/integrations/requests',t,{
   providerKind:'BANK',intentKind:'REQUEST_INFORMATION',accessToken:'secret'},key())).statusCode,422);
  assert.equal((await ask('GET',base+'/integrations/requests',t)).json().items.length,1);
  const privacyKey=key(),privacy=await ask('POST',base+'/privacy/requests',t,
   {requestKind:'ERASURE_REVIEW'},privacyKey);
  assert.equal(privacy.statusCode,201,privacy.body);
  assert.equal(privacy.json().status,'REQUESTED');
  assert.equal(privacy.json().fulfilled,false);
  assert.equal((await ask('POST',base+'/privacy/requests',t,{requestKind:'ERASURE_REVIEW'},privacyKey)).statusCode,200);
  assert.equal((await ask('POST',base+'/privacy/requests',t,{requestKind:'DELETE_NOW'},key())).statusCode,422);
  assert.equal((await ask('GET',base+'/privacy/requests',t)).json().items.length,1);
  const privacyState=(await ask('GET',base+'/privacy/status',t)).json();
  assert.equal(privacyState.unresolvedRequests,1);
  assert.equal(privacyState.erasureAutomatic,false);
  assert.equal(privacyState.bankSyncActive,false);
  assert.equal(privacyState.externalAiSharing,false);
  const history=(await ask('GET',base+'/security/audit',t)).json();
  assert.ok(history.items.some((x:any)=>x.eventType==='b7.settings'));
  assert.ok(history.items.some((x:any)=>x.eventType==='b7.privacy.request'));
  assert.ok(history.items.some((x:any)=>x.eventType==='b7.integration.info'));
  assert.ok(!JSON.stringify(history).includes('accessToken'));
  assert.equal((await admin.query('SELECT count(*)::int AS n FROM journal_entries WHERE workspace_id=$1',[w])).rows[0].n,
   beforeJournal,'Settings, advisor, reports, integration and privacy requests must not post new financial journals');
  await assert.rejects(admin.query('DELETE FROM b7_settings_snapshots WHERE id=$1',[saved.json().id]),/append-only/i);
  await assert.rejects(admin.query('UPDATE b7_privacy_requests SET state=\'REQUESTED\' WHERE id=$1',[privacy.json().id]),/append-only/i);
  assert.equal((await finance.query('SELECT count(*)::int AS n FROM b7_privacy_requests')).rows[0].n,0,
   'Tenant-unscoped role must not discover private requests');
  assert.equal((await ask('GET',base+'/settings',owner.accessToken)).statusCode,200);
 }finally{await app.close();await finance.end();await auth.end();await admin.end();}
});
