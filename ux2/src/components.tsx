import {useEffect,useRef} from 'react';
import type {ReactNode,FormEvent} from 'react';
import {NavLink,Outlet,useNavigate,useLocation} from 'react-router-dom';
import {LayoutDashboard,ArrowLeftRight,ChartPie,CalendarClock,Target,Landmark,Lightbulb,Settings,Plus,ChevronDown,LogOut,X,ShieldCheck,AlertCircle,Menu,RefreshCcw} from 'lucide-react';
import {ResponsiveContainer,BarChart,Bar,XAxis,YAxis,Tooltip,CartesianGrid,Legend} from 'recharts';
import {useSession} from './session';
import {dateText,describeError,formatMoney} from './finance';

const entries=[
 ['home','Home',LayoutDashboard],['activity','Activity',ArrowLeftRight],['spending','Spending',ChartPie],
 ['cash-flow','Cash Flow',CalendarClock],['goals','Goals',Target],['wealth','Wealth',Landmark],['insights','Insights',Lightbulb],['settings','Settings',Settings]
] as const;
export function Brand(){return <div className="brand"><span className="brand-symbol">◈</span><span className="brand-name">finance<span style={{color:'var(--emerald)'}}>os</span><small>YOUR MONEY, IN FOCUS</small></span></div>;}
export function AppShell({onAdd}:{onAdd:()=>void}){
 const {workspaces,workspaceId,selectWorkspace,signOut,role}=useSession();
 const navigate=useNavigate(),loc=useLocation(),current=entries.find(x=>loc.pathname.startsWith('/'+x[0]))?.[1]||'Home';
 const active=entries.find(x=>loc.pathname.startsWith('/'+x[0]))?.[0]||'home';
 return <div className="app-shell connected-layout">
  <aside className="sidebar"><Brand/><div className="nav-caption">YOUR WORKSPACE</div>
   <nav aria-label="Main navigation">{entries.map(([id,name,Icon])=><NavLink key={id} className={({isActive})=>'nav-item'+(isActive?' active':'')} to={'/'+id}><Icon size={19}/><span>{name}</span></NavLink>)}</nav>
   <div className="side-end"><div className="side-tip"><ShieldCheck size={20}/><strong>Recorded, not bank verified</strong><p>Every amount comes from your selected workspace. This app never invents balances.</p></div><span className="tiny muted">FINANCE OS V3 · CONNECTED</span></div>
  </aside>
  <div className="app-body"><header className="topbar"><div className="topbar-left"><div className="topbar-path">Workspace / <b>{current}</b></div></div>
    <div className="topbar-actions"><span className="pill subtle">POSTGRESQL · MANUAL</span><label className="sr-only" htmlFor="workspace-picker">Workspace</label>
      <select id="workspace-picker" className="connected-select" value={workspaceId} onChange={ev=>{selectWorkspace(ev.target.value);navigate('/home');}}>{workspaces.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>
      <button className="btn btn-primary top-add" onClick={onAdd}><Plus size={17}/> Add new</button>
      <button className="btn btn-icon btn-outline" title="Sign out" aria-label="Sign out" onClick={()=>{void signOut();navigate('/home');}}><LogOut size={18}/></button>
    </div></header>
   <main className="main" id="main"><div className="session-note" role="note">Financial source: manual PostgreSQL records · No bank or M-Pesa sync · No payments executed · {role==='VIEWER'?'View-only role':'Workspace: '+(workspaces.find(w=>w.id===workspaceId)?.name||'')}</div><Outlet/></main>
  </div>
  <nav className="mobile-nav connected-mobile-nav" aria-label="Mobile navigation">{[...entries.slice(0,3),entries[4],['more','More',Menu] as const].map(([id,name,Icon])=><NavLink key={id} className={'mobile-nav-item'+((id==='more'?['cash-flow','wealth','insights','settings'].includes(active):id===active)?' active':'')} to={id==='more'?'/settings':'/'+id}><Icon size={19}/><span>{name}</span></NavLink>)}</nav>
 </div>;
}
export function PageHead({title,sub,action}:{title:string;sub:string;action?:ReactNode}){return <div className="page-head"><div><div className="eyebrow">YOUR FINANCIAL WORKSPACE</div><h1>{title}</h1><p>{sub}</p></div>{action&&<div className="page-tools">{action}</div>}</div>;}
export function Card({title,sub,action,children,className=''}:{title:string;sub?:string;action?:ReactNode;children:ReactNode;className?:string}){return <section className={'surface '+className}><div className="section-title"><div><h2>{title}</h2>{sub&&<p>{sub}</p>}</div>{action}</div>{children}</section>;}
export function Empty({title,action}:{title:string;action?:ReactNode}){return <div className="empty-message"><div className="empty-glyph">◎</div><h3>{title}</h3><p>Financial information appears here only after it has been recorded.</p>{action}</div>;}
export function Busy(){return <div role="status" className="loading-block"><RefreshCcw size={19} className="spin"/> Fetching your financial records…</div>;}
export function Failure({error,retry}:{error:unknown;retry?:()=>void}){return <div className="error-block" role="alert"><AlertCircle size={20}/><div><b>These records couldn't be loaded</b><p>{describeError(error)}</p></div>{retry&&<button className="btn btn-outline" onClick={retry}>Retry</button>}</div>;}
export function Source({label='MANUAL_RECORD'}:{label?:string}){return <span className="source-pill"><ShieldCheck size={13}/> {label==='MANUAL_RECORD'?'Manual posted ledger':label.replaceAll('_',' ').toLowerCase()}</span>;}
export function Metric({label,value,sub,main=false}:{label:string;value:ReactNode;sub:string;main?:boolean}){return <article className={'metric-live '+(main?'metric-main':'')}><span className="eyebrow">{label}</span><strong>{value}</strong><small>{sub}</small></article>;}
export function Row({title,detail,value,onClick}:{title:string;detail:string;value:ReactNode;onClick?:()=>void}){return <div className="list-row connected-row"><div className="list-icon"><ArrowLeftRight size={17}/></div><div className="list-copy"><strong>{title}</strong><small>{detail}</small></div><div className="list-end">{value}{onClick&&<button className="link-action" onClick={onClick}>Details</button>}</div></div>;}
export function Notice({children,warning=false}:{children:ReactNode;warning?:boolean}){return <div className={'notice connected-notice'+(warning?' warn':'')} role="note"><AlertCircle size={16}/><span>{children}</span></div>;}
export function Segments({items,selected,onChange}:{items:{id:string;label:string}[];selected:string;onChange:(s:string)=>void}){return <div className="segments" role="group" aria-label="Financial view">{items.map(i=><button key={i.id} className={selected===i.id?'active':''} onClick={()=>onChange(i.id)} aria-pressed={selected===i.id}>{i.label}</button>)}</div>;}
export type ReportPeriod={period?:string;month?:string;incomeMinor:number;expenseMinor:number;netMinor?:number};
export function FinancialChart({rows}:{rows:ReportPeriod[]}){
 if(!rows.length)return <Empty title="No recorded history yet"/>;
 const chart=rows.map(r=>({name:(r.period||r.month||'').slice(0,7),income:r.incomeMinor/100,expenses:Math.abs(r.expenseMinor)/100}));
 const any=chart.some(x=>x.income!==0||x.expenses!==0);
 if(!any)return <Empty title="No posted income or expenses in this period"/>;
 return <div className="connected-chart"><div role="img" aria-label="Recorded manual income and expense trend over time"><ResponsiveContainer width="100%" height={240}><BarChart data={chart} margin={{top:6,right:12,left:0,bottom:4}}><CartesianGrid strokeDasharray="3 3" stroke="#e3ece6" vertical={false}/><XAxis dataKey="name" fontSize={11} stroke="#738782"/><YAxis width={55} tickFormatter={v=>String(v)} fontSize={11} stroke="#738782"/><Tooltip formatter={v=>formatMoney(Math.round(Number(v)*100))}/><Legend/><Bar dataKey="income" name="Income" fill="#0c8662" radius={[6,6,0,0]}/><Bar dataKey="expenses" name="Expenses" fill="#e5a766" radius={[6,6,0,0]}/></BarChart></ResponsiveContainer></div>
  <details className="chart-table"><summary>Accessible chart data</summary><table><thead><tr><th>Period</th><th>Income</th><th>Expenses</th></tr></thead><tbody>{rows.map((r,i)=><tr key={i}><td>{r.period||r.month}</td><td>{formatMoney(r.incomeMinor)}</td><td>{formatMoney(Math.abs(r.expenseMinor))}</td></tr>)}</tbody></table></details><div className="tiny muted">Posted manual transactions only · KES · no provider verification</div></div>;
}
export function Drawer({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){
 const target=useRef<HTMLDivElement>(null),previous=useRef<Element|null>(null);
 useEffect(()=>{previous.current=document.activeElement;const dialog=target.current;dialog?.querySelector<HTMLElement>('input,select,button')?.focus();
  const key=(ev:KeyboardEvent)=>{if(ev.key==='Escape')onClose();if(ev.key==='Tab'&&dialog){const all=Array.from(dialog.querySelectorAll<HTMLElement>('button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),a[href]'));if(!all.length)return;const first=all[0],last=all[all.length-1];if(ev.shiftKey&&document.activeElement===first){ev.preventDefault();last.focus();}else if(!ev.shiftKey&&document.activeElement===last){ev.preventDefault();first.focus();}}};
  window.addEventListener('keydown',key);return ()=>{window.removeEventListener('keydown',key);(previous.current as HTMLElement|null)?.focus();};},[onClose]);
 return <div className="drawer-backdrop" onMouseDown={ev=>{if(ev.target===ev.currentTarget)onClose();}}><div className="drawer" ref={target} role="dialog" aria-modal="true" aria-label={title}><div className="drawer-header"><div><span className="eyebrow">RECORDED FINANCE · WORKSPACE</span><h2>{title}</h2><p>Real PostgreSQL data, no synthetic fallbacks.</p></div><button type="button" className="btn btn-icon btn-outline" aria-label="Close" onClick={onClose}><X size={18}/></button></div>{children}</div></div>;
}
export function FormField({label,name,type='text',required=true,options,min,max,step,defaultValue,placeholder}:{label:string;name:string;type?:string;required?:boolean;options?:{value:string;label:string}[];min?:string;max?:string;step?:string;defaultValue?:string;placeholder?:string}){
 return <div className="form-field"><label htmlFor={'f-'+name}>{label}</label>{options?<select id={'f-'+name} name={name} required={required} defaultValue={defaultValue}>{options.map(o=><option key={o.value} value={o.value}>{o.label}</option>)}</select>:<input id={'f-'+name} name={name} type={type} required={required} min={min} max={max} step={step} defaultValue={defaultValue} placeholder={placeholder} maxLength={type==='text'?200:undefined}/>}</div>;
}
export function SaveForm({children,onSubmit,pending,error,close}:{children:ReactNode;onSubmit:(data:FormData)=>void;pending:boolean;error:string;close:()=>void}){
 return <form className="drawer-form" onSubmit={(ev:FormEvent<HTMLFormElement>)=>{ev.preventDefault();onSubmit(new FormData(ev.currentTarget));}}><div className="drawer-body">{children}{error&&<div role="alert" className="form-error">{error}</div>}</div><div className="drawer-footer"><button type="button" className="btn btn-outline" onClick={close}>Cancel</button><button className="btn btn-primary" type="submit" disabled={pending}>{pending?'Saving…':'Save record'}</button></div></form>;
}
export function NoWrite(){return <Notice warning>VIEWER role — you may inspect authorized records but not change them.</Notice>;}
export function LinkButton({to,children}:{to:string;children:ReactNode}){const navigate=useNavigate();return <button className="link-action" type="button" onClick={()=>navigate(to)}>{children} <ChevronDown size={13}/></button>;}
export {dateText};
