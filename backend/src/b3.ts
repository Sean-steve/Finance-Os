import type {FastifyInstance,FastifyRequest} from 'fastify';
import type pg from 'pg';
import {z} from 'zod';
import {DomainError,type AuthIdentity} from './auth.js';
import {scoped,reserve,finish,audit,headerIdempotency,type IdentityResolver} from './finance.js';

const uuid=z.string().uuid();
const money=z.number().int().positive().safe().max(1_000_000_000_000);
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
 .refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s+'T00:00:00Z').toISOString().startsWith(s));
const incomeCadence=z.enum(['WEEKLY','MONTHLY','QUARTERLY','YEARLY','VARIABLE']);
const billCadence=z.enum(['ONCE','WEEKLY','MONTHLY','QUARTERLY','YEARLY']);
const sourceBody=z.object({name:z.string().trim().min(2).max(150),
 categoryId:uuid,cadence:incomeCadence,expectedMinor:money,currency:z.literal('KES'),
 firstExpectedOn:day,lastExpectedOn:day.nullable().optional().default(null)}).strict()
 .refine(s=>!s.lastExpectedOn||s.lastExpectedOn>=s.firstExpectedOn,'Schedule end precedes start');
const billBody=z.object({name:z.string().trim().min(2).max(150),
 payeeLabel:z.string().trim().min(2).max(150).nullable().optional().default(null),
 categoryId:uuid,cadence:billCadence,amountMinor:money,currency:z.literal('KES'),
 firstDueOn:day,lastDueOn:day.nullable().optional().default(null)}).strict()
 .refine(s=>!s.lastDueOn||s.lastDueOn>=s.firstDueOn,'Bill end precedes start');
const settlementBody=z.object({dueOn:day,manualTransactionId:uuid}).strict();
const qInt=z.coerce.number().int();
const rangeSchema=z.object({from:day,to:day}).strict()
 .refine(r=>r.to>=r.from,'Date range invalid')
 .refine(r=>(Date.parse(r.to)-Date.parse(r.from))<=366*86400000,'Date range is limited to 366 days');
const list=(items:unknown[])=>({items,nextCursor:null});
const params=(request:FastifyRequest)=>request.params as {workspaceId:string;sourceId?:string;billId?:string};
const safe=(x:unknown)=>{const number=Number(x);if(!Number.isSafeInteger(number))throw new DomainError(422,'AMOUNT_RANGE','Financial amount exceeds safe integer minor units');return number;};
const addMinor=(a:number,b:number)=>safe(a+b);
function parse<S extends z.ZodTypeAny>(schema:S,data:unknown):z.infer<S>{
 const r=schema.safeParse(data);if(!r.success)throw new DomainError(422,'VALIDATION_ERROR','Invalid fields, currency or date period');return r.data;
}
const today=()=>new Date().toISOString().slice(0,10);
const iso=(x:string)=>new Date(x+'T00:00:00.000Z');
const asDate=(date:Date)=>date.toISOString().slice(0,10);
const dateShift=(x:string,days:number)=>asDate(new Date(iso(x).getTime()+days*86400000));
const daySpan=(start:string,end:string)=>Math.round((iso(end).getTime()-iso(start).getTime())/86400000);

/** Calendar-clamped recurrence preserves the initial anchor day: Jan 31 -> Feb 28 -> Mar 31. */
export function occurrenceDates(firstOn:string,cadence:string,from:string,to:string,lastOn:string|null=null):string[]{
 if(to<firstOn)return [];
 const bound=lastOn&&lastOn<to?lastOn:to;
 if(bound<from||bound<firstOn)return [];
 if(cadence==='ONCE'||cadence==='VARIABLE'){
  return firstOn>=from&&firstOn<=bound?[firstOn]:[];
 }
 const monthStep=cadence==='MONTHLY'?1:cadence==='QUARTERLY'?3:cadence==='YEARLY'?12:0;
 const first=iso(firstOn),anchor=first.getUTCDate();
 let k=0;
 if(monthStep){
  const a=iso(from);
  const monthDiff=(a.getUTCFullYear()-first.getUTCFullYear())*12+a.getUTCMonth()-first.getUTCMonth();
  k=Math.max(0,Math.floor(monthDiff/monthStep)-1);
 }else if(cadence==='WEEKLY'){
  k=Math.max(0,Math.floor(daySpan(firstOn,from)/7)-1);
 }else return [];
 const output:string[]=[];
 for(let iterations=0;iterations<500 && output.length<400;iterations++,k++){
  let candidate:string;
  if(monthStep){
   const d=new Date(Date.UTC(first.getUTCFullYear(),first.getUTCMonth()+monthStep*k,1));
   const monthEnd=new Date(Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,0)).getUTCDate();
   d.setUTCDate(Math.min(anchor,monthEnd));candidate=asDate(d);
  }else candidate=dateShift(firstOn,7*k);
  if(candidate>bound)break;
  if(candidate>=from)output.push(candidate);
 }
 return output;
}
type SourceRow={id:string;name:string;category_id:string|null;cadence:string;expected_minor:string;currency:string;
 evidence:string;enabled:boolean;first_expected_on:string;last_expected_on:string|null;version:number;disabled_at:Date|null};
