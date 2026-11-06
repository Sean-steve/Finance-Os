import type {FastifyInstance,FastifyRequest} from 'fastify';
import type pg from 'pg';
import {z} from 'zod';
import {DomainError,type AuthIdentity} from './auth.js';
import {scoped,reserve,finish,audit,headerIdempotency,type IdentityResolver} from './finance.js';

// B6 never buys securities, values real property, connects custodians or creates journal entries.
// B1 POSTED manual KES accounts are the only cash input. All other inputs are user estimates.
const uuid=z.string().uuid(),kes=z.literal('KES');
const money=z.number().int().safe().min(0).max(1_000_000_000_000);
const positive=money.refine(x=>x>0);
const name=z.string().trim().min(3).max(150);
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
 .refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s+'T00:00:00Z').toISOString().startsWith(s));
export const assetSchema=z.object({name,assetKind:z.enum(['PROPERTY','LAND','VEHICLE','BUSINESS','EQUIPMENT','OTHER']),
 initialValueMinor:money,currency:kes,acquiredOn:day.nullable().optional().default(null)}).strict();
export const investmentSchema=z.object({name,investmentKind:z.enum(['EQUITY','BOND','FUND','SACCO','OTHER']),
 quantityMicros:positive,costBasisMinor:money,initialValueMinor:money,currency:kes}).strict();
export const liabilitySchema=z.object({name,liabilityKind:z.enum(['UNPAID_OBLIGATION','OTHER']),
 initialValueMinor:positive,currency:kes}).strict();
export const valuationSchema=z.object({valueMinor:money,currency:kes,
 note:z.string().trim().min(3).max(500),recordedOn:day}).strict();
type Group='ASSET'|'INVESTMENT'|'LIABILITY';
const meta:{[k in Group]:{table:string;column:string;name:string;operation:string}}={
 ASSET:{table:'b6_assets',column:'asset_id',name:'assetId',operation:'b6.asset.valuation'},
 INVESTMENT:{table:'b6_investments',column:'investment_id',name:'investmentId',operation:'b6.investment.valuation'},
 LIABILITY:{table:'b6_liabilities',column:'liability_id',name:'liabilityId',operation:'b6.liability.valuation'}
};
const wid=(r:FastifyRequest)=>(r.params as {workspaceId:string}).workspaceId;
function target(r:FastifyRequest,group:Group){
 const value=(r.params as Record<string,string>)[meta[group].name];
 if(!uuid.safeParse(value).success)throw new DomainError(400,'INVALID_ID','Invalid record identifier');
 return value!;
}
const parse=<T extends z.ZodTypeAny>(schema:T,body:unknown):z.infer<T>=>{
 const outcome=schema.safeParse(body);
 if(!outcome.success)throw new DomainError(422,'VALIDATION_ERROR','Invalid wealth data or unsupported currency');
 return outcome.data;
};
export const safeMinor=(x:unknown):number=>{
 const n=Number(x);
 if(!Number.isSafeInteger(n))throw new DomainError(422,'MONEY_RANGE','Wealth estimate exceeds safe integer minor units');
 return n;
};
export const sumMinor=(values:number[])=>{
 const total=values.reduce((acc,n)=>acc+BigInt(n),0n);
 if(total>BigInt(Number.MAX_SAFE_INTEGER)||total<BigInt(Number.MIN_SAFE_INTEGER))
  throw new DomainError(422,'MONEY_RANGE','Aggregated wealth estimate exceeds safe integer minor units');
 return Number(total);
};
export const allocationBps=(part:number,total:number)=>
 total<=0?null:Number((BigInt(part)*10000n+BigInt(total)/2n)/BigInt(total));
