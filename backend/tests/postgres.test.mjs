import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import pg from 'pg';

const enabled = Boolean(process.env.DATABASE_URL && process.env.B0_INTEGRATION_TEST === '1');
test('PostgreSQL: workspace FK, balanced posting and immutable posted entries', {skip: !enabled}, async () => {
 const c=new pg.Client({connectionString:process.env.DATABASE_URL});await c.connect();
 const uid=randomUUID(),wid=randomUUID(),other=randomUUID(),cash=randomUUID(),alien=randomUUID(),asset=randomUUID(),income=randomUUID(),journal=randomUUID();
 async function fails(query,params,pattern) {
  await c.query('SAVEPOINT expected_fail');
  await assert.rejects(c.query(query,params),pattern);
  await c.query('ROLLBACK TO SAVEPOINT expected_fail');
  await c.query('RELEASE SAVEPOINT expected_fail');
 }
 try {
  await c.query('BEGIN');
  await c.query('INSERT INTO subjects(id,display_name) VALUES($1,$2)',[uid,'B0 test subject']);
  for(const w of [wid,other]){
   await c.query('INSERT INTO workspaces(id,name,kind,created_by) VALUES($1,$2,$3,$4)',[w,'B0 test','PERSONAL',uid]);
   await c.query('INSERT INTO workspace_memberships(workspace_id,subject_id,role) VALUES($1,$2,$3)',[w,uid,'OWNER']);
  }
  for(const [w,a] of [[wid,cash],[other,alien]]) await c.query('INSERT INTO financial_accounts(id,workspace_id,display_name,account_type,currency) VALUES($1,$2,$3,$4,$5)',[a,w,'Test cash','CASH','KES']);
  await fails('INSERT INTO ledger_accounts(workspace_id,code,title,class,currency,financial_account_id) VALUES($1,$2,$3,$4,$5,$6)',[wid,'BAD','Alien','ASSET','KES',alien],/foreign key/i);
  for(const [aid,code,kind] of [[asset,'1000','ASSET'],[income,'4000','INCOME']]) await c.query('INSERT INTO ledger_accounts(id,workspace_id,code,title,class,currency,financial_account_id) VALUES($1,$2,$3,$4,$5,$6,$7)',[aid,wid,code,'Test',kind,'KES',cash]);
  await c.query('INSERT INTO journals(id,workspace_id,description,occurred_at,created_by) VALUES($1,$2,$3,now(),$4)',[journal,wid,'Test journal',uid]);
  await fails('INSERT INTO journal_lines(workspace_id,journal_id,ledger_account_id,side,amount_minor,currency) VALUES($1,$2,$3,$4,$5,$6)',[wid,journal,asset,'DEBIT',500,'USD'],/currenc/i);
  await c.query('INSERT INTO journal_lines(workspace_id,journal_id,ledger_account_id,side,amount_minor,currency) VALUES($1,$2,$3,$4,$5,$6)',[wid,journal,asset,'DEBIT',500,'KES']);
  await c.query('INSERT INTO journal_lines(workspace_id,journal_id,ledger_account_id,side,amount_minor,currency) VALUES($1,$2,$3,$4,$5,$6)',[wid,journal,income,'CREDIT',400,'KES']);
  await c.query('SAVEPOINT imbalance');
  await c.query("UPDATE journals SET status='POSTED',posted_at=now() WHERE id=$1",[journal]);
  await fails('SET CONSTRAINTS ALL IMMEDIATE',[],/balance/i);
  await c.query('ROLLBACK TO SAVEPOINT imbalance');await c.query('RELEASE SAVEPOINT imbalance');
  await c.query('UPDATE journal_lines SET amount_minor=500 WHERE journal_id=$1 AND side=$2',[journal,'CREDIT']);
  await c.query("UPDATE journals SET status='POSTED',posted_at=now() WHERE id=$1",[journal]);
  await c.query('SET CONSTRAINTS ALL IMMEDIATE');
  await fails('UPDATE journal_lines SET amount_minor=900 WHERE journal_id=$1',[journal],/immutable|posted/i);
  await fails('UPDATE journals SET description=$1 WHERE id=$2',['tamper',journal],/immutable/i);
  await fails('INSERT INTO journal_lines(workspace_id,journal_id,ledger_account_id,side,amount_minor,currency) VALUES($1,$2,$3,$4,$5,$6)',[wid,journal,asset,'DEBIT',1,'KES'],/draft/i);
 } finally {await c.query('ROLLBACK').catch(()=>{});await c.end();}
});

test('PostgreSQL: RLS denies session-less access and permits scoped read with membership', {skip: !enabled}, async () => {
 const c=new pg.Client({connectionString:process.env.DATABASE_URL});await c.connect();
 const uid=randomUUID(),wid=randomUUID(),role='b0_reader_'+randomUUID().replace(/-/g,'').slice(0,14);
 try {
  await c.query('BEGIN');
  await c.query('INSERT INTO subjects(id,display_name) VALUES($1,$2)',[uid,'B0 test RLS']);
  await c.query('INSERT INTO workspaces(id,name,kind,created_by) VALUES($1,$2,$3,$4)',[wid,'B0 RLS','PERSONAL',uid]);
  await c.query('INSERT INTO workspace_memberships(workspace_id,subject_id,role) VALUES($1,$2,$3)',[wid,uid,'OWNER']);
  await c.query('CREATE ROLE "'+role+'" NOLOGIN NOSUPERUSER NOBYPASSRLS');
  await c.query('GRANT USAGE ON SCHEMA public TO "'+role+'"');
  await c.query('GRANT SELECT ON workspaces,workspace_memberships TO "'+role+'"');
  await c.query('SET LOCAL ROLE "'+role+'"');
  await c.query('SELECT set_config($1,$2,true)',['finance_os.subject_id','']);
  await c.query('SELECT set_config($1,$2,true)',['finance_os.workspace_id','']);
  assert.equal((await c.query('SELECT count(*)::int AS n FROM workspaces WHERE id=$1',[wid])).rows[0].n,0);
  await c.query('SELECT set_config($1,$2,true)',['finance_os.subject_id',uid]);
  await c.query('SELECT set_config($1,$2,true)',['finance_os.workspace_id',wid]);
  assert.equal((await c.query('SELECT count(*)::int AS n FROM workspaces WHERE id=$1',[wid])).rows[0].n,1);
 } finally {await c.query('ROLLBACK').catch(()=>{});await c.end();}
});