type BillRow={id:string;name:string;payee_label:string|null;category_id:string;cadence:string;amount_minor:string;
 currency:string;first_due_on:string;last_due_on:string|null;status:string;version:number;cancelled_at:Date|null};
type SettlementRow={id:string;bill_id:string;due_on:string;manual_transaction_id:string;status:string;linked_at:Date;reversed_at:Date|null};
function serialSource(r:SourceRow){return {id:r.id,name:r.name,categoryId:r.category_id,cadence:r.cadence,
 expectedMinor:safe(r.expected_minor),currency:r.currency,evidence:r.evidence,enabled:r.enabled,
 firstExpectedOn:r.first_expected_on,lastExpectedOn:r.last_expected_on,version:r.version,disabledAt:r.disabled_at,
 projectionQuality:'USER_ESTIMATE_NOT_RECEIVED'};}
function serialBill(r:BillRow){return {id:r.id,name:r.name,payeeLabel:r.payee_label,categoryId:r.category_id,
 cadence:r.cadence,amountMinor:safe(r.amount_minor),currency:r.currency,firstDueOn:r.first_due_on,
 lastDueOn:r.last_due_on,status:r.status,version:r.version,cancelledAt:r.cancelled_at,
 verification:'MANUAL_USER_OBLIGATION'};}
function serialSettlement(r:SettlementRow){return {id:r.id,billId:r.bill_id,dueOn:r.due_on,
 manualTransactionId:r.manual_transaction_id,status:r.status,linkedAt:r.linked_at,reversedAt:r.reversed_at,
 paymentEvidence:'POSTED_MANUAL_LEDGER_UNVERIFIED'};}
