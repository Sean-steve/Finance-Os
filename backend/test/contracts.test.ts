import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
const c=JSON.parse(readFileSync(new URL('../openapi/finance-os.v1.json',import.meta.url),'utf8'));
test('contract is versioned and all financial endpoints are explicitly future-only',()=>{
 assert.equal(c.openapi,'3.0.3');
 const implemented=['/health/live','/health/ready','/v1/meta'];
 let planned=0, ids=new Set<string>();
 for(const [url,methods] of Object.entries(c.paths) as [string,any][]){
  for(const [verb,op] of Object.entries(methods) as [string,any][]){
   assert.ok(!ids.has(op.operationId),'duplicate operationId '+op.operationId);ids.add(op.operationId);
   if(implemented.includes(url)){assert.equal(op['x-implementation-status'],'IMPLEMENTED_B0');continue}
   assert.equal(op['x-implementation-status'],'PLANNED',url);
   assert.ok(['B1','B2','B3'].includes(op['x-implementation-phase']));
   assert.ok(op.security?.[0]?.bearerAuth, 'Missing bearer security '+url);
   assert.ok(op.parameters?.some((x:any)=>x.name==='X-Workspace-Id'&&x.required));
   if(verb==='post')assert.ok(op.parameters?.some((x:any)=>x.name==='Idempotency-Key'&&x.required));
   planned++;
  }
 }
 assert.ok(planned>=20);
 assert.deepEqual(Object.keys(c.paths).filter((k:string)=>implemented.includes(k)).sort(),implemented.slice().sort());
});
test('financial money amounts use integer minor units and a currency code',()=>{
 const money=c.components.schemas.Money;
 assert.equal(money.properties.minor.type,'integer');
 assert.equal(money.properties.minor.format,'int64');
 assert.equal(money.properties.currency.pattern,'^[A-Z]{3}$');
 assert.ok(money.required.includes('currency') && money.required.includes('minor'));
});
