'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const ui=fs.readFileSync('rebuild/connected.js','utf8');
const html=fs.readFileSync('connected.html','utf8');
const config=JSON.parse(fs.readFileSync('connected-config.json','utf8'));
assert.equal(config.apiBase,null,'Public connected API must fail closed until operator configures it.');
assert.match(html,/rebuild\/connected\.js/);
assert.doesNotMatch(html,/(rebuild\/app\.js|b1-connected\.js|src\/app\.js)/,
 'Authenticated app must never load demo runtime.');
assert.match(ui,/Array\.from|const groups=/);
assert.match(ui,/n>=1&&n<=60/);
assert.match(ui,/const names=/);
assert.match(ui,/finance-os-pkce/);
assert.match(ui,/crypto\.subtle\.digest\('SHA-256'/);
assert.match(ui,/sessionStorage\.removeItem\('finance-os-pkce'\)/);
assert.doesNotMatch(ui,/(localStorage\.setItem|localStorage\.getItem|sessionStorage\.setItem\(['"](?:token|auth|session))/,
 'Do not persist access tokens or credentials in browser storage.');
assert.doesNotMatch(ui,/(KCB Main Account|Steve Nyaga|Nflake \(Tech Business\)|1245800|620450|254800)/,
 'Connected UI cannot ship seeded personal/demo financial records.');
assert.match(ui,/domain not activated/);
assert.match(ui,/OIDC_PKCE|acr_values/);
assert.match(ui,/balanceQuality|balanceMinor/);
for(const n of [1,2,3,4,7,8,9,10,11,12,13,15])assert.ok(ui.includes('case '+n+':')||ui.includes('case '+n+':return'), 'missing routed server-backed screen '+n);
console.log('PASS connected frontend static safety and 60-route data-honesty contract');
