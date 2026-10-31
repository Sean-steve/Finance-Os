import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const c=JSON.parse(readFileSync(new URL('../openapi/finance-os.v1.json',import.meta.url),'utf8'));
test('B1 contract differentiates locally implemented endpoints from future APIs',()=>{
 assert.equal(c.openapi,'3.0.3');
 const ids=new Set<string>();let b1=0,planned=0;
 for(const [path,methods] of Object.entries(c.paths) as [string,any][]){
  for(const [method,op] of Object.entries(methods) as [string,any][]){
   assert.ok(op.operationId,'missing operationId '+path);
   assert.ok(!ids.has(op.operationId),'duplicate operationId '+op.operationId);ids.add(op.operationId);
   const status=op['x-implementation-status'];
   assert.ok(['PLANNED','IMPLEMENTED_B0','IMPLEMENTED_B1_LOCAL','IMPLEMENTED_B1_1','IMPLEMENTED_B2','IMPLEMENTED_B3','IMPLEMENTED_B4'].includes(status),status);
   if(status==='IMPLEMENTED_B1_LOCAL'){
    b1++;
    if(!path.startsWith('/v1/auth/register')&&!path.startsWith('/v1/auth/login'))
     assert.ok(op.security?.[0]?.bearerAuth,'missing bearer on '+path);
    if(path.includes('{workspaceId}'))
     assert.ok(op.parameters?.some((p:any)=>p.name==='workspaceId'&&p.required));
    if(method==='post' && path.includes('{workspaceId}'))
     assert.ok(op.parameters?.some((p:any)=>p.name==='Idempotency-Key'&&p.required));
   }
   if(status==='IMPLEMENTED_B1_1')assert.equal(path,'/v1/auth/provider');
   if(status==='IMPLEMENTED_B2'){assert.ok(path.startsWith('/v1/workspaces/{workspaceId}/'));assert.ok(op.security?.[0]?.bearerAuth);}
   if(status==='IMPLEMENTED_B3'){assert.ok(path.startsWith('/v1/workspaces/{workspaceId}/'));assert.ok(op.security?.[0]?.bearerAuth);}
   if(status==='IMPLEMENTED_B4'){assert.ok(path.startsWith('/v1/workspaces/{workspaceId}/'));assert.ok(op.security?.[0]?.bearerAuth);}
   if(status==='PLANNED')planned++;
  }
 }
 assert.ok(b1>=18);assert.ok(planned>=20);
 assert.equal(c.paths['/v1/auth/login'].post['x-implementation-status'],'IMPLEMENTED_B1_LOCAL');
 assert.equal(c.paths['/v1/workspaces/{workspaceId}/transactions'].post['x-implementation-status'],'IMPLEMENTED_B1_LOCAL');
 assert.equal(c.paths['/v1/transactions'].get['x-implementation-status'],'PLANNED');
});
test('B1 amounts use safe integer minor units and financial posting operations are scoped',()=>{
 const s=c.components.schemas.B1Transaction;
 assert.equal(s.properties.amountMinor.format,'int64');
 assert.ok(s.required.includes('journalEntryId'));
 assert.equal(c.components.schemas.Money.properties.minor.type,'integer');
 assert.equal(c.components.schemas.Money.properties.currency.pattern,'^[A-Z]{3}$');
});
