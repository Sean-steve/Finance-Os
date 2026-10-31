import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';

const spec = JSON.parse(await readFile(new URL('../contracts/openapi.json', import.meta.url),'utf8'));
const migrations = (await readdir(new URL('../db/migrations/', import.meta.url))).filter(x=>x.endsWith('.sql')).sort();

test('OpenAPI 3.1 describes the canonical B0-to-B1 contract with explicit security',()=>{
 assert.equal(spec.openapi,'3.1.0');
 assert.ok(Object.keys(spec.paths).length>=12);
 assert.ok(spec.security?.[0]?.bearerAuth);
 for(const [path,verbs] of Object.entries(spec.paths)) for(const [verb,op] of Object.entries(verbs)) {
  assert.ok(op.operationId,verb+' '+path);
  assert.ok(op.responses,verb+' '+path);
  if(!path.startsWith('/health') && path!=='/v1') {
   assert.ok(op.responses['401'],verb+' '+path+' requires 401');
   assert.ok(op.responses['403'],verb+' '+path+' requires 403');
  }
 }
 assert.equal(spec.components.schemas.Money.properties.amountMinor.format,'int64');
 assert.equal(spec.components.schemas.Journal.properties.lines.minItems,2);
});
test('Every write contract requires idempotency and every workspace endpoint is scoped',()=>{
 for(const [path,verbs] of Object.entries(spec.paths)){
  if(path.includes('{workspaceId}')) for(const operation of Object.values(verbs)) assert.ok(operation.parameters?.some(p=>p.name==='workspaceId' && p.required),path);
  for(const [method,op] of Object.entries(verbs)) if(['post','patch','put','delete'].includes(method)) assert.ok(op.parameters?.some(p=>p.name==='Idempotency-Key' && p.required),method+' '+path);
 }
});
test('Migration names and defense-in-depth boundaries are retained',async()=>{
 assert.deepEqual(migrations,['0001_identity_workspaces.sql','0002_ledger.sql','0003_planning.sql','0004_rls.sql']);
 const ledger=await readFile(new URL('../db/migrations/0002_ledger.sql',import.meta.url),'utf8');
 const rls=await readFile(new URL('../db/migrations/0004_rls.sql',import.meta.url),'utf8');
 assert.match(ledger,/DEFERRABLE INITIALLY DEFERRED/);
 assert.match(ledger,/immutable/);
 assert.match(rls,/ENABLE ROW LEVEL SECURITY/);
 assert.match(rls,/workspace_memberships/);
});
