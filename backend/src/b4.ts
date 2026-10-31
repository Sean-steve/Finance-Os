import type {FastifyInstance,FastifyRequest} from 'fastify';
import type pg from 'pg';
import {z} from 'zod';
import {DomainError,type AuthIdentity} from './auth.js';
import {scoped,reserve,finish,audit,headerIdempotency,type IdentityResolver} from './finance.js';
import {indicativeForecast} from './b3.js';

const uuid=z.string().uuid(),kes=z.literal('KES');
const positive=z.number().int().safe().min(1).max(1_000_000_000_000);
const signed=z.number().int().safe().min(-1_000_000_000_000).max(1_000_000_000_000).refine(n=>n!==0);
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s+'T00:00:00Z').toISOString().startsWith(s));
const bucketSchema=z.object({name:z.string().trim().min(2).max(150),
 purpose:z.enum(['ESSENTIALS','SAVINGS','EMERGENCY','INVESTMENT','DISCRETIONARY','OTHER']),
 priority:z.number().int().min(1).max(5),currency:kes}).strict();
const goalSchema=z.object({name:z.string().trim().min(2).max(150),
 kind:z.enum(['SAVINGS','EMERGENCY']),targetMinor:positive,currency:kes,
 dueOn:day.nullable().optional().default(null),
 monthlyEssentialMinor:positive.nullable().optional().default(null)}).strict()
 .refine(g=>g.kind==='EMERGENCY'?g.monthlyEssentialMinor!==null:g.monthlyEssentialMinor===null);
const target=z.object({targetKind:z.enum(['BUCKET','GOAL']),targetId:uuid}).strict();
const allocationSchema=target.extend({amountMinor:signed,note:z.string().trim().min(3).max(500),
 approvalRequestId:uuid.nullable().optional().default(null)}).strict();
const requestSchema=target.extend({amountMinor:positive,rationale:z.string().trim().min(3).max(500),currency:kes}).strict();
const decisionSchema=z.object({decision:z.enum(['APPROVED','REJECTED'])}).strict();
export const scenarioSchema=z.object({name:z.string().trim().min(3).max(150),
 horizonMonths:z.number().int().min(1).max(24),currency:kes,
 monthlyIncomeMinor:z.number().int().safe().min(0).max(1_000_000_000_000),
 monthlyExpenseMinor:z.number().int().safe().min(0).max(1_000_000_000_000),
 monthlySavingsMinor:z.number().int().safe().min(0).max(1_000_000_000_000),
 oneTimePurchaseMinor:z.number().int().safe().min(0).max(1_000_000_000_000),
 incomeShockBasisPoints:z.number().int().min(-10000).max(10000),
 expenseShockBasisPoints:z.number().int().min(-10000).max(20000)}).strict();
const purchaseSchema=z.object({purchaseAmountMinor:positive,monthlyPaymentMinor:
 z.number().int().safe().min(0).max(1_000_000_000_000).optional().default(0)}).strict();
const parse=<S extends z.ZodTypeAny>(schema:S,value:unknown):z.infer<S>=>{
 const x=schema.safeParse(value);
 if(!x.success)throw new DomainError(422,'VALIDATION_ERROR','Invalid capital planning fields or unsupported currency');
 return x.data;
};
const money=(x:unknown):number=>{const n=Number(x);
 if(!Number.isSafeInteger(n))throw new DomainError(422,'MONEY_RANGE','Planning amount exceeds safe minor units');
 return n;};
const p=(r:FastifyRequest)=>r.params as {workspaceId:string;bucketId?:string;goalId?:string;requestId?:string;scenarioId?:string};
const wid=(r:FastifyRequest)=>p(r).workspaceId;
const table=(kind:'BUCKET'|'GOAL')=>kind==='BUCKET'?'money_buckets':'savings_goals';
const fk=(kind:'BUCKET'|'GOAL')=>kind==='BUCKET'?'bucket_id':'goal_id';
type Group={id:string;name:string;status:string;currency:string;created_at:Date;
 purpose?:string;priority?:number;kind?:string;target_minor?:string;monthly_essential_minor?:string|null;
 due_on?:string|null;archived_at?:Date|null;allocated_minor:string};