const asDate=(v:unknown)=>v instanceof Date?v.toISOString().slice(0,10):String(v??'');
const maxRows=500;
const list=<T>(items:T[])=>({items,nextCursor:null,quality:'USER_ESTIMATE'});
function validateLimit<T>(rows:T[]):T[]{
 if(rows.length>maxRows)throw new DomainError(409,'WEALTH_RESULT_LIMIT','Too many records for a safe complete wealth report');
 return rows;
}
async function fetchAssets(db:pg.PoolClient,w:string){
 const r=await db.query(`SELECT a.*,COALESCE(v.value_minor,a.initial_value_minor)::text AS current_value,
 v.recorded_on AS valuation_date,v.id AS valuation_id
 FROM b6_assets a LEFT JOIN LATERAL(
  SELECT value_minor,recorded_on,id FROM b6_valuations
  WHERE workspace_id=a.workspace_id AND asset_id=a.id
  ORDER BY recorded_on DESC,created_at DESC,id DESC LIMIT 1
 ) v ON true WHERE a.workspace_id=$1 ORDER BY a.created_at DESC,a.id DESC LIMIT 501`,[w]);
 return validateLimit(r.rows).map(x=>({
  id:x.id,name:x.name,assetKind:x.asset_kind,currency:x.currency,acquiredOn:x.acquired_on?asDate(x.acquired_on):null,
  originalEstimateMinor:safeMinor(x.initial_value_minor),estimatedValueMinor:safeMinor(x.current_value),
  latestValuationOn:x.valuation_date?asDate(x.valuation_date):null,latestValuationId:x.valuation_id,
  evidence:'USER_ESTIMATE',verified:false
 }));
}
async function fetchInvestments(db:pg.PoolClient,w:string){
 const r=await db.query(`SELECT a.*,COALESCE(v.value_minor,a.initial_value_minor)::text AS current_value,
 v.recorded_on AS valuation_date,v.id AS valuation_id
 FROM b6_investments a LEFT JOIN LATERAL(
  SELECT value_minor,recorded_on,id FROM b6_valuations
  WHERE workspace_id=a.workspace_id AND investment_id=a.id
  ORDER BY recorded_on DESC,created_at DESC,id DESC LIMIT 1
 ) v ON true WHERE a.workspace_id=$1 ORDER BY a.created_at DESC,a.id DESC LIMIT 501`,[w]);
 return validateLimit(r.rows).map(x=>{
  const estimate=safeMinor(x.current_value),cost=safeMinor(x.cost_basis_minor);
  return {id:x.id,name:x.name,investmentKind:x.investment_kind,currency:x.currency,
   quantityMicros:safeMinor(x.quantity_micros),costBasisMinor:cost,
   originalEstimateMinor:safeMinor(x.initial_value_minor),estimatedValueMinor:estimate,
   nominalUnrealizedDifferenceMinor:sumMinor([estimate,-cost]),
   latestValuationOn:x.valuation_date?asDate(x.valuation_date):null,latestValuationId:x.valuation_id,
   evidence:'USER_ESTIMATE',verified:false,tradesExecuted:false,performanceVerified:false};
 });
}
async function fetchLiabilities(db:pg.PoolClient,w:string){
 const r=await db.query(`SELECT a.*,COALESCE(v.value_minor,a.initial_value_minor)::text AS current_value,
 v.recorded_on AS valuation_date,v.id AS valuation_id
 FROM b6_liabilities a LEFT JOIN LATERAL(
  SELECT value_minor,recorded_on,id FROM b6_valuations
  WHERE workspace_id=a.workspace_id AND liability_id=a.id
  ORDER BY recorded_on DESC,created_at DESC,id DESC LIMIT 1
 ) v ON true WHERE a.workspace_id=$1 ORDER BY a.created_at DESC,a.id DESC LIMIT 501`,[w]);
 return validateLimit(r.rows).map(x=>({
  id:x.id,name:x.name,liabilityKind:x.liability_kind,currency:x.currency,
  originalEstimateMinor:safeMinor(x.initial_value_minor),estimatedValueMinor:safeMinor(x.current_value),
  latestValuationOn:x.valuation_date?asDate(x.valuation_date):null,latestValuationId:x.valuation_id,
  evidence:'USER_ESTIMATE',verified:false
 }));
}
async function fetchCash(db:pg.PoolClient,w:string){
 const r=await db.query(`SELECT a.id,a.display_name,a.kind,a.currency,
 COALESCE(SUM(CASE WHEN e.status='POSTED' AND e.effective_on<=current_date
   THEN l.debit_minor-l.credit_minor ELSE 0 END),0)::text AS balance_minor
 FROM financial_accounts a JOIN ledger_accounts la
  ON la.workspace_id=a.workspace_id AND la.financial_account_id=a.id
  AND la.class='ASSET' AND la.currency='KES'
 LEFT JOIN journal_lines l ON l.workspace_id=la.workspace_id AND l.ledger_account_id=la.id
 LEFT JOIN journal_entries e ON e.workspace_id=l.workspace_id AND e.id=l.entry_id
 WHERE a.workspace_id=$1 AND a.archived_at IS NULL AND a.provider_status='MANUAL'
  AND a.kind IN ('CASH','BANK','MOBILE_MONEY') AND a.currency='KES'
 GROUP BY a.id ORDER BY a.id LIMIT 501`,[w]);
 return validateLimit(r.rows).map(x=>({id:x.id,name:x.display_name,kind:x.kind,
  balanceMinor:safeMinor(x.balance_minor),evidence:'POSTED_MANUAL_LEDGER',verified:false}));
}
async function fetchDebts(db:pg.PoolClient,w:string){
 const r=await db.query(`SELECT d.id,d.name,d.lender_name,d.outstanding_minor::text AS starting_minor,
 (SELECT COALESCE(SUM(p.principal_minor),0)::text FROM b5_debt_payments p
  WHERE p.workspace_id=d.workspace_id AND p.debt_id=d.id
  AND NOT EXISTS(SELECT 1 FROM manual_transactions reversal
   WHERE reversal.workspace_id=p.workspace_id AND reversal.reverses_transaction_id=p.manual_transaction_id))
 AS linked_minor
 FROM debts d WHERE d.workspace_id=$1 AND d.currency='KES' ORDER BY d.id LIMIT 501`,[w]);
 return validateLimit(r.rows).map(x=>({
  id:x.id,name:x.name,lenderName:x.lender_name,
  estimatedOutstandingMinor:sumMinor([safeMinor(x.starting_minor),-safeMinor(x.linked_minor)]),
  evidence:'USER_REPORTED_WITH_MANUAL_CROSS_REFERENCE',verified:false
 }));
}
export async function wealthSnapshot(db:pg.PoolClient,w:string){
 const [cash,assets,investments,otherLiabilities,debts]=await Promise.all([
  fetchCash(db,w),fetchAssets(db,w),fetchInvestments(db,w),fetchLiabilities(db,w),fetchDebts(db,w)]);
 const cashAssets=sumMinor(cash.map(a=>Math.max(0,a.balanceMinor)));
 const cashOverdraft=sumMinor(cash.map(a=>Math.max(0,-a.balanceMinor)));
 const physical=sumMinor(assets.map(a=>a.estimatedValueMinor));
 const portfolio=sumMinor(investments.map(a=>a.estimatedValueMinor));
 const debtTotal=sumMinor(debts.map(a=>a.estimatedOutstandingMinor));
 const otherTotal=sumMinor(otherLiabilities.map(a=>a.estimatedValueMinor));
 const assetsTotal=sumMinor([cashAssets,physical,portfolio]);
 const liabilitiesTotal=sumMinor([cashOverdraft,debtTotal,otherTotal]);
 const netWorth=sumMinor([assetsTotal,-liabilitiesTotal]);
 return {currency:'KES',assetTotalMinor:assetsTotal,liabilityTotalMinor:liabilitiesTotal,
  estimatedNetWorthMinor:netWorth,breakdown:{manualCashAssetsMinor:cashAssets,
   manualCashOverdraftMinor:cashOverdraft,otherAssetsMinor:physical,
   investmentEstimatesMinor:portfolio,reportedDebtsMinor:debtTotal,
   otherLiabilitiesMinor:otherTotal},
  evidence:'MIXED_POSTED_MANUAL_LEDGER_AND_USER_ESTIMATES',
  includesProviderVerifiedData:false,hasLiveMarketPrices:false,investmentsExecuted:false,
  capitalGoalsCounted:false,retirementScenariosCounted:false,
  insuranceCoverageCounted:false,projectedTaxCounted:false,
  sourceCounts:{cashAccounts:cash.length,assets:assets.length,investments:investments.length,
   debts:debts.length,otherLiabilities:otherLiabilities.length},
  calculatedAt:new Date().toISOString(),cash,assets,investments,debts,otherLiabilities};
}
export function wealthAnalytics(snapshot:Awaited<ReturnType<typeof wealthSnapshot>>){
 const b=snapshot.breakdown;
 const categories=[
  {name:'CASH',amountMinor:b.manualCashAssetsMinor},
  {name:'PHYSICAL_ASSETS',amountMinor:b.otherAssetsMinor},
  {name:'INVESTMENTS',amountMinor:b.investmentEstimatesMinor}];
 return {currency:'KES',
  assetsByClass:categories.map(c=>({...c,shareBasisPoints:allocationBps(c.amountMinor,snapshot.assetTotalMinor)})),
  estimatedInvestmentCostMinor:sumMinor(snapshot.investments.map(x=>x.costBasisMinor)),
  estimatedInvestmentValueMinor:b.investmentEstimatesMinor,
  nominalUnrealizedDifferenceMinor:sumMinor(snapshot.investments.map(x=>x.nominalUnrealizedDifferenceMinor)),
  largestExposure:snapshot.investments.length?([...snapshot.investments].sort((a,b)=>
   b.estimatedValueMinor-a.estimatedValueMinor)[0]||null):null,
  estimatedNetWorthMinor:snapshot.estimatedNetWorthMinor,
  coverage: snapshot.liabilityTotalMinor===0?null:allocationBps(snapshot.assetTotalMinor,snapshot.liabilityTotalMinor),
  noVerifiedInvestmentPerformance:true,noBrokerConnection:true,noExecutedTrades:true,
  caveat:'Derived from manual ledger and user-supplied valuations; no verified market performance, returns, or tax advice.'};
}
async function createEntity(r:FastifyRequest,finance:pg.Pool,identity:IdentityResolver,
 operation:string,table:string,fields:string[],values:unknown[],payload:unknown){
 const idemKey=headerIdempotency(r);
 return scoped(r,finance,identity,'write',async(db,actor)=>{
  const w=wid(r),idem=await reserve(db,w,idemKey,operation,payload);
  if(!idem.fresh)return {id:idem.resultId,replayed:true,quality:'USER_ESTIMATE'};
  const args=[w,...values,actor.id];
  const cols=['workspace_id',...fields,'created_by'].join(',');
  const placeholders=args.map((_,i)=>'$'+(i+1)).join(',');
  const result=await db.query<{id:string}>(`INSERT INTO ${table}(${cols})
   VALUES(${placeholders}) RETURNING id`,args);
  const id=result.rows[0]!.id;await audit(db,w,actor,operation,table,id,r);
  await finish(db,idem.id,id);return {id,replayed:false,quality:'USER_ESTIMATE'};
 });
}
async function valuationList(db:pg.PoolClient,w:string,kind:Group,id:string){
 const m=meta[kind];
 const existing=await db.query(`SELECT id FROM ${m.table} WHERE workspace_id=$1 AND id=$2`,[w,id]);
 if(!existing.rowCount)throw new DomainError(404,'WEALTH_ITEM_NOT_FOUND','Wealth item not found');
 const r=await db.query(`SELECT id,value_minor::text,recorded_on,note,created_at FROM b6_valuations
 WHERE workspace_id=$1 AND ${m.column}=$2
 ORDER BY recorded_on DESC,created_at DESC,id DESC LIMIT 501`,[w,id]);
 return list(validateLimit(r.rows).map(x=>({id:x.id,valueMinor:safeMinor(x.value_minor),
  recordedOn:asDate(x.recorded_on),note:x.note,evidence:'USER_ESTIMATE'})));
}
async function insertValuation(r:FastifyRequest,finance:pg.Pool,identity:IdentityResolver,
 kind:Group,id:string,body:z.infer<typeof valuationSchema>){
 if(body.recordedOn>new Date().toISOString().slice(0,10))
  throw new DomainError(422,'FUTURE_VALUATION','Cannot record future manual valuations');
 const key=headerIdempotency(r),m=meta[kind];
 return scoped(r,finance,identity,'write',async(db,actor)=>{
  const w=wid(r),idem=await reserve(db,w,key,m.operation,{targetId:id,...body});
  if(!idem.fresh)return {id:idem.resultId,replayed:true,quality:'USER_ESTIMATE'};
  const existing=await db.query(`SELECT id FROM ${m.table} WHERE workspace_id=$1 AND id=$2`,[w,id]);
  if(!existing.rowCount)throw new DomainError(404,'WEALTH_ITEM_NOT_FOUND','Wealth item not found');
  const x=await db.query<{id:string}>(`INSERT INTO b6_valuations
   (workspace_id,target_kind,${m.column},value_minor,currency,note,recorded_on,created_by)
   VALUES($1,$2,$3,$4,'KES',$5,$6,$7) RETURNING id`,
   [w,kind,id,body.valueMinor,body.note,body.recordedOn,actor.id]);
  const rowId=x.rows[0]!.id;await audit(db,w,actor,m.operation,'b6_valuations',rowId,r);
  await finish(db,idem.id,rowId);return {id:rowId,replayed:false,quality:'USER_ESTIMATE'};
 });
}
export function installB6Routes(app:FastifyInstance,finance:pg.Pool,identity:IdentityResolver){
 const read=<T>(r:FastifyRequest,fn:(db:pg.PoolClient,actor:AuthIdentity)=>Promise<T>)=>
  scoped(r,finance,identity,'read',fn);
 app.get('/v1/workspaces/:workspaceId/wealth/summary',async r=>
  read(r,db=>wealthSnapshot(db,wid(r))));
 app.get('/v1/workspaces/:workspaceId/wealth/analytics',async r=>
  read(r,async db=>wealthAnalytics(await wealthSnapshot(db,wid(r)))));
 app.get('/v1/workspaces/:workspaceId/wealth/assets',async r=>
  list(await read(r,db=>fetchAssets(db,wid(r)))));
 app.post('/v1/workspaces/:workspaceId/wealth/assets',async(r,reply)=>{
  const b=parse(assetSchema,r.body);
  const out=await createEntity(r,finance,identity,'b6.asset.create','b6_assets',
   ['name','asset_kind','initial_value_minor','acquired_on','currency'],
   [b.name,b.assetKind,b.initialValueMinor,b.acquiredOn,b.currency],b);
  return reply.code(out.replayed?200:201).send(out);
 });
 app.get('/v1/workspaces/:workspaceId/wealth/investments',async r=>
  list(await read(r,db=>fetchInvestments(db,wid(r)))));
 app.post('/v1/workspaces/:workspaceId/wealth/investments',async(r,reply)=>{
  const b=parse(investmentSchema,r.body);
  const out=await createEntity(r,finance,identity,'b6.investment.create','b6_investments',
   ['name','investment_kind','quantity_micros','cost_basis_minor','initial_value_minor','currency'],
   [b.name,b.investmentKind,b.quantityMicros,b.costBasisMinor,b.initialValueMinor,b.currency],b);
  return reply.code(out.replayed?200:201).send(out);
 });
 app.get('/v1/workspaces/:workspaceId/wealth/liabilities',async r=>
  list(await read(r,db=>fetchLiabilities(db,wid(r)))));
 app.post('/v1/workspaces/:workspaceId/wealth/liabilities',async(r,reply)=>{
  const b=parse(liabilitySchema,r.body);
  const out=await createEntity(r,finance,identity,'b6.liability.create','b6_liabilities',
   ['name','liability_kind','initial_value_minor','currency'],
   [b.name,b.liabilityKind,b.initialValueMinor,b.currency],b);
  return reply.code(out.replayed?200:201).send(out);
 });
 for(const group of ['ASSET','INVESTMENT','LIABILITY'] as const){
  const m=meta[group];const base='/v1/workspaces/:workspaceId/wealth/'+
   (group==='ASSET'?'assets':group==='INVESTMENT'?'investments':'liabilities')+
   '/:'+m.name+'/valuations';
  app.get(base,async r=>read(r,db=>valuationList(db,wid(r),group,target(r,group))));
  app.post(base,async(r,reply)=>{
   const b=parse(valuationSchema,r.body);
   const out=await insertValuation(r,finance,identity,group,target(r,group),b);
   return reply.code(out.replayed?200:201).send(out);
  });
 }
}
