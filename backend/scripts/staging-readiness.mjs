#!/usr/bin/env node
// Finance OS B8.1 staging preflight: never use CI mocks as proof of a hosted release.
// Fetches only operator-approved HTTPS endpoints. Does not read or emit secrets.
import {pathToFileURL} from 'node:url';

const required=['FINANCE_STAGE_UI_ORIGIN','FINANCE_STAGE_API_ORIGIN','FINANCE_STAGE_IDP_ISSUER','FINANCE_STAGE_RELEASE_SHA'];
export function validateStaging(env=process.env){
 const problems=[], data={};
 for(const key of required)if(!env[key])problems.push('Required staging value missing: '+key);
 const check=(key,allowPath=false)=>{
  const value=env[key];if(!value)return null;
  try{
   const u=new URL(value);
   const host=u.hostname.toLowerCase();
   if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash||u.port||
      !host.includes('.')||['localhost','127.0.0.1','0.0.0.0'].includes(host)||
      host.endsWith('.invalid')||host.endsWith('.test')||host.endsWith('.example')||
      host==='example.com'||host==='example.org'||host.endsWith('.local')||
      (!allowPath&&u.pathname!=='/')||(allowPath&&u.pathname==='/'))
    throw Error('Staging endpoint must be a concrete HTTPS origin'+(allowPath?' or HTTPS issuer URL':''));
   return (allowPath?u.href:u.origin).replace(/\/$/,'');
  }catch{problems.push('Invalid or placeholder HTTPS staging endpoint: '+key);return null;}
 };
 data.uiOrigin=check('FINANCE_STAGE_UI_ORIGIN');
 data.apiOrigin=check('FINANCE_STAGE_API_ORIGIN');
 data.issuer=check('FINANCE_STAGE_IDP_ISSUER',true);
 const sha=env.FINANCE_STAGE_RELEASE_SHA;
 if(sha&&!/^[a-f\d]{40}$/i.test(sha))problems.push('FINANCE_STAGE_RELEASE_SHA must be 40 hexadecimal characters');
 data.releaseCommit=sha||null;
 if(data.uiOrigin&&data.apiOrigin&&data.uiOrigin===data.apiOrigin)
  problems.push('UI and API must use distinct staging origins');
 if(data.uiOrigin&&data.issuer&&new URL(data.uiOrigin).origin===new URL(data.issuer).origin)
  problems.push('UI and identity issuer must use distinct origins');
 if(data.apiOrigin&&data.issuer&&new URL(data.apiOrigin).origin===new URL(data.issuer).origin)
  problems.push('API and identity issuer must use distinct origins');
 if(env.FINANCE_PRODUCTION_API_ORIGIN&&data.apiOrigin===env.FINANCE_PRODUCTION_API_ORIGIN)
  problems.push('Staging API must not point to the production API');
 if(env.FINANCE_PRODUCTION_UI_ORIGIN&&data.uiOrigin===env.FINANCE_PRODUCTION_UI_ORIGIN)
  problems.push('Staging UI must not point to production UI');
 if(env.LOCAL_AUTH_ENABLED==='true')
  problems.push('Staging must not enable local password authentication');
 if(env.NODE_ENV&&env.NODE_ENV!=='production')
  problems.push('Staging runtime must use NODE_ENV=production to enforce OIDC and TLS');
 return {valid:!problems.length,problems,...data};
}
async function readJson(fetcher,url,origin){
 const response=await fetcher(url,{headers:{Accept:'application/json',...(origin?{Origin:origin}:{})},
  cache:'no-store',credentials:'omit',redirect:'error',signal:AbortSignal.timeout(7000)});
 if(!response.ok)throw Error('Unhealthy HTTP status '+response.status);
 const raw=await response.text();
 if(raw.length>65536)throw Error('Unexpectedly large probe response');
 return {data:JSON.parse(raw),response};
}
export async function probeStaging(env=process.env,fetcher=fetch){
 const config=validateStaging(env),failures=[...config.problems],passed=[];
 if(!config.valid)return {status:'STAGING_BLOCKED',passed,failures,releaseCommit:config.releaseCommit,
  externalMfaProven:false,productionReady:false};
 const attempt=async(name,run)=>{
  try{await run();passed.push(name);}catch(e){failures.push(name+': '+String(e?.message||e).slice(0,160));}
 };
 await attempt('HTTPS_UI_CONFIG',async()=>{
  const {data}=await readJson(fetcher,config.uiOrigin+'/connected-config.json');
  if(data.apiBase!==config.apiOrigin)throw Error('Staging frontend API origin is missing or incorrect');
 });
 await attempt('API_READY',async()=>{
  const {data}=await readJson(fetcher,config.apiOrigin+'/health/ready');
  if(data.status!=='ready'||data.migrationTracking!==true)throw Error('API database readiness unavailable');
 });
 await attempt('API_OIDC_ONLY',async()=>{
  const {data}=await readJson(fetcher,config.apiOrigin+'/v1/meta');
  if(data.authenticationScope!=='OIDC_VERIFIED_MFA'||data.authenticationAvailable!==true||
   data.financialEndpointsAvailable!==true||data.productionReady!==false)
   throw Error('API is not OIDC-connected, or claims unsupported production certification');
 });
 await attempt('AUTH_PROVIDER_BINDING',async()=>{
  const {data}=await readJson(fetcher,config.apiOrigin+'/v1/auth/provider');
  if(data.kind!=='OIDC_PKCE'||data.issuer!==config.issuer||!data.requiredAcr||
   data.redirectUri!==config.uiOrigin+'/connected.html'||
   new URL(data.tokenEndpoint).origin!==new URL(config.issuer).origin||
   new URL(data.authorizationEndpoint).origin!==new URL(config.issuer).origin)
   throw Error('OIDC issuer, redirect or MFA assurance is not bound to staging');
 });
 await attempt('OIDC_DISCOVERY',async()=>{
  const {data}=await readJson(fetcher,config.issuer+'/.well-known/openid-configuration');
  if(data.issuer!==config.issuer||!data.code_challenge_methods_supported?.includes('S256')||
   new URL(data.jwks_uri).origin!==new URL(config.issuer).origin)
   throw Error('Invalid provider discovery, JWKS origin or PKCE capability');
  const keys=(await readJson(fetcher,data.jwks_uri)).data.keys;
  if(!Array.isArray(keys)||!keys.some(x=>x.kty==='RSA'&&x.kid))throw Error('No usable RSA signing keys');
 });
 await attempt('API_FAILS_CLOSED_WITHOUT_TOKEN',async()=>{
  const response=await fetcher(config.apiOrigin+'/v1/me',{cache:'no-store',
   credentials:'omit',redirect:'error',signal:AbortSignal.timeout(7000)});
  if(response.status!==401)throw Error('Unauthenticated private data was not denied');
 });
 await attempt('CORS_EXACT_ORIGIN',async()=>{
  const ok=await fetcher(config.apiOrigin+'/v1/meta',{headers:{Origin:config.uiOrigin},
   redirect:'error',signal:AbortSignal.timeout(7000)});
  const denied=await fetcher(config.apiOrigin+'/v1/meta',{headers:{Origin:'https://untrusted.invalid'},
   redirect:'error',signal:AbortSignal.timeout(7000)});
  if(ok.headers.get('access-control-allow-origin')!==config.uiOrigin||
   denied.headers.get('access-control-allow-origin'))
   throw Error('CORS does not match the approved staging frontend origin');
 });
 return {status:failures.length?'STAGING_BLOCKED':'STAGING_TECHNICALLY_REACHABLE',
  passed,failures,releaseCommit:config.releaseCommit,externalMfaProven:false,
  humanApprovalRequired:true,backupRestorationVerified:false,legalApprovalVerified:false,
  productionReady:false};
}
async function main(){
 const result=process.argv.includes('--probe')
  ?await probeStaging():validateStaging();
 console.log(JSON.stringify(result,null,2));
 if(result.status==='STAGING_BLOCKED'||result.valid===false)process.exitCode=2;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 main().catch(()=>{console.error(JSON.stringify({status:'STAGING_BLOCKED',reason:'Staging verification failed without exposing sensitive details'}));process.exitCode=2;});
