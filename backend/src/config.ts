import { z } from 'zod';

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().min(1).default('127.0.0.1'),
  PORT: z.coerce.number().int().min(1).max(65535).default(3101),
  DATABASE_URL: z.string().min(1),
  AUTH_DATABASE_URL: z.string().optional(),
  LOCAL_AUTH_ENABLED: z.enum(['true','false']).default('false'),
  CORS_ALLOWED_ORIGINS: z.string().default(''),
  LOG_LEVEL: z.enum(['fatal','error','warn','info','debug','trace','silent']).default('info'),
});
export type Config = {
 nodeEnv:'development'|'test'|'production'; host:string; port:number;
 databaseUrl:string; authDatabaseUrl?:string; localAuthEnabled:boolean;
 corsAllowedOrigins:string[];logLevel:'fatal'|'error'|'warn'|'info'|'debug'|'trace'|'silent';
};
export function loadConfig(source: NodeJS.ProcessEnv = process.env): Config {
 const env=envSchema.parse(source);
 const origins=env.CORS_ALLOWED_ORIGINS.split(',').map(s=>s.trim()).filter(Boolean);
 const authEnabled=env.LOCAL_AUTH_ENABLED==='true';
 if(authEnabled && !env.AUTH_DATABASE_URL) throw new Error('LOCAL_AUTH_ENABLED requires separate AUTH_DATABASE_URL');
 if(authEnabled && env.AUTH_DATABASE_URL===env.DATABASE_URL) throw new Error('Auth and finance DB connections must use different roles');
 if(env.NODE_ENV==='production'){
  if(authEnabled) throw new Error('Development-only local password authentication is forbidden in production; configure vetted OIDC/MFA in a later security phase');
  if(!origins.length || origins.some(origin=>!origin.startsWith('https://'))) throw new Error('Production requires explicit HTTPS CORS_ALLOWED_ORIGINS');
  const url=new URL(env.DATABASE_URL);
  if(!['postgres:','postgresql:'].includes(url.protocol)) throw new Error('DATABASE_URL must use PostgreSQL');
  if(!url.searchParams.has('sslmode') && !url.searchParams.has('ssl')) throw new Error('Production DATABASE_URL must specify PostgreSQL TLS (sslmode=verify-full preferred)');
 }
 return {
  nodeEnv:env.NODE_ENV,host:env.HOST,port:env.PORT,databaseUrl:env.DATABASE_URL,
  authDatabaseUrl:env.AUTH_DATABASE_URL,localAuthEnabled:authEnabled,corsAllowedOrigins:origins,logLevel:env.LOG_LEVEL
 };
}
