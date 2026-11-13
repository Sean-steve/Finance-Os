'use strict';
/* UX1 DESIGN PROTOTYPE: synthetic temporary records; never calls backend, localStorage, or sends money. */
(()=>{
const root=document.getElementById('app');if(!root)return;
const paths={
home:'<path d="m3 10 9-7 9 7v10H3z"/><path d="M9 20v-7h6v7"/>',
activity:'<path d="M3 7h17m-4-4 4 4-4 4M21 17H4m4-4-4 4 4 4"/>',
spending:'<path d="M12 3v9h9"/><path d="M12 3a9 9 0 1 0 9 9"/>',
'cash-flow':'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6m10-6v6M3 10h18m-13 5h4"/>',
goals:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
wealth:'<path d="m3 17 7-8 5 4 6-9"/><path d="M16 4h5v5M3 21h18"/>',
insights:'<path d="M9 18h6m-5 3h4M8 14a7 7 0 1 1 8 0l-1 3H9z"/>',
settings:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>',
more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>'
};
const nav=[['home','Home'],['activity','Activity'],['spending','Spending'],['cash-flow','Cash Flow'],['goals','Goals'],['wealth','Wealth'],['insights','Insights'],['settings','Settings']];
const icon=id=>'<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+(paths[id]||paths.more)+'</svg>';
const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const k=n=>Number(n||0);
const money=(x,signed=false)=>(x<0?'-':signed&&x>0?'+':'')+'KES '+Math.abs(k(x)).toLocaleString('en-KE',{maximumFractionDigits:0});
const pct=(x,t)=>t?Math.max(0,Math.min(100,Math.round(x/t*100))):0;
const stamp=o=>{const a=new Date();a.setHours(12,0,0,0);a.setDate(a.getDate()+o);return a.toISOString().slice(0,10);};
const days=d=>Math.round((new Date(d+'T12:00:00').getTime()-Date.now())/86400000);
const fmt=d=>new Date(d+'T12:00:00').toLocaleDateString('en-KE',{month:'short',day:'numeric'});
const fresh=()=>({
accounts:[{id:'a1',name:'Everyday account',kind:'Bank · manual',balance:185400},{id:'a2',name:'Mobile money wallet',kind:'Mobile money · manual',balance:32600},{id:'a3',name:'Cash wallet',kind:'Cash · manual',balance:8500}],
transactions:[{id:'t1',name:'Salary received',category:'Income',account:'a1',amount:120000,date:stamp(-2)},{id:'t2',name:'Groceries',category:'Food & groceries',account:'a2',amount:-8200,date:stamp(-3)},{id:'t3',name:'Transport',category:'Transport',account:'a2',amount:-2750,date:stamp(-4)},{id:'t4',name:'Freelance income',category:'Income',account:'a1',amount:23500,date:stamp(-7)},{id:'t5',name:'Home internet',category:'Bills',account:'a1',amount:-4999,date:stamp(-10)},{id:'t6',name:'Coffee and lunch',category:'Food & groceries',account:'a3',amount:-1750,date:stamp(-12)},{id:'t7',name:'Household supplies',category:'Shopping',account:'a2',amount:-5600,date:stamp(-16)},{id:'t8',name:'Electricity',category:'Bills',account:'a1',amount:-3400,date:stamp(-21)}],
budgets:[{name:'Food & groceries',limit:18000},{name:'Transport',limit:9500},{name:'Shopping',limit:12500},{name:'Bills',limit:22000}],
bills:[{id:'b1',name:'Rent',amount:22000,due:stamp(3),reviewed:false},{id:'b2',name:'Internet',amount:4999,due:stamp(8),reviewed:false},{id:'b3',name:'Electricity',amount:3400,due:stamp(13),reviewed:false}],
goals:[{id:'g1',name:'Emergency reserve',target:150000,saved:102000,emoji:'✦'},{id:'g2',name:'New laptop',target:85000,saved:26000,emoji:'▣'}]});
let store=fresh(),state={view:'home',period:30,drawer:'',kind:'expense',filter:'all',empty:false,more:false,toast:'',userStarted:false};
const db=()=>state.empty?{accounts:[],transactions:[],budgets:[],bills:[],goals:[]}:store;
const recent=()=>db().transactions.filter(t=>{const n=-days(t.date);return n>=0&&n<state.period;});
const income=()=>recent().filter(t=>t.amount>0).reduce((n,t)=>n+t.amount,0);
const spent=()=>-recent().filter(t=>t.amount<0).reduce((n,t)=>n+t.amount,0);
const balance=()=>db().accounts.reduce((n,a)=>n+a.balance,0);
const cat=c=>-recent().filter(t=>t.amount<0&&t.category===c).reduce((n,t)=>n+t.amount,0);
const btn=(label,act,secondary=false)=>'<button type="button" class="btn'+(secondary?' secondary':'')+'" data-action="'+e(act)+'">'+e(label)+'</button>';
const panel=(title,body,action='',sub='')=>'<section class="panel"><div class="panel-head"><div><h2>'+e(title)+'</h2>'+(sub?'<div class="panel-sub">'+e(sub)+'</div>':'')+'</div>'+action+'</div>'+body+'</section>';
const heading=(title,desc)=>'<div class="page-head"><div><span class="eyebrow">YOUR FINANCIAL WORKSPACE</span><h1>'+e(title)+'</h1><p>'+e(desc)+'</p></div><div class="head-controls">'+periodSelect()+'</div></div>';
const periodSelect=()=>'<select class="select" data-change="period" aria-label="Time range"><option value="30"'+(state.period===30?' selected':'')+'>Last 30 days</option><option value="90"'+(state.period===90?' selected':'')+'>Last 90 days</option></select>';
const notice=()=>'<div class="notice warn" role="note"><b>UX1 concept · synthetic figures only.</b> No live bank, backend, authentication or payment connection. Actions update in-memory example records and reset on reload.</div>';
const row=(name,detail,value,sym='◈',act='')=>'<div class="row"><div class="row-left"><div class="row-icon">'+sym+'</div><div><div class="row-name">'+e(name)+'</div><div class="row-detail">'+e(detail)+'</div></div></div><div class="row-value">'+value+(act?'<div><button class="link-button" data-action="'+e(act)+'">Review →</button></div>':'')+'</div></div>';
const empty=(title,detail,action='')=>'<div class="empty"><b>'+e(title)+'</b>'+e(detail)+(action?'<p>'+action+'</p>':'')+'</div>';
function chart(){
const list=recent();if(!list.length)return empty('No history to chart','Add a sample record first.');
const group=[],parts=6,chunk=state.period/parts;
for(let i=0;i<parts;i++){const m=list.filter(t=>{const age=-days(t.date);return age>=i*chunk&&age<(i+1)*chunk;});group.push([m.filter(t=>t.amount>0).reduce((n,t)=>n+t.amount,0),-m.filter(t=>t.amount<0).reduce((n,t)=>n+t.amount,0)]);}
group.reverse();const max=Math.max(1,...group.flat()),floor=164,scale=135/max;
let svg='';
for(let i=0;i<4;i++){const y=floor-i*45;svg+='<line class="gridline" x1="34" x2="574" y1="'+y+'" y2="'+y+'"/><text x="0" y="'+(y+3)+'">'+Math.round(max*i/3000)+'k</text>';}
group.forEach((g,i)=>{const x=58+i*88,hi=g[0]*scale,he=g[1]*scale;svg+='<rect class="income" x="'+x+'" y="'+(floor-hi)+'" width="23" height="'+hi+'" rx="5"><title>Income '+money(g[0])+'</title></rect><rect class="expense" x="'+(x+28)+'" y="'+(floor-he)+'" width="23" height="'+he+'" rx="5"><title>Expenses '+money(g[1])+'</title></rect><text x="'+(x+24)+'" y="182" text-anchor="middle">'+(state.period===30?'Week ':'Part ')+(i+1)+'</text>';});
return '<div class="chart-wrap"><svg class="chart-svg" viewBox="0 0 580 190" role="img" aria-label="Synthetic manual income '+money(income())+' and spending '+money(spent())+' over '+state.period+' days">'+svg+'</svg></div><div class="chart-caption"><span><i class="dot"></i>Recorded income</span><span><i class="dot orange"></i>Recorded spending</span><span>KES · demo</span></div>';
}
function budgetList(){return db().budgets.length?db().budgets.map(b=>{let n=cat(b.name),p=pct(n,b.limit);return '<div class="category-line"><div class="between"><strong>'+e(b.name)+'</strong><small>'+money(n)+' of '+money(b.limit)+' · '+p+'%</small></div><div class="mini-progress '+(p>=100?'danger':p>=80?'warn':'')+'"><span style="width:'+p+'%"></span></div></div>';}).join(''):empty('No budgets yet','Create one to track your plan.',btn('+ New budget','new:budget'));}
function bills(max=99){let items=[...db().bills].sort((a,b)=>a.due.localeCompare(b.due)).slice(0,max);return items.length?items.map(b=>row(b.name,fmt(b.due)+' · '+(days(b.due)<0?'Overdue':'Due in '+Math.max(0,days(b.due))+' days')+(b.reviewed?' · Reviewed':''),money(b.amount),'▤','bill:'+b.id)).join(''):empty('Nothing due','No scheduled demo bills.',btn('+ Add bill','new:bill'));}
function txTable(){let items=[...db().transactions].sort((a,b)=>b.date.localeCompare(a.date));if(state.filter!=='all')items=items.filter(x=>x.category===state.filter);
return items.length?'<div style="overflow-x:auto"><table class="list-table"><thead><tr><th>Entry</th><th>Category</th><th>Date</th><th>Amount</th></tr></thead><tbody>'+items.map(t=>'<tr><td><b>'+e(t.name)+'</b><div class="row-detail">'+e(db().accounts.find(a=>a.id===t.account)?.name||'Manual')+'</div></td><td>'+e(t.category)+'</td><td>'+fmt(t.date)+'</td><td class="'+(t.amount>0?'amount-positive':'amount-negative')+'">'+money(t.amount,true)+'</td></tr>').join('')+'</tbody></table></div>':empty('No entries here','Choose another filter or record an entry.');}
function home(){
if(state.empty)return heading('Begin with one small step','This is the first-run empty state. No fictional balances are presented.')+panel('Create your financial picture','<div class="empty"><b>Your money, your way.</b>Add a manual account, then record your first income or expense.<p>'+btn('Add your first account','new:account')+'</p></div>')+notice();
const due=[...db().bills].sort((a,b)=>a.due.localeCompare(b.due));
return heading('Your money, at a glance.','A calmer way to understand your financial position.')+
'<div class="metrics"><article class="metric primary"><div class="metric-label">Recorded account position</div><div class="number">'+money(balance())+'</div><small>Synthetic manual balances · not bank verified</small></article>'+
'<article class="metric"><div class="metric-label">Recorded income</div><div class="number">'+money(income())+'</div><small>Last '+state.period+' days · manual</small></article>'+
'<article class="metric"><div class="metric-label">Recorded spending</div><div class="number">'+money(spent())+'</div><small>Last '+state.period+' days · manual</small></article>'+
'<article class="metric"><div class="metric-label">Upcoming bills</div><div class="number">'+money(db().bills.reduce((n,b)=>n+b.amount,0))+'</div><small>Scheduled only · not paid</small></article></div>'+
'<div class="grid">'+panel('Income & spending',chart(),'<div class="tabs"><button class="'+(state.period===30?'active':'')+'" data-period="30">30 days</button><button class="'+(state.period===90?'active':'')+'" data-period="90">90 days</button></div>','Source: synthetic manual transactions')+panel('Upcoming bills',bills(3),'<button class="link-button" data-nav="cash-flow">See all →</button>','Understand what needs attention')+'</div>'+
'<div class="grid">'+panel('Your next best action','<div class="action-banner"><div class="action-emblem">✦</div><div><strong>'+ (due.length?'Review your next upcoming bill':'Build your financial picture')+'</strong><p>'+(due.length?e(due[0].name)+' is due '+fmt(due[0].due):'Record a first transaction to begin.')+'</p></div>'+btn(due.length?'Review':'Record',due.length?'bill:'+due[0].id:'new:transaction')+'</div><p class="workspace-note">Simple rules on synthetic data · not AI financial advice.</p>')+panel('Spending plan',budgetList(),'<button class="link-button" data-nav="spending">Manage →</button>','Manual spending versus planning limits')+'</div>'+notice();
}
function activity(){return heading('Money in motion','Every recorded movement, in one clear place.')+
'<div style="display:flex;gap:9px;margin:-6px 0 18px">'+btn('＋ Record transaction','new:transaction')+btn('＋ Account','new:account',true)+'</div>'+
'<div class="grid three">'+(db().accounts.map(a=>'<article class="panel"><div class="mini-label">'+e(a.kind)+'</div><h2 style="margin:8px 0">'+e(a.name)+'</h2><div class="mini-number">'+money(a.balance)+'</div><div class="workspace-note">Synthetic · manually recorded</div></article>').join('')||panel('No accounts','Add a manual demo account.'))+'</div>'+
panel('Recent activity','<label class="mini-label" for="filter">Category</label> <select class="select" id="filter"><option value="all">All entries</option>'+[...new Set(db().transactions.map(t=>t.category))].map(c=>'<option value="'+e(c)+'"'+(state.filter===c?' selected':'')+'>'+e(c)+'</option>').join('')+'</select>'+txTable(),'','Manual entries, no live imports')+notice();}
function spending(){return heading('Spend with intention','Budgets and categories that make decisions easier.')+
'<div class="grid">'+panel('Your spending budgets',budgetList(),btn('Edit budget','new:budget',true),'Manual spending vs monthly limits')+panel('Category breakdown',db().budgets.map(b=>'<div class="category-line"><div class="between"><strong>'+e(b.name)+'</strong><small>'+money(cat(b.name))+'</small></div><button data-filter="'+e(b.name)+'" aria-label="See '+e(b.name)+' entries" style="width:100%;border:0;background:transparent;padding:0"><span class="mini-progress" style="display:block"><span style="width:'+pct(cat(b.name),Math.max(1,spent()))+'%"></span></span></button></div>').join('')||empty('No categories','Add a budget first.'),'','Select a bar to see the underlying entries')+'</div>'+notice();}
function cashflow(){return heading('Plan what’s next','See upcoming bills before they surprise you.')+
'<div class="metrics"><article class="metric primary"><div class="metric-label">Recorded position · manual</div><div class="number">'+money(balance())+'</div><small>Not guaranteed available-to-spend money</small></article><article class="metric"><div class="metric-label">Scheduled obligations</div><div class="number">'+money(db().bills.reduce((n,b)=>n+b.amount,0))+'</div><small>Not automatically paid</small></article><article class="metric"><div class="metric-label">Recorded income</div><div class="number">'+money(income())+'</div><small>Not expected income</small></article><article class="metric"><div class="metric-label">Scheduled bills</div><div class="number">'+db().bills.length+'</div><small>Manual due dates</small></article></div>'+
'<div class="grid">'+panel('Upcoming obligations',bills(),btn('Add bill','new:bill',true),'Review is not payment execution')+panel('Income & expense history',chart(),'','Not a predictive cash flow forecast')+'</div>'+notice();}
function goals(){const items=db().goals.map(g=>'<article class="panel"><div class="row-left"><div class="row-icon violet">'+e(g.emoji)+'</div><div><div class="row-name">'+e(g.name)+'</div><div class="row-detail">Virtual planning · no transferred funds</div></div></div><div class="mini-number" style="margin-top:22px">'+money(g.saved)+'</div><div class="between" style="display:flex;justify-content:space-between;margin:8px 0;font-size:11px;color:var(--muted)"><span>of '+money(g.target)+'</span><strong>'+pct(g.saved,g.target)+'%</strong></div><div class="progress-track"><div class="progress-fill" style="width:'+pct(g.saved,g.target)+'%"></div></div><div style="margin-top:16px">'+btn('Adjust plan','goal:'+g.id,true)+'</div></article>').join('');
return heading('Make progress visible','Small steps toward a stronger financial future.')+
'<div style="margin:0 0 18px">'+btn('＋ New savings goal','new:goal')+'</div><div class="grid">'+(items||panel('No goals','Create a virtual target to begin.'))+panel('Planning note','<div class="action-banner"><div class="action-emblem">◎</div><div><strong>Plans are not transfers</strong><p>These progress values are hypothetical. Connected V3 will distinguish actual funding from virtual earmarks.</p></div></div>')+'</div>'+notice();}
function wealth(){if(state.userStarted)return heading('Your bigger financial picture','No asset or liability data has been recorded yet.')+panel('No wealth estimates',empty('No estimates to show','Add verified records after connected backend activation.'))+notice();return heading('Your bigger financial picture','Separate user-reported estimates from recorded money.')+
'<div class="metrics"><article class="metric primary"><div class="metric-label">Illustrative net worth</div><div class="number">'+money(balance()+340000-95000)+'</div><small>Mixed synthetic cash + manual estimates</small></article><article class="metric"><div class="metric-label">Recorded cash illustration</div><div class="number">'+money(balance())+'</div><small>Not bank verified</small></article><article class="metric"><div class="metric-label">Other assets estimate</div><div class="number">KES 340,000</div><small>Illustrative user-reported</small></article><article class="metric"><div class="metric-label">Liabilities estimate</div><div class="number">KES 95,000</div><small>Illustrative user-reported</small></article></div>'+
panel('Manual financial components',row('Recorded cash','Synthetic manual account totals',money(balance()))+row('Other assets','User-reported example estimate',money(340000))+row('Liabilities','User-reported example estimate','−'+money(95000)),'','No market prices, providers or third-party verification')+notice();}
function insights(){return heading('Clarity, not noise','Insights backed by visible evidence and simple rules.')+
'<div class="grid">'+panel('Financial activity',chart(),'','Sample records, not predictive advice')+panel('Your next useful step','<div class="action-banner"><div class="action-emblem">✦</div><div><strong>Review your recent spending</strong><p>Compare recorded expenses with your planned limits before making a new commitment.</p></div>'+btn('Review','nav:spending')+'</div><p class="workspace-note">Rules-only demonstration. No AI provider, no financial advice.</p>')+'</div>'+notice();}
function settings(){return heading('Preferences & privacy','A safe place to control the experience.')+
'<div class="grid">'+panel('Workspace',row('Sample workspace','Demo personal profile','KES')+row('External connections','Not connected','Unavailable')+row('Financial provenance','All entries in this preview','Synthetic'))+
panel('Explore interface states','<p style="color:var(--muted);font-size:12px">Preview onboarding empty state, restore sample records, and explore each destination.</p><div style="display:flex;gap:9px;flex-wrap:wrap">'+btn(state.empty?'Show example state':'Show first-run empty state','toggle:empty')+btn('Reset sample','reset',true)+'</div>')+'</div>'+
panel('Security boundary','<p class="notice">This visual prototype never accepts real login details or persists financial records. Local Fastify/PostgreSQL tests use the separate connected frontend. Production OIDC MFA, privacy review, bank integrations and release evidence are not complete.</p>')+notice();}
function page(){switch(state.view){case 'activity':return activity();case 'spending':return spending();case 'cash-flow':return cashflow();case 'goals':return goals();case 'wealth':return wealth();case 'insights':return insights();case 'settings':return settings();default:return home();}}
function drawer(){
if(!state.drawer)return '';
const [type,id]=state.drawer.split(':'),bill=store.bills.find(b=>b.id===id),goal=store.goals.find(g=>g.id===id);
const names={transaction:'Record transaction',account:'Add manual account',bill:bill?'Review scheduled bill':'Add upcoming bill',budget:'Set a spending budget',goal:goal?'Adjust virtual goal':'Create savings goal'};
let form='';
if(type==='account')form='<label class="field"><span>Account name</span><input name="name" required maxlength="70" placeholder="e.g. Everyday wallet"></label><label class="field"><span>Account type</span><select name="kind"><option>Bank · manual</option><option>Mobile money · manual</option><option>Cash · manual</option></select></label><p class="notice">New accounts begin at zero. No bank provider connection is created.</p>';
if(type==='transaction')form='<div class="radio-pair"><button type="button" data-kind="expense" class="'+(state.kind==='expense'?'active':'')+'">Expense</button><button type="button" data-kind="income" class="'+(state.kind==='income'?'active':'')+'">Income</button></div>'+
'<label class="field"><span>Description</span><input name="name" required maxlength="70" placeholder="e.g. Groceries"></label><label class="field"><span>Amount · KES</span><input name="amount" type="number" min=".01" max="100000000" step=".01" required></label>'+
'<label class="field"><span>Account</span><select name="account">'+db().accounts.map(a=>'<option value="'+e(a.id)+'">'+e(a.name)+'</option>').join('')+'</select></label>'+
'<label class="field"><span>Category</span><select name="category">'+(state.kind==='income'?['Income']:['Food & groceries','Transport','Shopping','Bills','Other']).map(x=>'<option>'+x+'</option>').join('')+'</select></label>'+
'<label class="field"><span>Date</span><input name="date" type="date" value="'+stamp(0)+'" required></label>';
if(type==='bill')form=bill?'<div class="metric primary"><div class="metric-label">'+e(bill.name)+'</div><div class="number">'+money(bill.amount)+'</div><small>Due '+fmt(bill.due)+'</small></div><p class="notice">Marking a bill reviewed is NOT a payment or settlement.</p>':
'<label class="field"><span>Bill name</span><input name="name" required maxlength="70"></label><label class="field"><span>Amount · KES</span><input name="amount" type="number" min=".01" step=".01" required></label><label class="field"><span>Due date</span><input type="date" name="due" value="'+stamp(1)+'" required></label><p class="notice">No payment will be initiated.</p>';
if(type==='budget')form='<label class="field"><span>Spending category</span><select name="name">'+['Food & groceries','Transport','Shopping','Bills','Other'].map(x=>'<option>'+x+'</option>').join('')+'</select></label><label class="field"><span>Monthly limit · KES</span><input name="limit" type="number" min="1" step="1" required></label>';
if(type==='goal')form='<label class="field"><span>Goal name</span><input name="name" maxlength="70" required value="'+e(goal?.name||'')+'"></label><label class="field"><span>Target · KES</span><input name="target" type="number" min="1" step="1" required value="'+(goal?.target||'')+'"></label><label class="field"><span>Planned allocation · KES</span><input name="saved" type="number" min="0" step="1" required value="'+(goal?.saved||0)+'"></label><p class="notice">Planning amount, not actual money moved.</p>';
return '<div class="overlay" data-dismiss><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="dialog-title"><div class="drawer-head"><div><span class="eyebrow">UX1 · DEMO ACTION</span><h2 id="dialog-title">'+e(names[type]||'Details')+'</h2></div><button class="x-btn" data-action="close" aria-label="Close">×</button></div><div class="drawer-body"><form id="sample-form">'+form+'</form></div><div class="drawer-foot">'+btn('Cancel','close',true)+btn(bill?'Mark reviewed':'Save sample',bill?'review:'+bill.id:'submit')+'</div></aside></div>';
}
function render(){
let current=nav.find(x=>x[0]===state.view)?.[1]||'Home';
root.innerHTML='<div class="layout"><aside class="sidebar"><a class="brand" href="#home" data-nav="home"><span class="logo-mark">◈</span><span>finance<span style="color:var(--green)">os</span><small>YOUR MONEY, IN FOCUS</small></span></a>'+
'<div class="workspace"><div class="workspace-icon">S</div><div><strong>Sample workspace</strong><span>Personal · KES</span></div></div><div class="nav-label">WORKSPACE</div><nav class="nav" aria-label="Main navigation">'+nav.map(([id,name])=>'<button type="button" class="'+(state.view===id?'active':'')+'" data-nav="'+id+'" '+(state.view===id?'aria-current="page"':'')+'>'+icon(id)+'<span>'+name+'</span></button>').join('')+'</nav>'+
'<div class="sidebar-foot"><div class="help-card"><strong>Small steps, big clarity ✦</strong><p>Explore a guided journey through temporary sample records.</p><button data-action="journey">Start quick tour →</button></div><span class="version">UX1 · Design prototype · No backend</span></div></aside>'+
'<div class="main"><header class="topbar"><div class="crumb">Workspace / <b>'+e(current)+'</b></div><div class="top-actions"><span class="pill">DEMO · SYNTHETIC</span><button class="icon-btn" data-nav="settings" aria-label="Settings">⚙</button><button class="add-btn" data-action="new:transaction">＋ Add new</button><button class="avatar" data-nav="settings" aria-label="Open settings">SN</button></div></header><main id="main-content" class="content">'+page()+'</main></div></div>'+
'<nav class="bottom-nav" aria-label="Mobile navigation">'+['home','activity','spending','goals','more'].map(id=>'<button class="'+(state.view===id||(id==='more'&&['cash-flow','wealth','insights','settings'].includes(state.view))?'active':'')+'" data-nav="'+id+'">'+icon(id)+'<span>'+ (id==='more'?'More':nav.find(x=>x[0]===id)?.[1])+'</span></button>').join('')+'</nav>'+
(state.more?'<div class="overlay" data-dismiss><aside class="drawer" role="dialog" aria-label="More destinations"><div class="drawer-head"><h2>More</h2><button class="x-btn" data-action="close" aria-label="Close">×</button></div><div class="drawer-body nav">'+nav.filter(x=>['cash-flow','wealth','insights','settings'].includes(x[0])).map(([id,name])=>'<button data-nav="'+id+'">'+icon(id)+name+'</button>').join('')+'</div></aside></div>':'')+
drawer()+(state.toast?'<div class="toast" role="status">'+e(state.toast)+'</div>':'');
if(state.drawer)root.querySelector('.drawer button')?.focus();
}
function go(view){if(view==='more'){state.more=true;render();return;}if(!nav.some(x=>x[0]===view))return;state.view=view;state.drawer='';state.more=false;state.toast='';history.replaceState(null,'','#'+view);render();window.scrollTo(0,0);}
function close(){state.drawer='';state.more=false;render();}
function toast(msg){state.toast=msg;render();}
function submit(){
const form=document.getElementById('sample-form');if(!form||!form.reportValidity())return;
let v=Object.fromEntries(new FormData(form).entries()),[type,id]=state.drawer.split(':'),rand=()=>Math.random().toString(36).slice(2);
const amount=x=>{const n=Number(x);if(!Number.isFinite(n)||n<0||n>100000000)throw Error('Enter a valid amount.');return Math.round(n*100)/100;};
try{
if(type==='account')store.accounts.push({id:rand(),name:v.name.trim(),kind:v.kind,balance:0});
if(type==='transaction'){if(!store.accounts.length)throw Error('Create an account first.');const a=store.accounts.find(x=>x.id===v.account);if(!a)throw Error('Choose account.');const n=amount(v.amount);if(n===0)throw Error('Enter nonzero amount.');const signed=state.kind==='income'?n:-n;store.transactions.unshift({id:rand(),name:v.name.trim(),category:state.kind==='income'?'Income':v.category,account:a.id,amount:signed,date:v.date});a.balance+=signed;}
if(type==='bill'){let n=amount(v.amount);if(!n)throw Error('Bill amount must be positive.');store.bills.push({id:rand(),name:v.name.trim(),amount:n,due:v.due,reviewed:false});}
if(type==='budget'){let n=amount(v.limit);if(!n)throw Error('Budget must be positive.');let b=store.budgets.find(x=>x.name===v.name);if(b)b.limit=n;else store.budgets.push({name:v.name,limit:n});}
if(type==='goal'){let target=amount(v.target),saved=amount(v.saved);if(!target)throw Error('Target must be positive.');let g=store.goals.find(x=>x.id===id);if(g)Object.assign(g,{name:v.name.trim(),target,saved});else store.goals.push({id:rand(),name:v.name.trim(),target,saved,emoji:'◎'});}
state.empty=false;state.drawer='';toast('Sample saved locally in memory · not the backend.');
}catch(err){alert(err.message);}
}
root.addEventListener('click',ev=>{
const node=ev.target.closest('[data-nav],[data-action],[data-period],[data-filter],[data-kind],[data-dismiss]');if(!node)return;
if(node.hasAttribute('data-dismiss')&&node===ev.target){close();return;}
if(node.dataset.nav){ev.preventDefault();go(node.dataset.nav);return;}
if(node.dataset.period){state.period=Number(node.dataset.period);render();return;}
if(node.dataset.filter){state.filter=node.dataset.filter;go('activity');return;}
if(node.dataset.kind){state.kind=node.dataset.kind;render();return;}
const act=node.dataset.action;if(!act)return;
if(act==='close'){close();return;}
if(act==='submit'){submit();return;}
if(act==='journey'){if(state.empty){go('home');state.drawer='account';}else{go('activity');state.drawer='transaction';}render();return;}
if(act==='reset'){store=fresh();state.empty=false;state.userStarted=false;state.filter='all';toast('Synthetic records restored.');return;}
if(act==='toggle:empty'){if(!state.userStarted){store={accounts:[],transactions:[],budgets:[],bills:[],goals:[]};state.empty=true;state.userStarted=true;}else{store=fresh();state.empty=false;state.userStarted=false;}state.view='home';state.filter='all';toast(state.empty?'First-run empty workspace enabled.':'Synthetic example records restored.');return;}
if(act.startsWith('new:')){state.drawer=act.slice(4);state.toast='';render();return;}
if(act.startsWith('nav:')){go(act.slice(4));return;}
if(act.startsWith('goal:')){state.drawer='goal:'+act.slice(5);render();return;}
if(act.startsWith('bill:')){state.drawer='bill:'+act.slice(5);render();return;}
if(act.startsWith('review:')){let b=store.bills.find(x=>x.id===act.slice(7));if(b){b.reviewed=true;state.drawer='';toast('Bill reviewed in sample · no payment was made.');}}
});
root.addEventListener('change',ev=>{if(ev.target.dataset.change==='period'){state.period=Number(ev.target.value);render();}if(ev.target.id==='filter'){state.filter=ev.target.value;render();}});
root.addEventListener('submit',ev=>{if(ev.target.id==='sample-form'){ev.preventDefault();submit();}});
document.addEventListener('keydown',ev=>{if(ev.key==='Escape'&&(state.drawer||state.more))close();});
window.addEventListener('hashchange',()=>{if(nav.some(x=>x[0]===location.hash.slice(1)))go(location.hash.slice(1));});
if(nav.some(x=>x[0]===location.hash.slice(1)))state.view=location.hash.slice(1);
render();
})();
