import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {buildApp} from '../src/app.js';
import {loadConfig} from '../src/config.js';
const appUrl=process.env.TEST_APP_DATABASE_URL,authUrl=process.env.TEST_AUTH_DATABASE_URL,adminUrl=process.env.MIGRATION_DATABASE_URL;
if(!appUrl||!authUrl||!adminUrl)throw new Error('B4 requires disposable PostgreSQL 17, restricted finance/auth roles');
const config=loadConfig({NODE_ENV:'test',DATABASE_URL:appUrl,AUTH_DATABASE_URL:authUrl,
 LOCAL_AUTH_ENABLED:'true',CORS_ALLOWED_ORIGINS:'http://localhost:8080',LOG_LEVEL:'silent'});
const key=()=>randomUUID()+'-'+randomUUID();
test('B4: workspace planning envelopes, goal funding, approvals, scenarios and RLS financial integrity',async()=>{
 const financial=new pg.Pool({connectionString:appUrl,max:5}),auth=new pg.Pool({connectionString:authUrl,max:5});
 const admin=new pg.Client({connectionString:adminUrl});
 await admin.connect();
 const app=await buildApp({config,database:financial,financePool:financial,authPool:auth});
 const ask=(method:'POST'|'GET',url:string,token?:string,body?:unknown,idem?:string)=>app.inject({
  method,url,headers:{...(token?{authorization:'Bearer '+token}:{}),...(idem?{'idempotency-key':idem}:{})},
  ...(body===undefined?{}:{payload:body})});
 const signup=async()=>{
  const res=await ask('POST','/v1/auth/register',undefined,{email:'b4-'+randomUUID()+'@example.invalid',
   displayName:'B4 Disposable User',password:'TestOnlyLongStrongPassword!265'});
  assert.equal(res.statusCode,201,res.body);return res.json();
 };
 try{
  const owner=await signup(),adminUser=await signup(),viewer=await signup(),stranger=await signup();
  const w=owner.workspace.id,root='/v1/workspaces/'+w,token=owner.accessToken;
  await admin.query("INSERT INTO workspace_members(workspace_id,user_id,role,status) VALUES($1,$2,'ADMIN','ACTIVE'),($1,$3,'VIEWER','ACTIVE')",
    [w,adminUser.user.id,viewer.user.id]);
  const account=await ask('POST',root+'/accounts',token,{displayName:'Manual Wallet',kind:'CASH',currency:'KES'},key());
  const category=await ask('POST',root+'/categories',token,{name:'Manual Income',kind:'INCOME'},key());
  assert.equal(account.statusCode,201,account.body);assert.equal(category.statusCode,201,category.body);
  const cashBefore=await ask('GET',root+'/capital/summary',token);
  assert.equal(cashBefore.json().manualPostedLiquidityMinor,0);
  const noTarget=await ask('POST',root+'/money-buckets',viewer.accessToken,
    {name:'Viewer funds',purpose:'SAVINGS',priority:2,currency:'KES'},key());
  assert.equal(noTarget.statusCode,403,noTarget.body);
  const bucketBody={name:'Bills first',purpose:'ESSENTIALS',priority:1,currency:'KES'};
  const k1=key(),bucket=await ask('POST',root+'/money-buckets',token,bucketBody,k1);
  assert.equal(bucket.statusCode,201,bucket.body);
  assert.equal((await ask('POST',root+'/money-buckets',token,bucketBody,k1)).statusCode,200);
  assert.equal((await ask('POST',root+'/money-buckets',token,{...bucketBody,name:'different'},k1)).statusCode,409);
  const bId=bucket.json().id;
  const goalBody={name:'Emergency living costs',kind:'EMERGENCY',targetMinor:20000000,
   monthlyEssentialMinor:2000000,dueOn:null,currency:'KES'};
  const goal=await ask('POST',root+'/savings-goals',token,goalBody,key());
  assert.equal(goal.statusCode,201,goal.body);
  const gId=goal.json().id;
  assert.equal((await ask('POST',root+'/savings-goals',token,{...goalBody,monthlyEssentialMinor:null},key())).statusCode,422);
  const assign={targetKind:'BUCKET',targetId:bId,amountMinor:12000000,note:'Planning reserve for necessities',approvalRequestId:null};
  assert.equal((await ask('POST',root+'/capital/allocations',token,assign,key())).statusCode,409,
    'No money can be allocated until manually posted');
  const income=await ask('POST',root+'/transactions',token,{financialAccountId:account.json().id,
   categoryId:category.json().id,kind:'INCOME',amountMinor:30000000,
   currency:'KES',description:'User recorded income',effectiveOn:new Date().toISOString().slice(0,10)},key());
  assert.equal(income.statusCode,201,income.body);
  const fundedBefore=await ask('GET',root+'/capital/summary',token);
  assert.equal(fundedBefore.json().manualPostedLiquidityMinor,30000000);
  assert.equal(fundedBefore.json().virtualReservedMinor,0);
  assert.equal((await ask('POST',root+'/capital/allocations',token,assign,key())).statusCode,403,
   'Approval threshold applies to cumulative target funds');
  const fundingBody={targetKind:'BUCKET',targetId:bId,amountMinor:12000000,
   rationale:'Large necessities allocation needs independent review',currency:'KES'};
  const r=await ask('POST',root+'/capital/requests',token,fundingBody,key());
  assert.equal(r.statusCode,201,r.body);assert.equal(r.json().status,'PENDING');
  assert.equal((await ask('POST',root+'/capital/requests/'+r.json().id+'/decision',token,{decision:'APPROVED'},key())).statusCode,409);
  const approved=await ask('POST',root+'/capital/requests/'+r.json().id+'/decision',adminUser.accessToken,
    {decision:'APPROVED'},key());
  assert.equal(approved.statusCode,201,approved.body);assert.equal(approved.json().decidedBy,adminUser.user.id);
  assert.equal((await ask('POST',root+'/capital/requests/'+r.json().id+'/decision',adminUser.accessToken,
    {decision:'REJECTED'},key())).statusCode,409);
  const withApproval={...assign,approvalRequestId:r.json().id};
  const assignmentKey=key();
  const assignment=await ask('POST',root+'/capital/allocations',token,withApproval,assignmentKey);
  assert.equal(assignment.statusCode,201,assignment.body);
  assert.equal((await ask('POST',root+'/capital/allocations',token,withApproval,assignmentKey)).statusCode,200);
  assert.equal((await ask('POST',root+'/capital/allocations',token,withApproval,key())).statusCode,409,
    'An independent approval is consumed once');
  assert.equal((await ask('POST',root+'/capital/allocations',token,{...assign,amountMinor:1},key())).statusCode,403);
  const goalFund={targetKind:'GOAL',targetId:gId,amountMinor:7000000,
   note:'Mark as virtually set aside',approvalRequestId:null};
  const gf=await ask('POST',root+'/capital/allocations',token,goalFund,key());
  assert.equal(gf.statusCode,201,gf.body);
  const totals=await ask('GET',root+'/capital/summary',token);
  assert.equal(totals.statusCode,200,totals.body);
  assert.equal(totals.json().virtualReservedMinor,19000000);
  assert.equal(totals.json().unassignedMinor,11000000);
  assert.equal(totals.json().goals.find((g:any)=>g.id===gId).emergencyCoverageMonths,3.5);
  assert.equal(totals.json().fundsMoved,false);
  assert.equal(totals.json().isProviderVerified,false);
  assert.equal((await ask('POST',root+'/capital/allocations',token,{...goalFund,amountMinor:-7000001},key())).statusCode,422);
  assert.equal((await ask('POST',root+'/capital/allocations',token,{...goalFund,targetId:randomUUID()},key())).statusCode,422);
  assert.equal((await ask('POST',root+'/capital/allocations',token,{...goalFund,amountMinor:15000000},key())).statusCode,409);
  const afford=await ask('POST',root+'/capital/affordability',token,{purchaseAmountMinor:12000000});
  assert.equal(afford.statusCode,200,afford.body);
  assert.equal(afford.json().insufficientManualUnassigned,true);
  assert.equal(afford.json().verdict,'CANNOT_CONFIRM_AFFORDABILITY');
  assert.equal(afford.json().doesNotAuthorizePurchase,true);
  assert.equal((await ask('POST',root+'/savings-goals/'+gId+'/archive',token,undefined,key())).statusCode,409);
  assert.equal((await ask('POST',root+'/capital/allocations',token,{...goalFund,amountMinor:-7000000},key())).statusCode,201);
  const goalArchive=await ask('POST',root+'/savings-goals/'+gId+'/archive',token,undefined,key());
  assert.equal(goalArchive.statusCode,201,goalArchive.body);
  assert.equal(goalArchive.json().status,'ARCHIVED');
  const scenarioBody={name:'Monthly baseline with modest shock',currency:'KES',horizonMonths:3,
   monthlyIncomeMinor:1000000,monthlyExpenseMinor:700000,monthlySavingsMinor:100000,
   oneTimePurchaseMinor:250000,incomeShockBasisPoints:-1000,expenseShockBasisPoints:500};
  const scenario=await ask('POST',root+'/planning/scenarios',token,scenarioBody,key());
  assert.equal(scenario.statusCode,201,scenario.body);
  assert.equal(scenario.json().simulation.endingCashAfterExpensesMinor,30245000);
  const full=await ask('GET',root+'/planning/scenarios/'+scenario.json().id,token);
  assert.equal(full.statusCode,200,full.body);
  assert.equal(full.json().simulation.endingCashAfterExpensesMinor,30245000);
  assert.equal((await ask('GET',root+'/planning/scenarios',token)).statusCode,200);
  assert.equal((await ask('POST',root+'/planning/scenarios',token,{...scenarioBody,currency:'USD'},key())).statusCode,422);
  assert.equal((await ask('POST',root+'/planning/scenarios',viewer.accessToken,scenarioBody,key())).statusCode,403);
  assert.equal((await ask('GET',root+'/capital/summary',stranger.accessToken)).statusCode,404);
  assert.equal((await ask('GET','/v1/workspaces/'+stranger.workspace.id+'/savings-goals',token)).statusCode,404);
  assert.equal((await ask('GET',root+'/capital/summary')).statusCode,401);
  await assert.rejects(admin.query('UPDATE capital_allocations SET amount_minor=0 WHERE id=$1',[assignment.json().id]),/append-only/i);
  await assert.rejects(admin.query('UPDATE savings_goals SET target_minor=1 WHERE id=$1',[gId]),/immutable/i);
  await assert.rejects(admin.query("UPDATE financial_scenarios SET name='tampered' WHERE id=$1",[scenario.json().id]),/append-only/i);
  assert.equal((await ask('GET',root+'/ledger/journal-entries',token)).json().items.length,1,
    'Virtual funding, approvals and scenarios never write ledger entries');
 }finally{await app.close();await financial.end();await auth.end();await admin.end();}
});
