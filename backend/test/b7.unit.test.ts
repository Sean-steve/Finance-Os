import test from 'node:test';
import assert from 'node:assert/strict';
import {assessHealth,advisorRules} from '../src/b7.js';
const row=(incomeMinor:number,expenseMinor:number,transactionCount:number)=>({
 month:'2026-11',incomeMinor,expenseMinor,netMinor:incomeMinor-expenseMinor,transactionCount
});
test('B7 health is never fabricated from no or insufficient manual observations',()=>{
 const none=assessHealth([row(0,0,0)],0);
 assert.equal(none.status,'INSUFFICIENT_EVIDENCE');
 assert.equal(none.score,null);
 assert.equal(none.savingsRateBasisPoints,null);
 assert.equal(none.providerVerified,false);
 assert.equal(none.notFinancialAdvice,true);
 const scarce=assessHealth([row(50000,40000,1)],0);
 assert.equal(scarce.status,'INSUFFICIENT_EVIDENCE');
 assert.equal(scarce.score,null);
});
test('B7 net cashflow and review states derive from posted manual evidence',()=>{
 const positive=assessHealth([row(100000,50000,4)],200000);
 assert.equal(positive.status,'POSITIVE_MANUAL_CASHFLOW');
 assert.equal(positive.savingsRateBasisPoints,5000);
 assert.equal(positive.spendingToIncomeBps,5000);
 const gap=assessHealth([row(40000,70000,5)],-900000);
 assert.equal(gap.status,'RECOVERY_NEEDED');
 assert.equal(gap.netCashFlowMinor,-30000);
 assert.equal(gap.savingsRateBasisPoints,-7500);
 assert.equal(advisorRules(gap,true).items.some(x=>x.code==='CASHFLOW_GAP'),true);
 assert.equal(advisorRules(gap,true).items.some(x=>x.code==='NET_WORTH_REVIEW'),true);
});
test('B7 advisor explicitly off without owner consent and is always rules-only',()=>{
 const health=assessHealth([row(120000,110000,5)],1000);
 const disabled=advisorRules(health,false);
 assert.equal(disabled.enabled,false);
 assert.deepEqual(disabled.items,[]);
 assert.equal(disabled.externalAiUsed,false);
 const enabled=advisorRules(health,true);
 assert.equal(enabled.mode,'EXPLAINABLE_RULES_NOT_GENERATIVE_AI');
 assert.equal(enabled.providerDataSent,false);
 assert.equal(enabled.notFinancialAdvice,true);
 assert.equal(enabled.items[0]?.code,'SMALL_BUFFER');
});
