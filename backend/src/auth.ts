import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import type pg from 'pg';
import { z } from 'zod';

const derive=(password:string,salt:Buffer)=>new Promise<Buffer>((resolve,reject)=>
  scryptCallback(password,salt,64,passwordOptions,(err,key)=>err?reject(err):resolve(key as Buffer)));

const sha256=(value:string)=>createHash('sha256').update(value).digest('hex');
const token=()=> 'f1_'+randomBytes(32).toString('base64url');
const SESSION_HOURS=8;
const registerSchema=z.object({email:z.string().email().max(254),password:z.string().min(12).max(128),
 displayName:z.string().trim().min(2).max(160),workspaceName:z.string().trim().min(2).max(160).optional()}).strict();
const loginSchema=z.object({email:z.string().email().max(254),password:z.string().min(1).max(128)}).strict();
const workspaceSchema=z.object({name:z.string().trim().min(2).max(160),kind:z.enum(['PERSONAL','HOUSEHOLD','BUSINESS'])}).strict();
export type AuthIdentity={id:string;email:string;displayName:string;sessionId:string;tokenDigest:string};
export class DomainError extends Error {constructor(public status:number,public code:string,message:string){super(message);}}
const attempts=new Map<string,{count:number;until:number}>();
const normalizeEmail=(email:string)=>email.trim().toLowerCase();
const passwordOptions={N:32768,r:8,p:1,maxmem:64*1024*1024};
export async function hashPassword(password:string):Promise<string>{
 const salt=randomBytes(16).toString('base64url');
 const digest=await derive(password,Buffer.from(salt,'base64url'));
 return 'scrypt$32768$8$1$'+salt+'$'+digest.toString('base64url');
}
async function verifyPassword(password:string,verifier:string):Promise<boolean>{
 const parts=verifier.split('$');
 if(parts.length!==6||parts[0]!=='scrypt'||parts[1]!=='32768'||parts[2]!=='8'||parts[3]!=='1')return false;
 const expected=Buffer.from(parts[5]??'','base64url');
 if(expected.length!==64)return false;
 const actual=await derive(password,Buffer.from(parts[4]??'','base64url'));
 return timingSafeEqual(expected,actual);
}
const dummyPromise=hashPassword('unavailable-account-placeholder-not-secret');
const failed=(reply:FastifyReply,status:number,code:string,message:string)=>reply.code(status).send({error:{code,message}});
const bearer=(request:FastifyRequest)=>{
 const value=request.headers.authorization;
 const match=/^Bearer (f1_[A-Za-z0-9_-]{43})$/.exec(value??'');
 return match?.[1]??null;
};
export async function sessionIdentity(request:FastifyRequest, authPool:pg.Pool):Promise<AuthIdentity>{
 const raw=bearer(request);
 if(!raw)throw new DomainError(401,'AUTH_REQUIRED','A valid session is required');
 const digest=sha256(raw);
 const result=await authPool.query<{
  id:string;email_normalized:string;display_name:string;session_id:string
 }>(`SELECT u.id,u.email_normalized,u.display_name,s.id AS session_id
     FROM app.sessions s JOIN public.app_users u ON u.id=s.user_id
     WHERE s.token_digest=$1 AND s.revoked_at IS NULL AND s.expires_at>now() AND u.disabled_at IS NULL`,[digest]);
 const row=result.rows[0];
 if(!row)throw new DomainError(401,'AUTH_EXPIRED','Session invalid or expired');
 return {id:row.id,email:row.email_normalized,displayName:row.display_name,sessionId:row.session_id,tokenDigest:digest};
}
async function issueToken(client:pg.PoolClient,userId:string){
 const accessToken=token();
 const response=await client.query<{expires_at:Date}>(
  `INSERT INTO app.sessions(user_id,token_digest,expires_at) VALUES($1,$2,now()+interval '8 hours') RETURNING expires_at`,
  [userId,sha256(accessToken)]
 );
 return {tokenType:'Bearer',accessToken,expiresAt:response.rows[0]!.expires_at.toISOString()};
}
const safeRateKey=(request:FastifyRequest,email:string)=>sha256(request.ip+':'+email);
function rejectLocked(key:string){
 const state=attempts.get(key);return !!state && state.until>Date.now() && state.count>=5;
}
function recordFailure(key:string){
 const entry=attempts.get(key);
 const now=Date.now();
 if(!entry || entry.until<now)attempts.set(key,{count:1,until:now+10*60_000});
 else attempts.set(key,{count:entry.count+1,until:entry.until});
 if(attempts.size>10_000)for(const [k,v] of attempts){if(v.until<now)attempts.delete(k);}
}
export function installAuthRoutes(app:FastifyInstance,authPool:pg.Pool){
 app.post('/v1/auth/register',async(request,reply)=>{
  const parsed=registerSchema.safeParse(request.body);
  if(!parsed.success)return failed(reply,422,'VALIDATION_ERROR','Provide a valid email, name and password (minimum 12 characters)');
  const email=normalizeEmail(parsed.data.email);
  const verifier=await hashPassword(parsed.data.password);
  const client=await authPool.connect();
  try{
   await client.query('BEGIN');
   const user=(await client.query<{id:string}>(`INSERT INTO app_users(email_normalized,display_name) VALUES($1,$2) RETURNING id`,
      [email,parsed.data.displayName])).rows[0]!;
   await client.query('INSERT INTO app.password_credentials(user_id,password_verifier) VALUES($1,$2)',[user.id,verifier]);
   const workspace=(await client.query<{id:string}>(`INSERT INTO workspaces(owner_user_id,name,kind) VALUES($1,$2,'PERSONAL') RETURNING id`,
      [user.id,parsed.data.workspaceName||parsed.data.displayName+' — Personal'])).rows[0]!;
   await client.query(`INSERT INTO workspace_members(workspace_id,user_id,role,status) VALUES($1,$2,'OWNER','ACTIVE')`,[workspace.id,user.id]);
   const credentials=await issueToken(client,user.id);
   await client.query('COMMIT');
   return reply.code(201).send({...credentials,user:{id:user.id,email,displayName:parsed.data.displayName},
     workspace:{id:workspace.id,name:parsed.data.workspaceName||parsed.data.displayName+' — Personal',kind:'PERSONAL',role:'OWNER'}});
  }catch(error){
   await client.query('ROLLBACK').catch(()=>undefined);
   if((error as {code?:string}).code==='23505')return failed(reply,409,'ACCOUNT_EXISTS','Account already registered');
   throw error;
  }finally{client.release();}
 });
 app.post('/v1/auth/login',async(request,reply)=>{
  const parsed=loginSchema.safeParse(request.body);
  if(!parsed.success)return failed(reply,422,'VALIDATION_ERROR','Valid email and password are required');
  const email=normalizeEmail(parsed.data.email),key=safeRateKey(request,email);
  if(rejectLocked(key))return failed(reply,429,'TOO_MANY_ATTEMPTS','Try again later');
  const results=await authPool.query<{id:string;display_name:string;password_verifier:string}>(`
    SELECT u.id,u.display_name,c.password_verifier FROM app_users u
    JOIN app.password_credentials c ON c.user_id=u.id
    WHERE u.email_normalized=$1 AND u.disabled_at IS NULL AND c.disabled_at IS NULL`,[email]);
  const user=results.rows[0];
  const ok=await verifyPassword(parsed.data.password,user?.password_verifier??await dummyPromise);
  if(!ok||!user){recordFailure(key);return failed(reply,401,'INVALID_CREDENTIALS','Invalid email or password');}
  attempts.delete(key);
  const client=await authPool.connect();
  try{
   await client.query('BEGIN');
   const credentials=await issueToken(client,user.id);
   await client.query('COMMIT');
   return reply.send({...credentials,user:{id:user.id,email,displayName:user.display_name}});
  }catch(error){await client.query('ROLLBACK').catch(()=>undefined);throw error;}
  finally{client.release();}
 });
 app.get('/v1/me',async(request,reply)=>{
  const actor=await sessionIdentity(request,authPool);
  return reply.send({id:actor.id,email:actor.email,displayName:actor.displayName});
 });
 app.get('/v1/workspaces',async(request,reply)=>{
  const actor=await sessionIdentity(request,authPool);
  const result=await authPool.query(`SELECT w.id,w.name,w.kind,w.base_currency AS "baseCurrency",
   m.role FROM workspaces w JOIN workspace_members m ON m.workspace_id=w.id
   WHERE m.user_id=$1 AND m.status='ACTIVE' AND w.archived_at IS NULL ORDER BY w.created_at,w.id`,[actor.id]);
  return reply.send({items:result.rows});
 });
 app.post('/v1/workspaces',async(request,reply)=>{
  const actor=await sessionIdentity(request,authPool),parsed=workspaceSchema.safeParse(request.body);
  if(!parsed.success)return failed(reply,422,'VALIDATION_ERROR','Invalid workspace');
  const client=await authPool.connect();
  try{
   await client.query('BEGIN');
   const row=(await client.query<{id:string}>(`INSERT INTO workspaces(owner_user_id,name,kind) VALUES($1,$2,$3) RETURNING id`,
      [actor.id,parsed.data.name,parsed.data.kind])).rows[0]!;
   await client.query(`INSERT INTO workspace_members(workspace_id,user_id,role,status) VALUES($1,$2,'OWNER','ACTIVE')`,[row.id,actor.id]);
   await client.query('COMMIT');
   return reply.code(201).send({id:row.id,name:parsed.data.name,kind:parsed.data.kind,baseCurrency:'KES',role:'OWNER'});
  }catch(error){await client.query('ROLLBACK').catch(()=>undefined);throw error;}
  finally{client.release();}
 });
 app.post('/v1/auth/logout',async(request,reply)=>{
  const actor=await sessionIdentity(request,authPool);
  await authPool.query('UPDATE app.sessions SET revoked_at=now() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL',[actor.sessionId,actor.id]);
  return reply.code(204).send();
 });
 app.post('/v1/auth/refresh',async(request,reply)=>{
  const actor=await sessionIdentity(request,authPool);
  const client=await authPool.connect();
  try{
   await client.query('BEGIN');
   const result=await client.query('UPDATE app.sessions SET revoked_at=now() WHERE id=$1 AND user_id=$2 AND revoked_at IS NULL RETURNING id',[actor.sessionId,actor.id]);
   if(!result.rowCount){await client.query('ROLLBACK');return failed(reply,401,'AUTH_EXPIRED','Session expired');}
   const credentials=await issueToken(client,actor.id);
   await client.query('COMMIT');
   return reply.send(credentials);
  }catch(error){await client.query('ROLLBACK').catch(()=>undefined);throw error;}
  finally{client.release();}
 });
}
