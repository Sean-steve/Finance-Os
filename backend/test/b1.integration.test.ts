import {test} from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {randomUUID} from 'node:crypto';
import {buildApp} from '../src/app.js';
import {loadConfig} from '../src/config.js';

const url=process.env.TEST_APP_DATABASE_URL;
const authUrl=process.env.TEST_AUTH_DATABASE_URL;
const migrationUrl=process.env.MIGRATION_DATABASE_URL;
if(!url||!authUrl||!migrationUrl)throw new Error('Disposable B1 integration database role credentials required');
const config=loadConfig({
 NODE_ENV:'test',DATABASE_URL:url,AUTH_DATABASE_URL:authUrl,LOCAL_AUTH_ENABLED:'true',
 CORS_ALLOWED_ORIGINS:'http://localhost:8080',LOG_LEVEL:'silent'
});
const financePool=new pg.Pool({connectionString:url,max:5});
const authPool=new pg.Pool({connectionString:authUrl,max:4});
const admin=new pg.Client({connectionString:migrationUrl});
const request=(app:Awaited<ReturnType<typeof buildApp>>,method:string,path:string,token?:string,payload?:unknown,key?:string)=>
 app.inject({method:method as 'GET'|'POST',url:path,
  headers:{...(token?{authorization:'Bearer '+token}:{}),...(key?{'idempotency-key':key}:{})},
  ...(payload===undefined?{}:{payload})});
