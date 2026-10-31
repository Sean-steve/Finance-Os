import {test} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {buildApp} from '../src/app.js';
import {loadConfig} from '../src/config.js';

const db=process.env.TEST_APP_DATABASE_URL,authDb=process.env.TEST_AUTH_DATABASE_URL;
const migration=process.env.MIGRATION_DATABASE_URL;
if(!db||!authDb||!migration)throw new Error('B2 needs a disposable PostgreSQL database and separate restricted roles');
const config=loadConfig({NODE_ENV:'test',DATABASE_URL:db,AUTH_DATABASE_URL:authDb,LOCAL_AUTH_ENABLED:'true',
 CORS_ALLOWED_ORIGINS:'http://localhost:8080',LOG_LEVEL:'silent'});
const key=()=>randomUUID()+'-'+randomUUID();
test('B2: immutable budgets, real manual spending, effective guardrails and independent one-use approvals',async()=>{
 const financial=new pg.Pool({connectionString:db,max:5});
 const auth=new pg.Pool({connectionString:authDb,max:5});
 const admin=new pg.Client({connectionString:migration});
 await admin.connect();
 const app=await buildApp({config,database:financial,financePool:financial,authPool:auth});
 const ask=(method:'GET'|'POST',path:string,token?:string,body?:unknown,idempotency?:string)=>
  app.inject({method,url:path,headers:{...(token?{authorization:'Bearer '+token}:{}),
   ...(idempotency?{'idempotency-key':idempotency}:{})},...(body===undefined?{}:{payload:body})});
 const register=async email=>{
  const r=await ask('POST','/v1/auth/register',undefined,
   {email,displayName:'Budget Test User',password:'TestOnlyLongStrongPassword!265'});
  assert.equal(r.statusCode,201,r.body);return r.json();
 };
 try{
  const a=await register('b2-a-'+randomUUID()+'@example.invalid');
  const b=await register('b2-b-'+randomUUID()+'@example.invalid');
  const aw=a.workspace.id,token=a.accessToken,second=b.accessToken,prefix='/v1/workspaces/'+aw;
  const bUser=b.user.id;
  await admin.query("INSERT INTO workspace_members(workspace_id,user_id,role,status) VALUES($1,$2,'ADMIN','ACTIVE')",[aw,bUser]);
  const account=await ask('POST',prefix+'/accounts',token,{displayName:'Cash',kind:'CASH',currency:'KES'},key());
  assert.equal(account.statusCode,201,account.body);
  const income=await ask('POST',prefix+'/categories',token,{name:'Salary',kind:'INCOME'},key());
  const food=await ask('POST',prefix+'/categories',token,{name:'Food',kind:'EXPENSE'},key());
  assert.equal(food.statusCode,201,food.body);
  const accountId=account.json().id,foodId=food.json().id;
  const date=new Date().toISOString().slice(0,10),year=date.slice(0,4);
  const body={name:'B2 Monthly Food',currency:'KES',startsOn:year+'-01-01',endsOn:year+'-12-31',
   amountMinor:20000,allocations:[{categoryId:foodId,limitMinor:20000}]};
  assert.equal((await ask('POST',prefix+'/budgets',second,body,key())).statusCode,201,
   'Workspace ADMIN can draft a budget');
  const badBudget=await ask('POST',prefix+'/budgets',token,
    {...body,allocations:[{categoryId:foodId,limitMinor:25000}]},key());
  assert.equal(badBudget.statusCode,422,badBudget.body);
  const createKey=key();
  const created=await ask('POST',prefix+'/budgets',token,{...body,name:'Food Plan A'},createKey);
  assert.equal(created.statusCode,201,created.body);
  assert.equal(created.json().status,'DRAFT');
  assert.equal((await ask('POST',prefix+'/budgets',token,{...body,name:'Food Plan A'},createKey)).statusCode,200);
  const activated=await ask('POST',prefix+'/budgets/'+created.json().id+'/activate',token,undefined,key());
  assert.equal(activated.statusCode,201,activated.body);
  assert.equal(activated.json().version,2);
  const repeat=await ask('POST',prefix+'/budgets/'+created.json().id+'/activate',token,undefined,key());
  assert.equal(repeat.statusCode,409,repeat.body);
  const another=await ask('POST',prefix+'/budgets',token,{...body,name:'Overlapping second plan'},key());
  assert.equal(another.statusCode,201,another.body);
  const overlap=await ask('POST',prefix+'/budgets/'+another.json().id+'/activate',token,undefined,key());
  assert.equal(overlap.statusCode,409,overlap.body);
  const inc=await ask('POST',prefix+'/transactions',token,{
   financialAccountId:accountId,categoryId:income.json().id,kind:'INCOME',amountMinor:500000,
   description:'Wages manually recorded',effectiveOn:date,currency:'KES'},key());
  assert.equal(inc.statusCode,201,inc.body);
  const normal=await ask('POST',prefix+'/transactions',token,{
   financialAccountId:accountId,categoryId:foodId,kind:'EXPENSE',amountMinor:4500,
   description:'Grocery shopping',effectiveOn:date,currency:'KES'},key());
  assert.equal(normal.statusCode,201,normal.body);
  const budgets=await ask('GET',prefix+'/budgets',token);
  assert.equal(budgets.statusCode,200);
  assert.equal(budgets.json().items.find(x=>x.id===created.json().id).allocations[0].spentMinor,4500);
  const summary=await ask('GET',prefix+'/spending/insights?months=3',token);
  assert.equal(summary.statusCode,200,summary.body);
  assert.equal(summary.json().categories.find(x=>x.categoryId===foodId).netSpentMinor,4500);
  assert.equal(summary.json().sourceQuality,'MANUAL_POSTED_LEDGER');
  assert.equal(summary.json().isProviderVerified,false);
  assert.equal((await ask('GET',prefix+'/spending/insights?months=50',token)).statusCode,422);
  const warning=await ask('POST',prefix+'/spending/guardrails',token,{
   name:'Food category warning',kind:'CATEGORY',categoryId:foodId,action:'WARN'},key());
  assert.equal(warning.statusCode,201,warning.body);
  const requireRule=await ask('POST',prefix+'/spending/guardrails',token,{
   name:'Large expense approval',kind:'AMOUNT',minAmountMinor:10000,action:'REQUIRE_APPROVAL'},key());
  assert.equal(requireRule.statusCode,201,requireRule.body);
  const block=await ask('POST',prefix+'/spending/guardrails',token,{
   name:'Block huge expenses',kind:'AMOUNT',minAmountMinor:100000,action:'BLOCK'},key());
  assert.equal(block.statusCode,201,block.body);
  assert.equal((await ask('GET',prefix+'/spending/guardrails',b.accessToken)).statusCode,200);
  const purchase={amountMinor:15000,currency:'KES',categoryId:foodId,reference:'Groceries purchase approval'};
  const evaluate=await ask('POST',prefix+'/spending/purchase-checks',token,purchase);
  assert.equal(evaluate.statusCode,200,evaluate.body);
  assert.equal(evaluate.json().decision,'APPROVAL_REQUIRED');
  assert.equal(evaluate.json().advisoryOnly,true);
  assert.equal(evaluate.json().paymentAuthorized,false);
  assert.equal(evaluate.json().fundsMoved,false);
  assert.equal(evaluate.json().budgetWarnings[0].wouldExceed,false);
  const tBody={financialAccountId:accountId,categoryId:foodId,kind:'EXPENSE',
   amountMinor:15000,description:'Groceries requiring independent signoff',effectiveOn:date,currency:'KES'};
  assert.equal((await ask('POST',prefix+'/transactions',token,tBody,key())).statusCode,403,
   'Expense must not bypass an active approval rule');
  const approval=await ask('POST',prefix+'/spending/approvals',token,{
   ...purchase,guardrailId:requireRule.json().id},key());
  assert.equal(approval.statusCode,201,approval.body);
  assert.equal(approval.json().status,'PENDING');
  assert.equal((await ask('POST',prefix+'/spending/approvals/'+approval.json().id+'/decision',token,{decision:'APPROVED'},key())).statusCode,409,
    'Requesting user cannot self-approve');
  const decision=await ask('POST',prefix+'/spending/approvals/'+approval.json().id+'/decision',second,{decision:'APPROVED'},key());
  assert.equal(decision.statusCode,201,decision.body);
  assert.equal(decision.json().decidedBy,bUser);
  assert.equal((await ask('POST',prefix+'/spending/approvals/'+approval.json().id+'/decision',second,{decision:'REJECTED'},key())).statusCode,409);
  const postingKey=key();
  const posted=await ask('POST',prefix+'/transactions',token,{...tBody,approvalRequestIds:[approval.json().id]},postingKey);
  assert.equal(posted.statusCode,201,posted.body);
  assert.equal((await ask('POST',prefix+'/transactions',token,{...tBody,approvalRequestIds:[approval.json().id]},postingKey)).statusCode,200);
  assert.equal((await ask('POST',prefix+'/transactions',token,{...tBody,approvalRequestIds:[approval.json().id]},key())).statusCode,409,
    'Approval consumption is one-time, even with another idempotency key');
  const blocked=await ask('POST',prefix+'/transactions',token,{
   ...tBody,amountMinor:200000,description:'Blocked large expense'},key());
  assert.equal(blocked.statusCode,403,blocked.body);
  const afterward=await ask('GET',prefix+'/budgets',token);
  const spent=afterward.json().items.find(x=>x.id===created.json().id).allocations[0].spentMinor;
  assert.equal(spent,19500,'Budget counts manually posted expense exactly once');
  const future=await ask('POST',prefix+'/spending/purchase-checks',token,{...purchase,amountMinor:2000});
  assert.equal(future.statusCode,200);
  assert.equal(future.json().budgetWarnings[0].wouldExceed,true);
  const reversed=await ask('POST',prefix+'/transactions/'+posted.json().id+'/reverse',token,undefined,key());
  assert.equal(reversed.statusCode,201,reversed.body);
  const net=(await ask('GET',prefix+'/budgets',token)).json().items.find(x=>x.id===created.json().id);
  assert.equal(net.allocations[0].spentMinor,4500,'Reversal must reduce budget usage without editing the original ledger');
  // Recovery paths must not permanently lock the workspace after an accidental policy.
  const disable=await ask('POST',prefix+'/spending/guardrails/'+block.json().id+'/deactivate',token,undefined,key());
  assert.equal(disable.statusCode,201,disable.body);assert.equal(disable.json().active,false);
  const afterDisable=await ask('POST',prefix+'/spending/purchase-checks',token,{...purchase,amountMinor:200000});
  assert.equal(afterDisable.statusCode,200,afterDisable.body);
  assert.equal(afterDisable.json().decision,'APPROVAL_REQUIRED','Disabling BLOCK must leave independent approval policy intact');
  assert.equal((await ask('POST',prefix+'/spending/guardrails/'+block.json().id+'/deactivate',token,undefined,key())).statusCode,409);
  const archive=await ask('POST',prefix+'/budgets/'+created.json().id+'/archive',token,undefined,key());
  assert.equal(archive.statusCode,201,archive.body);
  assert.equal(archive.json().status,'ARCHIVED');assert.equal(archive.json().version,3);
  const nowActivate=await ask('POST',prefix+'/budgets/'+another.json().id+'/activate',token,undefined,key());
  assert.equal(nowActivate.statusCode,201,nowActivate.body);
  assert.equal(nowActivate.json().status,'ACTIVE');
  const other=await ask('GET','/v1/workspaces/'+b.workspace.id+'/budgets',token);
  assert.equal(other.statusCode,404,'RLS/membership denies cross-tenant budgets');
  const readDenied=await ask('GET','/v1/workspaces/'+b.workspace.id+'/spending/insights',token);
  assert.equal(readDenied.statusCode,404);
  assert.equal((await ask('GET',prefix+'/ledger/journal-entries',token)).json().items.length,4);
 }finally{await app.close();await financial.end();await auth.end();await admin.end();}
});
