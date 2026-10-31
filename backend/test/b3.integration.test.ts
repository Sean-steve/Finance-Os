import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';
import {buildApp} from '../src/app.js';
import {loadConfig} from '../src/config.js';

const appUrl=process.env.TEST_APP_DATABASE_URL,authUrl=process.env.TEST_AUTH_DATABASE_URL;
const adminUrl=process.env.MIGRATION_DATABASE_URL;
if(!appUrl||!authUrl||!adminUrl)throw new Error('B3 tests require disposable PostgreSQL 17 and separate runtime/auth DB roles');
const config=loadConfig({NODE_ENV:'test',DATABASE_URL:appUrl,AUTH_DATABASE_URL:authUrl,
 LOCAL_AUTH_ENABLED:'true',CORS_ALLOWED_ORIGINS:'http://localhost:8080',LOG_LEVEL:'silent'});
const key=()=>randomUUID()+'-'+randomUUID();
const now=()=>new Date().toISOString().slice(0,10);
const shift=(day:string,days:number)=>new Date(Date.parse(day+'T00:00:00Z')+days*86400000).toISOString().slice(0,10);
test('B3 PostgreSQL end-to-end: scheduled income, obligations, reversible manual bill records, cross-tenant policies',async()=>{
 const finance=new pg.Pool({connectionString:appUrl,max:5});
 const auth=new pg.Pool({connectionString:authUrl,max:5});
 const admin=new pg.Client({connectionString:adminUrl});
 await admin.connect();
 const app=await buildApp({config,database:finance,financePool:finance,authPool:auth});
 const ask=(method:'POST'|'GET',url:string,token?:string,body?:unknown,idem?:string)=>app.inject({
  method,url,headers:{...(token?{authorization:'Bearer '+token}:{}),...(idem?{'idempotency-key':idem}:{})},
  ...(body===undefined?{}:{payload:body})
 });
 const register=async(email:string)=>{
  const reply=await ask('POST','/v1/auth/register',undefined,{
   email,displayName:'Finance B3 Disposable',password:'TestOnlyLongStrongPassword!265'});
  assert.equal(reply.statusCode,201,reply.body);
  return reply.json();
 };
 try{
  const user=await register('b3-'+randomUUID()+'@example.invalid');
  const stranger=await register('b3-other-'+randomUUID()+'@example.invalid');
  const viewer=await register('b3-viewer-'+randomUUID()+'@example.invalid');
  const wid=user.workspace.id,token=user.accessToken,base='/v1/workspaces/'+wid;
  await admin.query("INSERT INTO workspace_members(workspace_id,user_id,role,status) VALUES($1,$2,'VIEWER','ACTIVE')",
   [wid,viewer.user.id]);
  const account=await ask('POST',base+'/accounts',token,{displayName:'Manual Wallet',kind:'CASH',currency:'KES'},key());
  assert.equal(account.statusCode,201,account.body);
  const incomeCat=await ask('POST',base+'/categories',token,{name:'Contract revenue',kind:'INCOME'},key());
  const billCat=await ask('POST',base+'/categories',token,{name:'Housing costs',kind:'EXPENSE'},key());
  assert.equal(incomeCat.statusCode,201,incomeCat.body);assert.equal(billCat.statusCode,201,billCat.body);
  const acct=account.json().id,ic=incomeCat.json().id,ec=billCat.json().id;
  const start=now(),incomeDate=shift(start,3),billDate=shift(start,2);
  const sourceBody={name:'Contract income expected',categoryId:ic,cadence:'MONTHLY',
   expectedMinor:250000,currency:'KES',firstExpectedOn:incomeDate,lastExpectedOn:null};
  const sourceKey=key();
  const source=await ask('POST',base+'/income/sources',token,sourceBody,sourceKey);
  assert.equal(source.statusCode,201,source.body);assert.equal(source.json().evidence,'USER_ESTIMATE');
  assert.equal((await ask('POST',base+'/income/sources',token,sourceBody,sourceKey)).statusCode,200);
  assert.equal((await ask('POST',base+'/income/sources',token,{...sourceBody,name:'Different'},sourceKey)).statusCode,409);
  assert.equal((await ask('POST',base+'/income/sources',token,{...sourceBody,categoryId:ec},key())).statusCode,422);
  assert.equal((await ask('POST',base+'/income/sources',token,{...sourceBody,currency:'USD'},key())).statusCode,422);
  const planned=await ask('GET',base+'/income/forecast?days=90',token);
  assert.equal(planned.statusCode,200,planned.body);
  assert.ok(planned.json().expectedMinor>=250000);
  assert.equal(planned.json().events[0].evidence,'USER_ESTIMATE');
  const overviewEmpty=await ask('GET',base+'/income/overview?months=3',token);
  assert.equal(overviewEmpty.statusCode,200,overviewEmpty.body);
  assert.equal(overviewEmpty.json().recordedIncomeMinor,0,'Estimates must not produce posted income');
  const billBody={name:'Monthly rent',payeeLabel:'Property manager',categoryId:ec,cadence:'MONTHLY',
   amountMinor:12000,currency:'KES',firstDueOn:billDate,lastDueOn:null};
  const bill=await ask('POST',base+'/bills',token,billBody,key());
  assert.equal(bill.statusCode,201,bill.body);
  const bid=bill.json().id;
  assert.equal((await ask('POST',base+'/bills',token,{...billBody,categoryId:ic},key())).statusCode,422);
  assert.equal((await ask('POST',base+'/bills',viewer.accessToken,billBody,key())).statusCode,403);
  assert.equal((await ask('GET',base+'/bills',viewer.accessToken)).statusCode,200);
  assert.equal((await ask('GET',base+'/bills',stranger.accessToken)).statusCode,404);
  const calendar=await ask('GET',base+'/bills/calendar?from='+start+'&to='+shift(start,50),token);
  assert.equal(calendar.statusCode,200,calendar.body);
  assert.ok(calendar.json().events.some((e:any)=>e.date===billDate&&e.status==='DUE_UNVERIFIED'));
  assert.equal((await ask('GET',base+'/bills/calendar?from=2026-01-01&to=2028-01-01',token)).statusCode,422);
  const forecast=await ask('GET',base+'/cash-flow/forecast?days=90',token);
  assert.equal(forecast.statusCode,200,forecast.body);
  assert.equal(forecast.json().manualBalanceMinor,0);
  assert.ok(forecast.json().expectedIncomeMinor>=250000);
  assert.ok(forecast.json().futureObligationsMinor>=12000);
  assert.equal(forecast.json().sourceQuality,'MANUAL_LEDGER_PLUS_USER_ESTIMATES');
  assert.equal(forecast.json().isProviderVerified,false);
  assert.ok(Array.isArray(forecast.json().limitations));
  assert.equal((await ask('GET',base+'/cash-flow/forecast?days=600',token)).statusCode,422);
  const shortfall=await ask('GET',base+'/cash-flow/shortfalls?days=3',token);
  assert.equal(shortfall.statusCode,200,shortfall.body);
  assert.equal(shortfall.json().advisoryOnly,true);
  assert.equal(shortfall.json().paymentAuthorized,false);
  assert.ok(shortfall.json().firstPotentialShortfallOn);
  const incomeTxn=await ask('POST',base+'/transactions',token,{
   financialAccountId:acct,categoryId:ic,kind:'INCOME',amountMinor:120000,description:'Manual income receipt',
   currency:'KES',effectiveOn:start},key());
  assert.equal(incomeTxn.statusCode,201,incomeTxn.body);
  assert.equal((await ask('GET',base+'/income/overview?months=3',token)).json().recordedIncomeMinor,120000);
  const wrongSettle=await ask('POST',base+'/bills/'+bid+'/settlements',token,
   {dueOn:billDate,manualTransactionId:incomeTxn.json().id},key());
  assert.equal(wrongSettle.statusCode,422,wrongSettle.body);
  const expenseBody={financialAccountId:acct,categoryId:ec,kind:'EXPENSE',amountMinor:12000,
   description:'Rent recorded manually',effectiveOn:start,currency:'KES'};
  const expense=await ask('POST',base+'/transactions',token,expenseBody,key());
  assert.equal(expense.statusCode,201,expense.body);
  const settleKey=key();
  const settled=await ask('POST',base+'/bills/'+bid+'/settlements',token,{
   dueOn:billDate,manualTransactionId:expense.json().id},settleKey);
  assert.equal(settled.statusCode,201,settled.body);
  assert.equal(settled.json().status,'RECORDED');
  assert.equal(settled.json().paymentEvidence,'POSTED_MANUAL_LEDGER_UNVERIFIED');
  assert.equal((await ask('POST',base+'/bills/'+bid+'/settlements',token,{
   dueOn:billDate,manualTransactionId:expense.json().id},settleKey)).statusCode,200);
  assert.equal((await ask('POST',base+'/bills/'+bid+'/settlements',token,{
   dueOn:billDate,manualTransactionId:expense.json().id},key())).statusCode,409);
  const afterPaid=(await ask('GET',base+'/bills/calendar?from='+start+'&to='+shift(start,8),token)).json();
  assert.equal(afterPaid.events.find((e:any)=>e.billId===bid&&e.date===billDate).status,'RECORDED_UNVERIFIED');
  const detail=(await ask('GET',base+'/bills/'+bid,token)).json();
  assert.equal(detail.settlements.length,1);
  const actual=(await ask('GET',base+'/cash-flow/timeline?days=7',token)).json();
  assert.equal(actual.netRecordedCashFlowMinor,108000);
  const reversed=await ask('POST',base+'/transactions/'+expense.json().id+'/reverse',token,undefined,key());
  assert.equal(reversed.statusCode,201,reversed.body);
  const afterReverse=(await ask('GET',base+'/bills/'+bid+'/settlements',token)).json().items;
  assert.equal(afterReverse[0].status,'REVERSED');
  assert.equal((await ask('GET',base+'/bills/calendar?from='+start+'&to='+shift(start,8),token)).json().events
    .find((e:any)=>e.billId===bid&&e.date===billDate).status,'DUE_UNVERIFIED');
  assert.equal((await ask('GET',base+'/cash-flow/timeline?days=7',token)).json().netRecordedCashFlowMinor,120000);
  const retry=await ask('POST',base+'/transactions',token,{...expenseBody,description:'Rebooked rent'},key());
  assert.equal(retry.statusCode,201,retry.body);
  const settleAgain=await ask('POST',base+'/bills/'+bid+'/settlements',token,{
   dueOn:billDate,manualTransactionId:retry.json().id},key());
  assert.equal(settleAgain.statusCode,201,settleAgain.body);
  const details=(await ask('GET',base+'/bills/'+bid+'/settlements',token)).json().items;
  assert.deepEqual(details.map((x:any)=>x.status).sort(),['RECORDED','REVERSED']);
  await assert.rejects(admin.query("UPDATE bills SET amount_minor=99 WHERE id=$1",[bid]),/immutable/i);
  await assert.rejects(admin.query("UPDATE bill_settlements SET status='REVERSED',reversed_at=now() WHERE id=$1",[settleAgain.json().id]),/posted journal reversal/i);
  const cancel=await ask('POST',base+'/bills/'+bid+'/cancel',token,undefined,key());
  assert.equal(cancel.statusCode,201,cancel.body);assert.equal(cancel.json().status,'CANCELLED');
  assert.equal((await ask('POST',base+'/bills/'+bid+'/cancel',token,undefined,key())).statusCode,409);
  const cancelled=(await ask('GET',base+'/bills/calendar?from='+start+'&to='+shift(start,50),token)).json();
  assert.ok(!cancelled.events.some((e:any)=>e.billId===bid&&e.date>=billDate),
   'Cancelled recurring source cannot create new due obligations after cancellation day');
  const disable=await ask('POST',base+'/income/sources/'+source.json().id+'/disable',token,undefined,key());
  assert.equal(disable.statusCode,201,disable.body);
  assert.equal(disable.json().enabled,false);
  assert.equal((await ask('GET',base+'/income/forecast?days=90',token)).json().expectedMinor,0);
  assert.equal((await ask('POST',base+'/income/sources/'+source.json().id+'/disable',token,undefined,key())).statusCode,409);
  await assert.rejects(admin.query("UPDATE income_sources SET expected_minor=999 WHERE id=$1",[source.json().id]),/immutable/i);
  assert.equal((await ask('GET','/v1/workspaces/'+stranger.workspace.id+'/income/sources',token)).statusCode,404);
  assert.equal((await ask('GET','/v1/workspaces/'+stranger.workspace.id+'/cash-flow/forecast',token)).statusCode,404);
  assert.equal((await ask('POST',base+'/income/sources',viewer.accessToken,sourceBody,key())).statusCode,403);
  const postLedger=await ask('GET',base+'/ledger/journal-entries',token);
  assert.equal(postLedger.statusCode,200);assert.ok(postLedger.json().items.length>=4);
 }finally{await app.close();await finance.end();await auth.end();await admin.end();}
});
