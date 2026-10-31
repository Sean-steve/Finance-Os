import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import type pg from 'pg';
import type {Config} from './config.js';
import type {Queryable} from './db/client.js';
import {installAuthRoutes,sessionIdentity,DomainError} from './auth.js';
import {installFinanceRoutes,type IdentityResolver} from './finance.js';
import {installB2Routes} from './b2.js';
import {createOidcVerifier,createOidcIdentity,installOidcRoutes} from './oidc.js';

export const API_CONTRACT='finance-os.v1';
export type Dependencies={config:Config;database:Queryable;financePool?:pg.Pool;authPool?:pg.Pool;
 oidcFetch?:typeof fetch};
export async function buildApp({config,database,financePool,authPool,oidcFetch}:Dependencies){
 const app=Fastify({logger:{level:config.logLevel,redact:[
  'req.headers.authorization','req.headers.cookie','res.headers.set-cookie','req.body.password',
  'req.body.token','req.body.code','req.body.codeVerifier']},trustProxy:false,
  bodyLimit:65536,requestIdHeader:false});
 await app.register(helmet);
 await app.register(cors,{credentials:false,origin(origin,cb){
  cb(null,!origin||config.corsAllowedOrigins.includes(origin));
 }});
 const buckets=new Map<string,{count:number;until:number}>();
 app.addHook('onRequest',async(request,reply)=>{
  reply.header('Cache-Control','no-store');
  reply.header('X-Content-Type-Options','nosniff');
  reply.header('Referrer-Policy','no-referrer');
  const method=request.method.toUpperCase();
  if(method==='POST'||method==='PATCH'||method==='PUT'||method==='DELETE'){
   const origin=request.headers.origin;
   if(origin && !config.corsAllowedOrigins.includes(origin)){
    reply.code(403).send({error:{code:'UNTRUSTED_ORIGIN',message:'Origin is not permitted'}});return reply;
   }
   const ct=request.headers['content-type'];
   if(method!=='DELETE' && ct && !ct.startsWith('application/json')){
    reply.code(415).send({error:{code:'UNSUPPORTED_MEDIA_TYPE',message:'JSON requests only'}});return reply;
   }
  }
  if(request.url==='/health/live')return;
  // Per-instance rate limit is defense in depth. Deploy a shared proxy/WAF limit before exposure.
  const now=Date.now(),key=request.ip;
  const prev=buckets.get(key),entry=!prev||prev.until<now?{count:1,until:now+60_000}:prev;
  if(prev&&entry===prev)entry.count++;
  buckets.set(key,entry);
  if(buckets.size>15000)for(const [k,v] of buckets){if(v.until<now)buckets.delete(k);}
  if(entry.count>120){
   reply.header('Retry-After',String(Math.max(1,Math.ceil((entry.until-now)/1000))));
   reply.code(429).send({error:{code:'RATE_LIMIT',message:'Too many requests'}});return reply;
  }
 });
 app.addHook('onSend',async(_request,reply,payload)=>{reply.header('Cache-Control','no-store');return payload;});
 app.get('/health/live',async()=>({status:'live',service:'finance-os-api'}));
 app.get('/health/ready',async(_request,reply)=>{
  try{
   const result=await database.query('SELECT version FROM schema_migrations ORDER BY version');
   const versions=new Set(result.rows.map(row=>(row as {version:string}).version));
   const required=['001_identity_workspaces.sql','002_financial_domains.sql','003_integrity_rls.sql'];
   if(config.localAuthEnabled||config.oidc)required.push('004_b1_identity_ledger.sql','005_b1_reversals.sql','006_b2_spending_controls.sql');
   if(!required.every(version=>versions.has(version)))throw new Error('Migrations not applied');
   return {status:'ready',migrationTracking:true};
  }catch{
   reply.code(503);return {status:'unavailable',migrationTracking:false};
  }
 });
 const enabled=Boolean((config.localAuthEnabled||config.oidc)&&financePool&&authPool);
 app.get('/v1/meta',async()=>({api:API_CONTRACT,stage:enabled?'B2':'B0',implementation:enabled?'connected-server':'foundation-only',
  financialEndpointsAvailable:enabled,authenticationAvailable:enabled,productionReady:false,
  authenticationScope:config.oidc?'OIDC_VERIFIED_MFA':config.localAuthEnabled?'LOCAL_TEST_ONLY':'DISABLED',
  reference:'openapi/finance-os.v1.json'}));
 if(enabled){
  let identity:IdentityResolver;
  if(config.oidc){
   const verifier=createOidcVerifier(config.oidc,oidcFetch??fetch);
   identity=createOidcIdentity(authPool!,verifier);
   installOidcRoutes(app,identity,authPool!,config.oidc);
  }else{
   identity=request=>sessionIdentity(request,authPool!);
   installAuthRoutes(app,authPool!);
  }
  installFinanceRoutes(app,financePool!,identity);
  installB2Routes(app,financePool!,identity);
 }
 app.setNotFoundHandler((_request,reply)=>reply.code(404).send({error:{code:'ROUTE_NOT_IMPLEMENTED',message:'Route not available'}}));
 app.setErrorHandler((error,request,reply)=>{
  const pgCode=(error as {code?:string}).code;
  if(error instanceof DomainError)return reply.code(error.status).send({error:{code:error.code,message:error.message,requestId:request.id}});
  if(pgCode==='23505')return reply.code(409).send({error:{code:'DUPLICATE',message:'Conflicting record',requestId:request.id}});
  if(pgCode==='23503'||pgCode==='23514'||pgCode==='23502')return reply.code(409).send({error:{code:'FINANCIAL_CONSTRAINT',message:'Financial validation failed',requestId:request.id}});
  if(pgCode==='42501')return reply.code(403).send({error:{code:'NOT_AUTHORIZED',message:'Permission denied',requestId:request.id}});
  if(pgCode==='22P02')return reply.code(400).send({error:{code:'BAD_IDENTIFIER',message:'Invalid identifier',requestId:request.id}});
  // Never log request bodies or raw SQL parameters, including financial PII.
  request.log.error({errorCode:pgCode??'INTERNAL',requestId:request.id},'Finance OS request failed');
  return reply.code(500).send({error:{code:'INTERNAL',message:'An unexpected server error occurred',requestId:request.id}});
 });
 return app;
}