async function sourceRows(db:pg.PoolClient,wid:string,id?:string):Promise<SourceRow[]>{
 const r=await db.query<SourceRow>(`SELECT id,name,category_id,cadence,expected_minor::text,currency,evidence,
 enabled,first_expected_on::text,last_expected_on::text,version,disabled_at FROM income_sources
 WHERE workspace_id=$1 AND ($2::uuid IS NULL OR id=$2::uuid) ORDER BY created_at DESC,id LIMIT 121`,[wid,id??null]);
 if(r.rows.length>120)throw new DomainError(409,'INCOME_SOURCE_LIMIT','Income source count exceeds certified planning window; use data archival or pagination');
 return r.rows;
}
async function billRows(db:pg.PoolClient,wid:string,id?:string):Promise<BillRow[]>{
 const r=await db.query<BillRow>(`SELECT id,name,payee_label,category_id,cadence,amount_minor::text,currency,
 first_due_on::text,last_due_on::text,status,version,cancelled_at FROM bills
 WHERE workspace_id=$1 AND ($2::uuid IS NULL OR id=$2::uuid) ORDER BY created_at DESC,id LIMIT 151`,[wid,id??null]);
 if(r.rows.length>150)throw new DomainError(409,'BILL_COUNT_LIMIT','Bill count exceeds certified planning window; do not project incomplete obligations');
 return r.rows;
}
async function settlementRows(db:pg.PoolClient,wid:string,billId?:string):Promise<SettlementRow[]>{
 const r=await db.query<SettlementRow>(`SELECT id,bill_id,due_on::text,manual_transaction_id,status,linked_at,reversed_at
 FROM bill_settlements WHERE workspace_id=$1 AND ($2::uuid IS NULL OR bill_id=$2::uuid)
 ORDER BY linked_at DESC,id DESC LIMIT 1001`,[wid,billId??null]);
 if(r.rows.length>1000)throw new DomainError(409,'SETTLEMENT_LIMIT','Settlement history exceeds certified window; refusing potentially inaccurate obligations');
 return r.rows;
}
async function incomeLedger(db:pg.PoolClient,wid:string,months:number){
 const r=await db.query<{period:string;net_minor:string;entry_count:string}>(`
 SELECT to_char(date_trunc('month',j.effective_on),'YYYY-MM') AS period,
 COALESCE(SUM(CASE WHEN t.kind='INCOME' THEN t.amount_minor
  WHEN t.kind='REVERSAL' AND original.kind='INCOME' THEN t.amount_minor ELSE 0 END),0)::text AS net_minor,
 count(*) FILTER(WHERE t.kind='INCOME')::text AS entry_count
 FROM manual_transactions t JOIN journal_entries j ON j.workspace_id=t.workspace_id AND j.id=t.entry_id
 LEFT JOIN manual_transactions original ON original.workspace_id=t.workspace_id AND original.id=t.reverses_transaction_id
 WHERE t.workspace_id=$1 AND t.currency='KES' AND j.status='POSTED'
  AND j.effective_on>=date_trunc('month',current_date)-($2::int-1)*interval '1 month'
  AND j.effective_on<date_trunc('month',current_date)+interval '1 month'
 GROUP BY 1 ORDER BY 1 DESC`,[wid,months]);
 return r.rows.map(x=>({period:x.period,netRecordedIncomeMinor:safe(x.net_minor),
  incomeEntries:safe(x.entry_count)}));
}
function proposedSources(sources:SourceRow[],from:string,to:string){
 const events:{date:string;sourceId:string;name:string;amountMinor:number;evidence:string}[]=[];
 for(const source of sources){
  if(!source.enabled||source.currency!=='KES')continue;
  for(const date of occurrenceDates(source.first_expected_on,source.cadence,from,to,source.last_expected_on)){
   events.push({date,sourceId:source.id,name:source.name,amountMinor:safe(source.expected_minor),evidence:'USER_ESTIMATE'});
  }
 }
 return events.sort((a,b)=>a.date.localeCompare(b.date)||a.sourceId.localeCompare(b.sourceId));
}
function pendingBills(bills:BillRow[],settlements:SettlementRow[],from:string,to:string,asOf:string){
 const active=new Set(settlements.filter(x=>x.status==='RECORDED').map(x=>x.bill_id+'#'+x.due_on));
 const events:{date:string;billId:string;name:string;amountMinor:number;state:string;dueOn:string}[]=[];
 for(const bill of bills){
  const cutoff=bill.status==='CANCELLED'&&bill.cancelled_at
    ?asDate(bill.cancelled_at):null;
  const last=cutoff&&(!bill.last_due_on||cutoff<bill.last_due_on)?cutoff:bill.last_due_on;
  for(const dueOn of occurrenceDates(bill.first_due_on,bill.cadence,from,to,last)){
   if(active.has(bill.id+'#'+dueOn))continue;
   events.push({date:dueOn,dueOn,billId:bill.id,name:bill.name,amountMinor:safe(bill.amount_minor),
    state:dueOn<asOf?'OVERDUE_UNVERIFIED':'UPCOMING_UNVERIFIED'});
  }
 }
 return events.sort((a,b)=>a.date.localeCompare(b.date)||a.billId.localeCompare(b.billId));
}
async function manualBalance(db:pg.PoolClient,wid:string){
 const r=await db.query<{balance_minor:string}>(`
 SELECT COALESCE(SUM(CASE WHEN j.status='POSTED' AND j.effective_on<=current_date
  THEN l.debit_minor-l.credit_minor ELSE 0 END),0)::text AS balance_minor
 FROM financial_accounts a JOIN ledger_accounts la ON la.workspace_id=a.workspace_id
   AND la.financial_account_id=a.id AND la.class='ASSET' AND la.currency='KES'
 JOIN journal_lines l ON l.workspace_id=la.workspace_id AND l.ledger_account_id=la.id
 JOIN journal_entries j ON j.workspace_id=l.workspace_id AND j.id=l.entry_id
 WHERE a.workspace_id=$1 AND a.currency='KES' AND a.archived_at IS NULL
  AND a.provider_status='MANUAL' AND a.kind IN ('CASH','BANK','MOBILE_MONEY')`,[wid]);
 return safe(r.rows[0]?.balance_minor??0);
}
export async function indicativeForecast(db:pg.PoolClient,wid:string,days:number,now=today()){
 const end=dateShift(now,days),start=dateShift(now,1);
 const [sources,bills,settlements,balance]=await Promise.all([
  sourceRows(db,wid),billRows(db,wid),settlementRows(db,wid),manualBalance(db,wid)]);
 const expected=proposedSources(sources,start,end);
 const pending=pendingBills(bills,settlements,start,end,now);
 // Overdue liabilities remain a separate exposure. They are NOT silently converted to today's ledger entries.
 const overdue=pendingBills(bills,settlements,dateShift(now,-366),dateShift(now,-1),now);
 const overdueMinor=overdue.reduce((a,x)=>addMinor(a,x.amountMinor),0);
 const byDay=new Map<string,{date:string;estimatedIncomeMinor:number;unverifiedBillsDueMinor:number;projectionMinor:number}>();
 const add=(date:string,amount:number,kind:'income'|'bill')=>{
  const row=byDay.get(date)||{date,estimatedIncomeMinor:0,unverifiedBillsDueMinor:0,projectionMinor:0};
  if(kind==='income')row.estimatedIncomeMinor=addMinor(row.estimatedIncomeMinor,amount);
  else row.unverifiedBillsDueMinor=addMinor(row.unverifiedBillsDueMinor,amount);
  byDay.set(date,row);
 };
 for(const e of expected)add(e.date,e.amountMinor,'income');
 for(const e of pending)add(e.date,e.amountMinor,'bill');
 let balanceProjection=balance,low=balance,firstNegative:string|null=null;
 const timeline=[...byDay.values()].sort((a,b)=>a.date.localeCompare(b.date));
 for(const item of timeline){
  balanceProjection=addMinor(balanceProjection,addMinor(item.estimatedIncomeMinor,-item.unverifiedBillsDueMinor));
  item.projectionMinor=balanceProjection;
  low=Math.min(low,balanceProjection);
  if(firstNegative===null&&addMinor(balanceProjection,-overdueMinor)<0)firstNegative=item.date;
 }
 const futureIncomeMinor=expected.reduce((a,x)=>addMinor(a,x.amountMinor),0);
 const futureBillsMinor=pending.reduce((a,x)=>addMinor(a,x.amountMinor),0);
 const endAfterOverdueMinor=addMinor(balanceProjection,-overdueMinor);
 return {currency:'KES',asOf:now,horizonEndsOn:end,days,sourceQuality:'MANUAL_LEDGER_PLUS_USER_ESTIMATES',
  isProviderVerified:false,manualBalanceMinor:balance,
  expectedIncomeMinor:futureIncomeMinor,futureObligationsMinor:futureBillsMinor,
  overdueUnverifiedMinor:overdueMinor,endingIndicativeMinor:balanceProjection,
  endingAfterOverdueExposureMinor:endAfterOverdueMinor,lowestIndicativeMinor:low,
  firstPotentialShortfallOn:firstNegative??(addMinor(balance,-overdueMinor)<0?now:null),
  risks:{negativeIndicativeCashFlow:low<0,overdueMayCauseShortfall:addMinor(low,-overdueMinor)<0,
   exposureExceedsManualCash:overdueMinor>balance},
  timeline,scheduledIncome:expected,unverifiedUpcomingBills:pending,unverifiedOverdueBills:overdue,
  limitations:['Not a bank-verified balance, actual solvency forecast or payment authorization',
   'Future income is user-entered and may not arrive',
   'Due dates are date-only UTC, not a configured local bank settlement schedule',
   'Manual, future-dated journal postings may overlap estimated income schedules',
   'No bank feeds, invoice verification, taxes, debt obligations or external transfers in this forecast']};
}
async function actualTimeline(db:pg.PoolClient,wid:string,days:number){
 const r=await db.query<{date:string;income_minor:string;expense_minor:string;entry_count:string}>(`
 SELECT j.effective_on::text AS date,
 COALESCE(SUM(CASE WHEN t.kind='INCOME' THEN t.amount_minor
  WHEN t.kind='REVERSAL' AND original.kind='INCOME' THEN t.amount_minor ELSE 0 END),0)::text AS income_minor,
 COALESCE(SUM(CASE WHEN t.kind='EXPENSE' THEN -t.amount_minor
  WHEN t.kind='REVERSAL' AND original.kind='EXPENSE' THEN -t.amount_minor ELSE 0 END),0)::text AS expense_minor,
 count(*)::text AS entry_count
 FROM manual_transactions t JOIN journal_entries j
 ON j.workspace_id=t.workspace_id AND j.id=t.entry_id AND j.status='POSTED'
 LEFT JOIN manual_transactions original ON original.workspace_id=t.workspace_id AND original.id=t.reverses_transaction_id
 WHERE t.workspace_id=$1 AND t.currency='KES' AND j.effective_on BETWEEN current_date-$2::int AND current_date
 GROUP BY j.effective_on ORDER BY j.effective_on DESC LIMIT 366`,[wid,days]);
 const daysWithRecords=r.rows.map(x=>({date:x.date,incomeMinor:safe(x.income_minor),
  expenseMinor:safe(x.expense_minor),recordedEntries:safe(x.entry_count)}));
 return {currency:'KES',days,sourceQuality:'MANUAL_POSTED_LEDGER',isProviderVerified:false,
  daysWithRecords,netRecordedCashFlowMinor:daysWithRecords.reduce((a,x)=>addMinor(addMinor(a,x.incomeMinor),-x.expenseMinor),0)};
}

