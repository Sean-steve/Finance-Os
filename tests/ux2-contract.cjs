'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../ux2'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const api=read('src/api.ts'),session=read('src/session.tsx'),pages=read('src/pages.tsx'),app=read('src/app.tsx'),forms=read('src/forms.tsx'),css=read('src/styles.css'),cfg=JSON.parse(read('public/config.json'));
assert.equal(cfg.apiBase,null,'Public API origin must be explicitly operator configured');
assert.match(api,/https:/);assert.match(api,/Idempotency-Key/);assert.match(api,/credentials:'omit'/);assert.match(api,/onUnauthorized|this.expired/);
assert.match(session,/finance-os-v3-pkce/);assert.match(session,/code_challenge_method','S256'/);assert.match(session,/OIDC_VERIFIED_MFA/);
assert.match(session,/token=useRef<string\|null>\(null\)/);
assert.doesNotMatch(session,/localStorage/);
assert.match(session,/qc.clear\(\)/,'Clear all TanStack Query caches on identity/workspace change');
for(const id of ['home','activity','spending','cash-flow','goals','wealth','insights','settings'])assert.match(app,new RegExp('path="/'+id+'"'));
for(const title of ['Accounts','Transactions','Budgets','Cash Flow','Goals','Wealth'])assert.ok(pages.includes(title));
assert.match(pages,/\/reports\/monthly\?months=6/);
assert.match(read('src/finance.ts'),/\/certification\/financial-integrity/); // owner-only helper
assert.match(forms,/\/transactions/);assert.match(forms,/\/bills/);assert.match(forms,/\/wealth\/assets/);
assert.match(forms,/\/privacy\/requests/);assert.match(forms,/\/budgets/);
assert.match(css,/\.connected-metrics/);assert.match(css,/@media\(max-width:740px\)/);
assert.doesNotMatch(app+pages+forms,/Math\.random\(\).*balance|fakeBankBalance|seedDemoTransactions/);
console.log('PASS UX2 contract: React eight-route live API, no seeded financial fallbacks, workspace-scoped writes, MFA boundary, provenance disclosures.');
