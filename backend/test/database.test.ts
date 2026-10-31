import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import pg from 'pg';

const adminUrl=process.env.MIGRATION_DATABASE_URL;
const appUrl=process.env.TEST_APP_DATABASE_URL;
if(!adminUrl || !appUrl) throw new Error('Set MIGRATION_DATABASE_URL and TEST_APP_DATABASE_URL for integration tests');
const admin=new pg.Client({connectionString:adminUrl});
const app=new pg.Client({connectionString:appUrl});
let a='',b='',actorA='',actorB='',entry='',accountA='';
async function seed(){
 await admin.connect();await app.connect();
 actorA=randomUUID();actorB=randomUUID();a=randomUUID();b=randomUUID();
 await admin.query('INSERT INTO app_users(id,email_normalized,display_name) VALUES($1,$2,$3),($4,$5,$6)',[actorA,actorA+'@example.invalid','CI A',actorB,actorB+'@example.invalid','CI B']);
 await admin.query("INSERT INTO workspaces(id,owner_user_id,name,kind) VALUES($1,$2,'WS-A','PERSONAL'),($3,$4,'WS-B','BUSINESS')",[a,actorA,b,actorB]);
 await admin.query("INSERT INTO workspace_members(workspace_id,user_id,role) VALUES($1,$2,'OWNER'),($3,$4,'OWNER')",[a,actorA,b,actorB]);
 const x=await admin.query("INSERT INTO financial_accounts(workspace_id,display_name,kind,currency) VALUES($1,'Cash A','CASH','KES') RETURNING id",[a]);accountA=x.rows[0].id;
 await admin.query("INSERT INTO financial_accounts(workspace_id,display_name,kind,currency) VALUES($1,'Cash B','CASH','KES')",[b]);
}
test('real PostgreSQL migrations, tenant RLS, immutability and journal invariants', async t=>{
 await seed();
 try{
  await t.test('all B0 migrations recorded and checksum-bound',async()=>{
   const {rows}=await admin.query('SELECT version,sha256 FROM schema_migrations ORDER BY version');
   assert.deepEqual(rows.map(x=>x.version),['001_identity_workspaces.sql','002_financial_domains.sql','003_integrity_rls.sql']);
   assert.ok(rows.every(x=>/^[0-9a-f]{64}$/.test(x.sha256)));
  });
  await t.test('API role cannot SELECT any workspace without transaction scope',async()=>{
   const r=await app.query('SELECT count(*)::integer AS n FROM financial_accounts');
   assert.equal(r.rows[0].n,0);
  });
  await t.test('SET LOCAL workspace scope restricts rows and is reset on commit',async()=>{
   await app.query('BEGIN');
   await app.query('SELECT set_config($1,$2,true)',['app.workspace_id',a]);
   await app.query('SELECT set_config($1,$2,true)',['app.actor_id',actorA]);
   const r=await app.query('SELECT display_name FROM financial_accounts');
   assert.deepEqual(r.rows.map(x=>x.display_name),['Cash A']);
   await app.query('COMMIT');
   assert.equal((await app.query('SELECT count(*)::integer AS n FROM financial_accounts')).rows[0].n,0);
  });
  await t.test('cross-workspace references cannot link another tenant account',async()=>{
   const bAccount=(await admin.query("SELECT id FROM financial_accounts WHERE workspace_id=$1",[b])).rows[0].id;
   const entryId=randomUUID();
   await admin.query("INSERT INTO journal_entries(id,workspace_id,currency,effective_on,source_type) VALUES($1,$2,'KES',current_date,'TEST')",[entryId,a]);
   await assert.rejects(admin.query("INSERT INTO ledger_accounts(workspace_id,code,name,class,currency,financial_account_id) VALUES($1,'CROSS','Invalid','ASSET','KES',$2)",[a,bAccount]),/foreign key/i);
  });
  await t.test('unbalanced posted journal rejected at transaction COMMIT',async()=>{
   await admin.query('BEGIN');
   try{
    const id=randomUUID();
    const aa=(await admin.query("INSERT INTO ledger_accounts(workspace_id,code,name,class,currency) VALUES($1,$2,'Cash','ASSET','KES') RETURNING id",[a,'CASH-'+id])).rows[0].id;
    const ab=(await admin.query("INSERT INTO ledger_accounts(workspace_id,code,name,class,currency) VALUES($1,$2,'Equity','EQUITY','KES') RETURNING id",[a,'EQUITY-'+id])).rows[0].id;
    await admin.query("INSERT INTO journal_entries(id,workspace_id,currency,effective_on,source_type) VALUES($1,$2,'KES',current_date,'TEST')",[id,a]);
    await admin.query("INSERT INTO journal_lines(workspace_id,entry_id,line_number,ledger_account_id,debit_minor) VALUES($1,$2,1,$3,10000)",[a,id,aa]);
    await admin.query("INSERT INTO journal_lines(workspace_id,entry_id,line_number,ledger_account_id,credit_minor) VALUES($1,$2,2,$3,9900)",[a,id,ab]);
    await admin.query("UPDATE journal_entries SET status='POSTED',posted_at=now() WHERE id=$1",[id]);
    await assert.rejects(admin.query('COMMIT'),/balanced/i);
   } finally {await admin.query('ROLLBACK').catch(()=>undefined);}
  });
  await t.test('balanced posted journal is immutable, reversal must be new entry',async()=>{
   entry=randomUUID();
   const aa=(await admin.query("INSERT INTO ledger_accounts(workspace_id,code,name,class,currency) VALUES($1,$2,'Cash','ASSET','KES') RETURNING id",[a,'CASH-'+entry])).rows[0].id;
   const ab=(await admin.query("INSERT INTO ledger_accounts(workspace_id,code,name,class,currency) VALUES($1,$2,'Income','INCOME','KES') RETURNING id",[a,'INC-'+entry])).rows[0].id;
   await admin.query("INSERT INTO journal_entries(id,workspace_id,currency,effective_on,source_type) VALUES($1,$2,'KES',current_date,'TEST')",[entry,a]);
   await admin.query('INSERT INTO journal_lines(workspace_id,entry_id,line_number,ledger_account_id,debit_minor) VALUES($1,$2,1,$3,10000)',[a,entry,aa]);
   await admin.query('INSERT INTO journal_lines(workspace_id,entry_id,line_number,ledger_account_id,credit_minor) VALUES($1,$2,2,$3,10000)',[a,entry,ab]);
   await admin.query("UPDATE journal_entries SET status='POSTED',posted_at=now() WHERE id=$1",[entry]);
   await assert.rejects(admin.query("UPDATE journal_entries SET memo='bad' WHERE id=$1",[entry]),/immutable/i);
   await assert.rejects(admin.query('DELETE FROM journal_lines WHERE entry_id=$1',[entry]),/immutable/i);
   assert.equal((await admin.query('SELECT count(*)::integer AS n FROM journal_lines WHERE entry_id=$1',[entry])).rows[0].n,2);
  });
  await t.test('API role cannot insert ledger rows in B0',async()=>{
   await assert.rejects(app.query("INSERT INTO financial_accounts(workspace_id,display_name,kind,currency) VALUES($1,'Bad','CASH','KES')",[a]),/permission denied|row-level security/i);
  });
 } finally { await app.end(); await admin.end(); }
});
