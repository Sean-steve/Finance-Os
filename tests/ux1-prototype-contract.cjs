'use strict';
const fs=require('node:fs'),assert=require('node:assert/strict'),path=require('node:path');
const dir=path.join(__dirname,'../v3');
const html=fs.readFileSync(path.join(dir,'index.html'),'utf8');
const css=fs.readFileSync(path.join(dir,'styles.css'),'utf8');
const js=fs.readFileSync(path.join(dir,'app.js'),'utf8');
new Function(js);
assert.match(html,/script defer src="\.\/app\.js"/);
assert.match(html,/Content-Security-Policy/);
assert.match(html,/connect-src 'none'/,'UX1 must not send data to external APIs');
assert.match(html,/script-src 'self'/);
assert.doesNotMatch(html,/https?:\/\/[^"'\s]+\.(?:js|css)/);
assert.match(js,/Sample financial data/);
assert.match(js,/NO API calls/);
assert.doesNotMatch(js,/\bfetch\s*\(|\blocalStorage\b\.|\bsessionStorage\b\.|document\.cookie/);
for(const id of ['home','activity','spending','cash-flow','goals','wealth','insights','settings']){
 assert.match(js,new RegExp("'"+id+"'"),'V3 navigation includes '+id);
}
assert.match(js,/function welcome\(\)/);
assert.match(js,/function authPreview\(\)/);
assert.match(js,/function onboarding\(\)/);
assert.match(js,/function home\(\)/);
assert.match(js,/function chart\(\)/);
assert.match(js,/function categoryRows\(/);
assert.match(js,/function cashFlow\(/);
assert.match(js,/function insights\(/);
for(const name of ['transaction','account','goal','budget','bill','allocate']){
 assert.ok(js.includes("kind==='"+name+"'"),'Missing interactive form '+name);
}
assert.match(js,/role="dialog" aria-modal="true"/);
assert.match(js,/data-chart-index/);
assert.match(js,/Accessible chart data/);
assert.match(js,/state\.toast/);
assert.match(js,/id="main"/);
assert.match(css,/\.mobile-nav\{display:grid/);
assert.match(css,/@media\(max-width:415px\)/);
assert.match(css,/prefers-reduced-motion/);
assert.match(js,/no backend posting|No backend posting|in memory only/i);
console.log('PASS UX1 structural: isolated offline no-credentials demo, 8 destinations, forms, charts, modal focus, mobile, source disclaimers.');
