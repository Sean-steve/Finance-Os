import test from 'node:test';
import assert from 'node:assert/strict';
import {computeScenario,scenarioSchema} from '../src/b4.js';
const base={name:'New laptop what-if',horizonMonths:3,currency:'KES' as const,
 monthlyIncomeMinor:1000000,monthlyExpenseMinor:700000,monthlySavingsMinor:100000,
 oneTimePurchaseMinor:250000,incomeShockBasisPoints:-1000,expenseShockBasisPoints:500};
test('B4 deterministic scenarios never post or treat planned savings as an expense',()=>{
 const parsed=scenarioSchema.parse(base);
 const result=computeScenario(3000000,parsed);
 assert.equal(result.months.length,3);
 assert.equal(result.months[0]?.incomeMinor,900000);
 assert.equal(result.months[0]?.expensesMinor,735000);
 assert.equal(result.months[0]?.cashAfterExpensesMinor,2915000);
 assert.equal(result.months[0]?.discretionaryAfterPlannedSavingsMinor,2815000);
 assert.equal(result.endingCashAfterExpensesMinor,3245000);
 assert.equal(result.endingDiscretionaryAfterPlannedSavingsMinor,2945000);
 assert.equal(result.savingsAreVirtual,true);assert.equal(result.fundsMoved,false);
 assert.equal(result.providerVerified,false);
});
test('B4 scenario invalid shock/horizon and overflow fail closed',()=>{
 assert.equal(scenarioSchema.safeParse({...base,horizonMonths:25}).success,false);
 assert.equal(scenarioSchema.safeParse({...base,incomeShockBasisPoints:-10001}).success,false);
 assert.equal(scenarioSchema.safeParse({...base,currency:'USD'}).success,false);
 assert.throws(()=>computeScenario(Number.MAX_SAFE_INTEGER,scenarioSchema.parse(base)),/safe minor units/);
});
