import type {FastifyInstance,FastifyRequest} from 'fastify';
import type pg from 'pg';
import {z} from 'zod';
import {DomainError,type AuthIdentity} from './auth.js';
import {scoped,reserve,finish,audit,headerIdempotency,type IdentityResolver} from './finance.js';
import {safeMinor,sumMinor,wealthSnapshot} from './b6.js';

// B7 is rules-based financial decision support, NOT an external AI model, tax advice,
// automated bank sync, investment management, credential collection or data erasure.
const money=(v:unknown)=>safeMinor(v);
const uuid=z.string().uuid();
const settingsSchema=z.object({
 advisorEnabled:z.boolean(),analyticsSharingEnabled:z.literal(false),
 monthlyReviewDay:z.number().int().min(1).max(28),
 periodMonths:z.number().int().min(1).max(12)
}).strict();
const privacySchema=z.object({requestKind:z.enum(['EXPORT_REVIEW','ERASURE_REVIEW','ACCESS_REVIEW'])}).strict();
const integrationSchema=z.object({providerKind:z.enum(['BANK','MOBILE_MONEY','BROKER','TAX','OTHER']),
 intentKind:z.literal('REQUEST_INFORMATION')}).strict();
const reportParams=z.object({months:z.coerce.number().int().min(1).max(12).optional().default(6)}).strict();
const asDate=(v:unknown)=>v instanceof Date?v.toISOString().slice(0,10):String(v);
const parse=<T extends z.ZodTypeAny>(schema:T,body:unknown):z.infer<T>=>{
 const found=schema.safeParse(body);
 if(!found.success)throw new DomainError(422,'B7_VALIDATION','Invalid request, settings or unsupported operation');
 return found.data;
};
const wid=(request:FastifyRequest)=>(request.params as {workspaceId:string}).workspaceId;
function requireOwner(role:string){
 if(role!=='OWNER')throw new DomainError(403,'OWNER_ONLY','Only the workspace owner can manage privacy, settings and integrations');
}
async function role(db:pg.PoolClient,w:string,actor:AuthIdentity){
 const result=await db.query<{role:string}>(`SELECT role FROM workspace_members
  WHERE workspace_id=$1 AND user_id=$2 AND status='ACTIVE'`,[w,actor.id]);
 const current=result.rows[0]?.role;
 if(!current)throw new DomainError(404,'WORKSPACE_NOT_FOUND','Workspace not found');
 return current;
}
async function ownerRead<T>(r:FastifyRequest,pool:pg.Pool,identity:IdentityResolver,
 handler:(db:pg.PoolClient,actor:AuthIdentity)=>Promise<T>){
 return scoped(r,pool,identity,'read',async(db,actor)=>{
  requireOwner(await role(db,wid(r),actor));
  return handler(db,actor);
 });
}
async function ownerWrite<T>(r:FastifyRequest,pool:pg.Pool,identity:IdentityResolver,
 handler:(db:pg.PoolClient,actor:AuthIdentity)=>Promise<T>){
 return scoped(r,pool,identity,'write',async(db,actor)=>{
  requireOwner(await role(db,wid(r),actor));
  return handler(db,actor);
 });
}
async function settings(db:pg.PoolClient,w:string){
 const r=await db.query(`SELECT id,advisor_enabled,analytics_sharing_enabled,monthly_review_day,
 period_months,created_at FROM b7_settings_snapshots
 WHERE workspace_id=$1 ORDER BY created_at DESC,id DESC LIMIT 1`,[w]);
 const x=r.rows[0];
 return {id:x?.id??null,advisorEnabled:x?.advisor_enabled??false,
  analyticsSharingEnabled:false,monthlyReviewDay:x?.monthly_review_day??1,periodMonths:x?.period_months??6,
  updatedAt:x?.created_at??null,configurationSource:x?'OWNER_SNAPSHOT':'SECURE_DEFAULT',
  externalAiConfigured:false,providerSyncEnabled:false,externalAnalyticsEnabled:false};
}
type Month={month:string;incomeMinor:number;expenseMinor:number;netMinor:number;transactionCount:number};
async function monthly(db:pg.PoolClient,w:string,months:number):Promise<Month[]>{
 const r=await db.query(`WITH months AS (
 SELECT date_trunc('month',current_date)::date-(n * interval '1 month') AS first_day
 FROM generate_series(0,$2::int-1) AS n
 ), totals AS (
 SELECT date_trunc('month',t.occurred_at AT TIME ZONE 'UTC')::date AS first_day,
  SUM(CASE WHEN t.kind='INCOME' THEN t.amount_minor ELSE 0 END)::text AS income_minor,
  SUM(CASE WHEN t.kind='EXPENSE' THEN -t.amount_minor ELSE 0 END)::text AS expense_minor,
  COUNT(*)::int AS n
 FROM manual_transactions t
 JOIN journal_entries e ON e.workspace_id=t.workspace_id AND e.id=t.entry_id
 WHERE t.workspace_id=$1 AND t.currency='KES'
  AND t.kind IN ('INCOME','EXPENSE') AND e.status='POSTED' AND e.effective_on<=current_date
  AND t.occurred_at::date<=current_date
  AND date_trunc('month',t.occurred_at AT TIME ZONE 'UTC')::date >=
     (date_trunc('month',current_date)::date-($2::int-1)*interval '1 month')::date
  AND NOT EXISTS (SELECT 1 FROM manual_transactions reversal
   WHERE reversal.workspace_id=t.workspace_id AND reversal.reverses_transaction_id=t.id)
 GROUP BY 1)
 SELECT to_char(m.first_day,'YYYY-MM') AS month,
 COALESCE(t.income_minor,'0') AS income_minor,
 COALESCE(t.expense_minor,'0') AS expense_minor,
 COALESCE(t.n,0)::int AS n
 FROM months m LEFT JOIN totals t ON t.first_day=m.first_day
 ORDER BY m.first_day`,[w,months]);
 return r.rows.map(x=>{
  const incomeMinor=money(x.income_minor),expenseMinor=money(x.expense_minor);
  return {month:String(x.month),incomeMinor,expenseMinor,
   netMinor:sumMinor([incomeMinor,-expenseMinor]),transactionCount:Number(x.n)};
 });
}
async function categories(db:pg.PoolClient,w:string,months:number){
 const r=await db.query(`SELECT c.name,c.kind,
 SUM(CASE WHEN t.kind='EXPENSE' THEN -t.amount_minor ELSE t.amount_minor END)::text AS amount_minor,
 COUNT(*)::int AS record_count
 FROM manual_transactions t
 JOIN financial_categories c ON c.workspace_id=t.workspace_id AND c.id=t.category_id
 JOIN journal_entries e ON e.workspace_id=t.workspace_id AND e.id=t.entry_id
 WHERE t.workspace_id=$1 AND t.currency='KES' AND t.kind IN ('INCOME','EXPENSE')
  AND e.status='POSTED' AND e.effective_on<=current_date AND t.occurred_at::date<=current_date
  AND date_trunc('month',t.occurred_at AT TIME ZONE 'UTC')::date >=
   (date_trunc('month',current_date)::date-($2::int-1)*interval '1 month')::date
  AND NOT EXISTS(SELECT 1 FROM manual_transactions reversal
    WHERE reversal.workspace_id=t.workspace_id AND reversal.reverses_transaction_id=t.id)
 GROUP BY c.name,c.kind ORDER BY amount_minor DESC,c.name LIMIT 201`,[w,months]);
 if(r.rows.length>200)throw new DomainError(409,'REPORT_LIMIT','Category report too large to be complete');
 return r.rows.map(x=>({name:x.name,kind:x.kind,amountMinor:money(x.amount_minor),recordCount:x.record_count}));
}
export function assessHealth(series:Month[],netWorthMinor:number){
 const observations=series.reduce((s,x)=>s+x.transactionCount,0);
 const income=sumMinor(series.map(x=>x.incomeMinor));
 const expense=sumMinor(series.map(x=>x.expenseMinor));
 const net=sumMinor([income,-expense]);
 const adequate=observations>=3 && income>0;
 // No made-up 0/100 score from empty / insufficient manual data.
 const savingsRateBasisPoints=income?Number(BigInt(net)*10000n/BigInt(income)):null;
 const spendingToIncomeBps=income?Number(BigInt(expense)*10000n/BigInt(income)):null;
 const status=!adequate?'INSUFFICIENT_EVIDENCE':net<0?'RECOVERY_NEEDED':
  expense*10>income*9?'WATCH':'POSITIVE_MANUAL_CASHFLOW';
 return {status,score:null,scoreReason:'No calibrated financial-health scoring or provider verified evidence',
  incomeMinor:income,expenseMinor:expense,netCashFlowMinor:net,
  savingsRateBasisPoints,spendingToIncomeBps,
  estimatedNetWorthMinor:netWorthMinor,postedTransactionCount:observations,
  monthsCovered:series.length,monthsWithRecords:series.filter(x=>x.transactionCount>0).length,
  dataQuality:adequate?'MANUAL_POSTED_INCOMPLETE_COVERAGE':'INSUFFICIENT_MANUAL_POSTINGS',
  providerVerified:false,notFinancialAdvice:true,modelVersion:'B7_EXPLAINABLE_V1'};
}
export function advisorRules(health:ReturnType<typeof assessHealth>,advisorEnabled:boolean){
 if(!advisorEnabled)return {enabled:false,mode:'DISABLED_BY_DEFAULT',
  externalAiUsed:false,providerDataSent:false,items:[],notFinancialAdvice:true};
 const items:{code:string;priority:'INFO'|'REVIEW'|'URGENT';message:string;evidence:string}[]=[];
 const emit=(code:string,priority:'INFO'|'REVIEW'|'URGENT',message:string,evidence:string)=>
  items.push({code,priority,message,evidence});
 if(health.status==='INSUFFICIENT_EVIDENCE')
  emit('COMPLETE_RECORDS','INFO','Record more real income and expenses before drawing conclusions.',
   'Fewer than three manually posted transactions or no posted income');
 else if(health.netCashFlowMinor<0)
  emit('CASHFLOW_GAP','URGENT','Review spending and upcoming obligations against actual cash before making new commitments.',
   'Recorded expenses exceed income in the selected period');
 else if((health.savingsRateBasisPoints??0)<1000)
  emit('SMALL_BUFFER','REVIEW','Consider setting aside a realistic buffer after essential obligations.',
   'Recorded net cash flow is less than 10% of recorded income');
 else emit('REVIEW_GOALS','INFO','Consider reviewing manual savings goals against confirmed available cash.',
   'Posted manual cash flow is positive');
 if(health.estimatedNetWorthMinor<0)
  emit('NET_WORTH_REVIEW','REVIEW','Reconcile reported debts, valuations and cash balances; estimates may be incomplete.',
   'Estimated liabilities exceed estimated assets');
 return {enabled:true,mode:'EXPLAINABLE_RULES_NOT_GENERATIVE_AI',
  externalAiUsed:false,providerDataSent:false,items,notFinancialAdvice:true,
  modelVersion:'B7_RULES_V1',caveat:'Suggestions come from explicit rules and unverified or incomplete financial records; no personalized investment, credit, tax or legal advice.'};
}
const integrationCatalog=[
 {providerKind:'BANK',capability:'Bank feed',connectionStatus:'NOT_CONFIGURED',canConnect:false},
 {providerKind:'MOBILE_MONEY',capability:'Mobile money feed',connectionStatus:'NOT_CONFIGURED',canConnect:false},
 {providerKind:'BROKER',capability:'Broker holdings',connectionStatus:'NOT_CONFIGURED',canConnect:false},
 {providerKind:'TAX',capability:'Tax submissions',connectionStatus:'NOT_CONFIGURED',canConnect:false},
 {providerKind:'OTHER',capability:'Other providers',connectionStatus:'NOT_CONFIGURED',canConnect:false}
];
const list=<T>(items:T[])=>({items,nextCursor:null});
export function installB7Routes(app:FastifyInstance,finance:pg.Pool,identity:IdentityResolver){
 const view=<T>(r:FastifyRequest,handler:(db:pg.PoolClient)=>Promise<T>)=>
  scoped(r,finance,identity,'read',db=>handler(db));
 app.get('/v1/workspaces/:workspaceId/financial-health',async r=>
  view(r,async db=>{
   const m=6;
   const [series,wealth]=await Promise.all([monthly(db,wid(r),m),wealthSnapshot(db,wid(r))]);
   return {...assessHealth(series,wealth.estimatedNetWorthMinor),currency:'KES',
    cashflowSeries:series,estimatedWealthQuality:wealth.evidence};
  }));
 app.get('/v1/workspaces/:workspaceId/advisor',async r=>
  view(r,async db=>{
   const [cfg,series,wealth]=await Promise.all([settings(db,wid(r)),monthly(db,wid(r),6),wealthSnapshot(db,wid(r))]);
   return advisorRules(assessHealth(series,wealth.estimatedNetWorthMinor),cfg.advisorEnabled);
  }));
 app.get('/v1/workspaces/:workspaceId/reports/monthly',async r=>
  view(r,async db=>{
   const {months}=parse(reportParams,r.query);
   const rows=await monthly(db,wid(r),months);
   return {currency:'KES',months,periods:rows,
    totals:{incomeMinor:sumMinor(rows.map(x=>x.incomeMinor)),expenseMinor:sumMinor(rows.map(x=>x.expenseMinor)),
     netMinor:sumMinor(rows.map(x=>x.netMinor))},providerVerified:false,
    quality:'POSTED_MANUAL_KES_ONLY_EXCLUDES_REVERSALS_FUTURE',generatedAt:new Date().toISOString()};
  }));
 app.get('/v1/workspaces/:workspaceId/reports/categories',async r=>
  view(r,async db=>{
   const {months}=parse(reportParams,r.query);
   return {currency:'KES',months,...list(await categories(db,wid(r),months)),
    quality:'POSTED_MANUAL_KES_ONLY_EXCLUDES_REVERSALS_FUTURE',providerVerified:false};
  }));
 app.get('/v1/workspaces/:workspaceId/integrations/catalog',async r=>
  view(r,async()=>({items:integrationCatalog,allConnectionsActive:false,
   bankCredentialsStored:false,externalSyncConfigured:false,
   note:'No live connector; information requests are not authorizations or connections.'})));
 app.get('/v1/workspaces/:workspaceId/integrations/requests',async r=>
  ownerRead(r,finance,identity,async db=>{
   const result=await db.query(`SELECT id,provider_kind,intent_kind,connection_state,created_at
   FROM b7_integration_intents WHERE workspace_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50`,[wid(r)]);
   return list(result.rows.map(x=>({id:x.id,providerKind:x.provider_kind,intentKind:x.intent_kind,
    connectionStatus:x.connection_state,createdAt:x.created_at})));
  }));
 app.post('/v1/workspaces/:workspaceId/integrations/requests',async(r,reply)=>{
  const body=parse(integrationSchema,r.body),key=headerIdempotency(r);
  const out=await ownerWrite(r,finance,identity,async(db,actor)=>{
   const w=wid(r),idem=await reserve(db,w,key,'b7.integration.info',body);
   if(!idem.fresh)return {id:idem.resultId,replayed:true,connectionStatus:'NOT_CONNECTED'};
   const x=await db.query<{id:string}>(`INSERT INTO b7_integration_intents
    (workspace_id,provider_kind,intent_kind,created_by) VALUES($1,$2,$3,$4) RETURNING id`,
    [w,body.providerKind,body.intentKind,actor.id]);
   await audit(db,w,actor,'b7.integration.info','b7_integration_intents',x.rows[0]!.id,r);
   await finish(db,idem.id,x.rows[0]!.id);
   return {id:x.rows[0]!.id,replayed:false,connectionStatus:'NOT_CONNECTED'};
  });return reply.code(out.replayed?200:201).send(out);
 });
 app.get('/v1/workspaces/:workspaceId/settings',async r=>
  ownerRead(r,finance,identity,db=>settings(db,wid(r))));
 app.post('/v1/workspaces/:workspaceId/settings',async(r,reply)=>{
  const body=parse(settingsSchema,r.body),key=headerIdempotency(r);
  const out=await ownerWrite(r,finance,identity,async(db,actor)=>{
   const w=wid(r),idem=await reserve(db,w,key,'b7.settings',body);
   if(!idem.fresh)return {id:idem.resultId,replayed:true,externalAiConfigured:false};
   const x=await db.query<{id:string}>(`INSERT INTO b7_settings_snapshots
    (workspace_id,advisor_enabled,analytics_sharing_enabled,monthly_review_day,period_months,created_by)
    VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
    [w,body.advisorEnabled,false,body.monthlyReviewDay,body.periodMonths,actor.id]);
   await audit(db,w,actor,'b7.settings','b7_settings_snapshots',x.rows[0]!.id,r);
   await finish(db,idem.id,x.rows[0]!.id);
   return {id:x.rows[0]!.id,replayed:false,externalAiConfigured:false};
  });return reply.code(out.replayed?200:201).send(out);
 });
 app.get('/v1/workspaces/:workspaceId/privacy/requests',async r=>
  ownerRead(r,finance,identity,async db=>{
   const x=await db.query(`SELECT id,request_kind,state,created_at FROM b7_privacy_requests
    WHERE workspace_id=$1 ORDER BY created_at DESC,id DESC LIMIT 50`,[wid(r)]);
   return list(x.rows.map(y=>({id:y.id,requestKind:y.request_kind,status:y.state,createdAt:y.created_at})));
  }));
 app.post('/v1/workspaces/:workspaceId/privacy/requests',async(r,reply)=>{
  const body=parse(privacySchema,r.body),key=headerIdempotency(r);
  const out=await ownerWrite(r,finance,identity,async(db,actor)=>{
   const w=wid(r),idem=await reserve(db,w,key,'b7.privacy.request',body);
   if(!idem.fresh)return {id:idem.resultId,replayed:true,status:'REQUESTED',fulfilled:false};
   const x=await db.query<{id:string}>(`INSERT INTO b7_privacy_requests
    (workspace_id,request_kind,created_by) VALUES($1,$2,$3) RETURNING id`,
    [w,body.requestKind,actor.id]);
   await audit(db,w,actor,'b7.privacy.request','b7_privacy_requests',x.rows[0]!.id,r);
   await finish(db,idem.id,x.rows[0]!.id);
   return {id:x.rows[0]!.id,replayed:false,status:'REQUESTED',fulfilled:false};
  });return reply.code(out.replayed?200:201).send(out);
 });
 app.get('/v1/workspaces/:workspaceId/security/audit',async r=>
  ownerRead(r,finance,identity,async db=>{
   const x=await db.query(`SELECT id,event_type,entity_type,occurred_at FROM audit_events
    WHERE workspace_id=$1 ORDER BY occurred_at DESC,id DESC LIMIT 50`,[wid(r)]);
   return {...list(x.rows.map(y=>({id:y.id,eventType:y.event_type,
    entityType:y.entity_type,occurredAt:y.occurred_at}))),
    truncatedTo:50,accessRequires:'WORKSPACE_OWNER'};
  }));
 app.get('/v1/workspaces/:workspaceId/privacy/status',async r=>
  ownerRead(r,finance,identity,async db=>{
   const cfg=await settings(db,wid(r));
   const count=await db.query<{n:string}>(`SELECT COUNT(*)::text AS n FROM b7_privacy_requests
    WHERE workspace_id=$1 AND state='REQUESTED'`,[wid(r)]);
   return {analyticsSharingEnabled:false,advisorEnabled:cfg.advisorEnabled,
    externalAiSharing:false,bankSyncActive:false,unresolvedRequests:Number(count.rows[0]?.n??0),
    erasureAutomatic:false,exportAutomatic:false,retentionPolicy:'REQUIRES_LEGAL_REVIEW',
    note:'Privacy/erasure requests are logged for authorized review, not automatically fulfilled.'};
  }));
}
