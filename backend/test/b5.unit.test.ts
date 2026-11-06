import test from 'node:test';
import assert from 'node:assert/strict';
import {debtSchema,taxSchema,insuranceSchema,retirementSchema,estateSchema,
 projectRetirement,estimateDebtPayoff} from '../src/b5.js';

test('B5 debt projections are indicative only; no payoff for interest-only minimums',()=>{
 assert.deepEqual(estimateDebtPayoff(10000,0,2500),{months:4,interestMinor:0});
 assert.equal(estimateDebtPayoff(100000,1200,100),null);
 assert.equal(estimateDebtPayoff(100000,0,0),null);
 const base={name:'Credit balance',lenderName:'Manual Creditor',currency:'KES',
  originalMinor:10000,outstandingMinor:5000,aprBasisPoints:1200,minimumPaymentMinor:1000};
 assert.equal(debtSchema.safeParse(base).success,true);
 assert.equal(debtSchema.safeParse({...base,outstandingMinor:10001}).success,false);
 assert.equal(debtSchema.safeParse({...base,currency:'USD'}).success,false);
});
test('B5 retirement uses deterministic BigInt minor units and labels provider state honestly',()=>{
 const body={name:'Target retirement',currentMinor:100000,monthlyContributionMinor:10000,
  targetMinor:200000,horizonMonths:12,annualReturnBasisPoints:0,currency:'KES' as const};
 assert.equal(retirementSchema.safeParse(body).success,true);
 const projected=projectRetirement(body);
 assert.equal(projected.endingMinor,220000);
 assert.equal(projected.targetMet,true);
 assert.equal(projected.moneyMoved,false);
 assert.equal(projected.providerVerified,false);
 assert.equal(projected.nominalOnly,true);
 assert.equal(projected.points.at(-1)?.month,12);
 assert.equal(retirementSchema.safeParse({...body,horizonMonths:601}).success,false);
 assert.equal(retirementSchema.safeParse({...body,annualReturnBasisPoints:1700}).success,false);
 assert.throws(()=>projectRetirement({...body,currentMinor:1e12,monthlyContributionMinor:1e12,
  horizonMonths:600,annualReturnBasisPoints:1500}),/safe minor units/);
});
test('B5 tax, insurance, estate validation rejects fabricated precision and sensitive extras',()=>{
 const tax={label:'2026 estimated tax',taxKind:'INCOME_TAX',taxYear:2026,
  estimatedMinor:40000,dueOn:'2026-12-31',currency:'KES'};
 assert.equal(taxSchema.safeParse(tax).success,true);
 assert.equal(taxSchema.safeParse({...tax,estimatedMinor:12.5}).success,false);
 assert.equal(taxSchema.safeParse({...tax,clientPin:'SECRET'}).success,false);
 const ins={name:'Vehicle protection',insurerLabel:'Example provider',coverageKind:'MOTOR',
  startOn:'2026-01-01',expiresOn:'2027-01-01',premiumMinor:5000,
  coverageLimitMinor:200000,currency:'KES'};
 assert.equal(insuranceSchema.safeParse(ins).success,true);
 assert.equal(insuranceSchema.safeParse({...ins,expiresOn:'2025-01-01'}).success,false);
 const estate={willPrepared:false,beneficiariesReviewed:true,executorNominated:false,
  dependantsConsidered:true,recordsSecured:false,reviewedOn:'2026-11-06'};
 assert.equal(estateSchema.safeParse(estate).success,true);
 assert.equal(estateSchema.safeParse({...estate,beneficiaryNationalId:'NOPE'}).success,false);
});
