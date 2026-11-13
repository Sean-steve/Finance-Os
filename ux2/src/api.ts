export type FinanceMeta={api:string;stage:string;financialEndpointsAvailable:boolean;authenticationAvailable:boolean;authenticationScope:'LOCAL_TEST_ONLY'|'OIDC_VERIFIED_MFA'|'DISABLED';productionReady:boolean};
export type Identity={id:string;email:string;displayName:string};
export type Workspace={id:string;name:string;kind:string;baseCurrency:string;role:'OWNER'|'EDITOR'|'VIEWER'|string};
export type OidcProvider={kind:'OIDC_PKCE';clientId:string;authorizationEndpoint:string;tokenEndpoint:string;redirectUri:string;issuer:string;requiredAcr:string;scope:string};
export type Items<T>={items:T[];nextCursor?:string|null};
export class ApiError extends Error {constructor(readonly status:number,readonly code:string,message:string){super(message);this.name='ApiError';}}
const isLocal=()=>['127.0.0.1','localhost'].includes(location.hostname);
export async function resolveApiBase():Promise<string>{
  if(import.meta.env.DEV){
    if(!isLocal())throw new Error('Local Finance OS development is restricted to localhost.');
    return '/finance-api';
  }
  let config:{apiBase?:unknown};
  try{const r=await fetch(new URL('config.json',location.href),{cache:'no-store',credentials:'omit'});if(!r.ok)throw new Error('Missing configuration');config=await r.json() as {apiBase?:unknown};}
  catch{throw new Error('Finance API is not configured. Contact the environment operator.');}
  if(typeof config.apiBase!=='string')throw new Error('Finance API is not configured. Live customer data is not available.');
  const url=new URL(config.apiBase);
  if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!==url.pathname.replace(/\/\/$/,'/')||isLocal()||['localhost','127.0.0.1'].includes(url.hostname)){
    throw new Error('Insecure or invalid public API endpoint rejected.');
  }
  return url.href.replace(/\/$/,'');
}
export class FinanceApi{
 constructor(readonly base:string,private token:()=>string|null,private expired:()=>void){}
 async request<T>(path:string,init:{method?:'GET'|'POST';body?:unknown;authenticated?:boolean}={}):Promise<T>{
   if(!path.startsWith('/')||path.startsWith('//')||path.includes('..'))throw new Error('Invalid API route');
   const auth=init.authenticated!==false;
   const accessToken=auth?this.token():null;
   if(auth&&!accessToken)throw new ApiError(401,'AUTH_REQUIRED','Sign in to continue.');
   const method=init.method||'GET';
   const headers:Record<string,string>={'Accept':'application/json'};
   if(init.body!==undefined)headers['Content-Type']='application/json';
   if(accessToken)headers.Authorization='Bearer '+accessToken;
   if(method!=='GET')headers['Idempotency-Key']='ux2-'+crypto.randomUUID();
   let r:Response;
   try{r=await fetch(this.base+path,{method,cache:'no-store',credentials:'omit',redirect:'error',headers,body:init.body===undefined?undefined:JSON.stringify(init.body)});}
   catch{throw new ApiError(0,'NETWORK','Finance API unavailable. Check that the backend is running and retry.');}
   let result:unknown;
   try{result=await r.json();}catch{result={};}
   if(!r.ok){
     if(r.status===401&&accessToken)this.expired();
     const error=(result as {error?:{code?:string;message?:string}})?.error;
     throw new ApiError(r.status,error?.code||'HTTP_ERROR',error?.message||'Request failed ('+r.status+').');
   }
   return result as T;
 }
 get<T>(path:string,authenticated=true){return this.request<T>(path,{authenticated});}
 post<T>(path:string,body:unknown,authenticated=true){return this.request<T>(path,{method:'POST',body,authenticated});}
 workspace<T>(id:string,tail:string){if(!id||!tail.startsWith('/'))throw new Error('Workspace required');return this.get<T>('/v1/workspaces/'+encodeURIComponent(id)+tail);}
 workspacePost<T>(id:string,tail:string,body:unknown){if(!id||!tail.startsWith('/'))throw new Error('Workspace required');return this.post<T>('/v1/workspaces/'+encodeURIComponent(id)+tail,body);}
}
