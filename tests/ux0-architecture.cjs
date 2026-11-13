'use strict';
// UX0 strategy/architecture contract, no financial fixtures or network connections.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const here=path.join(root,'product/ux0');
const architecture=JSON.parse(fs.readFileSync(path.join(here,'experience-architecture.json'),'utf8'));
const legacy=fs.readFileSync(path.join(root,'rebuild/connected.js'),'utf8');
const matching=legacy.match(/const names=\[([\s\S]*?)\];/);
assert.ok(matching,'Canonical B1.1 screen title list missing');
const titles=[...matching[1].matchAll(/'([^']*)'/g)].map(m=>m[1]);
assert.equal(titles.length,61,'Original source must enumerate screen 1 through 60 plus empty index 0');
assert.equal(architecture.phase,'UX0');
assert.equal(architecture.status,'DESIGN_CONTRACT_PROPOSED_NOT_USER_VALIDATED');
assert.equal(architecture.designRules.noNumbersInNavigation,true);
assert.equal(architecture.designRules.noAuthOrOnboardingInAuthenticatedMenu,true);
assert.equal(architecture.designRules.realMoneyProvenanceRequired,true);
assert.equal(architecture.designRules.noSyntheticFinancialRecordsInAuthenticatedUI,true);
assert.equal(architecture.designRules.suppressUnverifiedAvailableToSpend,true);
assert.equal(architecture.navigation.length,8,'Exactly eight goal-driven primary destinations');
const expected=['home','activity','spending','cash-flow','goals','wealth','insights','settings'];
assert.deepEqual(architecture.navigation.map(x=>x.id),expected);
assert.equal(architecture.routeMap.length,60,'Every legacy screen needs one destination');
const seenIds=new Set(),seenRoutes=new Set();
for(const r of architecture.routeMap){
 assert.ok(Number.isInteger(r.legacyScreen)&&r.legacyScreen>=1&&r.legacyScreen<=60,'Screen ID out of range');
 assert.ok(!seenIds.has(r.legacyScreen),'Duplicate legacy screen');
 seenIds.add(r.legacyScreen);
 assert.equal(r.legacyLabel,titles[r.legacyScreen],'Original screen title drift');
 assert.match(r.path,/^\/[a-z][a-z0-9/:-]*$/,'Invalid route shape');
 assert.ok(!seenRoutes.has(r.path),'Duplicate route: '+r.path);
 seenRoutes.add(r.path);
 assert.ok(expected.includes(r.destination)||['auth','onboarding'].includes(r.destination));
 assert.ok(['full-page','guided','page','detail','drawer','modal','disabled'].includes(r.presentation));
 if(r.legacyScreen<=3)assert.ok(['auth','onboarding'].includes(r.destination),'Auth / onboarding outside app shell');
 if(r.legacyScreen>=4)assert.ok(expected.includes(r.destination),'Only app features inside app navigation');
}
for(const n of architecture.navigation){
 assert.ok(seenRoutes.has(n.path),'Navigation anchor has no designed route '+n.path);
 assert.ok(!/[0-9]{2}/.test(n.label),'Do not label navigation by legacy screen IDs');
 assert.ok(!/auth|onboard|welcome/i.test(n.id+' '+n.label),'Auth never belongs to the menu');
}
assert.deepEqual(architecture.mobilePrimary,['home','activity','spending','goals','more']);
const risk={5:'safe',14:'transfer',31:'settle',35:'allocation',36:'virtual',40:'afford',42:'scenario',49:'estate',57:'AI',59:'integration',60:'manual'};
for(const [id] of Object.entries(risk)){
 assert.ok(architecture.routeMap[Number(id)-1].trustRule,'Missing explicit limitation on risk-sensitive legacy screen '+id);
}
assert.equal(architecture.routeMap[13].presentation,'disabled','Transfers must never appear operational without certified backend');
for(const key of ['firstValue','monthlyControl','financialProgress']){
 assert.ok(architecture.userJourneyRoutes[key]?.length>=3,'Missing journey '+key);
 for(const route of architecture.userJourneyRoutes[key])assert.ok(route.startsWith('/'));
}
const flags=Object.fromEntries(architecture.flowRules.map(x=>[x.capability,x.implementation]));
assert.equal(flags.transfers,'BLOCKED');
assert.equal(flags.provider_connections,'BLOCKED');
assert.equal(flags.payments,'BLOCKED');
assert.equal(flags['AI advice'],'RULES_ONLY');
assert.equal(flags.savings_buckets,'VIRTUAL_ONLY');
assert.equal(flags.financial_integrity,'MANUAL_LEDGER_ONLY');
for(const name of ['PRODUCT_STRATEGY.md','EXPERIENCE_ARCHITECTURE.md','DESIGN_DIRECTION.md','DELIVERY_AND_RESEARCH.md']){
 const content=fs.readFileSync(path.join(here,name),'utf8');
 assert.ok(content.length>2000,name+' must be a substantive completed specification');
}
console.log('PASS Finance OS UX0: 60-of-60 mapped to 8 outcome-driven destinations; auth removed from nav; financial-trust gates preserved; journey/design/research specs present. UX1 prototype and live product are NOT certified.');
