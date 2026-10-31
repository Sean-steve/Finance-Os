import {createHash} from 'node:crypto';
import type {FastifyInstance,FastifyRequest} from 'fastify';
import type pg from 'pg';
import {z} from 'zod';
import {sessionIdentity,DomainError,type AuthIdentity} from './auth.js';
import {withWorkspace} from './db/tenant.js';

const uuid=z.string().uuid();
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s)));
const cash=z.number().int().positive().safe().max(1_000_000_000_000);
const accountBody=z.object({displayName:z.string().trim().min(1).max(160),
 kind:z.enum(['CASH','BANK','MOBILE_MONEY','CARD','SACCO','INVESTMENT','OTHER']),
 currency:z.string().regex(/^[A-Z]{3}$/).default('KES')}).strict();
const categoryBody=z.object({name:z.string().trim().min(1).max(120),
 kind:z.enum(['INCOME','EXPENSE'])}).strict();
const transactionBody=z.object({financialAccountId:uuid,categoryId:uuid,
 kind:z.enum(['INCOME','EXPENSE']),amountMinor:cash,currency:z.string().regex(/^[A-Z]{3}$/).default('KES'),
 description:z.string().trim().min(1).max(500),effectiveOn:date}).strict();
const importRow=z.object({date,description:z.string().trim().min(1).max(500),
 amountMinor:z.number().int().safe().refine(n=>n!==0),currency:z.string().regex(/^[A-Z]{3}$/).default('KES')}).strict();
