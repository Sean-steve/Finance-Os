import {test} from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,sign,randomUUID} from 'node:crypto';
import pg from 'pg';
import {buildApp} from '../src/app.js';
import {loadConfig} from '../src/config.js';

const databaseUrl=process.env.TEST_APP_DATABASE_URL,authDatabaseUrl=process.env.TEST_AUTH_DATABASE_URL;
if(!databaseUrl||!authDatabaseUrl)throw new Error('B1.1 OIDC integration requires disposable app and auth-role database URLs');
const {privateKey,publicKey}=generateKeyPairSync('rsa',{modulusLength:2048});
const jwk=publicKey.export({format:'jwk'}) as Record<string,string>;
Object.assign(jwk,{kid:'b11-test',alg:'RS256',use:'sig'});
const issuer='https://oidc.finance.example';
const config=loadConfig({NODE_ENV:'test',DATABASE_URL:databaseUrl,AUTH_DATABASE_URL:authDatabaseUrl,LOCAL_AUTH_ENABLED:'false',
 OIDC_ISSUER:issuer,OIDC_AUDIENCE:'finance-os-b11-api',OIDC_JWKS_URI:issuer+'/jwks',
 OIDC_CLIENT_ID:'finance-spa',OIDC_AUTHORIZATION_ENDPOINT:issuer+'/authorize',
 OIDC_TOKEN_ENDPOINT:issuer+'/token',OIDC_REDIRECT_URI:'https://finance.example/connected.html',
 OIDC_REQUIRED_ACR:'urn:finance:mfa',CORS_ALLOWED_ORIGINS:'https://finance.example',LOG_LEVEL:'silent'});
const now=()=>Math.floor(Date.now()/1000);
function issue(subject:string,email:string,override:Record<string,unknown>={}){
 const payload={iss:issuer,sub:subject,aud:'finance-os-b11-api',iat:now()-20,exp:now()+300,
  auth_time:now()-60,acr:'urn:finance:mfa',email,email_verified:true,name:'Verified Integration User',...override};
 const b=(x:object)=>Buffer.from(JSON.stringify(x)).toString('base64url');
 const signed=b({kid:'b11-test',alg:'RS256',typ:'at+jwt'})+'.'+b(payload);
 return signed+'.'+sign('RSA-SHA256',Buffer.from(signed),privateKey).toString('base64url');
}
const fetchKeys=(async()=>new Response(JSON.stringify({keys:[jwk]}),{status:200})) as typeof fetch;
test('trusted OIDC MFA identity is provisioned atomically, workspace-scoped and cannot cross-link a matching email',async()=>{
 const financial=new pg.Pool({connectionString:databaseUrl,max:4});
 const auth=new pg.Pool({connectionString:authDatabaseUrl,max:4});
 const app=await buildApp({config,database:financial,financePool:financial,authPool:auth,oidcFetch:fetchKeys});
 const subjectA=randomUUID(),subjectB=randomUUID(),email='oidc-'+randomUUID()+'@example.invalid';
 const tokenA=issue(subjectA,email);
 const get=(url:string,token?:string)=>app.inject({method:'GET',url,headers:token?{Authorization:'Bearer '+token}:{}});
 try{
  assert.equal((await get('/v1/auth/provider')).statusCode,200);
  assert.equal((await get('/v1/auth/register')).statusCode,404);
  assert.equal((await app.inject({method:'POST',url:'/v1/auth/login',payload:{email,password:'abc'}})).statusCode,404);
  assert.equal((await get('/v1/me')).statusCode,401);
  assert.equal((await get('/v1/me',issue(subjectA,email,{acr:'urn:password'}))).statusCode,403);
  assert.equal((await get('/v1/me',issue(subjectA,email,{email_verified:false}))).statusCode,403);
  const who=await get('/v1/me',tokenA);
  assert.equal(who.statusCode,200,who.body);
  const me=who.json();
  assert.equal(me.email,email);
  const workspaces=await get('/v1/workspaces',tokenA);
  assert.equal(workspaces.statusCode,200,workspaces.body);
  const workspace=workspaces.json().items[0];
  assert.ok(workspace?.id);
  assert.equal(workspace.role,'OWNER');
  const again=await get('/v1/me',issue(subjectA,email));
  assert.equal(again.statusCode,200);assert.equal(again.json().id,me.id);
  assert.equal((await get('/v1/me',issue(subjectB,email))).statusCode,409,
   'The same email with a different issuer subject must never auto-link accounts');
  const second=await get('/v1/me',issue(subjectB,'second-'+randomUUID()+'@example.invalid'));
  assert.equal(second.statusCode,200);
  const unauthorized=await get('/v1/workspaces/'+workspace.id+'/accounts',issue(subjectB,second.json().email));
  assert.equal(unauthorized.statusCode,404);
  assert.equal((await get('/v1/workspaces/'+workspace.id+'/accounts',tokenA)).statusCode,200);
  const created=await app.inject({method:'POST',url:'/v1/workspaces/'+workspace.id+'/accounts',
   headers:{Authorization:'Bearer '+tokenA,'Idempotency-Key':randomUUID()},
   payload:{displayName:'OIDC verified account',kind:'CASH',currency:'KES'}});
  assert.equal(created.statusCode,201,created.body);
  assert.equal(created.json().balanceMinor,0);
  const withoutMfa=await app.inject({method:'POST',url:'/v1/workspaces/'+workspace.id+'/accounts',
   headers:{Authorization:'Bearer '+issue(subjectA,email,{acr:'urn:password'}),'Idempotency-Key':randomUUID()},
   payload:{displayName:'Rejected',kind:'CASH'}});
  assert.equal(withoutMfa.statusCode,403);
  assert.ok(!(await get('/v1/workspaces/'+workspace.id+'/accounts',tokenA)).body.includes('Rejected'));
 }finally{await app.close();await financial.end();await auth.end();}
});
