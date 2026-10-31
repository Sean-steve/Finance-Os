import type {FastifyInstance,FastifyRequest} from 'fastify';
import type pg from 'pg';
import {z} from 'zod';
import {DomainError,type AuthIdentity} from './auth.js';
import {scoped,reserve,finish,audit,headerIdempotency,type IdentityResolver} from './finance.js';

const uuid=z.string().uuid();
const amount=z.number().int().safe().min(1).max(1_000_000_000_000);
const currency=z.literal('KES');
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
 .refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s+'T00:00:00Z').toISOString().startsWith(s));
const allocation=z.object({categoryId:uuid,limitMinor:z.number().int().safe().min(0).max(1_000_000_000_000),
 rollover:z.literal(false).optional().default(false)}).strict();
const budgetSchema=z.object({
 name:z.string().trim().min(2).max(150),currency,startsOn:day,endsOn:day,
 amountMinor:amount,allocations:z.array(allocation).min(1).max(100)
}).strict().refine(b=>b.endsOn>=b.startsOn,'Period end precedes start')
 .refine(b=>new Set(b.allocations.map(a=>a.categoryId)).size===b.allocations.length,'Duplicate categories')
 .refine(b=>b.allocations.reduce((n,a)=>n+a.limitMinor,0)<=b.amountMinor,'Allocations exceed budget');
const guardrailSchema=z.discriminatedUnion('kind',[
 z.object({name:z.string().trim().min(2).max(150),kind:z.literal('AMOUNT'),
 action:z.enum(['WARN','REQUIRE_APPROVAL','BLOCK']),
 minAmountMinor:amount}).strict(),
 z.object({name:z.string().trim().min(2).max(150),kind:z.literal('CATEGORY'),
 action:z.enum(['WARN','REQUIRE_APPROVAL','BLOCK']),
 categoryId:uuid}).strict()
]);
const purchaseSchema=z.object({amountMinor:amount,currency,categoryId:uuid,
 reference:z.string().trim().min(3).max(200)}).strict();