export function installB3Routes(app:FastifyInstance,financial:pg.Pool,identity:IdentityResolver){
 const scopedB3=<T>(r:FastifyRequest,mode:'read'|'write',f:(db:pg.PoolClient,actor:AuthIdentity)=>Promise<T>)=>
  scoped(r,financial,identity,mode,f);
 const w=(r:FastifyRequest)=>params(r).workspaceId;
 app.get('/v1/workspaces/:workspaceId/income/sources',async request=>{
  const items=await scopedB3(request,'read',async db=>(await sourceRows(db,w(request))).map(serialSource));
  return list(items);
 });
 app.post('/v1/workspaces/:workspaceId/income/sources',async(request,reply)=>{
  const body=parse(sourceBody,request.body),key=headerIdempotency(request);
  const result=await scopedB3(request,'write',async(db,actor)=>{
   const wid=w(request),idem=await reserve(db,wid,key,'b3.income.create',body);
   if(!idem.fresh){
    const old=(await sourceRows(db,wid,idem.resultId!))[0];
    if(!old)throw new DomainError(409,'REPLAY_MISSING','Source missing');
    return {...serialSource(old),replayed:true};
   }
   const cat=await db.query(`SELECT id FROM financial_categories WHERE workspace_id=$1
    AND id=$2 AND kind='INCOME'`,[wid,body.categoryId]);
   if(!cat.rowCount)throw new DomainError(422,'CATEGORY_NOT_INCOME','Income category missing in this workspace');
   const source=(await db.query<{id:string}>(`INSERT INTO income_sources
    (workspace_id,name,category_id,cadence,expected_minor,currency,evidence,first_expected_on,last_expected_on,created_by)
    VALUES($1,$2,$3,$4,$5,'KES','USER_ESTIMATE',$6,$7,$8) RETURNING id`,
    [wid,body.name,body.categoryId,body.cadence,body.expectedMinor,body.firstExpectedOn,
     body.lastExpectedOn,actor.id])).rows[0]!;
   await audit(db,wid,actor,'income.source.created','income_source',source.id,request);
   await finish(db,idem.id,source.id);
   return serialSource((await sourceRows(db,wid,source.id))[0]!);
  });return reply.code('replayed' in result?200:201).send(result);
 });
 app.post('/v1/workspaces/:workspaceId/income/sources/:sourceId/disable',async(request,reply)=>{
  const id=parse(uuid,params(request).sourceId),key=headerIdempotency(request);
  const result=await scopedB3(request,'write',async(db,actor)=>{
   const wid=w(request),idem=await reserve(db,wid,key,'b3.income.disable',{id});
   if(!idem.fresh){
    const old=(await sourceRows(db,wid,idem.resultId!))[0];
    if(!old)throw new DomainError(409,'REPLAY_MISSING','Income source missing');
    return {...serialSource(old),replayed:true};
   }
   const changed=await db.query(`UPDATE income_sources SET enabled=false,disabled_at=now(),version=version+1
    WHERE workspace_id=$1 AND id=$2 AND enabled=true RETURNING id`,[wid,id]);
   if(!changed.rowCount)throw new DomainError(409,'SOURCE_STATE','Only enabled income sources can be disabled');
   await audit(db,wid,actor,'income.source.disabled','income_source',id,request);
   await finish(db,idem.id,id);
   return serialSource((await sourceRows(db,wid,id))[0]!);
  });return reply.code('replayed' in result?200:201).send(result);
 });
 app.get('/v1/workspaces/:workspaceId/income/overview',async request=>{
  const query=request.query as {months?:string};
  const months=parse(qInt.min(1).max(12),query.months??6);
  return scopedB3(request,'read',async db=>{
   const [sources,ledger]=await Promise.all([sourceRows(db,w(request)),incomeLedger(db,w(request),months)]);
   return {currency:'KES',months,sourceQuality:'POSTED_MANUAL_LEDGER_AND_SEPARATE_USER_ESTIMATES',
    isProviderVerified:false,monthlyRecordedIncome:ledger,
    recordedIncomeMinor:ledger.reduce((a,x)=>addMinor(a,x.netRecordedIncomeMinor),0),
    plannedSources:sources.map(serialSource),
    notes:['Source expectations are not automatically allocated to recorded journal entries',
     'A repeated income source does not create money or a financial transaction',
     'Income amounts are manual, not verified deposits']};
  });
 });
 app.get('/v1/workspaces/:workspaceId/income/forecast',async request=>{
  const query=request.query as {days?:string};
  const days=parse(qInt.min(1).max(180),query.days??90);
  return scopedB3(request,'read',async db=>{
   const sources=await sourceRows(db,w(request)),now=today(),end=dateShift(now,days);
   const expected=proposedSources(sources,dateShift(now,1),end);
   return {currency:'KES',asOf:now,through:end,days,
    evidence:'USER_ESTIMATE_NOT_RECEIVED',isProviderVerified:false,
    expectedMinor:expected.reduce((a,x)=>addMinor(a,x.amountMinor),0),events:expected,
    note:'Scheduled income estimates have not been received or posted. No funds are added to the ledger.'};
  });
 });
 app.get('/v1/workspaces/:workspaceId/bills',async request=>{
  return scopedB3(request,'read',async db=>{
   const [bills,settlements]=await Promise.all([billRows(db,w(request)),settlementRows(db,w(request))]);
   const now=today(),until=dateShift(now,90);
   const upcoming=pendingBills(bills,settlements,now,until,now);
   const overdue=pendingBills(bills,settlements,dateShift(now,-366),dateShift(now,-1),now);
   return {items:bills.map(serialBill),nextCursor:null,
    overview:{upcomingUnverifiedMinor:upcoming.reduce((a,x)=>addMinor(a,x.amountMinor),0),
     overdueUnverifiedMinor:overdue.reduce((a,x)=>addMinor(a,x.amountMinor),0),
     evidence:'USER_REPORTED_OBLIGATIONS_NOT_PROVIDER_VERIFIED'}};
  });
 });
 app.post('/v1/workspaces/:workspaceId/bills',async(request,reply)=>{
  const body=parse(billBody,request.body),key=headerIdempotency(request);
  const item=await scopedB3(request,'write',async(db,actor)=>{
   const wid=w(request),idem=await reserve(db,wid,key,'b3.bills.create',body);
   if(!idem.fresh){
    const old=(await billRows(db,wid,idem.resultId!))[0];
    if(!old)throw new DomainError(409,'REPLAY_MISSING','Bill missing');
    return {...serialBill(old),replayed:true};
   }
   const cat=await db.query(`SELECT id FROM financial_categories
    WHERE workspace_id=$1 AND id=$2 AND kind='EXPENSE'`,[wid,body.categoryId]);
   if(!cat.rowCount)throw new DomainError(422,'CATEGORY_NOT_EXPENSE','Bill category must be an expense category');
   const created=(await db.query<{id:string}>(`INSERT INTO bills(workspace_id,name,payee_label,category_id,
    amount_minor,currency,cadence,first_due_on,last_due_on,created_by)
    VALUES($1,$2,$3,$4,$5,'KES',$6,$7,$8,$9) RETURNING id`,
    [wid,body.name,body.payeeLabel,body.categoryId,body.amountMinor,body.cadence,body.firstDueOn,
     body.lastDueOn,actor.id])).rows[0]!;
   await audit(db,wid,actor,'bill.created','bill',created.id,request);await finish(db,idem.id,created.id);
   return serialBill((await billRows(db,wid,created.id))[0]!);
  });return reply.code('replayed' in item?200:201).send(item);
 });
 app.get('/v1/workspaces/:workspaceId/bills/calendar',async request=>{
  const query=request.query as {from?:string;to?:string};
  const range=parse(rangeSchema,{from:query.from??dateShift(today(),-30),to:query.to??dateShift(today(),90)});
  return scopedB3(request,'read',async db=>{
   const [bills,settlements]=await Promise.all([billRows(db,w(request)),settlementRows(db,w(request))]);
   const recorded=new Map(settlements.filter(x=>x.status==='RECORDED').map(x=>[x.bill_id+'#'+x.due_on,x]));
   const events:{billId:string;billName:string;date:string;amountMinor:number;status:string;settlementId:string|null}[]=[];
   for(const bill of bills){
    const cutoff=bill.status==='CANCELLED'&&bill.cancelled_at
      ?asDate(bill.cancelled_at):null;
    const end=cutoff&&(!bill.last_due_on||cutoff<bill.last_due_on)?cutoff:bill.last_due_on;
    for(const date of occurrenceDates(bill.first_due_on,bill.cadence,range.from,range.to,end)){
     const payment=recorded.get(bill.id+'#'+date);
     events.push({billId:bill.id,billName:bill.name,date,amountMinor:safe(bill.amount_minor),
      status:payment?'RECORDED_UNVERIFIED':date<today()?'OVERDUE_UNVERIFIED':'DUE_UNVERIFIED',
      settlementId:payment?.id??null});
    }
   }
   events.sort((a,b)=>a.date.localeCompare(b.date)||a.billId.localeCompare(b.billId));
   if(events.length>2000)throw new DomainError(422,'TOO_MANY_OCCURRENCES','Use a smaller calendar window');
   return {currency:'KES',from:range.from,to:range.to,events,
    evidence:'USER_REPORTED_OBLIGATIONS_AND_POSTED_MANUAL_EXPENSES',
    isProviderVerified:false,paymentAuthority:false};
  });
 });
 app.get('/v1/workspaces/:workspaceId/bills/:billId',async request=>{
  const id=parse(uuid,params(request).billId);
  return scopedB3(request,'read',async db=>{
   const row=(await billRows(db,w(request),id))[0];
   if(!row)throw new DomainError(404,'BILL_NOT_FOUND','Bill not found in workspace');
   return {bill:serialBill(row),
    settlements:(await settlementRows(db,w(request),id)).map(serialSettlement)};
  });
 });
 app.post('/v1/workspaces/:workspaceId/bills/:billId/cancel',async(request,reply)=>{
  const id=parse(uuid,params(request).billId),key=headerIdempotency(request);
  const result=await scopedB3(request,'write',async(db,actor)=>{
   const wid=w(request),idem=await reserve(db,wid,key,'b3.bill.cancel',{id});
   if(!idem.fresh){const prior=(await billRows(db,wid,idem.resultId!))[0];
    if(!prior)throw new DomainError(409,'REPLAY_MISSING','Bill missing');
    return {...serialBill(prior),replayed:true};}
   const updated=await db.query(`UPDATE bills SET status='CANCELLED',cancelled_at=now(),version=version+1
     WHERE workspace_id=$1 AND id=$2 AND status='ACTIVE' RETURNING id`,[wid,id]);
   if(!updated.rowCount)throw new DomainError(409,'BILL_STATE','Only ACTIVE bills can be cancelled');
   await audit(db,wid,actor,'bill.cancelled','bill',id,request);
   await finish(db,idem.id,id);
   return serialBill((await billRows(db,wid,id))[0]!);
  });return reply.code('replayed' in result?200:201).send(result);
 });
 app.get('/v1/workspaces/:workspaceId/bills/:billId/settlements',async request=>{
  const id=parse(uuid,params(request).billId);
  return scopedB3(request,'read',async db=>{
   if(!(await billRows(db,w(request),id)).length)throw new DomainError(404,'BILL_NOT_FOUND','Bill not found');
   return list((await settlementRows(db,w(request),id)).map(serialSettlement));
  });
 });
 app.post('/v1/workspaces/:workspaceId/bills/:billId/settlements',async(request,reply)=>{
  const id=parse(uuid,params(request).billId),body=parse(settlementBody,request.body),
   key=headerIdempotency(request);
  const item=await scopedB3(request,'write',async(db,actor)=>{
   const wid=w(request),idem=await reserve(db,wid,key,'b3.bill.settle',{id,...body});
   if(!idem.fresh){
    const old=await db.query<SettlementRow>(`SELECT id,bill_id,due_on::text,manual_transaction_id,status,
      linked_at,reversed_at FROM bill_settlements WHERE workspace_id=$1 AND id=$2`,[wid,idem.resultId]);
    if(!old.rows[0])throw new DomainError(409,'REPLAY_MISSING','Settlement missing');
    return {...serialSettlement(old.rows[0]),replayed:true};
   }
   const bill=(await billRows(db,wid,id))[0];
   if(!bill)throw new DomainError(404,'BILL_NOT_FOUND','Bill not found');
   const cutoff=bill.status==='CANCELLED'&&bill.cancelled_at?asDate(bill.cancelled_at):null;
   const last=cutoff&&(!bill.last_due_on||cutoff<bill.last_due_on)?cutoff:bill.last_due_on;
   if(!occurrenceDates(bill.first_due_on,bill.cadence,body.dueOn,body.dueOn,last).includes(body.dueOn))
    throw new DomainError(422,'NOT_SCHEDULED_DUE_DATE','Due date is not an occurrence of this bill');
   const tx=await db.query<{id:string;kind:string;amount_minor:string;currency:string;category_id:string}>(`
    SELECT t.id,t.kind,t.amount_minor::text,t.currency,t.category_id
    FROM manual_transactions t JOIN journal_entries j
     ON j.workspace_id=t.workspace_id AND j.id=t.entry_id AND j.status='POSTED'
    WHERE t.workspace_id=$1 AND t.id=$2`,[wid,body.manualTransactionId]);
   const paid=tx.rows[0];
   if(!paid||paid.kind!=='EXPENSE'||paid.currency!==bill.currency||
     safe(paid.amount_minor)!==-safe(bill.amount_minor)||paid.category_id!==bill.category_id)
    throw new DomainError(422,'PAYMENT_NOT_MATCHED','Requires a POSTED manual expense with exact bill amount, category and currency');
   const reversed=await db.query(`SELECT id FROM manual_transactions
      WHERE workspace_id=$1 AND reverses_transaction_id=$2`,[wid,body.manualTransactionId]);
   if(reversed.rowCount)throw new DomainError(409,'EXPENSE_REVERSED','A reversed expense cannot settle a bill');
   const created=(await db.query<{id:string}>(`INSERT INTO bill_settlements
    (workspace_id,bill_id,due_on,manual_transaction_id,linked_by) VALUES($1,$2,$3,$4,$5)
    RETURNING id`,[wid,id,body.dueOn,body.manualTransactionId,actor.id])).rows[0]!;
   await audit(db,wid,actor,'bill.settlement.manual_linked','bill_settlement',created.id,request);
   await finish(db,idem.id,created.id);
   const latest=(await db.query<SettlementRow>(`SELECT id,bill_id,due_on::text,manual_transaction_id,
    status,linked_at,reversed_at FROM bill_settlements WHERE workspace_id=$1 AND id=$2`,[wid,created.id])).rows[0]!;
   return serialSettlement(latest);
  });return reply.code('replayed' in item?200:201).send(item);
 });
 app.get('/v1/workspaces/:workspaceId/cash-flow/timeline',async request=>{
  const query=request.query as {days?:string};
  const days=parse(qInt.min(1).max(365),query.days??90);
  return scopedB3(request,'read',db=>actualTimeline(db,w(request),days));
 });
 app.get('/v1/workspaces/:workspaceId/cash-flow/forecast',async request=>{
  const query=request.query as {days?:string};
  const days=parse(qInt.min(1).max(180),query.days??90);
  return scopedB3(request,'read',db=>indicativeForecast(db,w(request),days));
 });
 app.get('/v1/workspaces/:workspaceId/cash-flow/shortfalls',async request=>{
  const query=request.query as {days?:string};
  const days=parse(qInt.min(1).max(180),query.days??90);
  const forecast=await scopedB3(request,'read',db=>indicativeForecast(db,w(request),days));
  const recommendations:string[]=[];
  if(forecast.overdueUnverifiedMinor>0)recommendations.push(
    'Review and confirm overdue user-reported bills; record payment only after reconciling a posted expense');
  if(forecast.firstPotentialShortfallOn)recommendations.push(
    'Review upcoming income estimates and bills before committing additional manual expense');
  if(forecast.expectedIncomeMinor>0)recommendations.push(
    'Confirm expected income receipts independently: planned income is not money received');
  if(!recommendations.length)recommendations.push(
    'No negative indicative balance was detected; this does not verify solvency or unrecorded obligations');
  return {asOf:forecast.asOf,currency:'KES',days,sourceQuality:forecast.sourceQuality,
   firstPotentialShortfallOn:forecast.firstPotentialShortfallOn,
   endingAfterOverdueExposureMinor:forecast.endingAfterOverdueExposureMinor,
   overdueUnverifiedMinor:forecast.overdueUnverifiedMinor,risks:forecast.risks,
   recommendations,advisoryOnly:true,paymentAuthorized:false,isProviderVerified:false};
 });
}
