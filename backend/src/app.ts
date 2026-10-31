import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import type pg from 'pg';
import type {Config} from './config.js';
import type {Queryable} from './db/client.js';
import {installAuthRoutes,DomainError} from './auth.js';
import {installFinanceRoutes} from './finance.js';

export const API_CONTRACT='finance-os.v1';
export type Dependencies={config:Config;database:Queryable;financePool?:pg.Pool;authPool?:pg.Pool};
export async function buildApp({config,database,financePool,authPool}:Dependencies){
 const app=Fastify({
  logger:{level:config.logLevel,redact:['req.headers.authorization','req.headers.cookie','res.headers.set-cookie','req.body.password','req.body.token']},
  trustProxy:false,bodyLimit:256*1024,requestIdHeader:false
 });
 await app.register(helmet);
 await app.register(cors,{credentials:false,origin(origin,cb){cb(null,!origin||config.corsAllowedOrigins.includes(origin));}});
 app.addHook('onSend',async(_request,reply,payload)=>{reply.header('Cache-Control','no-store');return payload;});
 app.get('/health/live',async()=>({status:'live',service:'finance-os-api'}));
 app.get('/health/ready',async(_request,reply)=>{
  try{
   const result=await database.query('SELECT version FROM schema_migrations ORDER BY version');
   const versions=new Set(result.rows.map(row=>(row as {version:string}).version));
   const required=['001_identity_workspaces.sql','002_financial_domains.sql','003_integrity_rls.sql'];
   if(config.localAuthEnabled)required.push('004_b1_identity_ledger.sql');
   if(!required.every(version=>versions.has(version)))throw new Error('Migrations not applied');
   return {status:'ready',migrationTracking:true};
  }catch{
   reply.code(503);return {status:'unavailable',migrationTracking:false};
  }
 });
 const b1Enabled=Boolean(config.localAuthEnabled && financePool && authPool);
 app.get('/v1/meta',async()=>({
  api:API_CONTRACT,stage:b1Enabled?'B1':'B0',implementation:b1Enabled?'local-backend-integration':'foundation-only',
  financialEndpointsAvailable:b1Enabled,authenticationAvailable:b1Enabled,
  productionReady:false,authenticationScope:'LOCAL_DEVELOPMENT_ONLY',
  reference:'openapi/finance-os.v1.json'
 }));
 if(b1Enabled){installAuthRoutes(app,authPool!);installFinanceRoutes(app,financePool!,authPool!);}
 app.setNotFoundHandler((_request,reply)=>reply.code(404).send({error:{code:'ROUTE_NOT_IMPLEMENTED',message:'Route not available'}}));
 app.setErrorHandler((error,request,reply)=>{
  const pgCode=(error as {code?:string}).code;
  if(error instanceof DomainError)return reply.code(error.status).send({error:{code:error.code,message:error.message,requestId:request.id}});
  if(pgCode==='23505')return reply.code(409).send({error:{code:'DUPLICATE',message:'Conflicting record',requestId:request.id}});
  if(pgCode==='23503'||pgCode==='23514'||pgCode==='23502')return reply.code(409).send({error:{code:'FINANCIAL_CONSTRAINT',message:'Financial validation failed',requestId:request.id}});
  if(pgCode==='42501')return reply.code(403).send({error:{code:'NOT_AUTHORIZED',message:'Permission denied',requestId:request.id}});
  if(pgCode==='22P02')return reply.code(400).send({error:{code:'BAD_IDENTIFIER',message:'Invalid identifier',requestId:request.id}});
  request.log.error({error,requestId:request.id},'Unexpected Finance OS request error');
  return reply.code(500).send({error:{code:'INTERNAL',message:'An unexpected server error occurred',requestId:request.id}});
 });
 return app;
}
