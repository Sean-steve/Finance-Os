import {useState} from 'react';
import type {FormEvent} from 'react';
import {Routes,Route,Navigate,useNavigate} from 'react-router-dom';
import {Plus,ShieldCheck} from 'lucide-react';
import {useSession} from './session';
import {Brand,AppShell,Drawer,Busy,Failure,Notice} from './components';
import {Home,Activity,Spending,CashFlow,Goals,Wealth,Insights,SettingsPage} from './pages';
import {RecordDrawer,actions} from './forms';
import type {ActionKind} from './forms';
import {describeError} from './finance';

function AuthScreen(){
 const {meta,signIn,register,beginOidc}=useSession(),[mode,setMode]=useState<'login'|'register'>('login'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const local=meta?.authenticationScope==='LOCAL_TEST_ONLY';
 const submit=async(ev:FormEvent<HTMLFormElement>)=>{
  ev.preventDefault();const data=new FormData(ev.currentTarget);
  setBusy(true);setError('');
  try{
   const email=String(data.get('email')||''),password=String(data.get('password')||'');
   if(mode==='register')await register(email,password,String(data.get('displayName')||''));
   else await signIn(email,password);
  }catch(ex){setError(describeError(ex));}finally{setBusy(false);}
 };
 return <div className="connected-auth"><section className="connected-auth-left"><Brand/><div><span className="eyebrow">KNOW YOUR MONEY. PLAN YOUR NEXT MOVE.</span><h1>Financial clarity,<br/>finally in focus.</h1><p>One connected financial workspace to record spending, prepare for bills, build goals and understand the numbers behind every decision.</p><div className="connected-auth-visual"><span className="connected-auth-mark">✦</span><strong>Your money should make sense.</strong><span>Thoughtful financial control. Evidence-first decisions.</span></div></div><span className="tiny">FINANCE OS V3 · AUTHENTICATED POSTGRESQL WORKSPACE</span></section>
 <section className="connected-auth-right"><div className="connected-auth-panel"><span className="eyebrow">WELCOME TO FINANCE OS</span><h2>{local?(mode==='login'?'Welcome back.':'Create your workspace.'): 'Sign in securely.'}</h2><p>{local?'Local development uses password access for testing only.':'Your identity provider must verify fresh MFA before financial access.'}</p>
 {local?<><div className="segments">{(['login','register'] as const).map(x=><button key={x} type="button" className={mode===x?'active':''} onClick={()=>{setMode(x);setError('');}}>{x==='login'?'Sign in':'Create account'}</button>)}</div>
 <form className="connected-login-form" onSubmit={ev=>void submit(ev)}>
 {mode==='register'&&<label className="form-field"><span>Display name</span><input name="displayName" minLength={2} maxLength={160} autoComplete="name" required/></label>}
 <label className="form-field"><span>Email address</span><input name="email" type="email" maxLength={254} autoComplete="email" required/></label>
 <label className="form-field"><span>Password</span><input name="password" type="password" minLength={mode==='register'?12:1} maxLength={128} autoComplete={mode==='login'?'current-password':'new-password'} required/></label>
 {error&&<p className="form-error" role="alert">{error}</p>}
 <button className="btn btn-primary" disabled={busy}>{busy?'Authenticating…':mode==='login'?'Sign in to Finance OS':'Create local test account'}</button></form>
 <Notice warning>Local passwords are forbidden in production. Do not enter sensitive real financial data into an unapproved environment.</Notice></>:
 <><button className="btn btn-primary" disabled={busy} onClick={()=>{setBusy(true);void beginOidc().catch(ex=>{setError(describeError(ex));setBusy(false);});}}><ShieldCheck size={17}/> Continue with verified MFA</button>{error&&<p className="form-error" role="alert">{error}</p>}</>}
 </div></section></div>;
}
function WorkspaceStart(){
 const {createWorkspace}=useSession(),[name,setName]=useState('Personal finances'),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 const submit=async(ev:FormEvent)=>{ev.preventDefault();setBusy(true);setError('');try{await createWorkspace(name,'PERSONAL');}catch(ex){setError(describeError(ex));}finally{setBusy(false);}};
 return <div className="connected-workspace-start"><div className="connected-auth-panel"><Brand/><span className="eyebrow">ONE SMALL STEP</span><h1>Let's create your financial workspace.</h1><p>Start with a personal workspace. Accounts and transactions can be added afterwards.</p><form onSubmit={ev=>void submit(ev)}><label className="form-field"><span>Workspace name</span><input value={name} onChange={ev=>setName(ev.target.value)} minLength={2} maxLength={160} required/></label>{error&&<div role="alert" className="form-error">{error}</div>}<button className="btn btn-primary" disabled={busy}>Create workspace</button></form><Notice>New workspaces have no seeded financial information and remain isolated from other workspaces.</Notice></div></div>;
}
function SignedIn(){
 const [drawer,setDrawer]=useState<ActionKind|null>(null),[quick,setQuick]=useState(false);
 const navigate=useNavigate();const {role}=useSession();
 const open=(kind:ActionKind)=>{setQuick(false);setDrawer(kind);};
 return <><Routes><Route element={<AppShell onAdd={()=>setQuick(true)}/>}>
 <Route path="/home" element={<Home open={open}/>}/>
 <Route path="/activity" element={<Activity open={open}/>}/>
 <Route path="/spending" element={<Spending open={open}/>}/>
 <Route path="/cash-flow" element={<CashFlow open={open}/>}/>
 <Route path="/goals" element={<Goals open={open}/>}/>
 <Route path="/wealth" element={<Wealth open={open}/>}/>
 <Route path="/insights" element={<Insights/>}/>
 <Route path="/settings" element={<SettingsPage open={open}/>}/>
 <Route path="*" element={<Navigate to="/home" replace/>}/>
 </Route></Routes>
 {quick&&<Drawer title="What would you like to do?" onClose={()=>setQuick(false)}><div className="connected-quick-menu">{(['transaction','account','category','budget','bill','income','goal','debt','asset'] as ActionKind[]).map(k=><button key={k} disabled={role==='VIEWER'} className="connected-quick-item" onClick={()=>open(k)}><Plus size={17}/><span>{actions[k]}</span></button>)}<div className="notice"><ShieldCheck size={15}/> Manual finance controls only. No bank connection or payment execution.</div><button className="btn btn-outline" onClick={()=>{setQuick(false);navigate('/activity');}}>Go to Activity</button></div></Drawer>}
 {drawer&&<RecordDrawer key={drawer} kind={drawer} onClose={()=>setDrawer(null)}/>}
 </>;
}
export function Application(){
 const {status,error,workspaceId}=useSession();
 if(status==='loading')return <div className="connected-loading"><Busy/></div>;
 if(status==='error')return <div className="connected-loading"><Failure error={error} retry={()=>window.location.reload()}/></div>;
 if(status==='ready')return <AuthScreen/>;
 if(!workspaceId)return <WorkspaceStart/>;
 return <SignedIn/>;
}
