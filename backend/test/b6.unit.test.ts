import test from 'node:test';
import assert from 'node:assert/strict';
import {assetSchema,investmentSchema,liabilitySchema,valuationSchema,
 safeMinor,sumMinor,allocationBps,wealthAnalytics} from '../src/b6.js';
test('B6 financial arithmetic uses integer minor units and fails closed',()=>{
 assert.equal(sumMinor([1000000000000,-700000000000,25]),300000000025);
 assert.equal(sumMinor([-1200,100]),-1100);
 assert.throws(()=>sumMinor([Number.MAX_SAFE_INTEGER,2]),/safe integer/);
 assert.throws(()=>safeMinor('9007199254740993'),/safe integer/);
 assert.equal(allocationBps(1,3),3333);
 assert.equal(allocationBps(0,0),null);
 assert.equal(allocationBps(25,100),2500);
});
test('B6 strict asset/holding/valuation schema rejects spoofed providers, imprecise amounts and unknown currency',()=>{
 const asset={name:'Home estimate',assetKind:'PROPERTY',initialValueMinor:100000,
  currency:'KES',acquiredOn:'2026-02-01'};
 assert.equal(assetSchema.safeParse(asset).success,true);
 assert.equal(assetSchema.safeParse({...asset,initialValueMinor:0}).success,true);
 assert.equal(assetSchema.safeParse({...asset,initialValueMinor:0.25}).success,false);
 assert.equal(assetSchema.safeParse({...asset,verified:true}).success,false);
 const investment={name:'Manual investment',investmentKind:'EQUITY',quantityMicros:1000000,
  costBasisMinor:5000,initialValueMinor:7000,currency:'KES'};
 assert.equal(investmentSchema.safeParse(investment).success,true);
 assert.equal(investmentSchema.safeParse({...investment,quantityMicros:0}).success,false);
 assert.equal(investmentSchema.safeParse({...investment,currency:'USD'}).success,false);
 assert.equal(investmentSchema.safeParse({...investment,brokerToken:'unsafe'}).success,false);
 const liability={name:'Other unpaid amount',liabilityKind:'OTHER',initialValueMinor:100,currency:'KES'};
 assert.equal(liabilitySchema.safeParse(liability).success,true);
 assert.equal(liabilitySchema.safeParse({...liability,liabilityKind:'MORTGAGE'}).success,false);
 const value={valueMinor:0,currency:'KES',recordedOn:'2026-11-06',note:'Reported decrease'};
 assert.equal(valuationSchema.safeParse(value).success,true);
 assert.equal(valuationSchema.safeParse({...value,note:'x'}).success,false);
});
test('B6 analytic model never claims provider performance or holdings are verified',()=>{
 const s={
  currency:'KES',assetTotalMinor:20000,liabilityTotalMinor:2000,estimatedNetWorthMinor:18000,
  breakdown:{manualCashAssetsMinor:5000,manualCashOverdraftMinor:0,otherAssetsMinor:8000,
   investmentEstimatesMinor:7000,reportedDebtsMinor:2000,otherLiabilitiesMinor:0},
  investments:[{id:'a',name:'Reported shares',costBasisMinor:5000,estimatedValueMinor:7000,
   nominalUnrealizedDifferenceMinor:2000,investmentKind:'EQUITY'}]
 } as Parameters<typeof wealthAnalytics>[0];
 const a=wealthAnalytics(s);
 assert.equal(a.estimatedNetWorthMinor,18000);
 assert.equal(a.assetsByClass.reduce((total,x)=>total+(x.shareBasisPoints??0),0),10000);
 assert.equal(a.nominalUnrealizedDifferenceMinor,2000);
 assert.equal(a.noVerifiedInvestmentPerformance,true);
 assert.equal(a.noExecutedTrades,true);
});
