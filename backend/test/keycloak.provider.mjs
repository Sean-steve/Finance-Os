import {createPublicKey,verify} from 'node:crypto';
import assert from 'node:assert/strict';

const issuer='http://127.0.0.1:8180/realms/finance-os-ci';
const discovery=await fetch(issuer+'/.well-known/openid-configuration',{signal:AbortSignal.timeout(8000)});
assert.equal(discovery.status,200,'Actual Keycloak OpenID discovery must be online');
const metadata=await discovery.json();
assert.equal(metadata.issuer,issuer);
assert.ok(metadata.response_types_supported?.includes('code'),'Authorization Code grant must be supported');
assert.ok(metadata.code_challenge_methods_supported?.includes('S256'),'PKCE S256 must be available');
const jwks=await fetch(metadata.jwks_uri,{signal:AbortSignal.timeout(8000)}).then(r=>r.json());
assert.ok(jwks.keys.length>0,'Real provider must publish asymmetric signing keys');
const tokenBody=(username,password)=>new URLSearchParams({
 grant_type:'password',client_id:'finance-os-spa',username,password,scope:'openid email profile'});
const tokenRequest=async (username,password)=>fetch(metadata.token_endpoint,{
 method:'POST',headers:{'content-type':'application/x-www-form-urlencoded'},
 body:tokenBody(username,password),signal:AbortSignal.timeout(8000)});
const response=await tokenRequest('ci-protocol','CI-ONLY-protocol-password-2026');
assert.equal(response.status,200,'Disposable protocol-only user should issue a genuine Keycloak token');
const {access_token}=await response.json();
assert.ok(access_token&&access_token.split('.').length===3);
const [head,body,signature]=access_token.split('.');
const header=JSON.parse(Buffer.from(head,'base64url').toString('utf8'));
const claims=JSON.parse(Buffer.from(body,'base64url').toString('utf8'));
assert.equal(header.alg,'RS256');
assert.equal(claims.iss,issuer);
assert.ok(claims.aud==='finance-os-api'||Array.isArray(claims.aud)&&claims.aud.includes('finance-os-api'),
 'Access token must target dedicated Finance OS API, not just a generic SPA');
assert.ok(claims.exp>Math.floor(Date.now()/1000));
const candidates=jwks.keys.filter(k=>k.kid===header.kid&&k.kty==='RSA');
assert.equal(candidates.length,1,'Matching real Keycloak signing key is required');
const ok=verify('RSA-SHA256',Buffer.from(head+'.'+body),
 createPublicKey({key:candidates[0],format:'jwk'}),Buffer.from(signature,'base64url'));
assert.equal(ok,true,'Real JWT signature must verify against actual JWKS');
const insufficient=claims.acr;
assert.notEqual(insufficient,'urn:finance-os:mfa',
 'A password-only token must NEVER claim the Finance OS MFA assurance level');
const enrolled=await tokenRequest('ci-mfa-required','CI-ONLY-mfa-password-2026');
assert.notEqual(enrolled.status,200,'User with required OTP setup must not bypass a required action by password-only grant');
console.log(JSON.stringify({status:'PASS',provider:'Keycloak 26.8.1 (temporary CI)',
 discovery:true,jwksVerification:true,apiAudience:true,pkceS256:true,
 requiredOtpActionBlocksPasswordOnly:true,productionIdpActivated:false,
 liveMfaLoginCertified:false}));
