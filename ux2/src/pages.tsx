import {useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {ArrowUpRight,Plus,Check,Info,CalendarClock} from 'lucide-react';
import {useSession} from './session';
import {PageHead,Card,Empty,Busy,Failure,Source,Metric,Row,Notice,Segments,FinancialChart,NoWrite} from './components';
import type {ReportPeriod} from './components';
import {useRead,useItems,useWrite,useOwnerCheck,formatMoney,dateText,describeError} from './finance';
import type {Account,Transaction,Category,Ledger,Bill,Goal,Budget,Entity} from './finance';
import type {ActionKind} from './forms';

export type OpenAction=(kind:ActionKind)=>void;
const Add=({label,kind,open}:{label:string;kind:ActionKind;open:OpenAction})=>{const {role}=useSession();return <button className="btn btn-primary" disabled={role==='VIEWER'} onClick={()=>open(kind)}><Plus size={16}/> {label}</button>;};
const Money=({v}:{v:unknown})=><span className="number-cell">{formatMoney(v)}</span>;
type Report={periods:ReportPeriod[];totals:{incomeMinor:number;expenseMinor:number;netMinor:number};quality:string;providerVerified:false;generatedAt:string};
type Bills={items:Bill[];overview:{upcomingUnverifiedMinor:number;overdueUnverifiedMinor:number;evidence:string}};
function ErrorView({queries}:{queries:{isPending:boolean;error:unknown;refetch:()=>unknown}[]}){
 const bad=queries.find(q=>q.error);
 if(bad)return <Failure error={bad.error} retry={()=>void bad.refetch()}/>;
 if(queries.some(q=>q.isPending))return <Busy/>;
 return null;
}
export function Home({open}:{open:OpenAction}){
 const navigate=useNavigate(),accounts=useItems<Account>('/accounts'),transactions=useItems<Transaction>('/transactions'),
  summary=useRead<Ledger>('/ledger/summary'),report=useRead<Report>('/reports/monthly?months=6'),bills=useRead<Bills>('/bills'),goals=useItems<Goal>('/savings-goals');
 const blocker=<ErrorView queries={[accounts,transactions,summary,report,bills,goals]}/>;
 if(blocker)return <><PageHead title="Your financial command centre" sub="Workspace-backed financial clarity."/>{blocker}</>;
 const hasRecords=accounts.items.length>0;
 const total=summary.data?.totalByCurrency.find(x=>x.currency==='KES')?.amountMinor;
 const last=report.data?.periods.at(-1),nextBill=bills.data?.items.find(b=>b.status!=='CANCELLED');
 const pending=Number(bills.data?.overview?.upcomingUnverifiedMinor||0);
 return <><PageHead title="Your financial command centre" sub="Recorded facts first. Your next useful action second." action={<Source/>}/>
 <div className="connected-metrics">
  <div className="surface position-card"><span className="eyebrow">MANUAL RECORDED POSITION · KES</span><h2>{hasRecords&&total!==undefined?formatMoney(total):'No recorded account yet'}</h2><p className="position-meta">Posted workspace ledger, not verified by a bank</p><Source/></div>
  <Metric label="This month · income" value={last?formatMoney(last.incomeMinor):'Unavailable'} sub="Posted manual KES records"/>
  <Metric label="This month · expenses" value={last?formatMoney(last.expenseMinor):'Unavailable'} sub="Posted manual KES records"/>
  <Metric label="Upcoming bills" value={formatMoney(pending)} sub="User-reported, not provider verified"/>
 </div>
 {!hasRecords&&<Card title="Start with a reliable financial picture" sub="Two quick steps to begin"><div className="action-card-body"><p>Add a manual account, then record your first income or expense. No demonstration figures will be imported.</p><Add label="Add first account" kind="account" open={open}/></div></Card>}
 <div className="connected-grid connected-grid-main">
  <Card title="Money in and out" sub="Cash movements recorded in your ledger · 6-month history" action={<button className="link-action" onClick={()=>navigate('/insights')}>See reports <ArrowUpRight size={14}/></button>}>
   <FinancialChart rows={report.data?.periods||[]}/>
  </Card>
  <Card title="What needs attention" sub="One decision at a time">
    {nextBill?<><div className="connected-focus"><CalendarClock/><span><strong>{nextBill.name}</strong><small>Scheduled: {dateText(nextBill.firstDueOn)} · {formatMoney(nextBill.amountMinor)}</small></span></div><Notice warning>Bill schedule is user-reported. No automatic payment or bank verification.</Notice><button className="btn btn-outline" onClick={()=>navigate('/cash-flow')}>Review obligations</button></>:
    <Empty title="No bills scheduled" action={<Add label="Add a bill" kind="bill" open={open}/>}/>}
  </Card>
 </div>
 <div className="connected-grid">
  <Card title="Recent activity" sub="The latest posted manual entries" action={<button className="link-action" onClick={()=>navigate('/activity')}>View activity</button>}>
   {transactions.items.length?transactions.items.slice(0,5).map(t=><Row key={t.id} title={t.description} detail={dateText(t.occurredAt)+' · '+t.kind} value={<Money v={t.amountMinor}/>}/>):<Empty title="No posted transactions" action={<Add label="Record a transaction" kind="transaction" open={open}/>}/>}
  </Card>
  <Card title="Goals & progress" sub="Virtual planning targets, not real transfers" action={<button className="link-action" onClick={()=>navigate('/goals')}>View goals</button>}>
   {goals.items.length?goals.items.slice(0,3).map(g=><div className="connected-goal" key={g.id}><div><strong>{g.name}</strong><span>{formatMoney(g.targetMinor)} target</span></div><progress max={Math.max(g.targetMinor,1)} value={Math.max(0,g.allocatedMinor||0)}/><small>Virtual allocation: {formatMoney(g.allocatedMinor||0)}</small></div>):<Empty title="No savings goal yet" action={<Add label="Create goal" kind="goal" open={open}/>}/>}
  </Card>
 </div></>;
}
function FilterList({items,kind}:{items:Transaction[];kind:string}){
 const [more,setMore]=useState(false),[search,setSearch]=useState('');
 const filtered=items.filter(t=>(t.description+' '+t.kind).toLowerCase().includes(search.toLowerCase()));
 return <><label className="sr-only" htmlFor={'activity-filter-'+kind}>Search recorded entries</label><input className="connected-search" id={'activity-filter-'+kind} value={search} onChange={ev=>setSearch(ev.target.value)} placeholder="Search descriptions…"/>{filtered.length?filtered.slice(0,more?50:8).map(t=><Row key={t.id} title={t.description} detail={dateText(t.occurredAt)+' · '+t.kind} value={<Money v={t.amountMinor}/>}/>):<Empty title="No matching recorded transactions"/>}
 {filtered.length>8&&<button className="btn btn-outline" onClick={()=>setMore(v=>!v)}>{more?'Show fewer':'View more ('+filtered.length+')'}</button>}</>;
}
export function Activity({open}:{open:OpenAction}){
 const [tab,setTab]=useState('transactions');
 const accounts=useItems<Account>('/accounts'),transactions=useItems<Transaction>('/transactions'),cats=useItems<Category>('/categories'),
 summary=useRead<Ledger>('/ledger/summary'),imports=useRead<Record<string,unknown>>('/reconciliation',tab==='reconciliation');
 const tabs=[{id:'transactions',label:'Transactions'},{id:'accounts',label:'Accounts'},{id:'categories',label:'Categories'},{id:'reconciliation',label:'Reconciliation'}];
 const blocker=<ErrorView queries={[accounts,transactions,cats,summary,...(tab==='reconciliation'?[imports]:[])]}/>;
 return <><PageHead title="Activity" sub="Understand every movement, and trace the financial records behind it." action={<Add label="Record transaction" kind="transaction" open={open}/>}/><Segments items={tabs} selected={tab} onChange={setTab}/>
 {blocker||<div className="connected-grid connected-grid-main">
   {tab==='transactions'?<><Card title="Posted transactions" sub="Journal-backed, manually entered"><FilterList items={transactions.items} kind={tab}/></Card><Card title="Record movement" sub="Fast actions" action={<Source/>}><div className="connected-action-stack"><Add label="Record income or expense" kind="transaction" open={open}/><Add label="Stage statement entry" kind="import" open={open}/></div><Notice>Statement imports remain unverified until explicitly matched.</Notice></Card></>:
   tab==='accounts'?<><Card title="Your financial accounts" sub="Manual records only">{accounts.items.length?accounts.items.map(a=><Row key={a.id} title={a.displayName} detail={a.kind+' · '+a.providerStatus} value={<Money v={a.balanceMinor}/>}/>):<Empty title="No manual accounts" action={<Add label="Add account" kind="account" open={open}/>}/>}</Card><Card title="Account position" sub="Sum of posted account journal lines"><div className="connected-value">{formatMoney(summary.data?.totalByCurrency.find(x=>x.currency==='KES')?.amountMinor)}</div><Source/><p className="small muted">Not independently reconciled to your bank.</p><Add label="Add manual account" kind="account" open={open}/></Card></>:
   tab==='categories'?<><Card title="Your categories" sub="Classify posted income and expenses">{cats.items.length?cats.items.map(c=><Row key={c.id} title={c.name} detail={c.kind} value={<Check size={17}/>}/>):<Empty title="No categories yet" action={<Add label="Create category" kind="category" open={open}/>}/>}</Card><Card title="Organize your records" sub="Keep it simple"><p className="muted">Start with an income category and an expense category before recording transactions.</p><Add label="Create category" kind="category" open={open}/></Card></>:
   <><Card title="Staged reconciliation" sub="Statement rows are unverified evidence"><pre className="summary-pre">{JSON.stringify(imports.data||{},null,2).slice(0,1800)}</pre></Card><Card title="Match evidence to journal" sub="A match never posts more cash"><Add label="Match imported row" kind="reconcile" open={open}/><Notice warning>Only match identical workspace, account, currency and signed amount records.</Notice></Card></>}
 </div>}</>;
}
type Insight={categories:{name:string;netSpentMinor:number;transactionCount:number}[];monthlyTotals:{period:string;netSpentMinor:number}[];sourceQuality:string};
function ListPanel({tail,title,sub,emptyTitle,open,kind}:{tail:string;title:string;sub:string;emptyTitle:string;open?:OpenAction;kind?:ActionKind}){
 const q=useItems<Entity>(tail);
 if(q.isPending)return <Busy/>;
 if(q.error)return <Failure error={q.error} retry={()=>void q.refetch()}/>;
 const shown=q.items.slice(0,8);
 return <Card title={title} sub={sub} action={kind&&open?<Add label="Add" kind={kind} open={open}/>:undefined}>
  {shown.length?shown.map(x=><Row key={x.id} title={String(x.name||x.label||x.id.slice(0,8))} detail={String(x.status||x.currency||x.kind||'User recorded')} value={moneyFrom(x)}/>):<Empty title={emptyTitle} action={kind&&open?<Add label="Create record" kind={kind} open={open}/>:undefined} />}
  {q.items.length>shown.length&&<p className="tiny muted">Showing {shown.length} of {q.items.length} records.</p>}
 </Card>;
}
function moneyFrom(x:Entity){for(const key of ['estimatedValueMinor','estimatedOutstandingMinor','outstandingMinor','amountMinor','targetMinor','initialValueMinor','expectedMinor','balanceMinor','premiumMinor']){if(typeof x[key]==='number')return <Money v={x[key]}/>;}return <Info size={15}/>;}
export function Spending({open}:{open:OpenAction}){
 const [tab,setTab]=useState('overview');
 const budgets=useItems<Budget>('/budgets',tab==='overview'||tab==='budgets'),insight=useRead<Insight>('/spending/insights?months=6',tab==='overview');
 const cats=useItems<Category>('/categories',tab==='overview');
 const tabs=[{id:'overview',label:'Overview'},{id:'budgets',label:'Budgets'},{id:'guardrails',label:'Guardrails'},{id:'approvals',label:'Approvals'}];
 const blocker=<ErrorView queries={tab==='overview'?[budgets,insight,cats]:tab==='budgets'?[budgets]:[]}/>;
 return <><PageHead title="Spending" sub="Know what was posted, what is planned, and where to review." action={<Add label="Create budget" kind="budget" open={open}/>}/><Segments items={tabs} selected={tab} onChange={setTab}/>
 {blocker||(tab==='overview'?<div className="connected-grid"><Card title="Spending categories" sub="Posted manual transactions · last six months">{insight.data?.categories.length?insight.data.categories.slice(0,7).map(c=><div className="connected-category" key={c.name}><span>{c.name}</span><strong>{formatMoney(c.netSpentMinor)}</strong><div className="connected-track"><span style={{width:(100*Math.max(0,c.netSpentMinor)/Math.max(1,...insight.data!.categories.map(x=>x.netSpentMinor)))+'%'}}/></div></div>):<Empty title="No posted spending data"/>}<Source label={insight.data?.sourceQuality}/></Card>
 <Card title="Monthly budgets" sub="Allocated spending limits">{budgets.items.length?budgets.items.slice(0,5).map(b=><div className="connected-category" key={b.id}><span>{b.name}</span><strong>{formatMoney(b.spentMinor)} / {formatMoney(b.amountMinor)}</strong><div className="connected-track"><span style={{width:Math.min(100,(b.spentMinor||0)/Math.max(b.amountMinor,1)*100)+'%'}}/></div></div>):<Empty title="No budgets recorded" action={<Add label="Create budget" kind="budget" open={open}/>}/>}</Card></div>:
 tab==='budgets'?<Card title="Your budgets" sub="Planning limits only">{budgets.items.length?budgets.items.map(b=><Row key={b.id} title={b.name} detail={b.status+' · '+dateText(b.startsOn)+' to '+dateText(b.endsOn)} value={<Money v={b.amountMinor}/>}/>):<Empty title="No budget yet" action={<Add label="Create budget" kind="budget" open={open}/>}/>}</Card>:
 tab==='guardrails'?<><ListPanel tail="/spending/guardrails" title="Manual posting controls" sub="Warnings and internal approvals only" emptyTitle="No spending rules" kind="guardrail" open={open}/><Notice warning>A warning cannot block a payment executed at a bank or mobile-money provider.</Notice></>:
 <ListPanel tail="/spending/approvals" title="Internal approval requests" sub="Finance OS workflow decisions, not bank authorizations" emptyTitle="No approval requests"/>)}</>;
}
export function CashFlow({open}:{open:OpenAction}){
 const [tab,setTab]=useState('bills'),bills=useRead<Bills>('/bills',tab==='bills'),
  overview=useRead<Record<string,unknown>>('/cash-flow/forecast?days=90',tab==='forecast'),risks=useRead<{recommendations?:string[];firstPotentialShortfallOn?:string|null}>('/cash-flow/shortfalls?days=90',tab==='risks');
 const tabs=[{id:'bills',label:'Bills'},{id:'income',label:'Income sources'},{id:'forecast',label:'Forecast'},{id:'risks',label:'Risks'}];
 const blocker=<ErrorView queries={tab==='bills'?[bills]:tab==='forecast'?[overview]:tab==='risks'?[risks]:[]}/>;
 return <><PageHead title="Cash Flow" sub="Separate expected income and obligations from money actually received." action={<Add label="Schedule bill" kind="bill" open={open}/>}/><Segments items={tabs} selected={tab} onChange={setTab}/>
 {blocker||(tab==='bills'?<div className="connected-grid"><Card title="Bills & obligations" sub="User-reported, not automatically paid">{bills.data?.items.length?bills.data.items.slice(0,12).map(b=><Row key={b.id} title={b.name} detail={b.cadence+' · Due '+dateText(b.firstDueOn)} value={<Money v={b.amountMinor}/>}/>):<Empty title="No bills recorded" action={<Add label="Add bill" kind="bill" open={open}/>}/>}</Card><Card title="Upcoming exposure" sub="Scheduled obligations not provider verified"><div className="connected-value">{formatMoney(bills.data?.overview.upcomingUnverifiedMinor)}</div><Notice>Paying an external bill does not update Finance OS unless manually recorded and reconciled.</Notice><Add label="Add bill" kind="bill" open={open}/></Card></div>:
 tab==='income'?<ListPanel tail="/income/sources" title="Expected income sources" sub="Not money received" emptyTitle="No income sources recorded" open={open} kind="income"/>:
 tab==='forecast'?<Card title="Indicative 90-day cash-flow forecast" sub="Read-only estimates and assumptions"><Notice warning>Forecasting is not proof of available funds. Confirm expected income independently.</Notice><SummaryFields value={overview.data||{}}/></Card>:
 <Card title="Cash-flow risk review" sub="Evidence-bound rules only">{risks.data?.recommendations?.length?risks.data.recommendations.map((t,i)=><div className="connected-insight" key={i}>{t}</div>):<Empty title="No actionable risk summary"/>}<Notice>Not a bank-confirmed solvency assessment or financial advice.</Notice></Card>)}</>;
}
function SummaryFields({value}:{value:Record<string,unknown>}){
 const rows=Object.entries(value).filter(([key,v])=>v!==null&&(typeof v==='number'||typeof v==='boolean'||typeof v==='string')&&!/(id|token|secret)/i.test(key)).slice(0,10);
 return <div className="connected-details">{rows.length?rows.map(([key,val])=><div key={key}><span>{key.replace(/([A-Z])/g,' $1').replaceAll('_',' ')}</span><strong>{key.endsWith('Minor')?formatMoney(val):String(val)}</strong></div>):<Empty title="No estimates available"/>}</div>;
}
export function Goals({open}:{open:OpenAction}){
 const [tab,setTab]=useState('goals'),tabs=[{id:'goals',label:'Savings goals'},{id:'buckets',label:'Money buckets'},{id:'allocations',label:'Virtual allocations'},{id:'scenarios',label:'Scenarios'},{id:'requests',label:'Funding approvals'}];
 const goals=useItems<Goal>('/savings-goals',tab==='goals');
 const blocker=<ErrorView queries={tab==='goals'?[goals]:[]}/>;
 return <><PageHead title="Goals" sub="Build a plan without confusing virtual allocations for real money." action={<Add label="Create savings goal" kind="goal" open={open}/>}/><Segments items={tabs} selected={tab} onChange={setTab}/>
 {blocker||(tab==='goals'?<div className="connected-grid">{goals.items.length?goals.items.slice(0,9).map(g=><Card key={g.id} title={g.name} sub={g.kind+' · planning target'}><div className="connected-value">{formatMoney(g.targetMinor)}</div><progress value={Math.max(0,g.allocatedMinor||0)} max={Math.max(1,g.targetMinor)}/><p className="tiny muted">Virtual allocation {formatMoney(g.allocatedMinor||0)}. No funds transferred.</p></Card>):<Card title="Your first goal" sub="Save for what matters"><Empty title="No savings goals" action={<Add label="Create goal" kind="goal" open={open}/>}/></Card>}</div>:
 tab==='buckets'?<ListPanel tail="/money-buckets" title="Virtual money buckets" sub="Planning envelopes only" emptyTitle="No money buckets" kind="bucket" open={open}/>:
 tab==='allocations'?<><ListPanel tail="/capital/allocations" title="Planned allocations" sub="Never moves bank funds" emptyTitle="No virtual allocations" kind="allocation" open={open}/><Notice>Do not count allocations as money separate from your ledger.</Notice></>:
 tab==='scenarios'?<ListPanel tail="/planning/scenarios" title="Financial scenarios" sub="Illustrative assumptions, not guaranteed outcomes" emptyTitle="No scenarios" kind="scenario" open={open}/>:
 <ListPanel tail="/capital/requests" title="Internal funding requests" sub="Approvals do not move funds" emptyTitle="No internal requests"/> )}</>;
}
export function Wealth({open}:{open:OpenAction}){
 const [tab,setTab]=useState('overview'),snapshot=useRead<{estimatedNetWorthMinor:number;assetTotalMinor:number;liabilityTotalMinor:number;evidence:string;sourceCounts:Record<string,number>}>('/wealth/summary',tab==='overview');
 const tabs=[{id:'overview',label:'Overview'},{id:'assets',label:'Assets'},{id:'investments',label:'Investments'},{id:'liabilities',label:'Liabilities'},{id:'debts',label:'Debts'},{id:'tax',label:'Tax'},{id:'insurance',label:'Insurance'},{id:'retirement',label:'Retirement'},{id:'estate',label:'Estate'}];
 const selected:Record<string,{tail:string;title:string;action?:ActionKind}>={assets:{tail:'/wealth/assets',title:'Manually valued assets',action:'asset'},investments:{tail:'/wealth/investments',title:'Investment estimates',action:'investment'},liabilities:{tail:'/wealth/liabilities',title:'Other liability estimates',action:'liability'},debts:{tail:'/debts',title:'Debt obligations',action:'debt'},tax:{tail:'/tax/obligations',title:'Estimated tax obligations',action:'tax'},insurance:{tail:'/insurance/policies',title:'Reported insurance policies',action:'insurance'},retirement:{tail:'/retirement/scenarios',title:'Retirement assumptions',action:'retirement'},estate:{tail:'/estate/checklists',title:'Private estate checklists'}};
 const {role}=useSession();
 return <><PageHead title="Wealth" sub="Your financial picture, with estimates and source quality visible." action={<Add label="Record asset" kind="asset" open={open}/>}/><Segments items={tabs} selected={tab} onChange={setTab}/>
 {tab==='overview'?(snapshot.isPending?<Busy/>:snapshot.error?<Failure error={snapshot.error} retry={()=>void snapshot.refetch()}/>:<><div className="connected-metrics"><Metric main label="Estimated net worth" value={formatMoney(snapshot.data?.estimatedNetWorthMinor)} sub="Cash journal plus user-reported values"/><Metric label="Estimated assets" value={formatMoney(snapshot.data?.assetTotalMinor)} sub="Not independently valued"/><Metric label="Estimated liabilities" value={formatMoney(snapshot.data?.liabilityTotalMinor)} sub="Includes reported debts"/></div><Card title="What is included" sub="No live quotes, trades or independent valuation"><SummaryFields value={snapshot.data?.sourceCounts||{}}/><Source label={snapshot.data?.evidence}/></Card></>):
 tab==='estate'&&role!=='OWNER'?<Notice warning>Estate planning records are restricted to the workspace owner.</Notice>:
 <ListPanel tail={selected[tab].tail} title={selected[tab].title} sub="User-reported records only" emptyTitle="No recorded items" kind={selected[tab].action} open={open}/>}
 <Notice>Retirement illustrations are not guaranteed. A policy record is not proof of coverage. Tax records are not official KRA assessments.</Notice></>;
}
type Advisor={items?:{title?:string;message?:string;detail?:string}[];recommendations?:{title?:string;message?:string}[];sourceQuality?:string};
export function Insights(){
 const [tab,setTab]=useState('reports'),tabs=[{id:'reports',label:'Monthly reports'},{id:'categories',label:'Categories'},{id:'health',label:'Financial health'},{id:'advisor',label:'Guidance'}];
 const report=useRead<Report>('/reports/monthly?months=6',tab==='reports'),categories=useRead<{items:{name:string;kind:string;amountMinor:number}[];quality:string}>('/reports/categories?months=6',tab==='categories'),
 health=useRead<Record<string,unknown>>('/financial-health',tab==='health'),advisor=useRead<Advisor>('/advisor',tab==='advisor');
 const blocker=<ErrorView queries={tab==='reports'?[report]:tab==='categories'?[categories]:tab==='health'?[health]:[advisor]}/>;
 return <><PageHead title="Insights" sub="Understand your manual records and avoid conclusions unsupported by the evidence."/><Segments items={tabs} selected={tab} onChange={setTab}/>
 {blocker||(tab==='reports'?<div className="connected-grid"><Card title="Income & expense history" sub="Posted manual KES · last six months"><FinancialChart rows={report.data?.periods||[]}/></Card><Card title="Period summary" sub="All amounts from the ledger"><div className="connected-value">{formatMoney(report.data?.totals.netMinor)}</div><p className="tiny muted">Net posted position across the displayed periods</p><SummaryFields value={report.data?.totals||{}}/><Source label={report.data?.quality}/></Card></div>:
 tab==='categories'?<Card title="Recorded category totals" sub="No invented spending analysis">{categories.data?.items.length?categories.data.items.map((x,i)=><Row key={i} title={x.name} detail={x.kind} value={<Money v={x.amountMinor}/>}/>):<Empty title="No posted category totals"/>}<Source label={categories.data?.quality}/></Card>:
 tab==='health'?<Card title="Explainable financial health" sub="Rules-based indicators, not objective credit scores"><SummaryFields value={health.data||{}}/><Notice warning>Any health interpretation is based on partial manual records, not professional advice.</Notice></Card>:
 <Card title="Rule-based guidance" sub="No generative AI provider activated">{advisor.data?.items?.length||advisor.data?.recommendations?.length?(advisor.data.items||advisor.data.recommendations||[]).map((x,i)=><Row key={i} title={x.title||'Recommendation'} detail={x.message||x.detail||'Review source records'} value={<Info size={16}/>}/>):<Empty title="No rule-based recommendations yet"/>}<Notice>Advice requires independent verification of sources and assumptions.</Notice></Card>)}</>;
}
export function SettingsPage({open}:{open:OpenAction}){
 const {user,role,meta,signOut,workspaces,createWorkspace}=useSession(),[tab,setTab]=useState('profile'),[name,setName]=useState(''),[error,setError]=useState(''),[notice,setNotice]=useState('');
 const owner=role==='OWNER',tabs=[{id:'profile',label:'Workspace'},{id:'privacy',label:'Privacy'},{id:'integrations',label:'Integrations'},{id:'security',label:'Security'},{id:'audit',label:'Audit'}];
 const check=useOwnerCheck();
 const created=async()=>{try{setError('');await createWorkspace(name,'PERSONAL');setName('');setNotice('Workspace created.');}catch(ex){setError(describeError(ex));}};
 return <><PageHead title="Settings" sub="Control identity, workspace access, privacy and data integrity."/><Segments items={tabs} selected={tab} onChange={setTab}/>
 {tab==='profile'?<div className="connected-grid"><Card title="Your profile" sub="Authenticated identity"><Row title={user?.displayName||'Account'} detail={user?.email||''} value={role}/><p className="small muted">Authentication mode: {meta?.authenticationScope}</p><button className="btn btn-outline" onClick={()=>void signOut()}>Sign out</button></Card><Card title="Your workspaces" sub="Workspaces are isolated in PostgreSQL">{workspaces.map(w=><Row key={w.id} title={w.name} detail={w.kind} value={w.role}/>)}<label className="form-field"><span>Create personal workspace</span><input value={name} onChange={ev=>setName(ev.target.value)} placeholder="Workspace name"/></label><button disabled={name.trim().length<2} className="btn btn-outline" onClick={()=>void created()}>Create workspace</button>{error&&<Notice warning>{error}</Notice>}{notice&&<Notice>{notice}</Notice>}</Card></div>:
 !owner?<NoWrite/>:
 tab==='privacy'?<ListPanel tail="/privacy/requests" title="Privacy requests" sub="Queued requests, not automatic export or erasure" emptyTitle="No privacy requests" kind="privacy" open={open}/>:
 tab==='integrations'?<><ListPanel tail="/integrations/requests" title="Integration information requests" sub="No active bank or M-Pesa connections" emptyTitle="No provider information requests" kind="integration" open={open}/><Notice warning>Finance OS does not store bank login credentials or connect to payment providers.</Notice></>:
 tab==='audit'?<ListPanel tail="/security/audit" title="Workspace audit events" sub="Read-only record of permitted actions" emptyTitle="No recorded audit entries"/>:
 <Card title="Manual-ledger financial integrity" sub="Owner-initiated read-only certification, not bank reconciliation"><p className="small muted">Explicitly run the B8 ledger consistency check. An empty workspace reports insufficient evidence, not a success.</p><button className="btn btn-outline" disabled={check.isPending} onClick={()=>check.mutate()}>{check.isPending?'Checking…':'Run financial integrity check'}</button>{check.error&&<Failure error={check.error}/>} {check.data&&<><SummaryFields value={check.data}/><Notice>PASS_MANUAL_LEDGER never certifies external bank balances or production readiness.</Notice></>}</Card>}</>;
}
