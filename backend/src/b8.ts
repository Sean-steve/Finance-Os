import type {FastifyInstance,FastifyRequest} from 'fastify';
import type pg from 'pg';
import {DomainError,type AuthIdentity} from './auth.js';
import {scoped,type IdentityResolver} from './finance.js';
import {safeMinor,sumMinor,wealthSnapshot} from './b6.js';

// B8 read-only certification: no provider, ledger, account, audit or privacy mutations.
// This is an integrity sample of complete WORKSPACE data, not bank reconciliation or regulatory assurance.
const wid=(r:FastifyRequest)=>(r.params as {workspaceId:string}).workspaceId;
function requireOwner(role:string){
 if(role!=='OWNER')throw new DomainError(403,'OWNER_ONLY','Only the workspace owner can inspect financial integrity');
}
async function queryTotals(db:pg.PoolClient,w:string){
 const r=await db.query<{total:string;imbalanced:string;bad_line_count:string;debits:string;credits:string}>(`
 WITH entries AS (
  SELECT e.id,e.currency,e.status,
   COUNT(l.id)::int AS n,
   COALESCE(SUM(l.debit_minor),0) AS debits,
   COALESCE(SUM(l.credit_minor),0) AS credits
  FROM journal_entries e LEFT JOIN journal_lines l
   ON l.workspace_id=e.workspace_id AND l.entry_id=e.id
  WHERE e.workspace_id=$1 AND e.status='POSTED'
  GROUP BY e.id
 )
 SELECT COUNT(*)::text AS total,
  COUNT(*) FILTER(WHERE debits<>credits)::text AS imbalanced,
  COUNT(*) FILTER(WHERE n<2)::text AS bad_line_count,
  COALESCE(SUM(debits),0)::text AS debits,
  COALESCE(SUM(credits),0)::text AS credits
 FROM entries`,[w]);
 return r.rows[0]!;
}
async function transactionAudit(db:pg.PoolClient,w:string){
 const r=await db.query<{
  total:string;missing_posting:string;divergent_cash_effect:string;invalid_reversal:string;
  amount_sum:string;cash_line_sum:string
 }>(`
 WITH facts AS (
  SELECT t.id,t.amount_minor,t.kind,t.reverses_transaction_id,
   e.id IS NOT NULL AND e.status='POSTED' AND e.currency=t.currency AS posted,
   e.reverses_entry_id,
   COALESCE((
    SELECT SUM(l.debit_minor-l.credit_minor) FROM journal_lines l
     JOIN ledger_accounts la ON la.workspace_id=l.workspace_id AND la.id=l.ledger_account_id
    WHERE l.workspace_id=t.workspace_id AND l.entry_id=t.entry_id
      AND la.financial_account_id=t.financial_account_id AND la.class='ASSET'
   ),0) AS cash_effect
  FROM manual_transactions t
   LEFT JOIN journal_entries e ON e.workspace_id=t.workspace_id AND e.id=t.entry_id
  WHERE t.workspace_id=$1 AND t.currency='KES'
 )
 SELECT COUNT(*)::text AS total,
  COUNT(*) FILTER(WHERE NOT posted)::text AS missing_posting,
  COUNT(*) FILTER(WHERE cash_effect<>amount_minor)::text AS divergent_cash_effect,
  COUNT(*) FILTER(WHERE (kind='REVERSAL')<>(reverses_transaction_id IS NOT NULL)
                 OR (kind='REVERSAL' AND reverses_entry_id IS NULL))::text AS invalid_reversal,
  COALESCE(SUM(amount_minor),0)::text AS amount_sum,
  COALESCE(SUM(cash_effect),0)::text AS cash_line_sum
 FROM facts`,[w]);
 return r.rows[0]!;
}
async function cashLedgerTotal(db:pg.PoolClient,w:string){
 const r=await db.query<{v:string}>(`SELECT COALESCE(SUM(CASE WHEN e.status='POSTED' AND la.currency='KES'
   THEN l.debit_minor-l.credit_minor ELSE 0 END),0)::text AS v
 FROM ledger_accounts la
 JOIN financial_accounts a ON a.workspace_id=la.workspace_id
  AND a.id=la.financial_account_id
 LEFT JOIN journal_lines l ON l.workspace_id=la.workspace_id AND l.ledger_account_id=la.id
 LEFT JOIN journal_entries e ON e.workspace_id=l.workspace_id AND e.id=l.entry_id
 WHERE la.workspace_id=$1 AND la.class='ASSET' AND a.currency='KES'
  AND a.provider_status='MANUAL' AND a.kind IN ('CASH','BANK','MOBILE_MONEY')
 `,[w]);
 return safeMinor(r.rows[0]?.v??0);
}
async function externalEvidenceStatus(db:pg.PoolClient,w:string){
 const r=await db.query<{debt_links:string;bill_links:string;tax_links:string}>(`
 SELECT (SELECT COUNT(*)::text FROM b5_debt_payments WHERE workspace_id=$1) AS debt_links,
 (SELECT COUNT(*)::text FROM bill_settlements WHERE workspace_id=$1 AND status='RECORDED') AS bill_links,
 (SELECT COUNT(*)::text FROM b5_tax_payments WHERE workspace_id=$1) AS tax_links`,[w]);
 return {
  debtPaymentLinks:Number(r.rows[0]?.debt_links??0),
  billSettlementLinks:Number(r.rows[0]?.bill_links??0),
  taxPaymentLinks:Number(r.rows[0]?.tax_links??0),
  allLinksAreManualEvidence:true,
  externalFinancialConfirmation:false
 };
}
export async function workspaceIntegrity(db:pg.PoolClient,w:string){
 const [j,t,cash,wealth,evidence]=await Promise.all([
  queryTotals(db,w),transactionAudit(db,w),cashLedgerTotal(db,w),
  wealthSnapshot(db,w),externalEvidenceStatus(db,w)]);
 const totalPostedJournals=Number(j.total),manualTransactions=Number(t.total);
 const invalidJournals=Number(j.imbalanced)+Number(j.bad_line_count);
 const mismatchedTransactions=Number(t.missing_posting)+Number(t.divergent_cash_effect)+Number(t.invalid_reversal);
 const postedDebitsMinor=safeMinor(j.debits),postedCreditsMinor=safeMinor(j.credits);
 const transactionCashMinor=safeMinor(t.amount_sum);
 const journalCashMinor=safeMinor(t.cash_line_sum);
 const cashReconciled=transactionCashMinor===journalCashMinor && transactionCashMinor===cash;
 const empty=manualTransactions===0 && totalPostedJournals===0;
 const state=invalidJournals||mismatchedTransactions||!cashReconciled?'FAIL':empty?'INSUFFICIENT_EVIDENCE':'PASS_MANUAL_LEDGER';
 return {
  status:state,canClaimBankReconciled:false,providerVerified:false,
  completeFinancialPicture:false,productionCertified:false,
  modelVersion:'B8_INTERNAL_RECONCILIATION_V1',
  ledger:{
   postedJournalCount:totalPostedJournals,manualTransactionCount:manualTransactions,
   postedDebitMinor:postedDebitsMinor,postedCreditMinor:postedCreditsMinor,
   imbalancedPostedJournals:Number(j.imbalanced),incompletePostedJournals:Number(j.bad_line_count),
   missingPostedTransactionLinks:Number(t.missing_posting),
   transactionCashEffectMismatches:Number(t.divergent_cash_effect),
   invalidReversalLinks:Number(t.invalid_reversal),
   summedManualTransactionCashMinor:transactionCashMinor,
   summedAccountJournalCashMinor:journalCashMinor,
   totalManualCashLedgerMinor:cash,cashReconciled
  },
  estimates:{
   estimatedNetWorthMinor:wealth.estimatedNetWorthMinor,
   assetTotalMinor:wealth.assetTotalMinor,
   liabilityTotalMinor:wealth.liabilityTotalMinor,
   sourceCounts:wealth.sourceCounts,
   manualAndUserEstimatesOnly:true
  },manualEvidence:evidence,
  limitations:[
   'Not a bank statement reconciliation or independently audited set of accounts',
   'Only manually POSTED KES ledger accounts are compared',
   'Retirement projections, virtual buckets and provider-unverified investments are excluded from audited balances',
   'External provider checks, identity attestation, backup restore and privacy legal review remain separate release gates'
  ]
 };
}
export function installB8Routes(app:FastifyInstance,finance:pg.Pool,identity:IdentityResolver){
 app.get('/v1/workspaces/:workspaceId/certification/financial-integrity',async r=>
  scoped(r,finance,identity,'read',async(db,actor:AuthIdentity)=>{
   const membership=await db.query<{role:string}>(`SELECT role FROM workspace_members
    WHERE workspace_id=$1 AND user_id=$2 AND status='ACTIVE'`,[wid(r),actor.id]);
   requireOwner(membership.rows[0]?.role||'');
   return workspaceIntegrity(db,wid(r));
  }));
}
