import {createPublicKey,verify as verifySignature,createHash} from 'node:crypto';
import type {FastifyRequest,FastifyInstance} from 'fastify';
import type pg from 'pg';
import type {OidcConfig} from './config.js';
import {DomainError,type AuthIdentity} from './auth.js';

type Jwk={kty:string;kid?:string;use?:string;key_ops?:string[];alg?:string;n?:string;e?:string};
type Claims={iss?:unknown;sub?:unknown;aud?:unknown;exp?:unknown;nbf?:unknown;iat?:unknown;auth_time?:unknown;
 acr?:unknown;email?:unknown;email_verified?:unknown;name?:unknown;preferred_username?:unknown};
const problem=(code:string)=>new DomainError(401,code,'OIDC token is invalid or insufficiently authenticated');
const bearer=(request:FastifyRequest)=>{
 const match=/^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/.exec(request.headers.authorization||'');
 if(!match||match[1]!.length>12000)throw problem('OIDC_TOKEN_REQUIRED');
 return match[1]!;
};
export function createOidcVerifier(config:OidcConfig,fetcher:typeof fetch=fetch){
 let jwks:{keys:Jwk[]}|null=null;
 let expires=0;
 async function keys():Promise<Jwk[]>{
  if(jwks&&Date.now()<expires)return jwks.keys;
  let response:Response;
  try{response=await fetcher(config.jwksUri,{signal:AbortSignal.timeout(3500),
    headers:{Accept:'application/json'},redirect:'error'});}
  catch{throw new DomainError(503,'OIDC_KEYS_UNAVAILABLE','Identity provider key service unavailable');}
  if(!response.ok)throw new DomainError(503,'OIDC_KEYS_UNAVAILABLE','Identity provider key service unavailable');
  const text=await response.text();
  if(text.length>65000)throw problem('OIDC_JWKS_SIZE');
  let parsed:unknown;
  try{parsed=JSON.parse(text);}catch{throw problem('OIDC_JWKS_INVALID');}
  if(!parsed||typeof parsed!=='object'||!Array.isArray((parsed as {keys?:unknown}).keys))throw problem('OIDC_JWKS_INVALID');
  const list=(parsed as {keys:Jwk[]}).keys;
  if(list.length===0||list.length>40)throw problem('OIDC_JWKS_INVALID');
  jwks={keys:list};expires=Date.now()+5*60_000;
  return list;
 }
 async function validate(raw:string):Promise<Claims>{
  const parts=raw.split('.');
  if(parts.length!==3||parts.some(p=>p.length>11000))throw problem('OIDC_TOKEN_MALFORMED');
  let header:{alg?:unknown;typ?:unknown;kid?:unknown},payload:Claims;
  try{header=JSON.parse(Buffer.from(parts[0]!,'base64url').toString('utf8'));
      payload=JSON.parse(Buffer.from(parts[1]!,'base64url').toString('utf8'));}
  catch{throw problem('OIDC_TOKEN_MALFORMED');}
  if(!header||header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>200||
   (header.typ && !['JWT','at+jwt','application/at+jwt'].includes(String(header.typ))))
    throw problem('OIDC_ALGORITHM_REJECTED');
  let list=await keys();
  let candidate=list.filter(k=>k.kty==='RSA'&&k.kid===header.kid&&(!k.use||k.use==='sig')&&
   (!k.alg||k.alg==='RS256')&&(!k.key_ops||k.key_ops.includes('verify')));
  if(candidate.length!==1){
   jwks=null;list=await keys();
   candidate=list.filter(k=>k.kty==='RSA'&&k.kid===header.kid&&(!k.use||k.use==='sig')&&
    (!k.alg||k.alg==='RS256')&&(!k.key_ops||k.key_ops.includes('verify')));
   if(candidate.length!==1)throw problem('OIDC_UNKNOWN_KEY');
  }
  let ok=false;
  try{
   const key=createPublicKey({key:candidate[0] as never,format:'jwk'});
   if(key.asymmetricKeyDetails?.modulusLength && key.asymmetricKeyDetails.modulusLength<2048)
     throw new Error('RSA key too small');
   ok=verifySignature('RSA-SHA256',Buffer.from(parts[0]+'.'+parts[1]),key,Buffer.from(parts[2]!,'base64url'));
  }
  catch{throw problem('OIDC_SIGNATURE_INVALID');}
  if(!ok)throw problem('OIDC_SIGNATURE_INVALID');
  const now=Math.floor(Date.now()/1000);
  if(!payload||payload.iss!==config.issuer||typeof payload.sub!=='string'||!payload.sub||payload.sub.length>256||
   !(payload.aud===config.audience||Array.isArray(payload.aud)&&payload.aud.includes(config.audience))||
   typeof payload.exp!=='number'||payload.exp<=now-30||payload.exp>now+900||
   typeof payload.iat!=='number'||payload.iat>now+30||
   payload.nbf!==undefined&&(typeof payload.nbf!=='number'||payload.nbf>now+30))
   throw problem('OIDC_CLAIMS_INVALID');
  if(payload.acr!==config.requiredAcr||typeof payload.auth_time!=='number'||
   payload.auth_time>now+30||now-payload.auth_time>config.maxAuthAgeSeconds)
    throw new DomainError(403,'OIDC_MFA_REQUIRED','Fresh MFA authentication is required by the configured identity provider');
  if(payload.email_verified!==true||typeof payload.email!=='string'||!/^\S+@\S+\.\S+$/.test(payload.email)||
   payload.email.length>254)throw new DomainError(403,'OIDC_EMAIL_UNVERIFIED','A provider-verified email address is required');
  return payload;
 }
 return {validate,authorize:async(request:FastifyRequest)=>validate(bearer(request))};
}