async function balance(db:pg.PoolClient,w:string):Promise<number>{
 const result=await db.query<{v:string}>(`SELECT COALESCE(SUM(CASE WHEN j.status='POSTED' AND j.effective_on<=current_date
 THEN l.debit_minor-l.credit_minor ELSE 0 END),0)::text AS v
 FROM financial_accounts a JOIN ledger_accounts la ON la.workspace_id=a.workspace_id
  AND la.financial_account_id=a.id AND la.class='ASSET' AND la.currency='KES'
 JOIN journal_lines l ON l.workspace_id=la.workspace_id AND l.ledger_account_id=la.id
 JOIN journal_entries j ON j.workspace_id=l.workspace_id AND j.id=l.entry_id
 WHERE a.workspace_id=$1 AND a.currency='KES' AND a.archived_at IS NULL
  AND a.provider_status='MANUAL' AND a.kind IN ('CASH','BANK','MOBILE_MONEY')`,[w]);
 return money(result.rows[0]?.v??0);
}
async function reserved(db:pg.PoolClient,w:string):Promise<number>{
 const r=await db.query<{v:string}>('SELECT COALESCE(SUM(amount_minor),0)::text AS v FROM capital_allocations WHERE workspace_id=$1',[w]);
 return money(r.rows[0]?.v??0);
}
async function groups(db:pg.PoolClient,w:string,kind:'BUCKET'|'GOAL',id?:string){
 const r=await db.query<Group>(`SELECT t.*,COALESCE((SELECT SUM(a.amount_minor) FROM capital_allocations a
 WHERE a.workspace_id=t.workspace_id AND a.`+fk(kind)+`=t.id),0)::text AS allocated_minor
 FROM `+table(kind)+` t WHERE t.workspace_id=$1 AND ($2::uuid IS NULL OR t.id=$2::uuid)
 ORDER BY t.created_at DESC,t.id LIMIT 150`,[w,id??null]);
 return r.rows.map(x=>kind==='BUCKET'?{id:x.id,name:x.name,purpose:x.purpose,
  priority:x.priority,currency:x.currency,status:x.status,allocatedMinor:money(x.allocated_minor),
  createdAt:x.created_at,planningOnly:true}:{
  id:x.id,name:x.name,kind:x.kind,targetMinor:money(x.target_minor),currency:x.currency,
  dueOn:x.due_on,monthlyEssentialMinor:x.monthly_essential_minor===null?null:money(x.monthly_essential_minor),
  status:x.status,allocatedMinor:money(x.allocated_minor),remainingMinor:money(x.target_minor)-money(x.allocated_minor),
  emergencyCoverageMonths:x.kind==='EMERGENCY'&&x.monthly_essential_minor
   ?Number((money(x.allocated_minor)/money(x.monthly_essential_minor)).toFixed(2)):null,
  createdAt:x.created_at,planningOnly:true});
}
type FundingRow={id:string;target_kind:'BUCKET'|'GOAL';bucket_id:string|null;goal_id:string|null;
 amount_minor:string;note?:string;rationale?:string;status?:string;requested_by?:string;decided_by?:string|null;
 created_at:Date;approval_request_id?:string|null};
const allocationView=(x:FundingRow)=>({id:x.id,targetKind:x.target_kind,
 targetId:x.bucket_id??x.goal_id,amountMinor:money(x.amount_minor),
 note:x.note,approvalRequestId:x.approval_request_id,createdAt:x.created_at});
const requestView=(x:FundingRow)=>({id:x.id,targetKind:x.target_kind,targetId:x.bucket_id??x.goal_id,
 amountMinor:money(x.amount_minor),rationale:x.rationale,status:x.status,requestedBy:x.requested_by,
 decidedBy:x.decided_by,createdAt:x.created_at});
