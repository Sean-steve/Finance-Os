import {createContext,useCallback,useContext,useEffect,useMemo,useRef,useState} from 'react';
import type {ReactNode} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {FinanceApi,resolveApiBase} from './api';
import type {FinanceMeta,Identity,Workspace,Items,OidcProvider} from './api';

type Status='loading'|'ready'|'signed-in'|'error';
type Session={
 status:Status;error:string;meta:FinanceMeta|null;api:FinanceApi|null;user:Identity|null;
 workspaces:Workspace[];workspaceId:string;role:string;
 signIn:(email:string,password:string)=>Promise<void>;
 register:(email:string,password:string,displayName:string)=>Promise<void>;
 signOut:()=>Promise<void>;selectWorkspace:(id:string)=>void;createWorkspace:(name:string,kind:string)=>Promise<void>;
 beginOidc:()=>Promise<void>;reload:()=>Promise<void>;
};
const Context=createContext<Session|null>(null);
const PKCE_KEY='finance-os-v3-pkce';
function isLocal(){return ['127.0.0.1','localhost'].includes(location.hostname);}
const b64=(buf:Uint8Array)=>btoa(Array.from(buf,x=>String.fromCharCode(x)).join('')).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/g,'');
async function callback(provider:OidcProvider):Promise<string|null>{
 const uri=new URL(window.location.href);
 const code=uri.searchParams.get('code'),state=uri.searchParams.get('state'),rejected=uri.searchParams.get('error');
 if(!code&&!rejected)return null;
 window.history.replaceState(null,'',window.location.pathname+window.location.hash);
 const raw=sessionStorage.getItem(PKCE_KEY);sessionStorage.removeItem(PKCE_KEY);
 if(rejected)throw new Error('Identity provider authentication was not completed.');
 if(!raw||!state||!code)throw new Error('Authorization state was not available. Sign in again.');
 let pending:{state:string;verifier:string;created:number};
 try{pending=JSON.parse(raw) as typeof pending;}catch{throw new Error('Invalid sign-in state.');}
 if(state!==pending.state||Date.now()-pending.created>5*60_000)throw new Error('Sign-in state expired or was not valid.');
 const redirect=new URL(provider.redirectUri);
 if(redirect.origin!==location.origin||redirect.pathname!==location.pathname)throw new Error('The identity provider callback does not match this V3 frontend. Check OIDC_REDIRECT_URI.');
 const params=new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:provider.redirectUri,client_id:provider.clientId,code_verifier:pending.verifier});
 // IdP must allow CORS for an approved public PKCE client. Never send a client secret.
 let response:Response;
 try{response=await fetch(provider.tokenEndpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:params,cache:'no-store',credentials:'omit',redirect:'error'});}
 catch{throw new Error('Cannot reach the identity provider token endpoint.');}
 if(!response.ok)throw new Error('Identity provider refused the authorization code.');
 const payload=await response.json() as {access_token?:string;token_type?:string};
 if(!payload.access_token||!['Bearer','bearer'].includes(String(payload.token_type)))throw new Error('Identity provider response did not include a bearer token.');
 return payload.access_token;
}
export function SessionProvider({children}:{children:ReactNode}){
 const qc=useQueryClient();
 const [status,setStatus]=useState<Status>('loading'),[error,setError]=useState('');
 const [base,setBase]=useState(''),[meta,setMeta]=useState<FinanceMeta|null>(null);
 const [user,setUser]=useState<Identity|null>(null),[workspaces,setWorkspaces]=useState<Workspace[]>([]);
 const [workspaceId,setWorkspaceId]=useState(''),token=useRef<string|null>(null),started=useRef(false);
 const clear=useCallback(()=>{token.current=null;qc.clear();setUser(null);setWorkspaces([]);setWorkspaceId('');setStatus('ready');},[qc]);
 const api=useMemo(()=>base?new FinanceApi(base,()=>token.current,clear):null,[base,clear]);
 const populate=useCallback(async(client:FinanceApi)=>{
   const [identity,list]=await Promise.all([client.get<Identity>('/v1/me'),client.get<Items<Workspace>>('/v1/workspaces')]);
   setUser(identity);setWorkspaces(list.items);setWorkspaceId(old=>list.items.some(w=>w.id===old)?old:list.items[0]?.id||'');setStatus('signed-in');setError('');
 },[]);
 const reload=useCallback(async()=>{
   if(!api||!token.current)return;
   await populate(api);
 },[api,populate]);
 useEffect(()=>{
  if(started.current)return;
  started.current=true;
  void (async()=>{
   try{
    const found=await resolveApiBase();
    const publicApi=new FinanceApi(found,()=>token.current,clear);
    const state=await publicApi.get<FinanceMeta>('/v1/meta',false);
    if(!state.authenticationAvailable||!state.financialEndpointsAvailable)throw new Error('Finance API is not active for authenticated financial records.');
    if(state.authenticationScope!=='OIDC_VERIFIED_MFA'&&!(state.authenticationScope==='LOCAL_TEST_ONLY'&&import.meta.env.DEV&&isLocal()))
      throw new Error('Unapproved authentication mode. Local passwords only work in local development.');
    setBase(found);setMeta(state);
    if(state.authenticationScope==='OIDC_VERIFIED_MFA'&&new URL(location.href).searchParams.has('code')){
      const provider=await publicApi.get<OidcProvider>('/v1/auth/provider',false);
      const access=await callback(provider);
      if(access){token.current=access;await populate(publicApi);return;}
    }else if(new URL(location.href).searchParams.has('error')){
      const provider=await publicApi.get<OidcProvider>('/v1/auth/provider',false);
      await callback(publicApi,provider);
    }
    setStatus('ready');
   }catch(ex){setError(ex instanceof Error?ex.message:'Unable to initialize Finance OS.');setStatus('error');}
  })();
 },[clear,populate]);
 const localAuth=useCallback(async(route:'login'|'register',body:Record<string,string>)=>{
  if(!api||meta?.authenticationScope!=='LOCAL_TEST_ONLY'||!isLocal())throw new Error('Local password authentication is unavailable.');
  setError('');
  const result=await api.post<{accessToken:string}>('/v1/auth/'+route,body,false);
  token.current=result.accessToken;
  try{await populate(api);}catch(ex){clear();throw ex;}
 },[api,clear,meta,populate]);
 const signIn=useCallback((email:string,password:string)=>localAuth('login',{email,password}),[localAuth]);
 const register=useCallback((email:string,password:string,displayName:string)=>localAuth('register',{email,password,displayName}),[localAuth]);
 const signOut=useCallback(async()=>{
   if(api&&token.current&&meta?.authenticationScope==='LOCAL_TEST_ONLY')
     await api.post('/v1/auth/logout',{}).catch(()=>undefined);
   sessionStorage.removeItem(PKCE_KEY);clear();
 },[api,clear,meta]);
 const selectWorkspace=useCallback((id:string)=>{if(!workspaces.some(w=>w.id===id))return;qc.clear();setWorkspaceId(id);},[qc,workspaces]);
 const createWorkspace=useCallback(async(name:string,kind:string)=>{if(!api)throw new Error('Finance API unavailable');await api.post('/v1/workspaces',{name,kind});await populate(api);},[api,populate]);
 const beginOidc=useCallback(async()=>{
   if(!api||meta?.authenticationScope!=='OIDC_VERIFIED_MFA')throw new Error('Identity provider is not enabled.');
   const p=await api.get<OidcProvider>('/v1/auth/provider',false);
   const redirect=new URL(p.redirectUri);
   if(redirect.origin!==location.origin||redirect.pathname!==location.pathname)throw new Error('OIDC redirect URL must match this V3 frontend deployment.');
   const bytes=crypto.getRandomValues(new Uint8Array(32)),verifier=b64(bytes);
   const challenge=b64(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier))));
   const nonce=b64(crypto.getRandomValues(new Uint8Array(20)));
   sessionStorage.setItem(PKCE_KEY,JSON.stringify({state:nonce,verifier,created:Date.now()}));
   const url=new URL(p.authorizationEndpoint);
   url.searchParams.set('response_type','code');url.searchParams.set('client_id',p.clientId);
   url.searchParams.set('redirect_uri',p.redirectUri);url.searchParams.set('scope',p.scope);
   url.searchParams.set('state',nonce);url.searchParams.set('code_challenge',challenge);
   url.searchParams.set('code_challenge_method','S256');url.searchParams.set('acr_values',p.requiredAcr);
   location.assign(url.toString());
 },[api,meta]);
 const role=workspaces.find(w=>w.id===workspaceId)?.role||'';
 const value:Session={status,error,meta,api,user,workspaces,workspaceId,role,signIn,register,signOut,selectWorkspace,createWorkspace,beginOidc,reload};
 return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useSession(){const value=useContext(Context);if(!value)throw new Error('No Finance SessionProvider');return value;}
