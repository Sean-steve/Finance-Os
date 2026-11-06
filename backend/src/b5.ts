import type {FastifyInstance,FastifyRequest} from 'fastify';
import type pg from 'pg';
import {z} from 'zod';
import {DomainError,type AuthIdentity} from './auth.js';
import {scoped,reserve,finish,audit,headerIdempotency,type IdentityResolver} from './finance.js';

// B5 is intentionally manual-record-only: it never writes journals, pays lenders,
// sends to KRA, validates insurer cover, invests money or creates legal instruments.
const uuid=z.string().uuid(),kes=z.literal('KES');
const amount=z.number().int().safe().min(0).max(1_000_000_000_000);
const positive=amount.refine(n=>n>0);
const day=z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
 .refine(s=>!Number.isNaN(Date.parse(s))&&new Date(s+'T00:00:00Z').toISOString().startsWith(s));
const label=z.string().trim().min(3).max(150);
export const debtSchema=z.object({name:label,lenderName:label,currency:kes,
 originalMinor:positive,outstandingMinor:positive,aprBasisPoints:z.number().int().min(0).max(100000),
 minimumPaymentMinor:amount,nextDueOn:day.nullable().optional().default(null)}).strict()
 .refine(x=>x.outstandingMinor<=x.originalMinor,'Outstanding exceeds original balance');
export const taxSchema=z.object({label,taxKind:z.enum(['INCOME_TAX','VAT','TURNOVER_TAX','OTHER']),
 taxYear:z.number().int().min(2000).max(2100),estimatedMinor:amount,dueOn:day,currency:kes}).strict();
export const insuranceSchema=z.object({name:label,insurerLabel:z.string().trim().min(2).max(150),
 coverageKind:z.enum(['HEALTH','LIFE','MOTOR','PROPERTY','DISABILITY','OTHER']),
 startOn:day,expiresOn:day,premiumMinor:amount,coverageLimitMinor:amount,currency:kes}).strict()
 .refine(x=>x.expiresOn>=x.startOn,'Cover end precedes start');
export const retirementSchema=z.object({name:label,currentMinor:amount,monthlyContributionMinor:amount,
 targetMinor:positive,horizonMonths:z.number().int().min(1).max(600),
 annualReturnBasisPoints:z.number().int().min(0).max(1500),currency:kes}).strict();
export const estateSchema=z.object({willPrepared:z.boolean(),beneficiariesReviewed:z.boolean(),
 executorNominated:z.boolean(),dependantsConsidered:z.boolean(),recordsSecured:z.boolean(),
 reviewedOn:day}).strict();
const paymentSchema=z.object({manualTransactionId:uuid,amountMinor:positive}).strict();
type Retirement=z.infer<typeof retirementSchema>;
const wid=(r:FastifyRequest)=>(r.params as {workspaceId:string}).workspaceId;
const param=(r:FastifyRequest,k:string)=>{
 const value=(r.params as Record<string,string>)[k];
 if(!uuid.safeParse(value).success)throw new DomainError(400,'INVALID_ID','Invalid record identifier');
 return value!;
};
const parse=<T extends z.ZodTypeAny>(schema:T,body:unknown):z.infer<T>=>{
 const result=schema.safeParse(body);
 if(!result.success)throw new DomainError(422,'VALIDATION_ERROR','Invalid B5 request fields');
 return result.data;
};
const minor=(v:unknown)=>{const n=Number(v);
 if(!Number.isSafeInteger(n))throw new DomainError(422,'AMOUNT_RANGE','Amount exceeds safe minor-unit limit');
 return n;
};
const dateValue=(v:unknown)=>v instanceof Date?v.toISOString().slice(0,10):String(v??'');
const list=(items:unknown[])=>({items,nextCursor:null});
const evidence='USER_REPORTED';
const moneyQuality='MANUAL_CROSS_REFERENCE_NOT_PROVIDER_VERIFIED';