async function allocationRows(db:pg.PoolClient,w:string,id?:string){
 const r=await db.query<FundingRow>(`SELECT id,target_kind,bucket_id,goal_id,amount_minor::text,note,
 approval_request_id,created_at FROM capital_allocations WHERE workspace_id=$1
 AND ($2::uuid IS NULL OR id=$2::uuid) ORDER BY created_at DESC,id DESC LIMIT 150`,[w,id??null]);
 return r.rows.map(allocationView);
}
async function fundingRequests(db:pg.PoolClient,w:string,id?:string){
 const r=await db.query<FundingRow>(`SELECT id,target_kind,bucket_id,goal_id,amount_minor::text,rationale,
 status,requested_by,decided_by,created_at FROM capital_funding_requests WHERE workspace_id=$1
 AND ($2::uuid IS NULL OR id=$2::uuid) ORDER BY created_at DESC,id DESC LIMIT 150`,[w,id??null]);
 return r.rows.map(requestView);
}
async function validateTarget(db:pg.PoolClient,w:string,kind:'BUCKET'|'GOAL',id:string){
 const rows=await db.query<{id:string;status:string;target_minor?:string}>(
 'SELECT id,status,'+(kind==='GOAL'?'target_minor::text':'NULL::text')+' AS target_minor FROM '+table(kind)+
 ' WHERE workspace_id=$1 AND id=$2',[w,id]);
 const row=rows.rows[0];if(!row||row.status!=='ACTIVE')
  throw new DomainError(422,'TARGET_NOT_ACTIVE','Planning bucket or goal must be active in this workspace');
 return row;
}
async function lock(db:pg.PoolClient,w:string){
 await db.query("SELECT pg_advisory_xact_lock(hashtext('finance-b4:'||$1::text))",[w]);
}
async function summary(db:pg.PoolClient,w:string){
 const [cash,envelopes,buckets,goals]=await Promise.all([
  balance(db,w),reserved(db,w),groups(db,w,'BUCKET'),groups(db,w,'GOAL')]);
 return {currency:'KES',asOf:new Date().toISOString().slice(0,10),
  manualPostedLiquidityMinor:cash,virtualReservedMinor:envelopes,unassignedMinor:money(cash-envelopes),
  unassignedNegative:cash-envelopes<0,buckets,goals,
  sourceQuality:'POSTED_MANUAL_LEDGER_AND_VIRTUAL_PLANNING',
  isProviderVerified:false,fundsMoved:false,isBankReservation:false,
  notes:['Virtual assignments do not transfer or protect cash','Later posted expenses can make reserves exceed available manual liquidity',
   'Bills, debts and provider balances may differ from manual records']};
}
export type ScenarioAssumptions=z.infer<typeof scenarioSchema>;
export function computeScenario(opening:number,input:ScenarioAssumptions){
 const safeB=(v:bigint)=>{if(v>BigInt(Number.MAX_SAFE_INTEGER)||v<BigInt(Number.MIN_SAFE_INTEGER))
  throw new DomainError(422,'SCENARIO_OVERFLOW','Scenario calculations exceed safe minor units');
  return Number(v);};
 const multiply=(n:number,bp:number)=>BigInt(n)*BigInt(bp)/10000n;
 let cash=BigInt(opening),discretionary=BigInt(opening);
 const months=[];
 const inflow=multiply(input.monthlyIncomeMinor,10000+input.incomeShockBasisPoints);
 const outflow=multiply(input.monthlyExpenseMinor,10000+input.expenseShockBasisPoints);
 for(let month=1;month<=input.horizonMonths;month++){
  const purchase=month===1?BigInt(input.oneTimePurchaseMinor):0n;
  cash=cash+inflow-outflow-purchase;
  discretionary=discretionary+inflow-outflow-purchase-BigInt(input.monthlySavingsMinor);
  months.push({month,incomeMinor:safeB(inflow),expensesMinor:safeB(outflow),
   oneTimePurchaseMinor:safeB(purchase),plannedSavingsMinor:input.monthlySavingsMinor,
   cashAfterExpensesMinor:safeB(cash),discretionaryAfterPlannedSavingsMinor:safeB(discretionary)});
 }
 return {openingManualMinor:opening,currency:'KES',months,
  endingCashAfterExpensesMinor:safeB(cash),
  endingDiscretionaryAfterPlannedSavingsMinor:safeB(discretionary),
  savingsAreVirtual:true,fundsMoved:false,providerVerified:false,
  note:'Deterministic user-defined what-if scenario; not actual income, investment returns, money movement or financial advice'};
}
export function installB4Routes(app:FastifyInstance,finance:pg.Pool,identity:IdentityResolver){
 const run=<T>(r:FastifyRequest,mode:'read'|'write',cb:(db:pg.PoolClient,actor:AuthIdentity)=>Promise<T>)=>
  scoped(r,finance,identity,mode,cb);
 app.get('/v1/workspaces/:workspaceId/capital/summary',async r=>run(r,'read',db=>summary(db,wid(r))));
 for(const kind of ['BUCKET','GOAL'] as const){
  const endpoint=kind==='BUCKET'?'money-buckets':'savings-goals';
  const schema=kind==='BUCKET'?bucketSchema:goalSchema;
  app.get('/v1/workspaces/:workspaceId/'+endpoint,async r=>{
   const items=await run(r,'read',db=>groups(db,wid(r),kind));return {items,nextCursor:null};
  });
  app.post('/v1/workspaces/:workspaceId/'+endpoint,async(r,reply)=>{
   const b=parse(schema,r.body),key=headerIdempotency(r);
   const item=await run(r,'write',async(db,actor)=>{
    const w=wid(r),idem=await reserve(db,w,key,'b4.'+endpoint+'.create',b);
    if(!idem.fresh){const old=(await groups(db,w,kind,idem.resultId!))[0];
     if(!old)throw new DomainError(409,'REPLAY_MISSING','Planning record not found');return {...old,replayed:true};}
    let created:{id:string};
    if(kind==='BUCKET'){
     const x=b as z.infer<typeof bucketSchema>;
     created=(await db.query<{id:string}>(`INSERT INTO money_buckets(workspace_id,name,purpose,priority,currency,created_by)
      VALUES($1,$2,$3,$4,'KES',$5) RETURNING id`,[w,x.name,x.purpose,x.priority,actor.id])).rows[0]!;
    }else{
     const x=b as z.infer<typeof goalSchema>;
     created=(await db.query<{id:string}>(`INSERT INTO savings_goals(workspace_id,name,kind,target_minor,
      monthly_essential_minor,due_on,currency,created_by)
      VALUES($1,$2,$3,$4,$5,$6,'KES',$7) RETURNING id`,
      [w,x.name,x.kind,x.targetMinor,x.monthlyEssentialMinor,x.dueOn,actor.id])).rows[0]!;
    }
    await audit(db,w,actor,'b4.'+endpoint+'.created',kind.toLowerCase(),created.id,r);
    await finish(db,idem.id,created.id);return (await groups(db,w,kind,created.id))[0]!;
   });
   return reply.code('replayed' in item?200:201).send(item);
  });
  app.post('/v1/workspaces/:workspaceId/'+endpoint+'/:'+(kind==='BUCKET'?'bucketId':'goalId')+'/archive',async(r,reply)=>{
   const id=parse(uuid,kind==='BUCKET'?p(r).bucketId:p(r).goalId),key=headerIdempotency(r);
   const item=await run(r,'write',async(db,actor)=>{
    const w=wid(r),idem=await reserve(db,w,key,'b4.'+endpoint+'.archive',{id});
    if(!idem.fresh){const old=(await groups(db,w,kind,idem.resultId!))[0];
     if(!old)throw new DomainError(409,'REPLAY_MISSING','Record not found');return {...old,replayed:true};}
    await lock(db,w);
    const funded=(await db.query<{v:string}>('SELECT COALESCE(SUM(amount_minor),0)::text AS v FROM capital_allocations WHERE workspace_id=$1 AND '+fk(kind)+'=$2',[w,id])).rows[0]!;
    if(money(funded.v)!==0)throw new DomainError(409,'RELEASE_FIRST','Release all virtual funds before archival');
    const updated=await db.query('UPDATE '+table(kind)+" SET status='ARCHIVED',archived_at=now() WHERE workspace_id=$1 AND id=$2 AND status='ACTIVE' RETURNING id",[w,id]);
    if(!updated.rowCount)throw new DomainError(409,'NOT_ACTIVE','Planning target is already archived or missing');
    await audit(db,w,actor,'b4.'+endpoint+'.archived',kind.toLowerCase(),id,r);
    await finish(db,idem.id,id);return (await groups(db,w,kind,id))[0]!;
   });
   return reply.code('replayed' in item?200:201).send(item);
  });
 }
 app.get('/v1/workspaces/:workspaceId/capital/allocations',async r=>{
  const items=await run(r,'read',db=>allocationRows(db,wid(r)));return {items,nextCursor:null};
 });
 app.post('/v1/workspaces/:workspaceId/capital/allocations',async(r,reply)=>{
  const body=parse(allocationSchema,r.body),key=headerIdempotency(r);
  const item=await run(r,'write',async(db,actor)=>{
   const w=wid(r),idem=await reserve(db,w,key,'b4.capital.assign',body);
   if(!idem.fresh){const old=(await allocationRows(db,w,idem.resultId!))[0];
    if(!old)throw new DomainError(409,'REPLAY_MISSING','Allocation missing');return {...old,replayed:true};}
   await lock(db,w);
   const t=await validateTarget(db,w,body.targetKind,body.targetId);
   const current=(await db.query<{v:string}>('SELECT COALESCE(SUM(amount_minor),0)::text AS v FROM capital_allocations WHERE workspace_id=$1 AND '+fk(body.targetKind)+'=$2',[w,body.targetId])).rows[0]!;
   const after=money(money(current.v)+body.amountMinor);
   if(after<0)throw new DomainError(422,'OVER_RELEASE','Cannot release more virtual funds than assigned');
   if(body.targetKind==='GOAL'&&after>money(t.target_minor))throw new DomainError(422,'TARGET_EXCEEDED','Goal funding exceeds its target');
   if(body.amountMinor>0){
    const cash=await balance(db,w),sum=await reserved(db,w);
    if(money(sum+body.amountMinor)>Math.max(0,cash))
     throw new DomainError(409,'INSUFFICIENT_MANUAL_LIQUIDITY','Posted manual liquidity does not support this virtual assignment');
   }
   if(body.amountMinor<0&&body.approvalRequestId)
    throw new DomainError(422,'UNEXPECTED_APPROVAL','Releases cannot consume approval requests');
   if(body.amountMinor>0&&after>10000000&&!body.approvalRequestId)
    throw new DomainError(403,'INDEPENDENT_APPROVAL_REQUIRED','Target above KES 100,000 requires independent approval');
   if(body.approvalRequestId){
    const req=(await db.query<{target_kind:string;bucket_id:string|null;goal_id:string|null;amount_minor:string;
     requested_by:string;status:string}>(`SELECT target_kind,bucket_id,goal_id,amount_minor::text,requested_by,status
       FROM capital_funding_requests WHERE workspace_id=$1 AND id=$2`,[w,body.approvalRequestId])).rows[0];
    if(!req||req.status!=='APPROVED'||req.requested_by!==actor.id||
       req.target_kind!==body.targetKind||money(req.amount_minor)!==body.amountMinor||
       (req.bucket_id??req.goal_id)!==body.targetId)
     throw new DomainError(403,'APPROVAL_MISMATCH','Approval must belong to requester, target and exact amount');
   }
   const row=(await db.query<{id:string}>(`INSERT INTO capital_allocations
    (workspace_id,target_kind,bucket_id,goal_id,amount_minor,currency,note,approval_request_id,created_by)
    VALUES($1,$2,$3,$4,$5,'KES',$6,$7,$8) RETURNING id`,
    [w,body.targetKind,body.targetKind==='BUCKET'?body.targetId:null,
     body.targetKind==='GOAL'?body.targetId:null,body.amountMinor,body.note,body.approvalRequestId,actor.id])).rows[0]!;
   await audit(db,w,actor,'b4.capital.allocation_recorded','planning_allocation',row.id,r);
   await finish(db,idem.id,row.id);return (await allocationRows(db,w,row.id))[0]!;
  });
  return reply.code('replayed' in item?200:201).send(item);
 });
 app.get('/v1/workspaces/:workspaceId/capital/requests',async r=>{
  const items=await run(r,'read',db=>fundingRequests(db,wid(r)));return {items,nextCursor:null};
 });
 app.post('/v1/workspaces/:workspaceId/capital/requests',async(r,reply)=>{
  const b=parse(requestSchema,r.body),key=headerIdempotency(r);
  const item=await run(r,'write',async(db,actor)=>{
   const w=wid(r),idem=await reserve(db,w,key,'b4.funding.request',b);
   if(!idem.fresh){const old=(await fundingRequests(db,w,idem.resultId!))[0];
    if(!old)throw new DomainError(409,'REPLAY_MISSING','Funding request missing');return {...old,replayed:true};}
   await validateTarget(db,w,b.targetKind,b.targetId);
   const created=(await db.query<{id:string}>(`INSERT INTO capital_funding_requests
     (workspace_id,target_kind,bucket_id,goal_id,amount_minor,currency,rationale,requested_by)
     VALUES($1,$2,$3,$4,$5,'KES',$6,$7) RETURNING id`,[w,b.targetKind,
     b.targetKind==='BUCKET'?b.targetId:null,b.targetKind==='GOAL'?b.targetId:null,
     b.amountMinor,b.rationale,actor.id])).rows[0]!;
   await audit(db,w,actor,'b4.funding.requested','funding_request',created.id,r);
   await finish(db,idem.id,created.id);return (await fundingRequests(db,w,created.id))[0]!;
  });
  return reply.code('replayed' in item?200:201).send(item);
 });
 app.post('/v1/workspaces/:workspaceId/capital/requests/:requestId/decision',async(r,reply)=>{
  const id=parse(uuid,p(r).requestId),body=parse(decisionSchema,r.body),key=headerIdempotency(r);
  const item=await run(r,'write',async(db,actor)=>{
   const w=wid(r),idem=await reserve(db,w,key,'b4.funding.decision',{id,...body});
   if(!idem.fresh){const old=(await fundingRequests(db,w,idem.resultId!))[0];
    if(!old)throw new DomainError(409,'REPLAY_MISSING','Decision missing');return {...old,replayed:true};}
   const role=await db.query<{role:string}>('SELECT role FROM workspace_members WHERE workspace_id=$1 AND user_id=$2 AND status=$3',[w,actor.id,'ACTIVE']);
   if(!['OWNER','ADMIN'].includes(role.rows[0]?.role??''))
    throw new DomainError(403,'APPROVER_ROLE_REQUIRED','Only independent owner or admin can approve virtual allocation');
   const changed=await db.query(`UPDATE capital_funding_requests
      SET status=$3,decided_by=$4,decided_at=now()
      WHERE workspace_id=$1 AND id=$2 AND status='PENDING' AND requested_by<>$4 RETURNING id`,
     [w,id,body.decision,actor.id]);
   if(!changed.rowCount)throw new DomainError(409,'INDEPENDENT_DECISION_REQUIRED','Self-approval or final decision rejected');
   await audit(db,w,actor,'b4.funding.decided','funding_request',id,r);
   await finish(db,idem.id,id);return (await fundingRequests(db,w,id))[0]!;
  });
  return reply.code('replayed' in item?200:201).send(item);
 });
 app.post('/v1/workspaces/:workspaceId/capital/affordability',async r=>{
  const b=parse(purchaseSchema,r.body);
  return run(r,'read',async db=>{
   const w=wid(r),snapshot=await summary(db,w),forecast=await indicativeForecast(db,w,90);
   const unassigned=snapshot.unassignedMinor;
   return {currency:'KES',purchaseAmountMinor:b.purchaseAmountMinor,monthlyPaymentMinor:b.monthlyPaymentMinor,
    manualPostedLiquidityMinor:snapshot.manualPostedLiquidityMinor,virtualReservedMinor:snapshot.virtualReservedMinor,
    unassignedMinor:unassigned,remainingAfterPurchaseMinor:money(unassigned-b.purchaseAmountMinor),
    upcoming90DayBillsUnverifiedMinor:forecast.futureObligationsMinor,
    overdueBillsUnverifiedMinor:forecast.overdueUnverifiedMinor,
    expectedIncomeUnreceivedMinor:forecast.expectedIncomeMinor,
    insufficientManualUnassigned:unassigned<b.purchaseAmountMinor,
    requiresIndependentVerification:true,advisoryOnly:true,doesNotAuthorizePurchase:true,
    fundsMoved:false,isProviderVerified:false,verdict:'CANNOT_CONFIRM_AFFORDABILITY',
    caveat:'This check excludes unrecorded obligations; it does not authorize purchases or validate bank balance'};
  });
 });
 app.get('/v1/workspaces/:workspaceId/planning/scenarios',async r=>{
  const items=await run(r,'read',async db=>{
   const rows=await db.query<{id:string;name:string;horizon_months:number;assumptions:ScenarioAssumptions;
    created_at:Date;model_version:string}>(`SELECT id,name,horizon_months,assumptions,created_at,model_version
      FROM financial_scenarios WHERE workspace_id=$1 AND model_version='B4_DETERMINISTIC_V1'
      ORDER BY created_at DESC,id DESC LIMIT 80`,[wid(r)]);
   return rows.rows.map(x=>({id:x.id,name:x.name,horizonMonths:x.horizon_months,
    assumptions:x.assumptions,createdAt:x.created_at,modelVersion:x.model_version}));
  });return {items,nextCursor:null};
 });
 app.post('/v1/workspaces/:workspaceId/planning/scenarios',async(r,reply)=>{
  const b=parse(scenarioSchema,r.body),key=headerIdempotency(r);
  const item=await run(r,'write',async(db,actor)=>{
   const w=wid(r),idem=await reserve(db,w,key,'b4.scenarios.create',b);
   if(!idem.fresh){const rows=await db.query<{id:string}>('SELECT id FROM financial_scenarios WHERE workspace_id=$1 AND id=$2',[w,idem.resultId]);
    if(!rows.rowCount)throw new DomainError(409,'REPLAY_MISSING','Scenario missing');return {id:idem.resultId,replayed:true};}
   const opening=await balance(db,w),simulation=computeScenario(opening,b);
   const created=(await db.query<{id:string}>(`INSERT INTO financial_scenarios
    (workspace_id,name,horizon_months,assumptions,base_snapshot_at,model_version,created_by,currency)
    VALUES($1,$2,$3,$4::jsonb,now(),'B4_DETERMINISTIC_V1',$5,'KES') RETURNING id`,
    [w,b.name,b.horizonMonths,JSON.stringify({...b,openingManualMinor:opening}),actor.id])).rows[0]!;
   await audit(db,w,actor,'b4.scenario.created','financial_scenario',created.id,r);
   await finish(db,idem.id,created.id);
   return {id:created.id,name:b.name,modelVersion:'B4_DETERMINISTIC_V1',simulation};
  });
  return reply.code('replayed' in item?200:201).send(item);
 });
 app.get('/v1/workspaces/:workspaceId/planning/scenarios/:scenarioId',async r=>{
  const id=parse(uuid,p(r).scenarioId);
  return run(r,'read',async db=>{
   const x=(await db.query<{id:string;name:string;assumptions:ScenarioAssumptions&{openingManualMinor:number};
    model_version:string;base_snapshot_at:Date}>(`SELECT id,name,assumptions,model_version,base_snapshot_at
     FROM financial_scenarios WHERE workspace_id=$1 AND id=$2 AND model_version='B4_DETERMINISTIC_V1'`,[wid(r),id])).rows[0];
   if(!x)throw new DomainError(404,'SCENARIO_NOT_FOUND','Workspace scenario missing');
   const {openingManualMinor,...rest}=x.assumptions;
   return {id:x.id,name:x.name,modelVersion:x.model_version,snapshotAt:x.base_snapshot_at,
    assumptions:rest,simulation:computeScenario(money(openingManualMinor),parse(scenarioSchema,rest))};
  });
 });
}