const requestSchema=purchaseSchema.extend({guardrailId:uuid}).strict();
const decisionSchema=z.object({decision:z.enum(['APPROVED','REJECTED'])}).strict();
const params=(r:FastifyRequest)=>r.params as {workspaceId:string;budgetId?:string;requestId?:string};
const n=(v:unknown)=>{const x=Number(v);if(!Number.isSafeInteger(x))throw new DomainError(422,'AMOUNT_OVERFLOW','Amount exceeds safe monetary representation');return x;};
function parse<S extends z.ZodTypeAny>(schema:S,value:unknown):z.infer<S>{
 const r=schema.safeParse(value);if(!r.success)throw new DomainError(422,'VALIDATION_ERROR','Invalid request fields or unsupported currency');return r.data;
}
const list=(items:unknown[])=>({items,nextCursor:null});
type Rule={id:string;name:string;kind:string;action:string;conditions:Record<string,unknown>;active:boolean;version:number};
async function readRules(db:pg.PoolClient,wid:string):Promise<Rule[]>{
 const rows=await db.query<{id:string;name:string;kind:string;action:string;conditions:Record<string,unknown>;
 active:boolean;version:number}>(`SELECT id,name,kind,action,conditions,active,version
 FROM spending_guardrails WHERE workspace_id=$1 AND active=true ORDER BY created_at,id`,[wid]);
 return rows.rows;
}
export function matchingRules(rules:Rule[],input:{amountMinor:number;categoryId:string}){
 return rules.filter(rule=>{
  if(rule.kind==='AMOUNT')return Number(rule.conditions.minAmountMinor)<=input.amountMinor;
  if(rule.kind==='CATEGORY')return rule.conditions.categoryId===input.categoryId;
  return false; // B2 does not invent merchant, location, time or recurring evidence.
 });
}
export function combineDecision(matches:Rule[]){
 if(matches.some(r=>r.action==='BLOCK'))return 'BLOCKED' as const;
 if(matches.some(r=>r.action==='REQUIRE_APPROVAL'))return 'APPROVAL_REQUIRED' as const;
 if(matches.some(r=>r.action==='WARN'))return 'WARNING' as const;
 return 'NO_RESTRICTION' as const;
}
async function readBudgets(db:pg.PoolClient,wid:string,id?:string){
 const result=await db.query<{id:string;name:string;currency:string;starts_on:string;ends_on:string;
 amount_minor:string;status:string;version:number}>(`SELECT id,name,currency,starts_on::text,ends_on::text,amount_minor::text,
 status,version FROM budgets WHERE workspace_id=$1 AND ($2::uuid IS NULL OR id=$2::uuid)
 ORDER BY created_at DESC,id DESC LIMIT 80`,[wid,id??null]);
 const budgets=result.rows;
 if(!budgets.length)return [];
 const allocations=await db.query<{budget_id:string;category_id:string;category_name:string;limit_minor:string;
 rollover:boolean;spent_minor:string}>(`
 SELECT a.budget_id,a.category_id,c.name AS category_name,a.limit_minor::text,a.rollover,
 COALESCE(SUM(CASE
  WHEN j.status='POSTED' AND j.effective_on BETWEEN b.starts_on AND b.ends_on
    AND m.kind='EXPENSE' THEN -m.amount_minor
  WHEN j.status='POSTED' AND j.effective_on BETWEEN b.starts_on AND b.ends_on
    AND m.kind='REVERSAL' AND original.kind='EXPENSE' THEN -m.amount_minor
  ELSE 0 END),0)::text AS spent_minor
 FROM budget_allocations a JOIN budgets b ON b.workspace_id=a.workspace_id AND b.id=a.budget_id
 JOIN financial_categories c ON c.workspace_id=a.workspace_id AND c.id=a.category_id
 LEFT JOIN manual_transactions m ON m.workspace_id=a.workspace_id AND m.category_id=a.category_id AND m.currency=b.currency
 LEFT JOIN journal_entries j ON j.workspace_id=m.workspace_id AND j.id=m.entry_id
 LEFT JOIN manual_transactions original ON original.workspace_id=m.workspace_id AND original.id=m.reverses_transaction_id
 WHERE a.workspace_id=$1 AND ($2::uuid IS NULL OR a.budget_id=$2::uuid)
 GROUP BY a.budget_id,a.category_id,c.name,a.limit_minor,a.rollover
 ORDER BY c.name,a.category_id`,[wid,id??null]);
 return budgets.map(b=>{
  const list=allocations.rows.filter(x=>x.budget_id===b.id).map(a=>({
   categoryId:a.category_id,categoryName:a.category_name,limitMinor:n(a.limit_minor),
   spentMinor:n(a.spent_minor),remainingMinor:n(a.limit_minor)-n(a.spent_minor),
   rollover:a.rollover,sourceQuality:'MANUAL_POSTED_LEDGER'
  }));
  return {id:b.id,name:b.name,currency:b.currency,startsOn:b.starts_on,endsOn:b.ends_on,
   amountMinor:n(b.amount_minor),status:b.status,version:b.version,
   allocatedMinor:list.reduce((acc,a)=>acc+a.limitMinor,0),
   spentMinor:list.reduce((acc,a)=>acc+a.spentMinor,0),allocations:list};
 });
}
async function spendingSummary(db:pg.PoolClient,wid:string,months:number){
 const series=await db.query<{period:string;category_id:string|null;category_name:string|null;
 total_minor:string;count:string}>(`
 SELECT to_char(date_trunc('month',e.effective_on),'YYYY-MM') AS period,
 t.category_id,c.name AS category_name,
 COALESCE(SUM(CASE WHEN t.kind='EXPENSE' THEN -t.amount_minor
  WHEN t.kind='REVERSAL' AND original.kind='EXPENSE' THEN -t.amount_minor ELSE 0 END),0)::text AS total_minor,
 COUNT(*) FILTER(WHERE t.kind='EXPENSE')::text AS count
 FROM manual_transactions t JOIN journal_entries e
 ON e.workspace_id=t.workspace_id AND e.id=t.entry_id AND e.status='POSTED'
 LEFT JOIN manual_transactions original ON original.workspace_id=t.workspace_id AND original.id=t.reverses_transaction_id
 LEFT JOIN financial_categories c ON c.workspace_id=t.workspace_id AND c.id=t.category_id
 WHERE t.workspace_id=$1 AND t.currency='KES'
 AND e.effective_on>=date_trunc('month',current_date)-($2::int-1)*interval '1 month'
 AND e.effective_on<date_trunc('month',current_date)+interval '1 month'
 GROUP BY 1,t.category_id,c.name ORDER BY 1 DESC,3,2`,[wid,months]);
 const byMonth=new Map<string,number>(),byCategory=new Map<string,{categoryId:string;name:string;netSpentMinor:number;transactionCount:number}>();
 for(const r of series.rows){
  const value=n(r.total_minor);byMonth.set(r.period,(byMonth.get(r.period)||0)+value);
  if(r.category_id){
   const row=byCategory.get(r.category_id)||{categoryId:r.category_id,name:r.category_name||'Uncategorized',netSpentMinor:0,transactionCount:0};
   row.netSpentMinor+=value;row.transactionCount+=n(r.count);byCategory.set(r.category_id,row);
  }
 }
 const recurring=await db.query<{description:string;occurrences:string;total_minor:string}>(`
 SELECT lower(trim(t.description)) AS description,count(*)::text AS occurrences,
 SUM(-t.amount_minor)::text AS total_minor
 FROM manual_transactions t JOIN journal_entries e ON e.workspace_id=t.workspace_id AND e.id=t.entry_id
 WHERE t.workspace_id=$1 AND t.kind='EXPENSE' AND t.currency='KES' AND e.status='POSTED'
 AND e.effective_on>=current_date-interval '90 days'
 GROUP BY lower(trim(t.description)) HAVING count(*)>=3
 ORDER BY count(*) DESC,SUM(-t.amount_minor) DESC LIMIT 10`,[wid]);
 return {currency:'KES',sourceQuality:'MANUAL_POSTED_LEDGER',isProviderVerified:false,
  asOf:new Date().toISOString(),months,
  monthlyTotals:[...byMonth].map(([period,netSpentMinor])=>({period,netSpentMinor})),
  categories:[...byCategory.values()].sort((a,b)=>b.netSpentMinor-a.netSpentMinor),
  potentialRecurringDescriptions:recurring.rows.map(r=>({description:r.description,
   occurrences:n(r.occurrences),recordedGrossMinor:n(r.total_minor),classification:'REVIEW_SUGGESTION_NOT_CONFIRMED_SUBSCRIPTION'})),
  limitations:['Descriptions are user-entered and cannot prove subscriptions','No bank feed or verified merchant identity','Reversals may appear in later months']};
}
async function fetchApproval(db:pg.PoolClient,wid:string,id?:string){
 const rows=await db.query<{id:string;guardrail_id:string|null;category_id:string|null;reference:string;amount_minor:string;
 currency:string;requested_by:string;decided_by:string|null;status:string;created_at:Date;decided_at:Date|null}>(`
 SELECT id,guardrail_id,category_id,reference,amount_minor::text,currency,
 requested_by,decided_by,status,created_at,decided_at
 FROM approval_requests WHERE workspace_id=$1 AND ($2::uuid IS NULL OR id=$2::uuid)
 ORDER BY created_at DESC,id DESC LIMIT 100`,[wid,id??null]);
 return rows.rows.map(x=>({
  id:x.id,guardrailId:x.guardrail_id,categoryId:x.category_id,reference:x.reference,
  amountMinor:n(x.amount_minor),currency:x.currency,requestedBy:x.requested_by,
  decidedBy:x.decided_by,status:x.status,createdAt:x.created_at,decidedAt:x.decided_at
 }));
}
export function installB2Routes(app:FastifyInstance,finance:pg.Pool,identity:IdentityResolver){
 const scopedB2=<T>(request:FastifyRequest,mode:'read'|'write',fn:(db:pg.PoolClient,actor:AuthIdentity)=>Promise<T>)=>
  scoped(request,finance,identity,mode,fn);
 app.get('/v1/workspaces/:workspaceId/budgets',async(request)=>{
  const budgets=await scopedB2(request,'read',db=>readBudgets(db,params(request).workspaceId));
  return list(budgets);
 });
 app.post('/v1/workspaces/:workspaceId/budgets',async(request,reply)=>{
  const body=parse(budgetSchema,request.body),key=headerIdempotency(request);
  const result=await scopedB2(request,'write',async(db,actor)=>{
   const wid=params(request).workspaceId,idem=await reserve(db,wid,key,'budget.create',body);
   if(!idem.fresh){const old=await readBudgets(db,wid,idem.resultId!);
    if(!old[0])throw new DomainError(409,'REPLAY_MISSING','Previously created budget missing');
    return {...old[0],replayed:true};
   }
   const valid=await db.query<{id:string}>(`SELECT id FROM financial_categories
     WHERE workspace_id=$1 AND kind='EXPENSE' AND id=ANY($2::uuid[])`,
    [wid,body.allocations.map(a=>a.categoryId)]);
   if(valid.rowCount!==body.allocations.length)throw new DomainError(422,'INVALID_BUDGET_CATEGORY','Expense categories must belong to workspace');
   const b=(await db.query<{id:string}>(`INSERT INTO budgets(workspace_id,name,currency,starts_on,ends_on,amount_minor)
      VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
    [wid,body.name,body.currency,body.startsOn,body.endsOn,body.amountMinor])).rows[0]!;
   for(const a of body.allocations)await db.query(`INSERT INTO budget_allocations(workspace_id,budget_id,category_id,limit_minor,rollover)
    VALUES($1,$2,$3,$4,false)`,[wid,b.id,a.categoryId,a.limitMinor]);
   await audit(db,wid,actor,'budget.created','budget',b.id,request);
   await finish(db,idem.id,b.id);
   return (await readBudgets(db,wid,b.id))[0]!;
  });
  return reply.code('replayed' in result?200:201).send(result);
 });
 app.post('/v1/workspaces/:workspaceId/budgets/:budgetId/activate',async(request,reply)=>{
  const {workspaceId:wid,budgetId}=params(request),key=headerIdempotency(request);
  const id=parse(uuid,budgetId);
  const result=await scopedB2(request,'write',async(db,actor)=>{
   const idem=await reserve(db,wid,key,'budget.activate',{id});
   if(!idem.fresh){
    const old=await readBudgets(db,wid,idem.resultId!);
    if(!old[0])throw new DomainError(409,'REPLAY_MISSING','Budget missing');
    return {...old[0],replayed:true};
   }
   const rows=await db.query<{id:string}>(`UPDATE budgets SET status='ACTIVE',version=version+1
     WHERE workspace_id=$1 AND id=$2 AND status='DRAFT' RETURNING id`,[wid,id]);
   if(!rows.rowCount)throw new DomainError(409,'BUDGET_STATE','Only an existing DRAFT budget can be activated');
   // Database deferred trigger checks same-category active overlap and total allocations at COMMIT.
   await audit(db,wid,actor,'budget.activated','budget',id,request);await finish(db,idem.id,id);
   return (await readBudgets(db,wid,id))[0]!;
  });return reply.code('replayed' in result?200:201).send(result);
 });
 app.post('/v1/workspaces/:workspaceId/budgets/:budgetId/archive',async(request,reply)=>{
  const {workspaceId:wid,budgetId}=params(request),id=parse(uuid,budgetId),key=headerIdempotency(request);
  const result=await scopedB2(request,'write',async(db,actor)=>{
   const idem=await reserve(db,wid,key,'budget.archive',{id});
   if(!idem.fresh){const old=await readBudgets(db,wid,idem.resultId!);
    if(!old[0])throw new DomainError(409,'REPLAY_MISSING','Budget missing');
    return {...old[0],replayed:true};}
   const changed=await db.query(`UPDATE budgets SET status='ARCHIVED',version=version+1
     WHERE workspace_id=$1 AND id=$2 AND status='ACTIVE' RETURNING id`,[wid,id]);
   if(!changed.rowCount)throw new DomainError(409,'BUDGET_STATE','Only an ACTIVE budget can be archived');
   await audit(db,wid,actor,'budget.archived','budget',id,request);
   await finish(db,idem.id,id);
   return (await readBudgets(db,wid,id))[0]!;
  });return reply.code('replayed' in result?200:201).send(result);
 });
 app.get('/v1/workspaces/:workspaceId/spending/insights',async(request)=>{
  const q=request.query as {months?:string};
  const months=Number(q?.months??6);
  if(!Number.isInteger(months)||months<1||months>12)throw new DomainError(422,'INVALID_PERIOD','Months must be 1–12');
  return scopedB2(request,'read',db=>spendingSummary(db,params(request).workspaceId,months));
 });
 app.get('/v1/workspaces/:workspaceId/spending/guardrails',async(request)=>{
  const items=await scopedB2(request,'read',db=>readRules(db,params(request).workspaceId));return list(items);
 });
 app.post('/v1/workspaces/:workspaceId/spending/guardrails',async(request,reply)=>{
  const body=parse(guardrailSchema,request.body),key=headerIdempotency(request);
  const result=await scopedB2(request,'write',async(db,actor)=>{
   const wid=params(request).workspaceId,idem=await reserve(db,wid,key,'guardrail.create',body);
   if(!idem.fresh){
    const row=(await readRules(db,wid)).find(r=>r.id===idem.resultId);
    if(!row)throw new DomainError(409,'REPLAY_MISSING','Guardrail missing');
    return {...row,replayed:true};
   }
   if(body.kind==='CATEGORY'){
    const cat=await db.query(`SELECT id FROM financial_categories WHERE workspace_id=$1 AND kind='EXPENSE' AND id=$2`,[wid,body.categoryId]);
    if(!cat.rowCount)throw new DomainError(422,'INVALID_CATEGORY','Expense category not in workspace');
   }
   const conditions=body.kind==='AMOUNT'?{minAmountMinor:body.minAmountMinor}:{categoryId:body.categoryId};
   const row=(await db.query<{id:string}>(`INSERT INTO spending_guardrails
     (workspace_id,name,kind,conditions,action) VALUES($1,$2,$3,$4::jsonb,$5) RETURNING id`,
    [wid,body.name,body.kind,JSON.stringify(conditions),body.action])).rows[0]!;
   await audit(db,wid,actor,'guardrail.created','spending_guardrail',row.id,request);await finish(db,idem.id,row.id);
   return (await readRules(db,wid)).find(r=>r.id===row.id)!;
  });return reply.code('replayed' in result?200:201).send(result);
 });
 app.post('/v1/workspaces/:workspaceId/spending/guardrails/:guardrailId/deactivate',async(request,reply)=>{
  const wid=params(request).workspaceId,id=parse(uuid,(request.params as {guardrailId:string}).guardrailId);
  const key=headerIdempotency(request);
  const result=await scopedB2(request,'write',async(db,actor)=>{
   const idem=await reserve(db,wid,key,'guardrail.deactivate',{id});
   if(!idem.fresh)return {id,active:false,replayed:true};
   const changed=await db.query(`UPDATE spending_guardrails SET active=false,version=version+1
     WHERE workspace_id=$1 AND id=$2 AND active=true RETURNING id,version`,[wid,id]);
   if(!changed.rowCount)throw new DomainError(409,'GUARDRAIL_STATE','Guardrail must be active and actor must be owner/admin');
   await audit(db,wid,actor,'guardrail.deactivated','spending_guardrail',id,request);
   await finish(db,idem.id,id);
   return {id,active:false,version:changed.rows[0]!.version};
  });return reply.code('replayed' in result?200:201).send(result);
 });
 app.post('/v1/workspaces/:workspaceId/spending/purchase-checks',async(request)=>{
  const body=parse(purchaseSchema,request.body);
  return scopedB2(request,'read',async db=>{
   const wid=params(request).workspaceId;
   const valid=await db.query(`SELECT id FROM financial_categories WHERE workspace_id=$1 AND kind='EXPENSE' AND id=$2`,
    [wid,body.categoryId]);
   if(!valid.rowCount)throw new DomainError(422,'INVALID_CATEGORY','Expense category does not belong to the workspace');
   const rules=await readRules(db,wid);
   if(rules.some(r=>!['AMOUNT','CATEGORY'].includes(r.kind)&&['BLOCK','REQUIRE_APPROVAL'].includes(r.action)))
    throw new DomainError(409,'UNSUPPORTED_ACTIVE_POLICY','Workspace has an unevaluable legacy policy. Resolve it before posting.');
   const matches=matchingRules(rules,body);
   const budgets=await readBudgets(db,wid);
   const flags=budgets.filter(b=>b.status==='ACTIVE'&&b.currency===body.currency&&
     b.startsOn<=new Date().toISOString().slice(0,10)&&b.endsOn>=new Date().toISOString().slice(0,10))
    .flatMap(b=>b.allocations.filter(a=>a.categoryId===body.categoryId).map(a=>({
     budgetId:b.id,limitMinor:a.limitMinor,alreadySpentMinor:a.spentMinor,
     proposedAmountMinor:body.amountMinor,wouldExceed:a.spentMinor+body.amountMinor>a.limitMinor
    })));
   return {decision:combineDecision(matches),rules:matches.map(r=>({id:r.id,name:r.name,action:r.action,kind:r.kind})),
    budgetWarnings:flags,advisoryOnly:true,fundsMoved:false,paymentAuthorized:false,sourceQuality:'MANUAL_POSTED_LEDGER',
    note:'Not an actual purchase authorization, bank payment, card block or guaranteed safe-to-spend amount.'};
  });
 });
 app.get('/v1/workspaces/:workspaceId/spending/approvals',async(request)=>{
  const rows=await scopedB2(request,'read',db=>fetchApproval(db,params(request).workspaceId));return list(rows);
 });
 app.post('/v1/workspaces/:workspaceId/spending/approvals',async(request,reply)=>{
  const body=parse(requestSchema,request.body),key=headerIdempotency(request);
  const result=await scopedB2(request,'write',async(db,actor)=>{
   const wid=params(request).workspaceId,idem=await reserve(db,wid,key,'approval.request',body);
   if(!idem.fresh){const old=await fetchApproval(db,wid,idem.resultId!);
    if(!old[0])throw new DomainError(409,'REPLAY_MISSING','Approval request missing');
    return {...old[0],replayed:true};}
   const rules=matchingRules(await readRules(db,wid),body);
   const required=rules.find(r=>r.id===body.guardrailId&&r.action==='REQUIRE_APPROVAL');
   if(!required)throw new DomainError(422,'APPROVAL_RULE_NOT_MATCHED','Active approval guardrail must match category or amount');
   const cat=await db.query(`SELECT id FROM financial_categories WHERE workspace_id=$1 AND id=$2 AND kind='EXPENSE'`,
     [wid,body.categoryId]);if(!cat.rowCount)throw new DomainError(422,'INVALID_CATEGORY','Expense category missing');
   const row=(await db.query<{id:string}>(`INSERT INTO approval_requests
      (workspace_id,guardrail_id,category_id,requested_by,reference,amount_minor,currency)
       VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [wid,body.guardrailId,body.categoryId,actor.id,body.reference,body.amountMinor,body.currency])).rows[0]!;
   await audit(db,wid,actor,'approval.requested','approval_request',row.id,request);
   await finish(db,idem.id,row.id);
   return (await fetchApproval(db,wid,row.id))[0]!;
  });return reply.code('replayed' in result?200:201).send(result);
 });
 app.post('/v1/workspaces/:workspaceId/spending/approvals/:requestId/decision',async(request,reply)=>{
  const id=parse(uuid,params(request).requestId),body=parse(decisionSchema,request.body),key=headerIdempotency(request);
  const result=await scopedB2(request,'write',async(db,actor)=>{
   const wid=params(request).workspaceId,idem=await reserve(db,wid,key,'approval.decision',{id,...body});
   if(!idem.fresh){const old=await fetchApproval(db,wid,idem.resultId!);
    if(!old[0])throw new DomainError(409,'REPLAY_MISSING','Decision missing');
    return {...old[0],replayed:true};}
   const role=await db.query<{role:string}>(`SELECT role FROM workspace_members
     WHERE workspace_id=$1 AND user_id=$2 AND status='ACTIVE'`,[wid,actor.id]);
   if(!['OWNER','ADMIN'].includes(role.rows[0]?.role||''))throw new DomainError(403,'APPROVER_ROLE_REQUIRED','Only independent OWNER or ADMIN can decide');
   const row=await db.query<{id:string}>(`UPDATE approval_requests
     SET status=$3,decided_by=$4,decided_at=now()
     WHERE workspace_id=$1 AND id=$2 AND status='PENDING' AND requested_by<>$4 RETURNING id`,
     [wid,id,body.decision,actor.id]);
   if(!row.rowCount)throw new DomainError(409,'APPROVAL_NOT_PENDING','Request not pending or self-approval forbidden');
   await audit(db,wid,actor,'approval.decided','approval_request',id,request);
   await finish(db,idem.id,id);
   return (await fetchApproval(db,wid,id))[0]!;
  });return reply.code('replayed' in result?200:201).send(result);
 });
}
