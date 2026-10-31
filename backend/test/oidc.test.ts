import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,randomUUID} from 'node:crypto';
import {createOidcVerifier} from '../src/oidc.js';
import {loadConfig,type OidcConfig} from '../src/config.js';

const {publicKey,privateKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk=publicKey.export({format:'jwk'}) as Record<string,string>;
Object.assign(jwk,{kid:'test-key-1',alg:'RS256',use:'sig'});
const issuer='https://login.finance-test.invalid';
const cfg:OidcConfig={
 issuer,audience:'finance-api',jwksUri:issuer+'/keys',clientId:'finance-spa',
 authorizationEndpoint:issuer+'/authorize',tokenEndpoint:issuer+'/token',
 redirectUri:'https://finance.example/connected.html',requiredAcr:'urn:finance:mfa',
 maxAuthAgeSeconds:3600
};
const fetcher=async()=>new Response(JSON.stringify({keys:[jwk]}),{status:200,
 headers:{'Content-Type':'application/json'}}) as Response;
const now=()=>Math.floor(Date.now()/1000);
const claims=()=>({iss:issuer,sub:randomUUID(),aud:cfg.audience,iat:now()-40,nbf:now()-30,
 exp:now()+600,auth_time:now()-60,acr:cfg.requiredAcr,email_verified:true,email:'test@example.invalid',name:'Verified Person'});
function token(payload:object,header:object={alg:'RS256',typ:'at+jwt',kid:'test-key-1'}){
 const raw=Buffer.from(JSON.stringify(header)).toString('base64url')+'.'+Buffer.from(JSON.stringify(payload)).toString('base64url');
 return raw+'.'+sign('RSA-SHA256',Buffer.from(raw),privateKey).toString('base64url');
}
test('OIDC requires configured issuer, audience, redirect origin, TLS and MFA',()=>{
 const good={NODE_ENV:'production',DATABASE_URL:'postgresql://finance_app:1@db.example/finance?sslmode=verify-full',
  AUTH_DATABASE_URL:'postgresql://finance_auth:2@db.example/finance?sslmode=verify-full',
  CORS_ALLOWED_ORIGINS:'https://finance.example',
  OIDC_ISSUER:cfg.issuer,OIDC_JWKS_URI:cfg.jwksUri,OIDC_AUDIENCE:cfg.audience,
  OIDC_CLIENT_ID:cfg.clientId,OIDC_AUTHORIZATION_ENDPOINT:cfg.authorizationEndpoint,
  OIDC_TOKEN_ENDPOINT:cfg.tokenEndpoint,OIDC_REDIRECT_URI:cfg.redirectUri,OIDC_REQUIRED_ACR:cfg.requiredAcr};
 assert.ok(loadConfig(good).oidc);
 assert.throws(()=>loadConfig({...good,OIDC_REQUIRED_ACR:''}),/OIDC_REQUIRED_ACR/);
 assert.throws(()=>loadConfig({...good,OIDC_JWKS_URI:'http://insecure.example/keys'}),/HTTPS/);
 assert.throws(()=>loadConfig({...good,OIDC_JWKS_URI:'https://attacker.example/keys'}),/same origin/);
 assert.throws(()=>loadConfig({...good,LOCAL_AUTH_ENABLED:'true'}),/forbidden/);
 assert.throws(()=>loadConfig({...good,DATABASE_URL:'postgresql://x:1@db.example/finance?sslmode=disable'}),/sslmode/);
 assert.throws(()=>loadConfig({...good,CORS_ALLOWED_ORIGINS:'https://other.example'}),/origin/);
});
test('valid pinned RS256 OIDC JWT verifies MFA, issuer, audience and email',async()=>{
 const result=await createOidcVerifier(cfg,fetcher as typeof fetch).validate(token(claims()));
 assert.equal(result.acr,cfg.requiredAcr);assert.equal(result.email_verified,true);
});
test('rejects forged signature, wrong audience, issuer, missing MFA and unverified email',async()=>{
 const v=createOidcVerifier(cfg,fetcher as typeof fetch);
 const malformed=token(claims()).split('.');
 malformed[1]=Buffer.from(JSON.stringify({...claims(),email:'attacker@example.invalid'})).toString('base64url');
 await assert.rejects(v.validate(malformed.join('.')),/invalid/i);
 for(const overrides of [
  {aud:'other-api'},{iss:'https://evil.example'},{exp:now()-100},
  {acr:'urn:pwd'},{auth_time:now()-90000},{email_verified:false},{email:'not-email'},
  {iat:now()+5000}
 ]){
  await assert.rejects(v.validate(token({...claims(),...overrides})));
 }
 await assert.rejects(v.validate(token(claims(),{alg:'none',kid:'test-key-1'})),/invalid/i);
 await assert.rejects(v.validate(token(claims(),{alg:'HS256',kid:'test-key-1'})),/invalid/i);
 await assert.rejects(v.validate(token(claims(),{alg:'RS256',kid:'other-kid'})),/invalid/i);
});
test('JWKS outage fails closed and remote denial cannot bypass signature checks',async()=>{
 const v=createOidcVerifier(cfg,(async()=>{throw new Error('Identity provider down')}) as typeof fetch);
 await assert.rejects(v.validate(token(claims())),/unavailable/i);
});
