import { z } from 'zod';

const envSchema=z.object({
 NODE_ENV:z.enum(['development','test','production']).default('development'),
 HOST:z.string().min(1).default('127.0.0.1'),
 PORT:z.coerce.number().int().min(1).max(65535).default(3101),
 DATABASE_URL:z.string().min(1),
 AUTH_DATABASE_URL:z.string().optional(),
 LOCAL_AUTH_ENABLED:z.enum(['true','false']).default('false'),
 OIDC_ISSUER:z.string().optional(),
 OIDC_AUDIENCE:z.string().optional(),
 OIDC_JWKS_URI:z.string().optional(),
 OIDC_CLIENT_ID:z.string().optional(),
 OIDC_AUTHORIZATION_ENDPOINT:z.string().optional(),
 OIDC_TOKEN_ENDPOINT:z.string().optional(),
 OIDC_REDIRECT_URI:z.string().optional(),
 OIDC_REQUIRED_ACR:z.string().optional(),
 OIDC_MAX_AUTH_AGE_SECONDS:z.coerce.number().int().min(60).max(86400).default(3600),
 CORS_ALLOWED_ORIGINS:z.string().default(''),
 LOG_LEVEL:z.enum(['fatal','error','warn','info','debug','trace','silent']).default('info'),
});
export type OidcConfig={
 issuer:string; audience:string;jwksUri:string;clientId:string;authorizationEndpoint:string;
 tokenEndpoint:string;redirectUri:string;requiredAcr:string;maxAuthAgeSeconds:number;
};
export type Config={
 nodeEnv:'development'|'test'|'production';host:string;port:number;databaseUrl:string;
 authDatabaseUrl?:string;localAuthEnabled:boolean;oidc?:OidcConfig;
 corsAllowedOrigins:string[];logLevel:'fatal'|'error'|'warn'|'info'|'debug'|'trace'|'silent';
};
function secureUrl(value:string,label:string,production:boolean):URL{
 const url=new URL(value);
 const local=!production&&url.protocol==='http:'&&['localhost','127.0.0.1'].includes(url.hostname);
 if(url.protocol!=='https:'&&!local)throw new Error(label+' must be HTTPS (localhost HTTP is test only)');
 if(url.username||url.password||url.hash)throw new Error(label+' may not contain credentials or fragments');
 return url;
}
export function loadConfig(source:NodeJS.ProcessEnv=process.env):Config{
 const e=envSchema.parse(source),origins=e.CORS_ALLOWED_ORIGINS.split(',').map(s=>s.trim()).filter(Boolean);
 const production=e.NODE_ENV==='production',local=e.LOCAL_AUTH_ENABLED==='true';
 if(local&&production)throw new Error('Local password auth is forbidden in production');
 const requestedOidc=Boolean(e.OIDC_ISSUER||e.OIDC_AUDIENCE||e.OIDC_JWKS_URI||e.OIDC_CLIENT_ID);
 if(local&&requestedOidc)throw new Error('Choose either local password auth or OIDC, not both');
 if((local||requestedOidc)&&!e.AUTH_DATABASE_URL)throw new Error('A separate AUTH_DATABASE_URL is required');
 if((local||requestedOidc)&&e.AUTH_DATABASE_URL===e.DATABASE_URL)throw new Error('Auth and finance must use different roles and database connections');
 let oidc:OidcConfig|undefined;
 if(requestedOidc){
  const required=['OIDC_ISSUER','OIDC_AUDIENCE','OIDC_JWKS_URI','OIDC_CLIENT_ID','OIDC_AUTHORIZATION_ENDPOINT',
   'OIDC_TOKEN_ENDPOINT','OIDC_REDIRECT_URI','OIDC_REQUIRED_ACR'] as const;
  for(const key of required)if(!e[key])throw new Error(key+' required for OIDC');
  const issuer=secureUrl(e.OIDC_ISSUER!,'OIDC_ISSUER',production);
  const jwks=secureUrl(e.OIDC_JWKS_URI!,'OIDC_JWKS_URI',production);
  const auth=secureUrl(e.OIDC_AUTHORIZATION_ENDPOINT!,'OIDC_AUTHORIZATION_ENDPOINT',production);
  const endpoint=secureUrl(e.OIDC_TOKEN_ENDPOINT!,'OIDC_TOKEN_ENDPOINT',production);
  const redirect=secureUrl(e.OIDC_REDIRECT_URI!,'OIDC_REDIRECT_URI',production);
  for(const [value,label] of [[jwks,'JWKS'],[auth,'authorization'],[endpoint,'token']] as const){
   if(value.origin!==issuer.origin)throw new Error('OIDC '+label+' endpoint must have same origin as OIDC_ISSUER');
  }
  if(redirect.search||redirect.hash)throw new Error('OIDC_REDIRECT_URI must not contain query or fragment');
  if(!origins.includes(redirect.origin))throw new Error('OIDC_REDIRECT_URI origin must be an explicit CORS_ALLOWED_ORIGINS member');
  if(e.OIDC_AUDIENCE!.trim()!==e.OIDC_AUDIENCE||!e.OIDC_AUDIENCE!.length)throw new Error('Invalid OIDC_AUDIENCE');
  oidc={issuer:issuer.href.replace(/\/$/,''),audience:e.OIDC_AUDIENCE!,jwksUri:jwks.href,clientId:e.OIDC_CLIENT_ID!,
   authorizationEndpoint:auth.href,tokenEndpoint:endpoint.href,redirectUri:redirect.href,
   requiredAcr:e.OIDC_REQUIRED_ACR!,maxAuthAgeSeconds:e.OIDC_MAX_AUTH_AGE_SECONDS};
 }
 if(production){
  if(!oidc)throw new Error('Production requires provider-verified OIDC with MFA (OIDC_* configuration)');
  if(!origins.length||origins.some(o=>!o.startsWith('https://')))throw new Error('Production requires explicit HTTPS CORS_ALLOWED_ORIGINS');
  for(const name of [e.DATABASE_URL,e.AUTH_DATABASE_URL!]){
   const u=new URL(name);
   if(!['postgres:','postgresql:'].includes(u.protocol)||!['verify-full','verify-ca'].includes(u.searchParams.get('sslmode')||''))
    throw new Error('Production database roles require PostgreSQL sslmode=verify-full (or verify-ca with trusted certificates)');
  }
 }
 return {nodeEnv:e.NODE_ENV,host:e.HOST,port:e.PORT,databaseUrl:e.DATABASE_URL,
  authDatabaseUrl:e.AUTH_DATABASE_URL,localAuthEnabled:local,oidc,corsAllowedOrigins:origins,logLevel:e.LOG_LEVEL};
}
