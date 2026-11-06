import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {buildApp} from '../src/app.js';
import {loadConfig} from '../src/config.js';
const appUrl=process.env.TEST_APP_DATABASE_URL,authUrl=process.env.TEST_AUTH_DATABASE_URL,
 adminUrl=process.env.MIGRATION_DATABASE_URL;
if(!appUrl||!authUrl||!adminUrl)throw new Error('B5 requires disposable PostgreSQL with least-privilege finance/auth roles');
const config=loadConfig({NODE_ENV:'test',DATABASE_URL:appUrl,AUTH_DATABASE_URL:authUrl,
 LOCAL_AUTH_ENABLED:'true',CORS_ALLOWED_ORIGINS:'http://localhost:8080',LOG_LEVEL:'silent'});
const key=()=>randomUUID()+'-'+randomUUID();
test('B5: all five domains, no false provider authority, idempotency, tenant and estate privacy',async()=>{
 const financial=new pg.Pool({connectionString:appUrl,max:5}),auth=new pg.Pool({connectionString:authUrl,max:5});
 const admin=new pg.Client({connectionString:adminUrl});
 await admin.connect();
 const app=await buildApp({config,database:financial,financePool:financial,authPool:auth});
 const ask=(method:'POST'|'GET',url:string,token?:string,body?:unknown,idem?:string)=>app.inject({
  method,url,headers:{...(token?{authorization:'Bearer '+token}:{}),...(idem?{'idempotency-key':idem}:{})},
  ...(body===undefined?{}:{payload:body})});
 const signup=async()=>{
  const x=await ask('POST','/v1/auth/register',undefined,{email:'b5-'+randomUUID()+'@example.invalid',
   displayName:'B5 Disposable User',password:'TestOnlyLongStrongPassword!265'});
  assert.equal(x.statusCode,201,x.body);return x.json();
 };
 try{
  const owner=await signup(),viewer=await signup(),outsider=await signup();
  const w=owner.workspace.id,base='/v1/workspaces/'+w,t=owner.accessToken;
  await admin.query("INSERT INTO workspace_members(workspace_id,user_id,role,status) VALUES($1,$2,'VIEWER','ACTIVE')",
   [w,viewer.user.id]);
  const debtBody={name:'Education loan',lenderName:'Manual lender',currency:'KES',
   originalMinor:2500000,outstandingMinor:2000000,aprBasisPoints:1200,
   minimumPaymentMinor:100000,nextDueOn:'2026-12-01'};
  const idem=key(),debt=await ask('POST',base+'/debts',t,debtBody,idem);
  assert.equal(debt.statusCode,201,debt.body);
  const debtId=debt.json().id;
  assert.equal((await ask('POST',base+'/debts',t,debtBody,idem)).statusCode,200);
  assert.equal((await ask('POST',base+'/debts',t,{...debtBody,name:'Other loan'},idem)).statusCode,409);
  assert.equal((await ask('POST',base+'/debts',viewer.accessToken,debtBody,key())).statusCode,403);
  assert.equal((await ask('GET',base+'/debts',outsider.accessToken)).statusCode,404);
  assert.equal((await ask('GET',base+'/debts')).statusCode,401);
  assert.equal((await ask('POST',base+'/debts',t,debtBody)).statusCode,428);
  const debts=(await ask('GET',base+'/debts',t)).json().items;
  assert.equal(debts[0].estimatedOutstandingMinor,2000000);
  assert.equal(debts[0].evidence,'USER_REPORTED');
  const taxBody={label:'Estimated personal tax',taxKind:'INCOME_TAX',taxYear:2026,
   estimatedMinor:500000,dueOn:'2026-12-31',currency:'KES'};
  const tax=await ask('POST',base+'/tax/obligations',t,taxBody,key());
  assert.equal(tax.statusCode,201,tax.body);
  const taxId=tax.json().id;
  assert.equal((await ask('POST',base+'/tax/obligations',t,{...taxBody,taxPin:'PRIVATE'},key())).statusCode,422);
  const insurance=await ask('POST',base+'/insurance/policies',t,{
   name:'Health coverage',insurerLabel:'User-entered insurer',coverageKind:'HEALTH',
   startOn:'2026-01-01',expiresOn:'2027-01-01',premiumMinor:250000,
   coverageLimitMinor:20000000,currency:'KES'},key());
  assert.equal(insurance.statusCode,201,insurance.body);
  assert.equal((await ask('GET',base+'/insurance/policies',t)).json().items[0].coverageVerified,false);
  const retirement=await ask('POST',base+'/retirement/scenarios',t,{
   name:'Pension scenario',currentMinor:100000,monthlyContributionMinor:20000,
   targetMinor:6000000,horizonMonths:120,annualReturnBasisPoints:500,currency:'KES'},key());
  assert.equal(retirement.statusCode,201,retirement.body);
  const simulation=(await ask('GET',base+'/retirement/scenarios',t)).json().items[0].simulation;
  assert.equal(simulation.moneyMoved,false);
  assert.equal(simulation.providerVerified,false);
  const estate={willPrepared:false,beneficiariesReviewed:false,executorNominated:true,
   dependantsConsidered:false,recordsSecured:true,reviewedOn:'2026-11-06'};
  assert.equal((await ask('GET',base+'/estate/checklists',viewer.accessToken)).statusCode,403);
  assert.equal((await ask('POST',base+'/estate/checklists',viewer.accessToken,estate,key())).statusCode,403);
  assert.equal((await ask('POST',base+'/estate/checklists',t,estate,key())).statusCode,201);
  assert.equal((await ask('GET',base+'/estate/checklists',t)).json().items[0].completedCount,2);

  const account=await ask('POST',base+'/accounts',t,
   {displayName:'Manual wallet',kind:'CASH',currency:'KES'},key());
  const incomeCat=await ask('POST',base+'/categories',t,{name:'B5 income',kind:'INCOME'},key());
  const expenseCat=await ask('POST',base+'/categories',t,{name:'B5 expense',kind:'EXPENSE'},key());
  for(const x of [account,incomeCat,expenseCat])assert.equal(x.statusCode,201,x.body);
  const today=new Date().toISOString().slice(0,10);
  const txPayload={financialAccountId:account.json().id,categoryId:incomeCat.json().id,
   kind:'INCOME',amountMinor:3000000,currency:'KES',description:'Manual cash in',effectiveOn:today};
  assert.equal((await ask('POST',base+'/transactions',t,txPayload,key())).statusCode,201);
  const expense=await ask('POST',base+'/transactions',t,
   {...txPayload,categoryId:expenseCat.json().id,kind:'EXPENSE',amountMinor:200000,
    description:'Manually recorded repayment'},key());
  assert.equal(expense.statusCode,201,expense.body);
  const expenseId=expense.json().id;
  const before=(await ask('GET',base+'/ledger/summary',t)).json();
  const paymentBody={manualTransactionId:expenseId,amountMinor:150000};
  const payment=await ask('POST',base+'/debts/'+debtId+'/payments',t,paymentBody,key());
  assert.equal(payment.statusCode,201,payment.body);
  assert.equal((await ask('GET',base+'/debts',t)).json().items[0].estimatedOutstandingMinor,1850000);
  assert.equal((await ask('POST',base+'/tax/obligations/'+taxId+'/payments',t,
   {manualTransactionId:expenseId,amountMinor:50000},key())).statusCode,409,
   'One manual expense cannot be counted as both a debt and a tax payment');
  assert.equal((await ask('POST',base+'/debts/'+debtId+'/payments',t,
   {manualTransactionId:randomUUID(),amountMinor:100},key())).statusCode,422);
  assert.equal((await ask('POST',base+'/debts/'+debtId+'/payments',t,
   {manualTransactionId:expenseId,amountMinor:100},key())).statusCode,409);
  const expense2=await ask('POST',base+'/transactions',t,
   {...txPayload,categoryId:expenseCat.json().id,kind:'EXPENSE',amountMinor:120000,
    description:'Manually recorded tax payment'},key());
  assert.equal(expense2.statusCode,201,expense2.body);
  const linked=await ask('POST',base+'/tax/obligations/'+taxId+'/payments',t,
   {manualTransactionId:expense2.json().id,amountMinor:100000},key());
  assert.equal(linked.statusCode,201,linked.body);
  const taxes=(await ask('GET',base+'/tax/obligations',t)).json().items;
  assert.equal(taxes[0].estimatedRemainingMinor,400000);
  assert.equal(taxes[0].filingStatus,'NOT_FILED_BY_FINANCE_OS');
  const after=(await ask('GET',base+'/ledger/summary',t)).json();
  assert.deepEqual(before,after,'Linking references to already POSTED manual expenses cannot post a new journal');
  const reversal=await ask('POST',base+'/transactions/'+expenseId+'/reverse',t,undefined,key());
  assert.equal(reversal.statusCode,201,reversal.body);
  assert.equal((await ask('GET',base+'/debts',t)).json().items[0].estimatedOutstandingMinor,2000000,
   'Reversed manual reference must stop reducing estimated principal');
  await assert.rejects(admin.query('UPDATE b5_tax_obligations SET estimated_minor=1 WHERE id=$1',[taxId]),
   /append-only/);
  const count=await admin.query(`SELECT count(*)::int AS n FROM journal_entries
    WHERE workspace_id=$1 AND source_type='MANUAL'`,[w]);
  assert.equal(count.rows[0].n,4,'Only income, two expenses and the reversal may create manual journals');
 }finally{await app.close();await financial.end();await auth.end();await admin.end();}
});
