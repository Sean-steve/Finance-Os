import test from 'node:test';
import assert from 'node:assert/strict';
import {validateStaging,probeStaging} from '../scripts/staging-readiness.mjs';
const config={
 NODE_ENV:'production',LOCAL_AUTH_ENABLED:'false',
 FINANCE_STAGE_UI_ORIGIN:'https://finance-staging.example.org',
 FINANCE_STAGE_API_ORIGIN:'https://api-finance-staging.example.org',
 FINANCE_STAGE_IDP_ISSUER:'https://identity-finance-staging.example.org/realms/finance',
 FINANCE_STAGE_RELEASE_SHA:'f'.repeat(40)
};
const routes={
 [config.FINANCE_STAGE_UI_ORIGIN+'/connected-config.json']:{apiBase:config.FINANCE_STAGE_API_ORIGIN},
 [config.FINANCE_STAGE_API_ORIGIN+'/health/ready']:{status:'ready',migrationTracking:true},
 [config.FINANCE_STAGE_API_ORIGIN+'/v1/meta']:{authenticationScope:'OIDC_VERIFIED_MFA',
   authenticationAvailable:true,financialEndpointsAvailable:true,productionReady:false},
 [config.FINANCE_STAGE_API_ORIGIN+'/v1/auth/provider']:{kind:'OIDC_PKCE',
  issuer:config.FINANCE_STAGE_IDP_ISSUER,
  requiredAcr:'urn:finance:mfa',
  redirectUri:config.FINANCE_STAGE_UI_ORIGIN+'/connected.html',
  authorizationEndpoint:config.FINANCE_STAGE_IDP_ISSUER+'/protocol/openid-connect/auth',
  tokenEndpoint:config.FINANCE_STAGE_IDP_ISSUER+'/protocol/openid-connect/token'},
 [config.FINANCE_STAGE_IDP_ISSUER+'/.well-known/openid-configuration']:{
  issuer:config.FINANCE_STAGE_IDP_ISSUER,code_challenge_methods_supported:['S256'],
  jwks_uri:config.FINANCE_STAGE_IDP_ISSUER+'/protocol/openid-connect/certs'},
 [config.FINANCE_STAGE_IDP_ISSUER+'/protocol/openid-connect/certs']:{
  keys:[{kty:'RSA',kid:'test-key-id'}]}
};
function fakeFetch(url,opt={}){
 const reqOrigin=new Headers(opt.headers).get('origin');
 if(url===config.FINANCE_STAGE_API_ORIGIN+'/v1/me')
  return Promise.resolve(new Response('{}',{status:401}));
 const data=routes[url];
 if(!data)return Promise.resolve(new Response('{}',{status:404}));
 const headers={'Content-Type':'application/json'};
 if(reqOrigin===config.FINANCE_STAGE_UI_ORIGIN)
  headers['Access-Control-Allow-Origin']=reqOrigin;
 return Promise.resolve(new Response(JSON.stringify(data),{status:200,headers}));
}
test('B8.1 rejects missing live staging host, local mode and production URL reuse',()=>{
 assert.equal(validateStaging({}).valid,false);
 assert.equal(validateStaging({...config,LOCAL_AUTH_ENABLED:'true'}).valid,false);
 assert.equal(validateStaging({...config,FINANCE_PRODUCTION_API_ORIGIN:config.FINANCE_STAGE_API_ORIGIN}).valid,false);
 assert.equal(validateStaging({...config,FINANCE_STAGE_API_ORIGIN:'http://127.0.0.1:3101'}).valid,false);
 assert.equal(validateStaging({...config,FINANCE_STAGE_API_ORIGIN:'https://example.com'}).valid,false);
 assert.equal(validateStaging({...config,FINANCE_STAGE_RELEASE_SHA:'not-commit'}).valid,false);
 assert.equal(validateStaging({...config,FINANCE_STAGE_API_ORIGIN:config.FINANCE_STAGE_UI_ORIGIN}).valid,false);
 assert.equal(validateStaging({...config,FINANCE_STAGE_IDP_ISSUER:'https://idp.finance.invalid/realms/finance'}).valid,false);
});
test('B8.1 validates operator staging origin contract without claiming a live deployment',()=>{
 const result=validateStaging(config);
 assert.equal(result.valid,true);
 assert.deepEqual(result.problems,[]);
});
test('B8.1 staging mock probe is scoped to HTTPS, MFA-bound provider and exact CORS',async()=>{
 const result=await probeStaging(config,fakeFetch);
 assert.equal(result.status,'STAGING_TECHNICALLY_REACHABLE',JSON.stringify(result.failures));
 assert.equal(result.passed.length,7);
 assert.equal(result.externalMfaProven,false);
 assert.equal(result.productionReady,false);
});
test('B8.1 remote probe fails closed on absent migrations, invalid MFA issuer and permissive CORS',async()=>{
 const failReady=(url,opt)=>url.endsWith('/health/ready')?Promise.resolve(new Response(
  JSON.stringify({status:'unavailable',migrationTracking:false}),
  {status:200,headers:{'Content-Type':'application/json'}})):fakeFetch(url,opt);
 const a=await probeStaging(config,failReady);
 assert.equal(a.status,'STAGING_BLOCKED');
 assert.ok(a.failures.some(x=>x.includes('API_READY')));
 const failOidc=(url,opt)=>url.endsWith('/v1/auth/provider')?Promise.resolve(new Response(
  JSON.stringify({...routes[url],requiredAcr:''}),
  {status:200,headers:{'Content-Type':'application/json'}})):fakeFetch(url,opt);
 const b=await probeStaging(config,failOidc);
 assert.equal(b.status,'STAGING_BLOCKED');
 assert.ok(b.failures.some(x=>x.includes('AUTH_PROVIDER_BINDING')));
 const allowAll=(url,opt)=>url.endsWith('/v1/meta')?Promise.resolve(new Response(
  JSON.stringify(routes[url]),{status:200,headers:{'Access-Control-Allow-Origin':'*'}})):fakeFetch(url,opt);
 const c=await probeStaging(config,allowAll);
 assert.equal(c.status,'STAGING_BLOCKED');
 assert.ok(c.failures.some(x=>x.includes('CORS_EXACT_ORIGIN')));
});