export function createOidcIdentity(authPool:pg.Pool,oidc:ReturnType<typeof createOidcVerifier>){
 return async(request:FastifyRequest):Promise<AuthIdentity>=>{
  const claims=await oidc.authorize(request);
  const subject=String(claims.iss)+'#'+String(claims.sub);
  const email=String(claims.email).trim().toLowerCase();
  const name=typeof claims.name==='string'&&claims.name.trim()?claims.name.trim().slice(0,150):email.split('@')[0]!;
  const client=await authPool.connect();
  try{
   await client.query('BEGIN');
   // Bind ONLY the verified issuer+subject, never auto-link by matching email.
   let row=(await client.query<{id:string;email_normalized:string;display_name:string}>(
    'SELECT id,email_normalized,display_name FROM app_users WHERE auth_subject=$1 AND disabled_at IS NULL',
    [subject])).rows[0];
   if(!row){
    // Verify email cannot map to a different existing account; manual provider migration is mandatory.
    const registered=await client.query('SELECT id FROM app_users WHERE email_normalized=$1',[email]);
    if(registered.rowCount)throw new DomainError(409,'IDENTITY_LINK_REQUIRED','Existing account requires verified identity-linking procedure');
    const inserted=await client.query<{id:string;email_normalized:string;display_name:string}>(
      'INSERT INTO app_users(auth_subject,email_normalized,display_name) VALUES($1,$2,$3) ON CONFLICT(auth_subject) DO NOTHING RETURNING id,email_normalized,display_name',
      [subject,email,name]);
    row=inserted.rows[0]??(await client.query<{id:string;email_normalized:string;display_name:string}>(
     'SELECT id,email_normalized,display_name FROM app_users WHERE auth_subject=$1 AND disabled_at IS NULL',[subject])).rows[0];
    if(!row)throw new DomainError(503,'OIDC_ACCOUNT_CONFLICT','Account provisioning temporarily unavailable');
    if(inserted.rowCount){
      const workspace=(await client.query<{id:string}>(
       "INSERT INTO workspaces(owner_user_id,name,kind) VALUES($1,$2,'PERSONAL') RETURNING id",[row.id,name+' — Personal'])).rows[0]!;
      await client.query("INSERT INTO workspace_members(workspace_id,user_id,role,status) VALUES($1,$2,'OWNER','ACTIVE')",[workspace.id,row.id]);
    }
   }
   if(row.email_normalized!==email)throw new DomainError(403,'OIDC_EMAIL_CHANGED','Verified email changed; re-verification of account linking is required');
   await client.query('COMMIT');
   return {id:row.id,email:row.email_normalized,displayName:row.display_name,sessionId:'oidc:'+String(claims.sub),
     tokenDigest:createHash('sha256').update(String(claims.sub)).digest('hex')};
  }catch(error){
   await client.query('ROLLBACK').catch(()=>undefined);
   if((error as {code?:string}).code==='23505')throw new DomainError(409,'IDENTITY_LINK_REQUIRED','Identity conflicts with an existing account');
   throw error;
  }finally{client.release();}
 };
}

export function installOidcRoutes(app:FastifyInstance,identity:ReturnType<typeof createOidcIdentity>,
 authPool:pg.Pool,config:OidcConfig){
 // No login/password endpoints: use Authorization Code + PKCE with the trusted IdP.
 app.get('/v1/auth/provider',async()=>({kind:'OIDC_PKCE',clientId:config.clientId,
   authorizationEndpoint:config.authorizationEndpoint,tokenEndpoint:config.tokenEndpoint,
   redirectUri:config.redirectUri,issuer:config.issuer,requiredAcr:config.requiredAcr,
   scope:'openid profile email'}));
 app.get('/v1/me',async(request)=>{const actor=await identity(request);return {id:actor.id,email:actor.email,displayName:actor.displayName};});
 app.get('/v1/workspaces',async(request)=>{
  const actor=await identity(request);
  const result=await authPool.query(`SELECT w.id,w.name,w.kind,w.base_currency AS "baseCurrency",m.role
   FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id
   WHERE m.user_id=$1 AND m.status='ACTIVE' AND w.archived_at IS NULL ORDER BY w.created_at,w.id`,[actor.id]);
  return {items:result.rows};
 });
 app.post('/v1/workspaces',async(request,reply)=>{
  const actor=await identity(request),body=request.body as Record<string,unknown>|undefined;
  if(!body||typeof body.name!=='string'||body.name.trim().length<2||body.name.length>160||
    !['PERSONAL','HOUSEHOLD','BUSINESS'].includes(String(body.kind)))
   throw new DomainError(422,'WORKSPACE_INVALID','A valid workspace name and kind are required');
  const client=await authPool.connect();
  try{
   await client.query('BEGIN');
   const row=(await client.query<{id:string}>(`INSERT INTO workspaces(owner_user_id,name,kind)
      VALUES($1,$2,$3) RETURNING id`,[actor.id,body.name.trim(),body.kind])).rows[0]!;
   await client.query("INSERT INTO workspace_members(workspace_id,user_id,role,status) VALUES($1,$2,'OWNER','ACTIVE')",[row.id,actor.id]);
   await client.query('COMMIT');
   return reply.code(201).send({id:row.id,name:body.name.trim(),kind:body.kind,baseCurrency:'KES',role:'OWNER'});
  }catch(error){await client.query('ROLLBACK').catch(()=>undefined);throw error;}
  finally{client.release();}
 });
}
