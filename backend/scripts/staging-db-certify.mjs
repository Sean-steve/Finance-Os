#!/usr/bin/env node
// B8.1 read-only PostgreSQL certification: no PII, writes, migrations or false release claim.
import {readFileSync,readdirSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const migrationDir=resolve(dirname(fileURLToPath(import.meta.url)),'../db/migrations');
export const expectedChecksums=()=>{
 const files=readdirSync(migrationDir).filter(n=>/^\d{3}_[\w-]+\.sql$/.test(n)).sort();
 return new Map(files.map(n=>[n,createHash('sha256').update(readFileSync(resolve(migrationDir,n))).digest('hex')]));
};
export async function certifyStagingDatabase(db,expectedDb){
 const failures=[],checks=[];
 const check=(name,ok)=>{if(ok)checks.push(name);else failures.push(name);};
 let tx=false;
 try{
  await db.query('BEGIN READ ONLY');tx=true;
  const who=(await db.query('SELECT current_user AS role,current_database() AS database_name')).rows[0];
  check('DEDICATED_STAGE_DB',who?.database_name===expectedDb && expectedDb==='finance_os_staging');
  check('APP_ROLE_ONLY',who?.role==='finance_app');
  const perms=(await db.query('SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole FROM pg_roles WHERE rolname=current_user')).rows[0];
  check('NO_PRIVILEGE_ESCALATION',Boolean(perms)&&
   perms.rolsuper===false&&perms.rolbypassrls===false&&perms.rolcreatedb===false&&perms.rolcreaterole===false);
  const applied=await db.query('SELECT version,sha256 FROM schema_migrations ORDER BY version');
  const expected=expectedChecksums();
  check('FORWARD_ONLY_MIGRATION_CHECKSUMS',
   applied.rows.length===expected.size && applied.rows.every(x=>expected.get(x.version)===x.sha256));
  const rls=await db.query("SELECT relname,relrowsecurity,relforcerowsecurity FROM pg_class WHERE oid IN ('public.manual_transactions'::regclass,'public.journal_entries'::regclass,'public.b6_assets'::regclass,'public.b7_privacy_requests'::regclass)");
  check('FORCED_ROW_LEVEL_SECURITY',rls.rows.length===4&&
    rls.rows.every(r=>r.relrowsecurity===true&&r.relforcerowsecurity===true));
  const untouched=await db.query('SELECT (SELECT count(*) FROM manual_transactions)::int AS transaction_count,(SELECT count(*) FROM b7_privacy_requests)::int AS private_count,(SELECT count(*) FROM financial_accounts)::int AS account_count');
  const row=untouched.rows[0];
  check('UNSCOPED_TENANT_ACCESS_DENIED',
   Number(row?.transaction_count)===0&&Number(row?.private_count)===0&&Number(row?.account_count)===0);
 }catch{failures.push('DATABASE_CONNECTION_OR_SCHEMA_CHECK_FAILED');}
 finally{if(tx)await db.query('ROLLBACK').catch(()=>undefined);}
 return {status:failures.length?'STAGING_DB_BLOCKED':'STAGING_DB_INTERNAL_CHECKS_PASS',
  checks,failures,customerRecordsRead:false,providerReconciliationVerified:false,productionReady:false};
}
async function main(){
 if(process.env.NODE_ENV!=='production'||process.env.LOCAL_AUTH_ENABLED==='true'||
   process.env.FINANCE_STAGE_DB_NAME!=='finance_os_staging')
  throw Error('Refusing non-production runtime, local auth or non-staging database');
 const url=process.env.DATABASE_URL;
 if(!url)throw Error('DATABASE_URL required');
 const parsed=new URL(url);
 if(parsed.pathname!=='/finance_os_staging'||parsed.searchParams.get('sslmode')!=='verify-full'||
   !['postgres:','postgresql:'].includes(parsed.protocol))
  throw Error('Staging database must be finance_os_staging with PostgreSQL verify-full');
 const pg=(await import('pg')).default;
 const db=new pg.Client({connectionString:url,connectionTimeoutMillis:6000});
 try{
  await db.connect();
  const report=await certifyStagingDatabase(db,'finance_os_staging');
  console.log(JSON.stringify(report,null,2));
  if(report.status!=='STAGING_DB_INTERNAL_CHECKS_PASS')process.exitCode=2;
 }finally{await db.end().catch(()=>undefined);}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href)
 main().catch(()=>{console.error(JSON.stringify({status:'STAGING_DB_BLOCKED',
  reason:'Staging DB connectivity or configuration blocked (secrets withheld)'}));process.exitCode=2;});