const freshKey=()=>randomUUID()+'-'+randomUUID();
test('B1 end-to-end: real credentials, workspace authorization, immutable posting, idempotency and reconciliation',async()=>{
 await admin.connect();
 const app=await buildApp({config,database:financePool,financePool,authPool});
 const alpha='a-'+randomUUID()+'@example.invalid',beta='b-'+randomUUID()+'@example.invalid';
 try{
  const signup=await request(app,'POST','/v1/auth/register',undefined,{email:alpha,password:'B1LocalOnly-Account-StrongPassword!27',displayName:'B1 User A'});
  assert.equal(signup.statusCode,201,signup.body);
  const {accessToken:tokenA,workspace:{id:workspaceA}}=signup.json();
  assert.ok(tokenA.startsWith('f1_'));
  assert.ok(!signup.body.includes('password_verifier'));
  const signupB=await request(app,'POST','/v1/auth/register',undefined,{email:beta,password:'B1LocalOnly-Account-StrongPassword!39',displayName:'B1 User B'});
  assert.equal(signupB.statusCode,201,signupB.body);
  const {accessToken:tokenB,workspace:{id:workspaceB},user:{id:userBId}}=signupB.json();
  const target='/v1/workspaces/'+workspaceA;
  assert.equal((await request(app,'GET',target+'/accounts')).statusCode,401);
  assert.equal((await request(app,'GET',target+'/accounts',tokenB)).statusCode,404);
  const list=await request(app,'GET','/v1/workspaces',tokenA);
  assert.equal(list.statusCode,200);assert.ok(list.json().items.find((w:{id:string})=>w.id===workspaceA));
  const account=await request(app,'POST',target+'/accounts',tokenA,
   {displayName:'Manual KES Wallet',kind:'CASH',currency:'KES'},freshKey());
  assert.equal(account.statusCode,201,account.body);
  const accountId=account.json().id;
  assert.equal(account.json().balanceMinor,0);
  const category=await request(app,'POST',target+'/categories',tokenA,{name:'Contract income',kind:'INCOME'},freshKey());
  assert.equal(category.statusCode,201,category.body);
  const expenseCategory=await request(app,'POST',target+'/categories',tokenA,{name:'Food & Groceries',kind:'EXPENSE'},freshKey());
  assert.equal(expenseCategory.statusCode,201,expenseCategory.body);
  const income={financialAccountId:accountId,categoryId:category.json().id,kind:'INCOME',amountMinor:250_000,
   currency:'KES',description:'Local manual income',effectiveOn:'2026-10-30'};
  const incomeKey=freshKey();
  const posted=await request(app,'POST',target+'/transactions',tokenA,income,incomeKey);
  assert.equal(posted.statusCode,201,posted.body);
  assert.equal(posted.json().amountMinor,250000);
  const replay=await request(app,'POST',target+'/transactions',tokenA,income,incomeKey);
  assert.equal(replay.statusCode,200,replay.body);assert.equal(replay.json().id,posted.json().id);
  assert.equal((await request(app,'POST',target+'/transactions',tokenA,{...income,amountMinor:2},incomeKey)).statusCode,409);
  const expense=await request(app,'POST',target+'/transactions',tokenA,
   {...income,kind:'EXPENSE',categoryId:expenseCategory.json().id,amountMinor:10000,description:'Local grocery purchase'},freshKey());
  assert.equal(expense.statusCode,201,expense.body);
  assert.equal(expense.json().amountMinor,-10000);
  const accounts=await request(app,'GET',target+'/accounts',tokenA);
  assert.equal(accounts.statusCode,200);assert.equal(accounts.json().items[0].balanceMinor,240000);
  const ledger=await request(app,'GET',target+'/ledger/journal-entries',tokenA);
  assert.equal(ledger.statusCode,200);assert.equal(ledger.json().items.length,2);
  for(const j of ledger.json().items)assert.equal(j.totalDebitMinor,j.totalCreditMinor);
  assert.equal((await request(app,'GET',target+'/ledger/summary',tokenA)).json().totalByCurrency[0].amountMinor,240000);
  const noOther=await request(app,'GET','/v1/workspaces/'+workspaceB+'/transactions',tokenA);
  assert.equal(noOther.statusCode,404);
  const imported=await request(app,'POST',target+'/statement-imports',tokenA,
   {financialAccountId:accountId,rows:[{date:'2026-10-30',description:'Bank credit',amountMinor:250000,currency:'KES'}]},freshKey());
  assert.equal(imported.statusCode,201,imported.body);
  const rows=await request(app,'GET',target+'/reconciliation',tokenA);
  assert.equal(rows.statusCode,200);assert.equal(rows.json().items.length,1);
  const mismatch=await request(app,'POST',target+'/reconciliation/matches',tokenA,
   {importRowId:rows.json().items[0].id,manualTransactionId:expense.json().id},freshKey());
  assert.equal(mismatch.statusCode,422,mismatch.body);
  const matched=await request(app,'POST',target+'/reconciliation/matches',tokenA,
   {importRowId:rows.json().items[0].id,manualTransactionId:posted.json().id},freshKey());
  assert.equal(matched.statusCode,201,matched.body);
  assert.equal((await request(app,'GET',target+'/reconciliation',tokenA)).json().items[0].disposition,'POSTED');
  assert.equal((await request(app,'GET',target+'/ledger/journal-entries',tokenA)).json().items.length,2,
    'reconciliation must not double-post money');

  const reverseKey=freshKey();
  const reversed=await request(app,'POST',target+'/transactions/'+expense.json().id+'/reverse',tokenA,undefined,reverseKey);
  assert.equal(reversed.statusCode,201,reversed.body);
  assert.equal(reversed.json().kind,'REVERSAL');assert.equal(reversed.json().amountMinor,10000);
  assert.equal((await request(app,'GET',target+'/accounts',tokenA)).json().items[0].balanceMinor,250000);
  assert.equal((await request(app,'GET',target+'/ledger/journal-entries',tokenA)).json().items.length,3);
  assert.equal((await request(app,'POST',target+'/transactions/'+expense.json().id+'/reverse',tokenA,undefined,reverseKey)).statusCode,200);
  assert.equal((await request(app,'POST',target+'/transactions/'+expense.json().id+'/reverse',tokenA,undefined,freshKey())).statusCode,409);

  const userA=(await request(app,'GET','/v1/me',tokenA)).json();
  await admin.query(`INSERT INTO workspace_members(workspace_id,user_id,role,status) VALUES($1,$2,'VIEWER','ACTIVE')`,
    [workspaceA,userBId]);
  assert.equal((await request(app,'GET',target+'/accounts',tokenB)).statusCode,200);
  assert.equal((await request(app,'POST',target+'/accounts',tokenB,{displayName:'Denied',kind:'CASH'},freshKey())).statusCode,403);
  const authData=(await admin.query('SELECT count(*)::int AS n FROM app.password_credentials WHERE user_id=$1',[userA.id])).rows[0].n;
  assert.equal(authData,1);
  const real=(await admin.query(`SELECT count(*)::int AS n FROM journal_entries WHERE workspace_id=$1 AND status='POSTED'`,[workspaceA])).rows[0].n;
  assert.equal(real,3);
  await assert.rejects(admin.query(`UPDATE journal_entries SET memo='tampered' WHERE id=$1`,[posted.json().journalEntryId]),/immutable/i);
  const refresh=await request(app,'POST','/v1/auth/refresh',tokenA);
  assert.equal(refresh.statusCode,200,refresh.body);
  assert.equal((await request(app,'GET','/v1/me',tokenA)).statusCode,401);
  const newToken=refresh.json().accessToken;
  assert.equal((await request(app,'GET','/v1/me',newToken)).statusCode,200);
  assert.equal((await request(app,'POST','/v1/auth/logout',newToken)).statusCode,204);
  assert.equal((await request(app,'GET','/v1/me',newToken)).statusCode,401);
  const login=await request(app,'POST','/v1/auth/login',undefined,{email:alpha,password:'B1LocalOnly-Account-StrongPassword!27'});
  assert.equal(login.statusCode,200,login.body);
  assert.equal((await request(app,'GET','/v1/me',login.json().accessToken)).statusCode,200);
 }finally{
  await app.close();await financePool.end();await authPool.end();await admin.end();
 }
});