export function projectRetirement(plan:Retirement){
 // Nominal monthly compounding of a *user assumption*, rounded to whole minor units.
 // BigInt prevents intermediate float precision loss. No investment or inflation guarantee.
 let balance=BigInt(plan.currentMinor);
 const contribution=BigInt(plan.monthlyContributionMinor);
 const rate=BigInt(plan.annualReturnBasisPoints),denominator=120000n;
 const points:{month:number;projectedMinor:number}[]=[];
 for(let month=1;month<=plan.horizonMonths;month++){
  balance=(balance*(denominator+rate))/denominator+contribution;
  if(balance>BigInt(Number.MAX_SAFE_INTEGER))throw new DomainError(422,'PROJECTION_OVERFLOW','Projection exceeds safe minor units');
  if(month===1||month%12===0||month===plan.horizonMonths)
   points.push({month,projectedMinor:Number(balance)});
 }
 return {endingMinor:Number(balance),targetMinor:plan.targetMinor,
  targetMet:balance>=BigInt(plan.targetMinor),points,
  moneyMoved:false,providerVerified:false,nominalOnly:true,
  assumptionsAreNotAdvice:true,modelVersion:'B5_NOMINAL_ILLUSTRATION_V1'};
}
export function estimateDebtPayoff(outstandingMinor:number,aprBasisPoints:number,paymentMinor:number){
 if(!paymentMinor||!outstandingMinor)return outstandingMinor?null:{months:0,interestMinor:0};
 let current=BigInt(outstandingMinor),interest=0n;
 for(let month=1;month<=600;month++){
  const charge=(current*BigInt(aprBasisPoints)+119999n)/120000n;
  if(BigInt(paymentMinor)<=charge)return null;
  interest+=charge;
  current=current+charge-BigInt(paymentMinor);
  if(current<=0n){
   if(interest>BigInt(Number.MAX_SAFE_INTEGER))return null;
   return {months:month,interestMinor:Number(interest)};
  }
  if(current>BigInt(Number.MAX_SAFE_INTEGER))return null;
 }
 return null;
}
async function ownerOnly(db:pg.PoolClient,w:string,actor:AuthIdentity){
 const res=await db.query(`SELECT 1 FROM workspaces w JOIN workspace_members m
 ON m.workspace_id=w.id AND m.user_id=$2 AND m.status='ACTIVE'
 WHERE w.id=$1 AND w.owner_user_id=$2 AND m.role='OWNER'`,[w,actor.id]);
 if(!res.rowCount)throw new DomainError(403,'ESTATE_OWNER_ONLY','Estate readiness is available only to the workspace owner');
}
async function create(r:FastifyRequest,finance:pg.Pool,identity:IdentityResolver,op:string,
 table:string,columns:string[],values:unknown[],body:unknown){
 const key=headerIdempotency(r);
 return scoped(r,finance,identity,'write',async(db,actor)=>{
  const w=wid(r),idem=await reserve(db,w,key,op,body);
  if(!idem.fresh)return {id:idem.resultId,replayed:true,evidence};
  // Static server-owned table/column strings only; never accept SQL identifiers from client.
  const args=[w,...values,actor.id];
  const columnsSql=['workspace_id',...columns,'created_by'].join(',');
  const placeholders=args.map((_,i)=>'$'+(i+1)).join(',');
  const res=await db.query<{id:string}>(`INSERT INTO ${table}(${columnsSql}) VALUES(${placeholders}) RETURNING id`,args);
  const id=res.rows[0]!.id;
  await audit(db,w,actor,op,table,id,r);
  await finish(db,idem.id,id);
  return {id,replayed:false,evidence};
 });
}
async function selectDebts(db:pg.PoolClient,w:string){
 const x=await db.query(`SELECT d.*,
 (SELECT COALESCE(SUM(p.principal_minor),0)::text FROM b5_debt_payments p
  WHERE p.workspace_id=d.workspace_id AND p.debt_id=d.id
   AND NOT EXISTS(SELECT 1 FROM manual_transactions r
    WHERE r.workspace_id=p.workspace_id AND r.reverses_transaction_id=p.manual_transaction_id)) paid_minor
 FROM debts d WHERE d.workspace_id=$1 ORDER BY d.created_at DESC,d.id DESC LIMIT 100`,[w]);
 return x.rows.map(row=>{
  const original=minor(row.original_minor),starting=minor(row.outstanding_minor),paid=minor(row.paid_minor);
  const remaining=starting-paid;
  return {id:row.id,name:row.name,lenderName:row.lender_name,currency:row.currency,
   originalMinor:original,startingOutstandingMinor:starting,linkedPrincipalMinor:paid,
   estimatedOutstandingMinor:remaining,aprBasisPoints:row.apr_basis_points,
   minimumPaymentMinor:minor(row.minimum_payment_minor),nextDueOn:row.next_due_on?dateValue(row.next_due_on):null,
   evidence:row.evidence,linkedPaymentQuality:moneyQuality,
   payoffIllustration:estimateDebtPayoff(remaining,row.apr_basis_points,minor(row.minimum_payment_minor))};
 });
}
async function selectTax(db:pg.PoolClient,w:string){
 const x=await db.query(`SELECT o.*,
 (SELECT COALESCE(SUM(p.amount_minor),0)::text FROM b5_tax_payments p
  WHERE p.workspace_id=o.workspace_id AND p.obligation_id=o.id
    AND NOT EXISTS(SELECT 1 FROM manual_transactions r
      WHERE r.workspace_id=p.workspace_id AND r.reverses_transaction_id=p.manual_transaction_id)) linked_minor
 FROM b5_tax_obligations o WHERE o.workspace_id=$1 ORDER BY o.due_on,o.id LIMIT 100`,[w]);
 return x.rows.map(row=>{
  const estimated=minor(row.estimated_minor),linked=minor(row.linked_minor);
  return {id:row.id,label:row.label,taxKind:row.tax_kind,taxYear:row.tax_year,
   estimatedMinor:estimated,linkedManualPaymentsMinor:linked,estimatedRemainingMinor:estimated-linked,
   dueOn:dateValue(row.due_on),currency:row.currency,evidence:row.evidence,
   filingStatus:'NOT_FILED_BY_FINANCE_OS',paymentQuality:moneyQuality};
 });
}
async function selectInsurance(db:pg.PoolClient,w:string){
 const x=await db.query(`SELECT * FROM b5_insurance_policies
 WHERE workspace_id=$1 ORDER BY expires_on,id LIMIT 100`,[w]);
 return x.rows.map(row=>({id:row.id,name:row.name,insurerLabel:row.insurer_label,
  coverageKind:row.coverage_kind,startOn:dateValue(row.start_on),expiresOn:dateValue(row.expires_on),
  premiumMinor:minor(row.premium_minor),coverageLimitMinor:minor(row.coverage_limit_minor),
  currency:row.currency,evidence:row.evidence,coverageVerified:false,
  renewalIsReminderOnly:true}));
}
async function selectRetirement(db:pg.PoolClient,w:string){
 const x=await db.query(`SELECT * FROM b5_retirement_scenarios
 WHERE workspace_id=$1 ORDER BY created_at DESC,id DESC LIMIT 100`,[w]);
 return x.rows.map(row=>{
  const plan:Retirement={name:row.name,currentMinor:minor(row.current_minor),
   monthlyContributionMinor:minor(row.monthly_contribution_minor),targetMinor:minor(row.target_minor),
   horizonMonths:row.horizon_months,annualReturnBasisPoints:row.annual_return_bps,currency:'KES'};
  return {id:row.id,...plan,simulation:projectRetirement(plan)};
 });
}
function mapEstate(row:Record<string,unknown>){
 const flags=['will_prepared','beneficiaries_reviewed','executor_nominated','dependants_considered','records_secured'];
 const completed=flags.filter(k=>row[k]===true).length;
 return {id:row.id,willPrepared:row.will_prepared,beneficiariesReviewed:row.beneficiaries_reviewed,
  executorNominated:row.executor_nominated,dependantsConsidered:row.dependants_considered,
  recordsSecured:row.records_secured,reviewedOn:dateValue(row.reviewed_on),
  completedCount:completed,totalItems:5,legalDocumentCreated:false,legalValidityVerified:false};
}
async function selectEstate(db:pg.PoolClient,w:string){
 const x=await db.query(`SELECT * FROM b5_estate_checklists
 WHERE workspace_id=$1 ORDER BY created_at DESC,id DESC LIMIT 25`,[w]);
 return x.rows.map(mapEstate);
}
async function linkExpense(r:FastifyRequest,finance:pg.Pool,identity:IdentityResolver,
 domain:'debt'|'tax',targetId:string,body:z.infer<typeof paymentSchema>){
 const key=headerIdempotency(r);
 const debt=domain==='debt';
 const table=debt?'b5_debt_payments':'b5_tax_payments';
 const targetTable=debt?'debts':'b5_tax_obligations';
 const targetColumn=debt?'debt_id':'obligation_id';
 const ceilingColumn=debt?'outstanding_minor':'estimated_minor';
 const appliedColumn=debt?'principal_minor':'amount_minor';
 return scoped(r,finance,identity,'write',async(db,actor)=>{
  const w=wid(r),op=debt?'b5.debt.payment.link':'b5.tax.payment.link';
  const idem=await reserve(db,w,key,op,{targetId,...body});
  if(!idem.fresh)return {id:idem.resultId,replayed:true,quality:moneyQuality};
  const target=await db.query(`SELECT ${ceilingColumn}::text AS ceiling FROM ${targetTable}
    WHERE workspace_id=$1 AND id=$2 FOR UPDATE`,[w,targetId]);
  if(!target.rowCount)throw new DomainError(404,'OBLIGATION_NOT_FOUND','Record not found in workspace');
  // Lock the expense so simultaneous attempts cannot allocate one posting twice.
  const tx=await db.query<{kind:string;amount_minor:string;reverses_transaction_id:string|null}>(`
   SELECT kind,amount_minor::text,reverses_transaction_id FROM manual_transactions
   WHERE workspace_id=$1 AND id=$2 FOR UPDATE`,[w,body.manualTransactionId]);
  if(!tx.rowCount||tx.rows[0]!.kind!=='EXPENSE'||minor(tx.rows[0]!.amount_minor)>=0||
     tx.rows[0]!.reverses_transaction_id)
   throw new DomainError(422,'INVALID_EXPENSE','Requires an original posted manual expense');
  const reversed=await db.query('SELECT 1 FROM manual_transactions WHERE workspace_id=$1 AND reverses_transaction_id=$2 LIMIT 1',
    [w,body.manualTransactionId]);
  if(reversed.rowCount)throw new DomainError(409,'REVERSED_EXPENSE','Reversed expenses cannot be linked');
  if(body.amountMinor>Math.abs(minor(tx.rows[0]!.amount_minor)))
   throw new DomainError(422,'AMOUNT_EXCEEDS_EXPENSE','Allocation exceeds original manual expense');
  const used=await db.query(`SELECT 1 FROM b5_debt_payments WHERE workspace_id=$1 AND manual_transaction_id=$2
   UNION ALL SELECT 1 FROM b5_tax_payments WHERE workspace_id=$1 AND manual_transaction_id=$2 LIMIT 1`,
   [w,body.manualTransactionId]);
  if(used.rowCount)throw new DomainError(409,'EXPENSE_ALREADY_LINKED','Expense already used for a B5 obligation');
  const sum=await db.query(`SELECT COALESCE(SUM(p.${appliedColumn}),0)::text AS applied
   FROM ${table} p WHERE p.workspace_id=$1 AND p.${targetColumn}=$2
   AND NOT EXISTS(SELECT 1 FROM manual_transactions reversal
    WHERE reversal.workspace_id=p.workspace_id AND reversal.reverses_transaction_id=p.manual_transaction_id)`,[w,targetId]);
  if(minor(sum.rows[0]!.applied)+body.amountMinor>minor(target.rows[0]!.ceiling))
   throw new DomainError(409,'OVER_ALLOCATED','Linked expenses cannot exceed initial user-reported obligation');
  const added=await db.query<{id:string}>(`INSERT INTO ${table}(workspace_id,${targetColumn},manual_transaction_id,
    ${appliedColumn},created_by) VALUES($1,$2,$3,$4,$5) RETURNING id`,
   [w,targetId,body.manualTransactionId,body.amountMinor,actor.id]);
  const id=added.rows[0]!.id;
  await audit(db,w,actor,op,table,id,r);await finish(db,idem.id,id);
  return {id,replayed:false,quality:moneyQuality};
 });
}
export function installB5Routes(app:FastifyInstance,finance:pg.Pool,identity:IdentityResolver){
 const read=<T>(r:FastifyRequest,handler:(db:pg.PoolClient,actor:AuthIdentity)=>Promise<T>)=>
  scoped(r,finance,identity,'read',handler);
 app.get('/v1/workspaces/:workspaceId/debts',async r=>list(await read(r,db=>selectDebts(db,wid(r)))));
 app.post('/v1/workspaces/:workspaceId/debts',async(r,reply)=>{
  const b=parse(debtSchema,r.body);
  const result=await create(r,finance,identity,'b5.debt.create','debts',
   ['name','lender_name','currency','original_minor','outstanding_minor','apr_basis_points',
    'minimum_payment_minor','next_due_on'],
   [b.name,b.lenderName,b.currency,b.originalMinor,b.outstandingMinor,b.aprBasisPoints,b.minimumPaymentMinor,b.nextDueOn],b);
  return reply.code(result.replayed?200:201).send(result);
 });
 app.post('/v1/workspaces/:workspaceId/debts/:debtId/payments',async(r,reply)=>{
  const b=parse(paymentSchema,r.body);
  const result=await linkExpense(r,finance,identity,'debt',param(r,'debtId'),b);
  return reply.code(result.replayed?200:201).send(result);
 });
 app.get('/v1/workspaces/:workspaceId/tax/obligations',async r=>list(await read(r,db=>selectTax(db,wid(r)))));
 app.post('/v1/workspaces/:workspaceId/tax/obligations',async(r,reply)=>{
  const b=parse(taxSchema,r.body);
  const result=await create(r,finance,identity,'b5.tax.create','b5_tax_obligations',
   ['label','tax_kind','tax_year','estimated_minor','due_on','currency'],
   [b.label,b.taxKind,b.taxYear,b.estimatedMinor,b.dueOn,b.currency],b);
  return reply.code(result.replayed?200:201).send(result);
 });
 app.post('/v1/workspaces/:workspaceId/tax/obligations/:obligationId/payments',async(r,reply)=>{
  const b=parse(paymentSchema,r.body);
  const result=await linkExpense(r,finance,identity,'tax',param(r,'obligationId'),b);
  return reply.code(result.replayed?200:201).send(result);
 });
 app.get('/v1/workspaces/:workspaceId/insurance/policies',async r=>list(await read(r,db=>selectInsurance(db,wid(r)))));
 app.post('/v1/workspaces/:workspaceId/insurance/policies',async(r,reply)=>{
  const b=parse(insuranceSchema,r.body);
  const result=await create(r,finance,identity,'b5.insurance.create','b5_insurance_policies',
   ['name','insurer_label','coverage_kind','start_on','expires_on','premium_minor','coverage_limit_minor','currency'],
   [b.name,b.insurerLabel,b.coverageKind,b.startOn,b.expiresOn,b.premiumMinor,b.coverageLimitMinor,b.currency],b);
  return reply.code(result.replayed?200:201).send(result);
 });
 app.get('/v1/workspaces/:workspaceId/retirement/scenarios',async r=>list(await read(r,db=>selectRetirement(db,wid(r)))));
 app.post('/v1/workspaces/:workspaceId/retirement/scenarios',async(r,reply)=>{
  const b=parse(retirementSchema,r.body);
  // Fail closed on extreme projection arithmetic before durable storage.
  projectRetirement(b);
  const result=await create(r,finance,identity,'b5.retirement.create','b5_retirement_scenarios',
   ['name','current_minor','monthly_contribution_minor','target_minor','horizon_months','annual_return_bps','currency'],
   [b.name,b.currentMinor,b.monthlyContributionMinor,b.targetMinor,b.horizonMonths,b.annualReturnBasisPoints,b.currency],b);
  return reply.code(result.replayed?200:201).send(result);
 });
 app.get('/v1/workspaces/:workspaceId/estate/checklists',async r=>
  list(await read(r,async(db,actor)=>{await ownerOnly(db,wid(r),actor);return selectEstate(db,wid(r));})));
 app.post('/v1/workspaces/:workspaceId/estate/checklists',async(r,reply)=>{
  const b=parse(estateSchema,r.body),key=headerIdempotency(r);
  const result=await scoped(r,finance,identity,'write',async(db,actor)=>{
   const w=wid(r);await ownerOnly(db,w,actor);
   const idem=await reserve(db,w,key,'b5.estate.snapshot',b);
   if(!idem.fresh)return {id:idem.resultId,replayed:true};
   const x=await db.query<{id:string}>(`INSERT INTO b5_estate_checklists(workspace_id,will_prepared,
    beneficiaries_reviewed,executor_nominated,dependants_considered,records_secured,reviewed_on,created_by)
    VALUES($1,$2,$3,$4,$5,$6,$7,$8) RETURNING id`,
    [w,b.willPrepared,b.beneficiariesReviewed,b.executorNominated,b.dependantsConsidered,b.recordsSecured,b.reviewedOn,actor.id]);
   const id=x.rows[0]!.id;await audit(db,w,actor,'b5.estate.snapshot','b5_estate_checklists',id,r);
   await finish(db,idem.id,id);return {id,replayed:false};
  });
  return reply.code(result.replayed?200:201).send(result);
 });
}
