import test from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.mjs';

test('liveness never requires database or credentials', async () => {
 const app = await buildApp(); const result = await app.inject('/health/live');
 assert.equal(result.statusCode, 200); assert.deepEqual(result.json(), { status: 'ok', service: 'finance-os-api' });
 assert.equal(result.headers['cache-control'], 'no-store'); await app.close();
});
test('readiness fails closed without a database', async () => {
 const app = await buildApp(); const response = await app.inject('/health/ready');
 assert.equal(response.statusCode, 503); assert.equal(response.json().status, 'unavailable'); await app.close();
});
test('readiness checks database and returns 503 without leaking errors', async () => {
 const app = await buildApp({ pool: { query: async () => { throw new Error('secret postgres connection'); } } });
 const response = await app.inject('/health/ready');
 assert.equal(response.statusCode, 503); assert.ok(!response.body.includes('secret postgres')); await app.close();
});
test('readiness succeeds with responsive database', async () => {
 const app = await buildApp({ pool: { query: async () => ({ rows: [{ '?column?': 1 }] }) } });
 assert.equal((await app.inject('/health/ready')).statusCode, 200); await app.close();
});
test('B0 exposes no functional finance, login or transaction mutations', async () => {
 const app = await buildApp();
 for (const endpoint of ['/v1/auth/login', '/v1/accounts', '/v1/transactions', '/v1/ledger/postings']) {
  const response = await app.inject({method:'POST',url:endpoint,payload:{amountMinor:100}});
  assert.equal(response.statusCode,404,endpoint);
 }
 assert.equal((await app.inject('/v1')).json().stage,'B0');
 await app.close();
});
