import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildApp } from '../src/app.js';
import { loadConfig } from '../src/config.js';

const config = {
  nodeEnv:'test' as const, host:'127.0.0.1', port:3101,
  databaseUrl:'postgresql://not-used.invalid/test', corsAllowedOrigins:['http://localhost:8080'],
  logLevel:'silent' as const,localAuthEnabled:false,authDatabaseUrl:undefined,
};
test('liveness, documented API stage and no prematurely served financial routes', async () => {
  const app = await buildApp({config,database:{query: async()=>({rows:[{version:'001_identity_workspaces.sql'},{version:'002_financial_domains.sql'},{version:'003_integrity_rls.sql'}]})}});
  try {
    const live = await app.inject({method:'GET',url:'/health/live'});
    assert.equal(live.statusCode,200);
    assert.equal(live.json().status,'live');
    const ready = await app.inject({method:'GET',url:'/health/ready'});
    assert.equal(ready.statusCode,200);
    const meta = await app.inject({method:'GET',url:'/v1/meta'});
    assert.equal(meta.json().financialEndpointsAvailable,false);
    assert.equal(meta.json().authenticationAvailable,false);
    assert.equal((await app.inject({method:'GET',url:'/v1/accounts'})).statusCode,404);
    assert.equal((await app.inject({method:'POST',url:'/v1/ledger/journal-entries',payload:{}})).statusCode,404);
    assert.equal(live.headers['cache-control'],'no-store');
  } finally {await app.close();}
});
test('database readiness fails closed with 503', async () => {
  const app=await buildApp({config,database:{query:async()=>{throw new Error('database credentials hidden') }}});
  try {
    const response=await app.inject({method:'GET',url:'/health/ready'});
    assert.equal(response.statusCode,503);
    assert.ok(!response.body.includes('credentials hidden'));
  } finally {await app.close();}
});
test('CORS grants only explicit configured frontend origins', async()=>{
  const app=await buildApp({config,database:{query:async()=>({rows:[]})}});
  try {
    const allowed=await app.inject({method:'GET',url:'/v1/meta',headers:{origin:'http://localhost:8080'}});
    assert.equal(allowed.headers['access-control-allow-origin'],'http://localhost:8080');
    const denied=await app.inject({method:'GET',url:'/v1/meta',headers:{origin:'https://attacker.example'}});
    assert.ok(!denied.headers['access-control-allow-origin']);
  } finally {await app.close();}
});
test('production rejects missing identity provider, untrusted CORS and inadequate database TLS',()=>{
 const oidc={NODE_ENV:'production',DATABASE_URL:'postgresql://app:p@db-host/finance?sslmode=verify-full',
  AUTH_DATABASE_URL:'postgresql://auth:p@db-host/finance?sslmode=verify-full',
  OIDC_ISSUER:'https://login.example',OIDC_AUDIENCE:'finance-api',OIDC_JWKS_URI:'https://login.example/jwks',
  OIDC_CLIENT_ID:'finance-spa',OIDC_AUTHORIZATION_ENDPOINT:'https://login.example/authorize',
  OIDC_TOKEN_ENDPOINT:'https://login.example/token',OIDC_REDIRECT_URI:'https://finance.example/connected.html',
  OIDC_REQUIRED_ACR:'urn:mfa',CORS_ALLOWED_ORIGINS:'https://finance.example'};
 assert.throws(()=>loadConfig({NODE_ENV:'production',DATABASE_URL:'postgresql://db-host/finance',
  CORS_ALLOWED_ORIGINS:'http://localhost:8080'}),/OIDC/);
 assert.throws(()=>loadConfig({...oidc,CORS_ALLOWED_ORIGINS:'http://finance.example'}),/origin|HTTPS/);
 assert.throws(()=>loadConfig({...oidc,DATABASE_URL:'postgresql://db-host/finance?sslmode=disable'}),/sslmode/);
});
