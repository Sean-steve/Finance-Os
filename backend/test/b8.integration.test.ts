import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {buildApp} from '../src/app.js';
import {loadConfig} from '../src/config.js';

const appUrl=process.env.TEST_APP_DATABASE_URL,authUrl=process.env.TEST_AUTH_DATABASE_URL,
 adminUrl=process.env.MIGRATION_DATABASE_URL;
if(!appUrl||!authUrl||!adminUrl)throw Error('B8 integration requires disposable PostgreSQL and separated app/auth roles');
const config=loadConfig({NODE_ENV:'test',DATABASE_URL:appUrl,AUTH_DATABASE_URL:authUrl,
 LOCAL_AUTH_ENABLED:'true',CORS_ALLOWED_ORIGINS:'http://localhost:8080',LOG_LEVEL:'silent'});
const key=()=>randomUUID()+'-'+randomUUID();
test('B8 golden flow: 2 tenants, journal + reversal + B5/B6 + privacy, read-only owner certification',async()=>{
 const financial=new pg.Pool({connectionString:appUrl,max:5}),auth=new pg.Pool({connectionString:authUrl,max:5});
 const admin=new pg.Client({connectionString:adminUrl});await admin.connect();
 const app=await buildApp({config,database:financial,financePool:financial,authPool:auth});
 const ask=(method:'GET'|'POST',url:string,token?:string,body?:unknown,idem?:string)=>app.inject({
  method,url,headers:{...(token?{authorization:'Bearer '+token}:{}),
   ...(idem?{'idempotency-key':idem}:{})},...(body===undefined?{}:{payload:body})});
 const signup=async()=>{const x=await ask('POST','/v1/auth/register',undefined,{
  email:'b8-'+randomUUID()+'@example.invalid',displayName:'B8 Disposable User',
  password:'TestOnlyLongStrongPassword!265'});assert.equal(x.statusCode,201,x.body);return x.json();};
 try{
  const owner=await signup(),viewer=await signup(),outsider=await signup();
  const w=owner.workspace.id,t=owner.accessToken,base='/v1/workspaces/'+w,
   report=base+'/certification/financial-integrity';
  await admin.query("INSERT INTO workspace_members(workspace_id,user_id,role,status) VALUES($1,$2,'VIEWER','ACTIVE')",[w,viewer.user.id]);
  assert.equal((await ask('GET',report)).statusCode,401);
  assert.equal((await ask('GET',report,viewer.accessToken)).statusCode,403);
  assert.equal((await ask('GET',report,outsider.accessToken)).statusCode,404);
  const empty=await ask('GET',report,t);
  assert.equal(empty.statusCode,200,empty.body);
  assert.equal(empty.json().status,'INSUFFICIENT_EVIDENCE');
  assert.equal(empty.json().canClaimBankReconciled,false);
  const a=await ask('POST',base+'/accounts',t,{displayName:'B8 manual bank',kind:'BANK',currency:'KES'},key());
  const ic=await ask('POST',base+'/categories',t,{name:'B8 income',kind:'INCOME'},key());
  const ec=await ask('POST',base+'/categories',t,{name:'B8 expense',kind:'EXPENSE'},key());
  assert.equal(a.statusCode,201,a.body);assert.equal(ic.statusCode,201,ic.body);
  assert.equal(ec.statusCode,201,ec.body);
  const today=new Date().toISOString().slice(0,10);
  const amount=async(kind:'INCOME'|'EXPENSE',minor:number,categoryId:string)=>{
   const r=await ask('POST',base+'/transactions',t,{
    financialAccountId:a.json().id,categoryId,kind,amountMinor:minor,currency:'KES',
    description:'B8 actual manual '+kind,effectiveOn:today},key());
   assert.equal(r.statusCode,201,r.body);return r.json();
  };
  const income=await amount('INCOME',1000000,ic.json().id);
  const expense=await amount('EXPENSE',250000,ec.json().id);
  const afterTx=(await ask('GET',report,t)).json();
  assert.equal(afterTx.status,'PASS_MANUAL_LEDGER');
  assert.equal(afterTx.ledger.manualTransactionCount,2);
  assert.equal(afterTx.ledger.totalManualCashLedgerMinor,750000);
  assert.equal(afterTx.ledger.cashReconciled,true);
  const reversal=await ask('POST',base+'/transactions/'+expense.id+'/reverse',t,undefined,key());
  assert.equal(reversal.statusCode,201,reversal.body);
  const afterReversal=(await ask('GET',report,t)).json();
  assert.equal(afterReversal.ledger.manualTransactionCount,3);
  assert.equal(afterReversal.ledger.postedJournalCount,3);
  assert.equal(afterReversal.ledger.totalManualCashLedgerMinor,1000000);
  assert.equal(afterReversal.ledger.invalidReversalLinks,0);
  assert.equal(afterReversal.ledger.transactionCashEffectMismatches,0);
  assert.equal(afterReversal.ledger.missingPostedTransactionLinks,0);
  assert.equal(afterReversal.ledger.postedDebitMinor,afterReversal.ledger.postedCreditMinor);
  const loan=await ask('POST',base+'/debts',t,{
   name:'B8 reported loan',lenderName:'B8 manual lender',
   currency:'KES',originalMinor:300000,outstandingMinor:300000,
   aprBasisPoints:1200,minimumPaymentMinor:10000,nextDueOn:null},key());
  assert.equal(loan.statusCode,201,loan.body);
  const asset=await ask('POST',base+'/wealth/assets',t,{
   name:'B8 manual vehicle',assetKind:'VEHICLE',
   initialValueMinor:100000,currency:'KES',acquiredOn:null},key());
  assert.equal(asset.statusCode,201,asset.body);
  const bucket=await ask('POST',base+'/money-buckets',t,{
   name:'B8 reserved money',purpose:'EMERGENCY',priority:1,currency:'KES'},key());
  assert.equal(bucket.statusCode,201,bucket.body);
  const settings=await ask('POST',base+'/settings',t,{
   advisorEnabled:true,analyticsSharingEnabled:false,monthlyReviewDay:7,periodMonths:6},key());
  assert.equal(settings.statusCode,201,settings.body);
  const privacy=await ask('POST',base+'/privacy/requests',t,{requestKind:'EXPORT_REVIEW'},key());
  assert.equal(privacy.statusCode,201,privacy.body);
  const finalReport=await ask('GET',report,t);
  assert.equal(finalReport.statusCode,200,finalReport.body);
  const proof=finalReport.json();
  assert.equal(proof.status,'PASS_MANUAL_LEDGER');
  assert.equal(proof.ledger.cashReconciled,true);
  assert.equal(proof.ledger.imbalancedPostedJournals,0);
  assert.equal(proof.ledger.incompletePostedJournals,0);
  assert.equal(proof.estimates.estimatedNetWorthMinor,800000);
  assert.equal(proof.estimates.manualAndUserEstimatesOnly,true);
  assert.equal(proof.providerVerified,false);
  assert.equal(proof.productionCertified,false);
  assert.equal(proof.manualEvidence.externalFinancialConfirmation,false);
  assert.equal((await ask('GET',base+'/advisor',t)).json().mode,'EXPLAINABLE_RULES_NOT_GENERATIVE_AI');
  assert.equal((await ask('GET',base+'/privacy/status',t)).json().unresolvedRequests,1);
  assert.equal((await ask('GET',base+'/wealth/summary',t)).json().estimatedNetWorthMinor,800000);
  const other=await ask('GET','/v1/workspaces/'+outsider.workspace.id+'/certification/financial-integrity',outsider.accessToken);
  assert.equal(other.statusCode,200,other.body);
  assert.equal(other.json().status,'INSUFFICIENT_EVIDENCE');
  assert.equal(other.json().estimates.estimatedNetWorthMinor,0);
  const journalCount=(await admin.query('SELECT COUNT(*)::int AS n FROM journal_entries WHERE workspace_id=$1',[w])).rows[0].n;
  assert.equal(journalCount,3,'B8, B4, B5, B6 and B7 reporting and planning must not post extra journal entries');
  assert.equal((await financial.query('SELECT COUNT(*)::int AS n FROM manual_transactions')).rows[0].n,0,
   'Restricted role cannot access unscoped financial history');
  assert.equal((await financial.query('SELECT COUNT(*)::int AS n FROM b7_privacy_requests')).rows[0].n,0,
   'Restricted role cannot access unscoped privacy events');
  const ready=await app.inject({method:'GET',url:'/health/ready'});
  assert.equal(ready.statusCode,200,ready.body);
  assert.equal((await app.inject({method:'GET',url:'/v1/meta'})).json().stage,'B8');
 }finally{await app.close();await financial.end();await auth.end();await admin.end();}
});