const importBody=z.object({financialAccountId:uuid,rows:z.array(importRow).min(1).max(150)}).strict();
const matchBody=z.object({importRowId:uuid,manualTransactionId:uuid}).strict();
const asMoney=(value:unknown)=>{const n=Number(value);if(!Number.isSafeInteger(n))throw new DomainError(422,'AMOUNT_RANGE','Amount cannot be safely represented');return n;};
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const parse=<T extends z.ZodTypeAny>(schema:T,body:unknown):z.infer<T>=>{
 const result=schema.safeParse(body);
 if(!result.success)throw new DomainError(422,'VALIDATION_ERROR','Invalid request fields');
 return result.data;
};
function headerIdempotency(request:FastifyRequest){
 const raw=request.headers['idempotency-key'];
 const key=Array.isArray(raw)?raw[0]:raw;
 if(!key||key.length<10||key.length>160||!/^[A-Za-z0-9_.:-]+$/.test(key))throw new DomainError(428,'IDEMPOTENCY_REQUIRED','Idempotency-Key header required (10–160 safe characters)');
 return key;
}
const params=(request:FastifyRequest)=>request.params as {workspaceId:string;accountId?:string};
async function scoped<T>(request:FastifyRequest,financial:pg.Pool,auth:pg.Pool,
 mode:'read'|'write',work:(db:pg.PoolClient,actor:AuthIdentity)=>Promise<T>):Promise<T>{
 const actor=await sessionIdentity(request,auth),workspaceId=params(request).workspaceId;
 if(!uuid.safeParse(workspaceId).success)throw new DomainError(400,'INVALID_WORKSPACE','Invalid workspace identifier');
 return withWorkspace(financial,actor.id,workspaceId,async db=>{
  const result=await db.query<{role:string}>(`SELECT role FROM workspace_members
      WHERE workspace_id=$1 AND user_id=$2 AND status='ACTIVE'`,[workspaceId,actor.id]);
  const membership=result.rows[0];
  if(!membership)throw new DomainError(404,'WORKSPACE_NOT_FOUND','Workspace not found');
  if(mode==='write' && membership.role==='VIEWER')throw new DomainError(403,'READ_ONLY','Workspace role cannot modify finances');
  return work(db,actor);
 });
}
async function reserve(db:pg.PoolClient,workspaceId:string,key:string,operation:string,data:unknown){
 const fingerprint=hash(JSON.stringify({operation,data}));
 const inserted=await db.query<{id:string}>(`INSERT INTO idempotency_records(workspace_id,operation,request_key,request_sha256,expires_at)
    VALUES($1,$2,$3,$4,now()+interval '48 hours') ON CONFLICT(workspace_id,operation,request_key) DO NOTHING RETURNING id`,[workspaceId,operation,key,fingerprint]);
 if(inserted.rowCount)return {fresh:true,id:inserted.rows[0]!.id,resultId:null};
 const old=await db.query<{id:string;request_sha256:string;result_id:string|null}>(`SELECT id,request_sha256,result_id FROM idempotency_records
     WHERE workspace_id=$1 AND operation=$2 AND request_key=$3`,[workspaceId,operation,key]);
 const record=old.rows[0];
 if(!record||record.request_sha256!==fingerprint)throw new DomainError(409,'IDEMPOTENCY_CONFLICT','Idempotency key was used for a different request');
 if(!record.result_id)throw new DomainError(409,'IDEMPOTENCY_INCOMPLETE','Original operation did not finish');
 return {fresh:false,id:record.id,resultId:record.result_id};
}
async function finish(db:pg.PoolClient,id:string,resultId:string){
 await db.query('UPDATE idempotency_records SET result_id=$2 WHERE id=$1',[id,resultId]);
}
async function audit(db:pg.PoolClient,workspaceId:string,actor:AuthIdentity,action:string,entityType:string,entityId:string,request:FastifyRequest){
 await db.query(`INSERT INTO audit_events(workspace_id,actor_user_id,event_type,entity_type,entity_id,correlation_id,details)
 VALUES($1,$2,$3,$4,$5,$6,'{}'::jsonb)`,[workspaceId,actor.id,action,entityType,entityId,request.id]);
}
async function fetchAccounts(db:pg.PoolClient,wid:string,accountId?:string){
 const result=await db.query<{
  id:string;display_name:string;kind:string;currency:string;provider_status:string;balance_minor:string
 }>(`SELECT a.id,a.display_name,a.kind,a.currency,a.provider_status,
 COALESCE(SUM(CASE WHEN e.status='POSTED' THEN l.debit_minor-l.credit_minor ELSE 0 END),0)::text AS balance_minor
 FROM financial_accounts a LEFT JOIN ledger_accounts la ON la.workspace_id=a.workspace_id AND la.financial_account_id=a.id
 LEFT JOIN journal_lines l ON l.workspace_id=la.workspace_id AND l.ledger_account_id=la.id
 LEFT JOIN journal_entries e ON e.workspace_id=l.workspace_id AND e.id=l.entry_id
 WHERE a.workspace_id=$1 AND a.archived_at IS NULL AND ($2::uuid IS NULL OR a.id=$2::uuid)
 GROUP BY a.id ORDER BY a.created_at,a.id`,[wid,accountId??null]);
 return result.rows.map(r=>({id:r.id,displayName:r.display_name,kind:r.kind,currency:r.currency,providerStatus:r.provider_status,
  balanceMinor:asMoney(r.balance_minor),balanceQuality:'MANUAL_RECORD'}));
}
async function fetchTransactions(db:pg.PoolClient,wid:string,transactionId?:string){
 const result=await db.query<{
  id:string;financial_account_id:string;category_id:string;kind:string;amount_minor:string;currency:string;
  description:string;occurred_at:Date;entry_id:string;origin:string;reverses_transaction_id:string|null
 }>(`SELECT id,financial_account_id,category_id,kind,amount_minor,currency,description,occurred_at,entry_id,origin,reverses_transaction_id
 FROM manual_transactions WHERE workspace_id=$1 AND ($2::uuid IS NULL OR id=$2::uuid)
 ORDER BY occurred_at DESC,id DESC LIMIT 100`,[wid,transactionId??null]);
 return result.rows.map(r=>({id:r.id,financialAccountId:r.financial_account_id,categoryId:r.category_id,
  kind:r.kind,amountMinor:asMoney(r.amount_minor),currency:r.currency,description:r.description,
  occurredAt:r.occurred_at instanceof Date?r.occurred_at.toISOString():String(r.occurred_at),
  journalEntryId:r.entry_id,origin:r.origin,reversesTransactionId:r.reverses_transaction_id,status:'POSTED'}));
}
export function installFinanceRoutes(app:FastifyInstance,finance:pg.Pool,auth:pg.Pool){
 app.get('/v1/workspaces/:workspaceId/accounts',async(request,reply)=>{
  const items=await scoped(request,finance,auth,'read',(db)=>fetchAccounts(db,params(request).workspaceId));
  return reply.send({items,nextCursor:null});
 });
 app.post('/v1/workspaces/:workspaceId/accounts',async(request,reply)=>{
  const body=parse(accountBody,request.body),key=headerIdempotency(request);
  const item=await scoped(request,finance,auth,'write',async(db,actor)=>{
   const wid=params(request).workspaceId, idem=await reserve(db,wid,key,'accounts.create',body);
   if(!idem.fresh){
    const prior=await fetchAccounts(db,wid,idem.resultId!);
    if(!prior[0])throw new DomainError(409,'REPLAY_NOT_FOUND','Prior account record cannot be loaded');
    return {...prior[0],replayed:true};
   }
   const row=await db.query<{id:string}>(`INSERT INTO financial_accounts(workspace_id,display_name,kind,currency,provider_status)
    VALUES($1,$2,$3,$4,'MANUAL') RETURNING id`,[wid,body.displayName,body.kind,body.currency]);
   const id=row.rows[0]!.id;
   await db.query(`INSERT INTO ledger_accounts(workspace_id,code,name,class,currency,financial_account_id)
    VALUES($1,$2,$3,'ASSET',$4,$5)`,[wid,'FIN:'+id,body.displayName,body.currency,id]);
   await audit(db,wid,actor,'account.created','financial_account',id,request);
   await finish(db,idem.id,id);
   return (await fetchAccounts(db,wid,id))[0]!;
  });
  return reply.code('replayed' in item?200:201).send(item);
 });
 app.get('/v1/workspaces/:workspaceId/categories',async(request,reply)=>{
  const items=await scoped(request,finance,auth,'read',async db=>{
   const rows=await db.query<{id:string;name:string;kind:string}>(`SELECT id,name,kind FROM financial_categories
       WHERE workspace_id=$1 ORDER BY kind,name LIMIT 200`,[params(request).workspaceId]);
   return rows.rows;
  });return reply.send({items});
 });
 app.post('/v1/workspaces/:workspaceId/categories',async(request,reply)=>{
  const body=parse(categoryBody,request.body),key=headerIdempotency(request);
  const category=await scoped(request,finance,auth,'write',async(db,actor)=>{
   const wid=params(request).workspaceId, idem=await reserve(db,wid,key,'categories.create',body);
   if(!idem.fresh){
    const row=await db.query('SELECT id,name,kind FROM financial_categories WHERE workspace_id=$1 AND id=$2',[wid,idem.resultId]);
    if(!row.rows[0])throw new DomainError(409,'REPLAY_NOT_FOUND','Prior category missing');
    return {...(row.rows[0] as object),replayed:true};
   }
   const created=await db.query<{id:string;name:string;kind:string}>(`INSERT INTO financial_categories(workspace_id,name,kind)
      VALUES($1,$2,$3) RETURNING id,name,kind`,[wid,body.name,body.kind]);
   const row=created.rows[0]!;
   await db.query(`INSERT INTO ledger_accounts(workspace_id,code,name,class,currency)
     VALUES($1,$2,$3,$4,'KES')`,[wid,'CAT:'+row.id,body.name,body.kind]);
   await audit(db,wid,actor,'category.created','category',row.id,request);
   await finish(db,idem.id,row.id);return row;
  });return reply.code('replayed' in category?200:201).send(category);
 });
 app.get('/v1/workspaces/:workspaceId/transactions',async(request,reply)=>{
  const items=await scoped(request,finance,auth,'read',db=>fetchTransactions(db,params(request).workspaceId));
  return reply.send({items,nextCursor:null});
 });
 app.post('/v1/workspaces/:workspaceId/transactions',async(request,reply)=>{
  const body=parse(transactionBody,request.body),key=headerIdempotency(request);
  const item=await scoped(request,finance,auth,'write',async(db,actor)=>{
   const wid=params(request).workspaceId,idem=await reserve(db,wid,key,'transactions.record',body);
   if(!idem.fresh){
    const prior=await fetchTransactions(db,wid,idem.resultId!);
    if(!prior[0])throw new DomainError(409,'REPLAY_NOT_FOUND','Prior transaction missing');
    return {...prior[0],replayed:true};
   }
   const account=(await db.query<{id:string;currency:string;ledger_id:string}>(`SELECT a.id,a.currency,l.id AS ledger_id
    FROM financial_accounts a JOIN ledger_accounts l ON l.workspace_id=a.workspace_id AND l.financial_account_id=a.id
    WHERE a.workspace_id=$1 AND a.id=$2 AND a.archived_at IS NULL AND a.provider_status='MANUAL'`,[wid,body.financialAccountId])).rows[0];
   if(!account)throw new DomainError(404,'ACCOUNT_NOT_FOUND','Manual account not found');
   if(account.currency!==body.currency)throw new DomainError(422,'CURRENCY_MISMATCH','Account and posting currencies differ');
   const category=(await db.query<{kind:string;ledger_id:string}>(`SELECT c.kind,l.id AS ledger_id FROM financial_categories c
    JOIN ledger_accounts l ON l.workspace_id=c.workspace_id AND l.code='CAT:'||c.id::text AND l.class=c.kind
    WHERE c.workspace_id=$1 AND c.id=$2`,[wid,body.categoryId])).rows[0];
   if(!category||category.kind!==body.kind)throw new DomainError(422,'INVALID_CATEGORY','Category must match transaction kind');
   if(body.currency!=='KES')throw new DomainError(422,'UNSUPPORTED_CURRENCY','Manual category ledger currently supports KES only');
   const entry=(await db.query<{id:string}>(`INSERT INTO journal_entries(workspace_id,currency,effective_on,source_type,memo,status,idempotency_key,created_by)
     VALUES($1,$2,$3,'MANUAL',$4,'DRAFT',$5,$6) RETURNING id`,
     [wid,body.currency,body.effectiveOn,body.description,key,actor.id])).rows[0]!;
   const debit=body.kind==='INCOME'?account.ledger_id:category.ledger_id;
   const credit=body.kind==='INCOME'?category.ledger_id:account.ledger_id;
   for(const [number,accountId,side] of [[1,debit,'debit_minor'],[2,credit,'credit_minor']] as const){
    // Column names come only from static literals, never request data.
    await db.query(`INSERT INTO journal_lines(workspace_id,entry_id,line_number,ledger_account_id,${side})
     VALUES($1,$2,$3,$4,$5)`,[wid,entry.id,number,accountId,body.amountMinor]);
   }
   await db.query(`UPDATE journal_entries SET status='POSTED',posted_at=now() WHERE id=$1 AND workspace_id=$2`,[entry.id,wid]);
   const created=await db.query<{id:string}>(`INSERT INTO manual_transactions(workspace_id,financial_account_id,category_id,entry_id,
      kind,amount_minor,currency,description,occurred_at,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) RETURNING id`,
      [wid,account.id,body.categoryId,entry.id,body.kind,body.kind==='INCOME'?body.amountMinor:-body.amountMinor,
       body.currency,body.description,body.effectiveOn+'T12:00:00.000Z',actor.id]);
   const id=created.rows[0]!.id;
   await audit(db,wid,actor,'transaction.posted','manual_transaction',id,request);
   await finish(db,idem.id,id);
   return (await fetchTransactions(db,wid,id))[0]!;
  });
  return reply.code('replayed' in item?200:201).send(item);
 });
 app.get('/v1/workspaces/:workspaceId/ledger/journal-entries',async(request,reply)=>{
  const items=await scoped(request,finance,auth,'read',async(db)=>{
   const rows=await db.query<{id:string;effective_on:Date;currency:string;memo:string;status:string;
     debit_minor:string;credit_minor:string}>(`SELECT e.id,e.effective_on,e.currency,e.memo,e.status,
    SUM(l.debit_minor)::text AS debit_minor,SUM(l.credit_minor)::text AS credit_minor
    FROM journal_entries e JOIN journal_lines l ON l.workspace_id=e.workspace_id AND l.entry_id=e.id
    WHERE e.workspace_id=$1 AND e.status='POSTED' GROUP BY e.id ORDER BY e.effective_on DESC,e.id DESC LIMIT 100`,[params(request).workspaceId]);
   return rows.rows.map(r=>({id:r.id,effectiveOn:r.effective_on,currency:r.currency,memo:r.memo,
      status:r.status,totalDebitMinor:asMoney(r.debit_minor),totalCreditMinor:asMoney(r.credit_minor)}));
  });return reply.send({items,nextCursor:null});
 });
 app.get('/v1/workspaces/:workspaceId/ledger/summary',async(request,reply)=>{
  const summary=await scoped(request,finance,auth,'read',async(db)=>{
   const accounts=await fetchAccounts(db,params(request).workspaceId);
   return {accounts,totalByCurrency:Object.entries(accounts.reduce<Record<string,number>>((acc,item)=>{
    acc[item.currency]=(acc[item.currency]??0)+item.balanceMinor;return acc;
   },{})).map(([currency,amountMinor])=>({currency,amountMinor,quality:'MANUAL_RECORD'})),asOf:new Date().toISOString()};
  });return reply.send(summary);
 });
 app.post('/v1/workspaces/:workspaceId/statement-imports',async(request,reply)=>{
  const body=parse(importBody,request.body),key=headerIdempotency(request);
  const response=await scoped(request,finance,auth,'write',async(db,actor)=>{
   const wid=params(request).workspaceId,idem=await reserve(db,wid,key,'imports.stage',body);
   if(!idem.fresh)return {id:idem.resultId,status:'STAGED',replayed:true};
   const ac=(await db.query<{currency:string}>(`SELECT currency FROM financial_accounts WHERE workspace_id=$1 AND id=$2 AND archived_at IS NULL`,
    [wid,body.financialAccountId])).rows[0];
   if(!ac)throw new DomainError(404,'ACCOUNT_NOT_FOUND','Account not found');
   if(body.rows.some(row=>row.currency!==ac.currency))throw new DomainError(422,'CURRENCY_MISMATCH','Statement must match account currency');
   const sh=hash(JSON.stringify(body.rows));
   const batch=await db.query<{id:string}>(`INSERT INTO import_batches(workspace_id,financial_account_id,source_sha256,status)
       VALUES($1,$2,$3,'STAGED') ON CONFLICT(workspace_id,financial_account_id,source_sha256)
       DO NOTHING RETURNING id`,[wid,body.financialAccountId,sh]);
   const id=batch.rows[0]?.id ?? (await db.query<{id:string}>(`SELECT id FROM import_batches WHERE workspace_id=$1 AND financial_account_id=$2 AND source_sha256=$3`,[wid,body.financialAccountId,sh])).rows[0]!.id;
   for(const row of body.rows){
    const fingerprint=hash(JSON.stringify(row));
    await db.query(`INSERT INTO import_rows(workspace_id,batch_id,row_fingerprint,transaction_on,description,
       amount_minor,currency,disposition) VALUES($1,$2,$3,$4,$5,$6,$7,'PENDING')
       ON CONFLICT(batch_id,row_fingerprint) DO NOTHING`,[wid,id,fingerprint,row.date,row.description,row.amountMinor,row.currency]);
   }
   await audit(db,wid,actor,'statement.staged','import_batch',id,request);
   await finish(db,idem.id,id);return {id,status:'STAGED',replayed:false};
  });return reply.code(response.replayed?200:201).send(response);
 });
 app.get('/v1/workspaces/:workspaceId/reconciliation',async(request,reply)=>{
  const items=await scoped(request,finance,auth,'read',async db=>{
   const rows=await db.query(`SELECT i.id,i.batch_id,i.transaction_on,i.description,i.amount_minor::text,
    i.currency,i.disposition,i.entry_id,b.financial_account_id
    FROM import_rows i JOIN import_batches b ON b.workspace_id=i.workspace_id AND b.id=i.batch_id
    WHERE i.workspace_id=$1 ORDER BY i.transaction_on DESC,i.id DESC LIMIT 100`,[params(request).workspaceId]);
   return (rows.rows as Array<Record<string,unknown>>).map(r=>({
    id:r.id,batchId:r.batch_id,date:r.transaction_on,description:r.description,
    amountMinor:asMoney(r.amount_minor),currency:r.currency,disposition:r.disposition,
    financialAccountId:r.financial_account_id,journalEntryId:r.entry_id
   }));
  });return reply.send({items,nextCursor:null});
 });
 app.post('/v1/workspaces/:workspaceId/reconciliation/matches',async(request,reply)=>{
  const body=parse(matchBody,request.body),key=headerIdempotency(request);
  const match=await scoped(request,finance,auth,'write',async(db,actor)=>{
   const wid=params(request).workspaceId,idem=await reserve(db,wid,key,'reconciliation.match',body);
   if(!idem.fresh)return {id:idem.resultId,matched:true,replayed:true};
   const row=(await db.query<{account:string;amount_minor:string;currency:string;disposition:string}>(`
    SELECT b.financial_account_id AS account,r.amount_minor::text,r.currency,r.disposition
    FROM import_rows r JOIN import_batches b ON b.workspace_id=r.workspace_id AND b.id=r.batch_id
    WHERE r.workspace_id=$1 AND r.id=$2 FOR UPDATE OF r`,[wid,body.importRowId])).rows[0];
   const tx=(await db.query<{financial_account_id:string;amount_minor:string;currency:string;entry_id:string}>(`
    SELECT financial_account_id,amount_minor::text,currency,entry_id FROM manual_transactions
    WHERE workspace_id=$1 AND id=$2`,[wid,body.manualTransactionId])).rows[0];
   if(!row||!tx)throw new DomainError(404,'RECONCILIATION_ITEM_MISSING','Statement row or transaction missing');
   if(row.disposition!=='PENDING')throw new DomainError(409,'ALREADY_RECONCILED','Statement row already reconciled');
   if(row.account!==tx.financial_account_id||row.currency!==tx.currency||row.amount_minor!==tx.amount_minor)
     throw new DomainError(422,'RECONCILIATION_MISMATCH','Account, amount and currency must match exactly');
   const created=(await db.query<{id:string}>(`INSERT INTO reconciliation_matches(workspace_id,import_row_id,manual_transaction_id,matched_by)
     VALUES($1,$2,$3,$4) RETURNING id`,[wid,body.importRowId,body.manualTransactionId,actor.id])).rows[0]!;
   await db.query(`UPDATE import_rows SET disposition='POSTED',entry_id=$3 WHERE workspace_id=$1 AND id=$2`,[wid,body.importRowId,tx.entry_id]);
   await audit(db,wid,actor,'statement.reconciled','reconciliation_match',created.id,request);
   await finish(db,idem.id,created.id);return {id:created.id,matched:true,replayed:false};
  });return reply.code(match.replayed?200:201).send(match);
 });
 app.post('/v1/workspaces/:workspaceId/transactions/:transactionId/reverse',async(request,reply)=>{
  const key=headerIdempotency(request);
  const transactionId=(request.params as {transactionId:string}).transactionId;
  if(!uuid.safeParse(transactionId).success)throw new DomainError(400,'INVALID_TRANSACTION','Invalid transaction identifier');
  const item=await scoped(request,finance,auth,'write',async(db,actor)=>{
   const wid=params(request).workspaceId,idem=await reserve(db,wid,key,'transactions.reverse',{transactionId});
   if(!idem.fresh){
    const prior=await fetchTransactions(db,wid,idem.resultId!);
    if(!prior[0])throw new DomainError(409,'REPLAY_NOT_FOUND','Prior reversal missing');
    return {...prior[0],replayed:true};
   }
   const original=(await db.query<{id:string;financial_account_id:string;category_id:string|null;entry_id:string;
      currency:string;amount_minor:string;description:string;kind:string;occurred_at:Date}>(`
     SELECT id,financial_account_id,category_id,entry_id,currency,amount_minor::text,
      description,kind,occurred_at FROM manual_transactions
     WHERE workspace_id=$1 AND id=$2`,[wid,transactionId])).rows[0];
   if(!original)throw new DomainError(404,'TRANSACTION_NOT_FOUND','Transaction not found');
   if(original.kind==='REVERSAL')throw new DomainError(409,'REVERSAL_CANNOT_REVERSE','A reversal cannot be reversed; post a new adjusting transaction');
   const existing=await db.query(`SELECT id FROM manual_transactions WHERE workspace_id=$1 AND reverses_transaction_id=$2`,[wid,transactionId]);
   if(existing.rows.length)throw new DomainError(409,'ALREADY_REVERSED','Transaction was already reversed');
   const entry=(await db.query<{id:string}>(`INSERT INTO journal_entries
     (workspace_id,currency,effective_on,source_type,memo,status,idempotency_key,created_by,reverses_entry_id)
     VALUES($1,$2,$3,'REVERSAL',$4,'DRAFT',$5,$6,$7) RETURNING id`,[
      wid,original.currency,new Date().toISOString().slice(0,10),
      'Reversal: '+original.description,key,actor.id,original.entry_id
     ])).rows[0]!;
   const oldLines=await db.query<{line_number:number;ledger_account_id:string;debit_minor:string;credit_minor:string}>(`
     SELECT line_number,ledger_account_id,debit_minor::text,credit_minor::text
     FROM journal_lines WHERE workspace_id=$1 AND entry_id=$2 ORDER BY line_number`,[wid,original.entry_id]);
   if(oldLines.rows.length<2)throw new DomainError(409,'INVALID_ORIGINAL_JOURNAL','Original journal has no balanced lines');
   for(const line of oldLines.rows){
    await db.query(`INSERT INTO journal_lines(workspace_id,entry_id,line_number,ledger_account_id,debit_minor,credit_minor)
     VALUES($1,$2,$3,$4,$5,$6)`,[wid,entry.id,line.line_number,line.ledger_account_id,line.credit_minor,line.debit_minor]);
   }
   await db.query(`UPDATE journal_entries SET status='POSTED',posted_at=now() WHERE workspace_id=$1 AND id=$2`,[wid,entry.id]);
   const created=(await db.query<{id:string}>(`INSERT INTO manual_transactions
      (workspace_id,financial_account_id,category_id,entry_id,kind,amount_minor,currency,description,
       occurred_at,created_by,reverses_transaction_id)
      VALUES($1,$2,$3,$4,'REVERSAL',$5,$6,$7,now(),$8,$9) RETURNING id`,[
       wid,original.financial_account_id,original.category_id,entry.id,
       -asMoney(original.amount_minor),original.currency,'Reversal: '+original.description,actor.id,original.id
      ])).rows[0]!;
   await audit(db,wid,actor,'transaction.reversed','manual_transaction',created.id,request);
   await finish(db,idem.id,created.id);
   return (await fetchTransactions(db,wid,created.id))[0]!;
  });
  return reply.code('replayed' in item?200:201).send(item);
 });

}
