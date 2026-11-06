import test from 'node:test';
import assert from 'node:assert/strict';
import pg from 'pg';
import {certifyStagingDatabase,expectedChecksums} from '../scripts/staging-db-certify.mjs';
const url=process.env.TEST_APP_DATABASE_URL;
if(!url)throw Error('B8.1 staging database certification requires a disposable restricted app database');
test('B8.1 dedicated disposable staging-style PostgreSQL 17 validates checksum, RLS and role isolation',async()=>{
 const db=new pg.Client({connectionString:url,connectionTimeoutMillis:8000});
 try{
  await db.connect();
  const report=await certifyStagingDatabase(db,'finance_os_staging');
  assert.equal(report.status,'STAGING_DB_INTERNAL_CHECKS_PASS',JSON.stringify(report));
  assert.equal(report.failures.length,0);
  assert.equal(report.checks.length,6);
  assert.equal(report.customerRecordsRead,false);
  assert.equal(report.providerReconciliationVerified,false);
  assert.equal(report.productionReady,false);
  assert.equal(expectedChecksums().size>=11,true);
 }finally{await db.end().catch(()=>undefined);}
});
