/* Finance OS V3 / UX1 — a self-contained interactive, illustrative design prototype.
 * Security boundary: NO API calls, credentials, storage or production financial records.
 * All sandbox values are generated, remain in memory, and disappear on refresh.
 * The existing connected.html + Fastify/PostgreSQL app remains the real local test surface.
 */
(()=>{
'use strict';
const root=document.getElementById('app');
if(!root)return;
const NAV=[
 ['home','Home','home'],['activity','Activity','activity'],['spending','Spending','spending'],
 ['cash-flow','Cash Flow','calendar'],['goals','Goals','target'],['wealth','Wealth','layers'],
 ['insights','Insights','sparkles'],['settings','Settings','settings']
];
const icons={
 home:'<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/><path d="M9 21v-7h6v7"/>',
 activity:'<path d="M3 7h18M3 17h18"/><path d="m8 3-4 4 4 4M16 13l4 4-4 4"/>',
 spending:'<path d="M12 2v10l8.5 5"/><path d="M12 2a10 10 0 1 0 8.5 15"/>',
 calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 2v6M17 2v6M3 11h18"/><path d="m9 16 2 2 4-4"/>',
 target:'<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>',
 layers:'<path d="m12 2 9 5-9 5-9-5 9-5zM3 12l9 5 9-5M3 17l9 5 9-5"/>',
 sparkles:'<path d="m12 3 1.9 6.1L20 11l-6.1 1.9L12 19l-1.9-6.1L4 11l6.1-1.9L12 3zM19 18l.8 2.2L22 21l-2.2.8L19 24l-.8-2.2L16 21l2.2-.8z"/>',
 settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.7l-1.8 1.8a1.6 1.6 0 0 0-1.7-.3l-1 2.3h-2.5l-1-2.3a1.6 1.6 0 0 0-1.7.3l-1.8-1.8a1.6 1.6 0 0 0 .3-1.7l-2.3-1v-2.5l2.3-1a1.6 1.6 0 0 0-.3-1.7l1.8-1.8a1.6 1.6 0 0 0 1.7.3l1-2.3h2.5l1 2.3a1.6 1.6 0 0 0 1.7-.3l1.8 1.8a1.6 1.6 0 0 0-.3 1.7l2.3 1v2.5z" transform="translate(-2,-1) scale(1.1)"/>',
 plus:'<path d="M12 5v14M5 12h14"/>',
 arrow:'<path d="M5 12h14m-6-6 6 6-6 6"/>',
 chevron:'<path d="m9 18 6-6-6-6"/>',
 down:'<path d="m6 9 6 6 6-6"/>',
 close:'<path d="M5 5l14 14M19 5 5 19"/>',
 search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/>',
 bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
 wallet:'<rect x="2" y="5" width="20" height="15" rx="3"/><path d="M2 10h20M17 15h2"/>',
 up:'<path d="m12 19 0-14m-5 5 5-5 5 5"/>',
 refund:'<path d="m5 8 6-5 6 5M11 3v11m-8 5h18"/>',
 clock:'<circle cx="12" cy="12" r="9"/><path d="M12 6v6l4 2"/>',
 receipt:'<path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2zM9 7h6M9 12h6"/>',
 check:'<path d="m4 12 5 5L20 6"/>',
 shield:'<path d="m12 2 8 4v6c0 5-3.5 8-8 10-4.5-2-8-5-8-10V6l8-4z"/><path d="m8 12 3 3 5-5"/>',
 chart:'<path d="M3 20V5m0 15h18M6 15l5-5 4 3 5-8"/>',
 info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7v1"/>',
 more:'<circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/>',
 spark:'<path d="M3 17h4l3-7 4 4 3-8 4 5"/>'
};
const icon=(name,extra='')=>'<svg class="icon '+extra+'" viewBox="0 0 24 24" aria-hidden="true">'+(icons[name]||icons.info)+'</svg>';
const esc=v=>String(v??'').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const minor=v=>Math.round(Number(v)*100);
const amount=v=>'KES '+(Number(v||0)/100).toLocaleString('en-KE',{minimumFractionDigits:0,maximumFractionDigits:0});
const monthText=(iso)=>new Date(iso+'T12:00:00Z').toLocaleString('en-GB',{month:'short',year:'numeric',timeZone:'UTC'});
const now=new Date();
const toISO=(year,month,day)=>new Date(Date.UTC(year,month,day)).toISOString().slice(0,10);
const monthStart=(offset=0)=>toISO(now.getFullYear(),now.getMonth()+offset,1);
const daysFromNow=n=>new Date(Date.UTC(now.getFullYear(),now.getMonth(),now.getDate()+n)).toISOString().slice(0,10);
const readableDate=(date)=>new Date(date+'T12:00:00Z').toLocaleDateString('en-KE',{day:'numeric',month:'short',timeZone:'UTC'});
const id=()=>String(Date.now())+'-'+Math.random().toString(36).slice(2,8);
function demoRecords(){
 const accounts=[{id:'bank',name:'Everyday Bank',kind:'Manual bank account'},
  {id:'mobile',name:'Mobile Money',kind:'Manual mobile money'}];
 const transactions=[];
 const add=(offset,day,title,value,category,accountId,kind)=>{
  const date=toISO(now.getFullYear(),now.getMonth()+offset,Math.min(day,27));
  transactions.push({id:id(),date,title,amountMinor:minor(value),category,accountId,kind});
 };
 for(let offset=-5;offset<=0;offset++){
  add(offset,3,'Salary',95000+5000*(offset+5),'Income','bank','income');
  add(offset,12,'Freelance project',16000+1000*(offset+5),'Income','mobile','income');
  add(offset,6,'Rent',-26000,'Housing','bank','expense');
  add(offset,9,'Groceries',-(11500+(offset+5)*420),'Food','bank','expense');
  add(offset,16,'Transport',-(6100+(offset+5)*190),'Transport','mobile','expense');
  add(offset,18,'Utilities',-4500,'Utilities','bank','expense');
  add(offset,21,'Everyday spending',-4300,'Lifestyle','mobile','expense');
 }
 return {accounts,transactions,bills:[
  {id:'bill1',title:'Internet subscription',amountMinor:minor(3500),due:daysFromNow(3),status:'due'},
  {id:'bill2',title:'Insurance premium',amountMinor:minor(5500),due:daysFromNow(12),status:'due'},
  {id:'bill3',title:'Electricity',amountMinor:minor(2400),due:daysFromNow(20),status:'due'}],
  budgets:[{category:'Food',limitMinor:minor(17000)},{category:'Transport',limitMinor:minor(10000)},
   {category:'Lifestyle',limitMinor:minor(10000)},{category:'Utilities',limitMinor:minor(7000)}],
  goals:[{id:'goal1',title:'Emergency cushion',targetMinor:minor(200000),progressMinor:minor(92000),note:'Virtual planning progress'},
    {id:'goal2',title:'New laptop',targetMinor:minor(85000),progressMinor:minor(26000),note:'Virtual planning progress'}],
  debt:[{title:'Personal loan',balanceMinor:minor(45000),kind:'User-reported estimate'}],
  assets:[{title:'Home equipment',valueMinor:minor(60000),kind:'User-reported estimate'},
    {title:'Investment contributions',valueMinor:minor(26000),kind:'Manual, unpriced'}]};
}
const emptyRecords=()=>({accounts:[],transactions:[],bills:[],budgets:[],goals:[],debt:[],assets:[]});
let state={stage:'welcome',route:'home',records:demoRecords(),isDemo:true,
  firstName:'Alex',workspace:'Personal workspace',period:6,filter:'all',search:'',
  drawer:null,chartFocus:null,more:false,toast:'',error:'',selected:null};
const transactions=()=>state.records.transactions.slice().sort((a,b)=>b.date.localeCompare(a.date));
const currentTx=()=>state.records.transactions.filter(t=>t.date>=monthStart()&&t.date<monthStart(1));
const total=(arr,fn)=>arr.reduce((n,r)=>n+fn(r),0);
const netBalance=()=>total(state.records.transactions,t=>t.amountMinor);
const monthIncome=()=>total(currentTx().filter(t=>t.amountMinor>0),t=>t.amountMinor);
const monthExpense=()=>-total(currentTx().filter(t=>t.amountMinor<0),t=>t.amountMinor);
const spentFor=category=>-total(currentTx().filter(t=>t.amountMinor<0&&t.category===category),t=>t.amountMinor);
const hasData=()=>state.records.transactions.length>0;
const dueBills=()=>state.records.bills.filter(b=>b.status!=='settled').sort((a,b)=>a.due.localeCompare(b.due));
const monthData=(count=6)=>{
 const rows=[];
 for(let offset=1-count;offset<=0;offset++){
  const start=monthStart(offset),end=monthStart(offset+1);
  const list=state.records.transactions.filter(t=>t.date>=start&&t.date<end);
  rows.push({key:start,label:monthText(start).split(' ')[0],income:total(list.filter(t=>t.amountMinor>0),t=>t.amountMinor),
   expense:-total(list.filter(t=>t.amountMinor<0),t=>t.amountMinor)});
 }
 return rows;
};
const dot=(name)=>'<span class="legend-mark '+name+'"></span>';
function topNotice(extra=''){
 return '<div class="preview-strip"><span class="preview-dot"></span><strong>UX1 INTERACTIVE PREVIEW</strong><span>· Sample financial data · No bank or backend connection</span>'+extra+'</div>';
}
function brand(){return '<span class="brand-symbol" aria-hidden="true">◈</span><span class="brand-name">finance<span style="font-weight:450">OS</span><small>YOUR MONEY, MADE CLEAR</small></span>';}
function welcome(){
 const chart=[12,26,18,40,34,46,55].map((n,i)=>({x:18+i*47,y:122-n*1.6}));
 return topNotice()+'<div class="welcome"><section class="welcome-content"><div class="welcome-mark">'+brand()+'</div>'+
  '<div class="eyebrow">A more considered way to manage money</div><h1>Get closer to financial clarity.</h1>'+
  '<p>See the whole picture. Understand your next move. Build momentum toward what matters — in one calm financial workspace.</p>'+
  '<div class="welcome-actions"><button class="btn btn-accent" data-action="demo">Explore interactive preview '+icon('arrow')+'</button>'+
  '<button class="btn btn-outline" data-action="onboarding">Start with an empty workspace</button></div>'+
  '<div class="welcome-note">'+icon('shield')+' UX design prototype. No sign-up required, no real accounts connected, and nothing leaves this browser session.</div></section>'+
  '<aside class="welcome-visual" aria-hidden="true"><span class="visual-tag">A clearer picture. Every day. ↗</span><div class="sample-board">'+
  '<span class="eyebrow">YOUR FINANCIAL PICTURE</span><h2 style="margin:13px 0 5px">KES 286,400</h2><p class="small muted">Illustrative recorded position</p>'+
  '<div class="mini-line"><svg viewBox="0 0 330 145" width="100%" aria-hidden="true"><defs><linearGradient id="introfill" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#53a887" stop-opacity=".30"/><stop offset="1" stop-color="#53a887" stop-opacity="0"/></linearGradient></defs>'+
  '<path d="M '+chart.map(p=>p.x+' '+p.y).join(' L ')+' L 300 145 L 18 145Z" fill="url(#introfill)"/>'+
  '<polyline points="'+chart.map(p=>p.x+','+p.y).join(' ')+'" stroke="#087e60" fill="none" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>'+
  '<div class="sample-board-footer"><div class="sample-chip">Money in<strong>+18.4%</strong></div><div class="sample-chip">Goals on track<strong>2 of 3</strong></div></div></div></aside></div>';
}
function onboarding(){
 return topNotice()+'<main id="main" class="onboarding"><section class="onboarding-card">'+
 '<div class="brand" style="padding:0;margin-bottom:30px">'+brand()+'</div>'+
 '<div class="onboard-progress"><span></span><span></span><span></span></div>'+
 '<span class="eyebrow">Set up your financial workspace</span>'+
 '<h1>Let’s start with the essentials.</h1><p>What you see first should be useful, not another long questionnaire. You can add more details later.</p>'+
 '<form data-form="onboarding"><div class="form-field"><label for="onboard-name">First name</label><input id="onboard-name" name="firstName" maxlength="40" required value="Alex" autocomplete="off"></div>'+
 '<div class="form-field"><label for="onboard-workspace">Workspace name</label><input id="onboard-workspace" name="workspace" maxlength="60" required value="Personal workspace" autocomplete="off"></div>'+
 '<div class="notice">'+icon('info')+' This preview starts without records. Add a manual account and a transaction to see your financial picture take shape.</div>'+
 '<button class="btn btn-primary" type="submit">Create preview workspace '+icon('arrow')+'</button>'+
 '<button type="button" class="btn btn-text" data-action="welcome">Go back</button></form></section></main>';
}
const navItem=([key,label,ico])=>'<button class="nav-item '+(state.route===key?'active':'')+'" data-go="'+key+'" '+(state.route===key?'aria-current="page"':'')+'>'+icon(ico)+'<span>'+label+'</span></button>';
function sidebar(){
 return '<aside class="sidebar" aria-label="Primary navigation"><div class="brand">'+brand()+'</div>'+
 '<div class="nav-caption">Your workspace</div><nav aria-label="Main destinations">'+NAV.map(navItem).join('')+'</nav>'+
 '<div class="side-end"><div class="side-tip"><span class="eyebrow">Financial clarity</span><strong>Small actions. Real momentum.</strong>'+
 '<p>Start with the money you record, then work toward the goals that matter to you.</p></div>'+
 '<button class="profile-row" data-go="settings">'+
 '<span class="avatar">'+esc(state.firstName.slice(0,1).toUpperCase())+'</span><span class="profile-meta"><strong>'+esc(state.firstName)+' · Preview</strong><small>Sample workspace · no live data</small></span>'+icon('chevron')+
 '</button></div></aside>';
}
function mobileNav(){
 const items=[['home','Home','home'],['activity','Activity','activity'],['spending','Spending','spending'],['goals','Goals','target'],['more','More','more']];
 return '<nav class="mobile-nav" aria-label="Mobile navigation">'+items.map(([key,label,ic])=>
 '<button data-go="'+key+'" class="'+(state.route===key||key==='more'&&state.more?'active':'')+'" '+(state.route===key?'aria-current="page"':'')+'>'+icon(ic)+'<span>'+label+'</span></button>').join('')+'</nav>';
}
function shell(){
 const title=NAV.find(x=>x[0]===state.route)?.[1]||'Home';
 return topNotice()+'<div class="app-shell">'+sidebar()+'<div class="workspace">'+
 '<header class="topbar"><div class="topbar-left"><span class="topbar-workspace">'+icon('wallet')+' '+esc(state.workspace)+' '+icon('down')+'</span><span class="topbar-path">/ '+title+'</span></div>'+
 '<div class="topbar-actions"><span class="pill subtle">'+icon('shield')+' Sample data</span><span class="status-text">Session-only preview</span>'+
 '<button class="btn btn-icon btn-outline" data-go="insights" aria-label="Open insights">'+icon('bell')+'</button>'+
 '<button class="btn btn-primary" data-open="quick">'+icon('plus')+' Add new</button></div></header>'+
 '<main id="main" class="main" tabindex="-1">'+page()+'</main>'+mobileNav()+'</div></div>'+
 (state.more?moreMenu():'')+(state.drawer?drawer():'')+(state.toast?'<div class="toast" role="status">'+icon('check')+' '+esc(state.toast)+'</div>':'');
}
function moreMenu(){
 return '<div class="drawer-backdrop" data-backdrop="true"><aside class="drawer" role="dialog" aria-modal="true" aria-label="More destinations"><div class="drawer-header"><div><span class="eyebrow">Explore Finance OS</span><h2>More</h2></div><button class="btn btn-icon" data-action="close-more" aria-label="Close menu">'+icon('close')+'</button></div>'+
 NAV.filter(x=>!['home','activity','spending','goals'].includes(x[0])).map(x=>navItem(x)).join('')+
 '</aside></div>';
}
const heading=(tag,title,desc,tools='')=>'<div class="page-head"><div><span class="eyebrow">'+tag+'</span><h1>'+title+'</h1><p>'+desc+'</p></div><div class="page-tools">'+tools+'</div></div>';
function disclosure(message='Illustrative sandbox records, not verified bank balances or independent financial advice.'){
 return '<div class="disclosure">'+icon('info')+' <span>'+esc(message)+'</span></div>';
}
function surface(title,subtitle,body,tools=''){
 return '<section class="surface"><div class="section-title"><div><h2>'+title+'</h2>'+(subtitle?'<p>'+subtitle+'</p>':'')+'</div>'+tools+'</div>'+body+'</section>';
}
function empty(title,desc,cta='',action=''){
 return '<div class="empty-message"><span class="icon-box">'+icon('wallet')+'</span><h3>'+title+'</h3><p>'+desc+'</p>'+
 (cta?'<button class="btn btn-quiet" data-open="'+action+'">'+cta+' '+icon('arrow')+'</button>':'')+'</div>';
}
function chart(){
 const periods=[[1,'30 days'],[3,'90 days'],[6,'6 months']];
 const rows=monthData(state.period),some=rows.some(r=>r.income||r.expense);
 const tabs='<div class="tabs" role="group" aria-label="Chart time range">'+periods.map(([n,label])=>
  '<button data-period="'+n+'" class="'+(state.period===n?'active':'')+'" aria-pressed="'+(state.period===n)+'">'+label+'</button>').join('')+'</div>';
 if(!some)return surface('Money in and out','Recorded manual transaction trends',empty('No chart yet','Record income or an expense to build a chart from your own entries.','Record transaction','transaction'),tabs);
 const max=Math.max(...rows.flatMap(r=>[r.income,r.expense]),1);
 const width=600,height=224,top=21,bottom=181,left=40,right=575;
 const usableW=right-left,slot=usableW/rows.length,barWidth=Math.min(25,slot*.26);
 const marks=rows.map((r,i)=>{
  const x=left+slot*i+slot/2,hi=(r.income/max)*(bottom-top),he=(r.expense/max)*(bottom-top);
  return '<g role="button" tabindex="0" data-chart-index="'+i+'" aria-label="'+r.label+': income '+amount(r.income)+', expenses '+amount(r.expense)+'" class="chart-col">'+
   '<rect x="'+(x-barWidth-2)+'" y="'+(bottom-hi)+'" width="'+barWidth+'" height="'+Math.max(1,hi)+'" rx="4" fill="#087e60"/>'+
   '<rect x="'+(x+2)+'" y="'+(bottom-he)+'" width="'+barWidth+'" height="'+Math.max(1,he)+'" rx="4" fill="#b8d9ca"/>'+
   '<text class="chart-axis" x="'+x+'" y="207" text-anchor="middle">'+r.label+'</text></g>';
 }).join('');
 const grid=[0,.25,.5,.75,1].map(n=>'<line class="chart-grid" x1="'+left+'" x2="'+right+'" y1="'+(bottom-n*(bottom-top))+'" y2="'+(bottom-n*(bottom-top))+'"/>'+
  '<text class="chart-axis" x="'+(left-8)+'" y="'+(bottom-n*(bottom-top)+4)+'" text-anchor="end">'+(n===0?'0':Math.round(max*n/100000)+'k')+'</text>').join('');
 const focus=state.chartFocus!=null&&state.chartFocus<rows.length?rows[state.chartFocus]:null;
 return surface('Money in and out','Recorded transactions over time',
  '<div class="chart-legend"><span>'+dot('income')+'Income</span><span>'+dot('expense')+'Expenses</span><span>All amounts in KES</span></div>'+
  '<div class="chart-wrap"><svg viewBox="0 0 '+width+' '+height+'" role="img" aria-label="Income versus expenses bar chart, '+state.period+' month view"><title>Income and expenses by month</title>'+grid+marks+'</svg></div>'+
  '<div class="chart-tooltip" role="status">'+(focus?esc(focus.label)+': '+amount(focus.income)+' in · '+amount(focus.expense)+' out':'Select a bar to inspect the recorded month.')+'</div>'+
  '<details class="small muted"><summary>Accessible chart data</summary><div class="table-scroll"><table class="data-table"><thead><tr><th>Month</th><th>Income</th><th>Expenses</th></tr></thead><tbody>'+rows.map(r=>
   '<tr><td>'+esc(r.label)+'</td><td>'+amount(r.income)+'</td><td>'+amount(r.expense)+'</td></tr>').join('')+'</tbody></table></div></details>'+
  disclosure('Chart uses in-memory sample manual transactions only. Never represents verified cash or a bank feed.'),tabs);
}
function categoryRows(items,totalValue=0){
 return '<div class="category-rows">'+items.map((r,i)=>{
  const percent=totalValue?Math.min(100,Math.round(r.value/totalValue*100)):0;
  return '<div class="category-row"><span class="category-label"><span class="legend-mark" style="background:'+['#108363','#98c7a6','#d7bc92','#96a8b9','#c8a9bc'][i%5]+'"></span>'+esc(r.name)+'</span><strong>'+amount(r.value)+'</strong>'+
   '<div class="progress-track"><span style="width:'+percent+'%;background:'+['#108363','#98c7a6','#d7bc92','#96a8b9','#c8a9bc'][i%5]+'"></span></div></div>';
 }).join('')+'</div>';
}
const categorySpend=()=>Object.entries(currentTx().filter(t=>t.amountMinor<0).reduce((a,t)=>
 (a[t.category]=(a[t.category]||0)-t.amountMinor,a),{})).map(([name,value])=>({name,value})).sort((a,b)=>b.value-a.value);
function spendingCard(){
 const rows=categorySpend(),totalValue=total(rows,x=>x.value);
 return surface('Where it went','This month · categories',
  rows.length?categoryRows(rows.slice(0,4),totalValue)+disclosure('Categories reflect manually categorized entries; no automatic bank categorization.') :
  empty('No spending recorded','Record an expense to see how spending is distributed.','Record expense','transaction'),
  '<button class="link-action" data-go="spending">Details '+icon('arrow')+'</button>');
}
function billList(limit=3){
 const rows=dueBills().slice(0,limit);
 if(!rows.length)return empty('All clear here','No outstanding bills have been recorded in this preview.','Add bill','bill');
 return '<ul class="list-reset">'+rows.map(b=>
 '<li class="list-row"><span class="list-icon orange">'+icon('receipt')+'</span><span class="list-copy"><strong>'+esc(b.title)+'</strong><small>Due '+readableDate(b.due)+'</small></span>'+
 '<span class="list-end"><strong>'+amount(b.amountMinor)+'</strong><button class="link-action small" data-settle="'+esc(b.id)+'">Mark settled</button></span></li>').join('')+'</ul>';
}
function goalList(limit=2){
 const rows=state.records.goals.slice(0,limit);
 if(!rows.length)return empty('No goals yet','Choose something meaningful, then set a target.','Create goal','goal');
 return rows.map(g=>{
  const pct=Math.round(g.progressMinor/Math.max(1,g.targetMinor)*100);
  return '<div class="goal-hero" style="margin-bottom:17px"><div style="flex:1;min-width:0"><strong style="font-size:14px">'+esc(g.title)+'</strong><div class="small muted">'+amount(g.progressMinor)+' of '+amount(g.targetMinor)+'</div>'+
   '<div class="progress-track"><span style="width:'+Math.min(100,pct)+'%"></span></div><button class="link-action" data-allocate="'+esc(g.id)+'">Adjust planning progress</button></div>'+
   '<span class="gauge-ring" style="--percent:'+Math.min(100,pct)+'" data-label="'+pct+'%" role="img" aria-label="'+pct+' percent of target"></span></div>';
 }).join('');
}
function recentActivity(limit=5){
 const items=transactions().slice(0,limit);
 if(!items.length)return empty('No activity yet','Record your first transaction and watch your financial story take shape.','Record transaction','transaction');
 return '<ul class="list-reset">'+items.map(t=>'<li class="list-row">'+
 '<span class="list-icon '+(t.amountMinor<0?'orange':'')+'">'+icon(t.amountMinor<0?'up':'refund')+'</span>'+
 '<span class="list-copy"><strong>'+esc(t.title)+'</strong><small>'+esc(t.category)+' · '+readableDate(t.date)+'</small></span>'+
 '<span class="list-end"><strong class="'+(t.amountMinor>0?'amount-pos':'amount-neg')+'">'+(t.amountMinor>0?'+':'−')+amount(Math.abs(t.amountMinor))+'</strong>'+
 '<button class="link-action small" data-detail="'+esc(t.id)+'">Details</button></span></li>').join('')+'</ul>';
}
function nextAction(){
 const bill=dueBills()[0];
 if(!state.records.accounts.length)return {title:'Start with one account',desc:'Give your money a home before recording your first activity.',label:'Add an account',open:'account'};
 if(!hasData())return {title:'Record your first movement',desc:'Add an income or expense to begin a meaningful financial picture.',label:'Record a transaction',open:'transaction'};
 if(bill)return {title:'A bill deserves attention',desc:bill.title+' is due '+readableDate(bill.due)+'. Review it before it surprises you.',label:'Review upcoming bills',go:'cash-flow'};
 if(!state.records.goals.length)return {title:'Choose what matters next',desc:'Give your savings a meaningful destination and follow your progress.',label:'Create a goal',open:'goal'};
 return {title:'Make a little more progress',desc:'A quick financial review can highlight what changed this week.',label:'Review insights',go:'insights'};
}
function home(){
 const a=nextAction(),tools='<button class="btn btn-outline" data-go="activity">'+icon('activity')+' View activity</button>';
 const emptyAccount=!state.records.accounts.length;
 return heading('Your financial command centre','Good '+(new Date().getHours()<12?'morning':new Date().getHours()<18?'afternoon':'evening')+', '+esc(state.firstName)+'.',
  emptyAccount?'Start with the essentials. Your financial picture will build as you record activity.':'A clear view of what you have recorded, what is coming and what matters next.',tools)+
 '<div class="overview-grid"><section class="surface position-card"><span class="eyebrow">RECORDED POSITION · KES</span>'+
 '<h2>'+(hasData()?amount(netBalance()):'No records yet')+'</h2><p class="position-meta">'+(hasData()?'Derived from illustrative manual transactions':'Add income or expenses to begin')+'</p>'+
 '<div class="card-bottom"><span class="pill dark">'+icon('shield')+' '+(hasData()?'Manual sample':'Incomplete data')+'</span><button class="link-action" style="color:#daf3d9" data-go="activity">Explore '+icon('arrow')+'</button></div></section>'+
 '<div class="metric-pair"><section class="metric-tile"><span class="icon-box">'+icon('refund')+'</span><div><span class="eyebrow">Money in · This month</span><strong>'+ (hasData()?amount(monthIncome()):'—')+'</strong><small>Recorded, not bank verified</small></div></section>'+
 '<section class="metric-tile expenses"><span class="icon-box">'+icon('up')+'</span><div><span class="eyebrow">Money out · This month</span><strong>'+(hasData()?amount(monthExpense()):'—')+'</strong><small>Recorded spending</small></div></section></div>'+
 '<section class="surface action-card"><div><span class="eyebrow">YOUR NEXT MOVE</span><h2>'+esc(a.title)+'</h2><p>'+esc(a.desc)+'</p></div>'+
 '<button class="btn btn-primary" '+(a.open?'data-open="'+a.open+'"':'data-go="'+a.go+'"')+'>'+esc(a.label)+' '+icon('arrow')+'</button></section></div>'+
 '<div class="dashboard-main">'+chart()+spendingCard()+'</div>'+
 '<div class="dashboard-lower">'+surface('Coming up','Your next financial obligations',billList(),'<button class="link-action" data-go="cash-flow">View all '+icon('arrow')+'</button>')+
 surface('Goals in motion','Virtual planning progress',goalList(),'<button class="link-action" data-go="goals">All goals '+icon('arrow')+'</button>')+
 surface('Recent activity','Your latest recorded movements',recentActivity(),'<button class="link-action" data-go="activity">All activity '+icon('arrow')+'</button>')+'</div>';
}
function activity(){
 const q=state.search.toLowerCase(),items=transactions().filter(t=>
  (state.filter==='all'||(state.filter==='income'?t.amountMinor>0:t.amountMinor<0))&&
  (!q||[t.title,t.category,t.date].join(' ').toLowerCase().includes(q)));
 return heading('Everyday money','Activity','Money in, money out, and where each recorded movement belongs.',
  '<button class="btn btn-primary" data-open="transaction">'+icon('plus')+' Record transaction</button>')+
 '<div class="stats-strip"><div class="mini-stat"><small>Recorded position</small><strong>'+(hasData()?amount(netBalance()):'—')+'</strong></div>'+
 '<div class="mini-stat"><small>Accounts</small><strong>'+state.records.accounts.length+'</strong></div>'+
 '<div class="mini-stat"><small>Recorded movements</small><strong>'+state.records.transactions.length+'</strong></div></div>'+
 '<div class="content-grid">'+surface('Transactions','Browse illustrative manual activity',
 '<div class="page-tools" style="justify-content:flex-start;margin-bottom:13px"><div class="tabs" role="group" aria-label="Transaction filter">'+
 [['all','All'],['income','Income'],['expense','Expenses']].map(([k,l])=>'<button data-filter="'+k+'" class="'+(state.filter===k?'active':'')+'" aria-pressed="'+(state.filter===k)+'">'+l+'</button>').join('')+'</div></div>'+
 '<form data-form="search" class="searchbox" style="margin-bottom:16px">'+icon('search')+' <input aria-label="Search transactions" name="search" value="'+esc(state.search)+'" placeholder="Search description or category"><button type="submit" class="link-action">Search</button></form>'+
 (items.length?'<div class="table-scroll"><table class="data-table"><thead><tr><th>Transaction</th><th>Category</th><th>Date</th><th>Amount</th><th>Details</th></tr></thead><tbody>'+
 items.slice(0,30).map(t=>'<tr><td><strong>'+esc(t.title)+'</strong></td><td>'+esc(t.category)+'</td><td>'+readableDate(t.date)+'</td><td class="'+(t.amountMinor>0?'amount-pos':'amount-neg')+'">'+(t.amountMinor>0?'+':'−')+amount(Math.abs(t.amountMinor))+'</td>'+
 '<td><button class="link-action" data-detail="'+esc(t.id)+'">Open '+icon('chevron')+'</button></td></tr>').join('')+'</tbody></table></div>':
 empty('Nothing matches','Try another search or record a new transaction.','New transaction','transaction'))+
 disclosure('Activity here is a temporary UI sandbox. New entries do not post to PostgreSQL.'),'<button class="link-action" data-open="transaction">+ New</button>')+
 surface('Your accounts','Manual records only',
 state.records.accounts.length?'<ul class="list-reset">'+state.records.accounts.map(a=>{
  const bal=total(state.records.transactions.filter(t=>t.accountId===a.id),t=>t.amountMinor);
  return '<li class="list-row"><span class="list-icon">'+icon('wallet')+'</span><span class="list-copy"><strong>'+esc(a.name)+'</strong><small>'+esc(a.kind)+'</small></span><span class="list-end"><strong>'+amount(bal)+'</strong><small>Illustrative</small></span></li>';
 }).join('')+'</ul>':empty('No accounts','Create a manual account to begin.','Add an account','account'),
 '<button class="link-action" data-open="account">+ Account</button>')+'</div>';
}
function spending(){
 const rows=state.records.budgets,spend=monthExpense(),budgetTotal=total(rows,r=>r.limitMinor);
 return heading('Know where it goes','Spending','Spend intentionally. See the categories that need your attention.',
 '<button class="btn btn-primary" data-open="budget">'+icon('plus')+' Adjust a budget</button>')+
 '<div class="stats-strip"><div class="mini-stat"><small>Recorded this month</small><strong>'+(hasData()?amount(spend):'—')+'</strong></div>'+
 '<div class="mini-stat"><small>Planned monthly budgets</small><strong>'+(rows.length?amount(budgetTotal):'—')+'</strong></div>'+
 '<div class="mini-stat"><small>Budget pressure</small><strong>'+(rows.length?Math.round(spend/Math.max(1,budgetTotal)*100)+'%':'Not set')+'</strong></div></div>'+
 '<div class="content-grid">'+surface('Monthly budget','Plan versus manual spending',
 rows.length?'<div class="category-rows">'+rows.map(r=>{
  const spent=spentFor(r.category),pct=Math.min(100,Math.round(spent/Math.max(1,r.limitMinor)*100));
  return '<div class="category-row"><span class="category-label">'+esc(r.category)+'</span><strong>'+amount(spent)+' / '+amount(r.limitMinor)+'</strong><div class="progress-track"><span style="width:'+pct+'%;background:'+(pct>85?'#be8759':'#108363')+'"></span></div></div>';
 }).join('')+'</div>':empty('No budgets yet','Start with one category and a realistic limit.','Create budget','budget'))+
 disclosure('Budget pressure is advisory. It cannot block spending through banks or cards.'),
 '<button class="link-action" data-open="budget">Edit monthly budget '+icon('arrow')+'</button>')+
 spendingCard()+'</div>';
}
function cashFlow(){
 const bills=state.records.bills,unpaid=dueBills(),outstanding=total(unpaid,b=>b.amountMinor);
 return heading('Stay one step ahead','Cash Flow','Understand recorded income and what you have planned to pay next.',
 '<button class="btn btn-primary" data-open="bill">'+icon('plus')+' Add bill</button>')+
 '<div class="stats-strip"><div class="mini-stat"><small>This month · Recorded income</small><strong>'+(hasData()?amount(monthIncome()):'—')+'</strong></div>'+
 '<div class="mini-stat"><small>Outstanding planned bills</small><strong>'+amount(outstanding)+'</strong></div>'+
 '<div class="mini-stat"><small>Bills awaiting review</small><strong>'+unpaid.length+'</strong></div></div>'+
 '<div class="notice warn">'+icon('info')+' Forecasts are planning illustrations: expected income is not recorded cash, and a bill marked settled does not mean a payment was executed.</div>'+
 '<div class="content-grid">'+surface('Upcoming obligations','Review and manually mark settlement',billList(15),
 '<button class="link-action" data-open="bill">+ New bill</button>')+
 surface('Planning outlook','Next 30 days',
 '<div class="goal-hero"><div><span class="eyebrow">Recorded position − outstanding bills</span><strong>'+(hasData()?amount(netBalance()-outstanding):'Unavailable')+'</strong><div class="small muted">Illustrative subtraction only; not verified safe-to-spend</div></div>'+
 '<span class="list-icon">'+icon('calendar')+'</span></div><hr class="card-divider"/>'+
 '<p class="small muted">Without verified balances and complete obligations, this is not a reliable available-to-spend estimate.</p>'+
 disclosure('Forecasts and bill settlements are user plans, not bank receipts.'))+'</div>';
}
function goals(){
 const progress=state.records.goals;
 return heading('Make the future tangible','Goals','Track your intentions without confusing earmarked plans for cash actually moved.',
 '<button class="btn btn-primary" data-open="goal">'+icon('plus')+' New goal</button>')+
 '<div class="notice">'+icon('info')+' Goal progress is a <strong style="display:inline">virtual planning figure</strong>, not money held in a separate account or an executed transfer.</div>'+
 '<div class="content-grid">'+surface('Your goals','Make progress visible',
 progress.length?goalList(15):empty('Choose a meaningful goal','Start with an emergency cushion or a personal milestone.','Create goal','goal'),
 '<button class="link-action" data-open="goal">+ Add goal</button>')+
 surface('Debt & financial security','Manual estimates, not lender statements',
 state.records.debt.length?'<ul class="list-reset">'+state.records.debt.map(d=>
 '<li class="list-row"><span class="list-icon orange">'+icon('receipt')+'</span><span class="list-copy"><strong>'+esc(d.title)+'</strong><small>'+esc(d.kind)+'</small></span><span class="list-end"><strong>'+amount(d.balanceMinor)+'</strong></span></li>').join('')+'</ul>'+disclosure('Debt figures are sample user-reported estimates. No repayment is made here.') :
 empty('No debt estimate','Debt can be added later; this preview does not make lender connections.'))+'</div>';
}
function wealth(){
 const assets=total(state.records.assets,a=>a.valueMinor),debt=total(state.records.debt,d=>d.balanceMinor);
 const estimated=hasData()?netBalance()+assets-debt:null;
 return heading('Look at the bigger picture','Wealth','Bring recorded money and self-reported asset estimates into one clearly labeled view.')+
 '<div class="stats-strip"><div class="mini-stat"><small>Illustrative estimated net worth</small><strong>'+(estimated!==null?amount(estimated):'Insufficient data')+'</strong></div>'+
 '<div class="mini-stat"><small>Assets (user-reported)</small><strong>'+amount(assets)+'</strong></div>'+
 '<div class="mini-stat"><small>Debts (user-reported)</small><strong>'+amount(debt)+'</strong></div></div>'+
 '<div class="notice warn">'+icon('info')+' These valuations are deliberately illustrative. No market data, bank sync or external balance verification is available.</div>'+
 '<div class="content-grid">'+surface('Assets and investments','User estimates',state.records.assets.length?'<ul class="list-reset">'+state.records.assets.map(a=>
 '<li class="list-row"><span class="list-icon">'+icon('layers')+'</span><span class="list-copy"><strong>'+esc(a.title)+'</strong><small>'+esc(a.kind)+'</small></span><span class="list-end"><strong>'+amount(a.valueMinor)+'</strong></span></li>').join('')+'</ul>':
 empty('No assets recorded','Your manually recorded financial position remains separate from unverified wealth estimates.'))+
 surface('How to read these figures','Financial truth first',
 '<div class="settings-stack">'+[['Recorded','Amounts entered as manual financial transactions'],['User-reported','Values typed or estimated by the owner'],['Planned','Buckets, budgets and future goals do not move funds'],['Verified','Requires an actual connected provider — unavailable here']].map(([a,b])=>
 '<div class="settings-row"><div><h3>'+a+'</h3><p>'+b+'</p></div>'+icon('shield')+'</div>').join('')+'</div>')+'</div>';
}
function insights(){
 const spent=categorySpend(),largest=spent[0];
 const suggestions=[
  {title:'Review your biggest expense',detail:largest?'Your highest recorded expense category is '+largest.name+' ('+amount(largest.value)+').':'Add a transaction to reveal your top category.',go:'spending',icon:'spending'},
  {title:'Stay on top of upcoming bills',detail:dueBills().length?'You have '+dueBills().length+' bill(s) waiting for review.':'You have no outstanding recorded bills.',go:'cash-flow',icon:'calendar'},
  {title:'Build financial momentum',detail:state.records.goals.length?'You have '+state.records.goals.length+' planning goal(s). Review their progress.':'Start a goal to turn intention into a plan.',go:'goals',icon:'target'}
 ];
 return heading('Understanding, not overwhelm','Insights','Simple, explainable observations from the information you choose to record.')+
 '<div class="notice">'+icon('sparkles')+' <div><strong>Rule-based insights only.</strong> No generative AI, external transaction analysis or professional financial advice is operating in this preview.</div></div>'+
 '<div class="content-grid">'+surface('Worth a look','Choose a clear next action',
 '<ul class="list-reset">'+suggestions.map(s=>'<li class="list-row"><span class="list-icon">'+icon(s.icon)+'</span><span class="list-copy"><strong>'+esc(s.title)+'</strong><small>'+esc(s.detail)+'</small></span>'+
 '<button class="link-action" data-go="'+s.go+'">Explore '+icon('chevron')+'</button></li>').join('')+'</ul>')+
 surface('Clarity check','What data can we actually trust?',
 '<div class="settings-stack"><div class="settings-row"><div><h3>Manual transactions</h3><p>'+state.records.transactions.length+' illustrative entries</p></div><span class="pill subtle">Sample</span></div>'+
 '<div class="settings-row"><div><h3>Bank verified data</h3><p>No bank or mobile-money provider connected</p></div><span class="pill warning">Not available</span></div>'+
 '<div class="settings-row"><div><h3>Forecast confidence</h3><p>Cannot be certified without complete sources</p></div><span class="pill warning">Limited</span></div></div>')+'</div>';
}
function settings(){
 return heading('Make it yours','Settings','Your workspace, sources, and the difference between a demo and real financial records.')+
 '<div class="content-grid">'+surface('This preview','Safe and isolated',
 '<div class="settings-stack">'+
 '<div class="settings-row"><div><h3>Data mode</h3><p>Illustrative sample values held in memory, not PostgreSQL</p></div><span class="pill subtle">'+(state.isDemo?'Populated demo':'Empty preview')+'</span></div>'+
 '<div class="settings-row"><div><h3>Financial connections</h3><p>Bank, M-Pesa and payment providers are not connected</p></div><span class="pill warning">Unavailable</span></div>'+
 '<div class="settings-row"><div><h3>Privacy</h3><p>No API calls, financial cookies, or saved local records in this prototype</p></div>'+icon('shield')+'</div></div>'+
 '<div class="page-tools" style="margin-top:20px;justify-content:flex-start"><button class="btn btn-outline" data-action="reset-demo">Reset sample data</button><button class="btn btn-outline" data-action="reset-empty">Switch to empty state</button></div>')+
 surface('Production boundaries','Not yet activated',
 '<p class="small muted">This is a UX1 interaction study. The existing Finance OS API and PostgreSQL remain available separately at <code>connected.html</code>. The real app must keep strict tenant isolation, real OIDC MFA for public access, and auditable financial ledger calculations.</p>'+
 '<button class="btn btn-quiet" data-action="exit">Return to introduction '+icon('arrow')+'</button>')+'</div>';
}
function page(){
 switch(state.route){
  case 'home':return home();case 'activity':return activity();case 'spending':return spending();
  case 'cash-flow':return cashFlow();case 'goals':return goals();case 'wealth':return wealth();
  case 'insights':return insights();case 'settings':return settings();
  default:return home();
 }
}
function formField(label,name,type,value='',extra=''){
 return '<div class="form-field"><label for="field-'+name+'">'+label+'</label><input id="field-'+name+'" name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+extra+' required></div>';
}
function formSelect(label,name,options){
 return '<div class="form-field"><label for="field-'+name+'">'+label+'</label><select id="field-'+name+'" name="'+name+'" required>'+
 options.map(([value,text])=>'<option value="'+esc(value)+'">'+esc(text)+'</option>').join('')+'</select></div>';
}
function drawer(){
 const type=state.drawer?.type||'quick';
 const header={
 quick:['Add something new','Choose a short, focused action.'],
 account:['Add a manual account','No bank account is being connected.'],
 transaction:['Record a transaction','A preview entry — no actual financial posting.'],
 bill:['Add an upcoming bill','Plan a due date. No payment will be initiated.'],
 budget:['Adjust a monthly budget','Change a planning limit, not a bank restriction.'],
 goal:['Create a new goal','Make a goal visible, not a money transfer.'],
 allocate:['Update goal planning progress','Virtual progress only. No funds are transferred.'],
 detail:['Transaction details','Manual sample record and source context.']
 }[type]||['Quick action',''];
 let body='';
 const accounts=state.records.accounts;
 if(type==='quick')body='<div class="settings-stack">'+
 [['transaction','Record transaction','income or expense','activity'],['account','Add account','bank, cash or mobile money','wallet'],['bill','Plan a bill','track an obligation','calendar'],['budget','Create budget','set a spending limit','spending'],['goal','Start a goal','define a savings target','target']].map(([kind,title,desc,ic])=>
 '<button type="button" class="settings-row" data-open="'+kind+'" style="width:100%;background:#fff;text-align:left"><span class="list-icon">'+icon(ic)+'</span><span class="list-copy"><strong>'+title+'</strong><small>'+desc+'</small></span>'+icon('chevron')+'</button>').join('')+'</div>';
 if(type==='account')body='<form data-form="account" class="drawer-form"><div class="drawer-body">'+
 formField('Account name','name','text','','placeholder="e.g. Everyday wallet" minlength="2" maxlength="60"')+
 formSelect('Account type','kind',[['Manual cash wallet','Cash wallet (manual)'],['Manual bank account','Bank account (manual)'],['Manual mobile money','Mobile money (manual)']])+
 '<p class="field-help">This prototype does not verify opening balances or connect to any provider.</p></div>'+
 '<div class="drawer-footer"><button class="btn btn-outline" type="button" data-action="close-drawer">Cancel</button><button class="btn btn-primary" type="submit">Add account</button></div></form>';
 if(type==='transaction')body='<form data-form="transaction" class="drawer-form"><div class="drawer-body">'+
 (!accounts.length?'<div class="notice warn">Please create a manual account before recording any transactions.</div>':'')+
 formSelect('Type','kind',[['expense','Expense'],['income','Income']])+
 formField('Description','title','text','','placeholder="e.g. Groceries" minlength="2" maxlength="80"')+
 formField('Amount (KES)','amount','number','','min="0.01" max="999999999" step="0.01" placeholder="2500"')+
 formSelect('Account','accountId',accounts.length?accounts.map(a=>[a.id,a.name]):[['','Create an account first']])+
 formSelect('Category','category',[['Food','Food'],['Income','Income'],['Housing','Housing'],['Transport','Transport'],['Lifestyle','Lifestyle'],['Utilities','Utilities'],['Other','Other']])+
 formField('Date','date','date',daysFromNow(0),'')+
 '<p class="field-help">The visual preview updates in memory only. The real backend posts to an immutable double-entry ledger; this preview does not.</p></div>'+
 '<div class="drawer-footer"><button class="btn btn-outline" type="button" data-action="close-drawer">Cancel</button><button class="btn btn-primary" type="submit" '+(!accounts.length?'disabled':'')+'>Record preview entry</button></div></form>';
 if(type==='bill')body='<form data-form="bill" class="drawer-form"><div class="drawer-body">'+
 formField('Bill name','title','text','','placeholder="e.g. Internet" minlength="2" maxlength="80"')+
 formField('Amount (KES)','amount','number','','min="0.01" step="0.01"')+
 formField('Due date','due','date',daysFromNow(7),'')+
 '<p class="field-help">A bill is a planning obligation. Marking it settled later does not send money.</p></div>'+
 '<div class="drawer-footer"><button class="btn btn-outline" type="button" data-action="close-drawer">Cancel</button><button class="btn btn-primary" type="submit">Save bill</button></div></form>';
 if(type==='budget')body='<form data-form="budget" class="drawer-form"><div class="drawer-body">'+
 formSelect('Category','category',[['Food','Food'],['Housing','Housing'],['Transport','Transport'],['Lifestyle','Lifestyle'],['Utilities','Utilities'],['Other','Other']])+
 formField('Monthly budget (KES)','amount','number','','min="1" step="0.01"')+
 '<p class="field-help">This is a manual budget planning rule, not a bank spending limit.</p></div>'+
 '<div class="drawer-footer"><button class="btn btn-outline" type="button" data-action="close-drawer">Cancel</button><button class="btn btn-primary" type="submit">Save budget</button></div></form>';
 if(type==='goal')body='<form data-form="goal" class="drawer-form"><div class="drawer-body">'+
 formField('Your goal','title','text','','placeholder="e.g. Emergency fund" minlength="2" maxlength="80"')+
 formField('Target (KES)','amount','number','','min="1" step="0.01"')+
 '<p class="field-help">Progress will begin at zero. No money is held or moved by creating a goal.</p></div>'+
 '<div class="drawer-footer"><button class="btn btn-outline" type="button" data-action="close-drawer">Cancel</button><button class="btn btn-primary" type="submit">Create goal</button></div></form>';
 if(type==='allocate'){
  const g=state.records.goals.find(x=>x.id===state.drawer.id);
  body=g?'<form data-form="allocate" class="drawer-form"><div class="drawer-body"><div class="notice">'+icon('info')+' This is a virtual planning entry. It does not debit an account or transfer funds.</div>'+
   '<h3>'+esc(g.title)+'</h3><p>Current planned progress: '+amount(g.progressMinor)+' / '+amount(g.targetMinor)+'</p>'+
   formField('New total virtual progress (KES)','amount','number',(g.progressMinor/100).toFixed(2),'min="0" step="0.01"')+
   '<input type="hidden" name="id" value="'+esc(g.id)+'"></div>'+
   '<div class="drawer-footer"><button class="btn btn-outline" type="button" data-action="close-drawer">Cancel</button><button class="btn btn-primary" type="submit">Update planning figure</button></div></form>':'Goal not found.';
 }
 if(type==='detail'){
  const t=state.records.transactions.find(x=>x.id===state.drawer.id);
  body=t?'<div class="settings-stack"><div class="settings-row"><div><h3>Description</h3><p>'+esc(t.title)+'</p></div></div>'+
   '<div class="settings-row"><div><h3>Amount</h3><p>'+amount(t.amountMinor)+' · '+(t.kind==='income'?'Income':'Expense')+'</p></div></div>'+
   '<div class="settings-row"><div><h3>Category / Date</h3><p>'+esc(t.category)+' · '+readableDate(t.date)+'</p></div></div>'+
   '<div class="settings-row"><div><h3>Provenance</h3><p>Illustrative manual sample. Not a verified bank posting.</p></div><span class="pill warning">Demo</span></div></div>':empty('Not found','The preview transaction is unavailable.');
 }
 return '<div class="drawer-backdrop" data-backdrop="true"><aside class="drawer" role="dialog" aria-modal="true" aria-labelledby="drawer-title" tabindex="-1">'+
 '<div class="drawer-header"><div><span class="eyebrow">Finance OS · Preview</span><h2 id="drawer-title">'+header[0]+'</h2><p>'+header[1]+'</p></div>'+
 '<button class="btn btn-icon btn-outline" data-action="close-drawer" aria-label="Close panel">'+icon('close')+'</button></div>'+
 (state.error?'<div class="form-error" role="alert">'+esc(state.error)+'</div>':'')+
 body+'</aside></div>';
}
function route(name){
 if(!NAV.some(r=>r[0]===name))return;
 state.route=name;state.more=false;state.drawer=null;state.error='';state.chartFocus=null;
 location.hash=name;
 window.scrollTo({top:0,behavior:'instant'});
 render();
}
function openPanel(type,idValue){
 if(!['quick','account','transaction','bill','budget','goal','allocate','detail'].includes(type))return;
 state.drawer={type,id:idValue};state.error='';state.more=false;render();
 requestAnimationFrame(()=>root.querySelector('.drawer input:not([type="hidden"]),.drawer select,.drawer button')?.focus());
}
function setToast(message){
 state.toast=message;render();
 window.clearTimeout(setToast.timer);
 setToast.timer=window.setTimeout(()=>{state.toast='';render();},3600);
}
function closePanels(){
 state.drawer=null;state.more=false;state.error='';render();
}
function render(){
 const active=document.activeElement;
 root.innerHTML=state.stage==='welcome'?welcome():state.stage==='onboarding'?onboarding():shell();
 document.title='Finance OS V3 · '+(state.stage==='app'?(NAV.find(x=>x[0]===state.route)?.[1]||'Home'):'Interactive Preview');
 if(active?.dataset?.go&&state.stage==='app'){
  const b=root.querySelector('[data-go="'+CSS.escape(active.dataset.go)+'"]');
  if(b&&active.closest('.sidebar'))b.focus();
 }
}
function submit(form){
 const data=Object.fromEntries(new FormData(form));
 const kind=form.dataset.form;
 const validAmount=v=>{const n=Number(v);return Number.isFinite(n)&&n>=0&&n<=999999999?minor(n):null;};
 state.error='';
 if(kind==='search'){state.search=String(data.search||'').trim().slice(0,80);render();return;}
 if(kind==='onboarding'){
  if(!data.firstName?.trim()||!data.workspace?.trim())return;
  state.firstName=String(data.firstName).trim().slice(0,40);
  state.workspace=String(data.workspace).trim().slice(0,60);
  state.records=emptyRecords();state.isDemo=false;state.stage='app';state.route='home';
  location.hash='home';render();return;
 }
 const amt=validAmount(data.amount);
 if(['transaction','bill','budget','goal','allocate'].includes(kind)&&
   (amt===null||(kind==='allocate'?amt<0:amt<=0))){
  state.error='Enter a valid amount in KES.';render();return;
 }
 if(kind==='account'){
  const title=String(data.name||'').trim();
  if(title.length<2){state.error='Please enter an account name.';render();return;}
  state.records.accounts.push({id:id(),name:title.slice(0,60),kind:String(data.kind)});
  state.drawer=null;setToast('Manual account added to the preview.');return;
 }
 if(kind==='transaction'){
  if(!state.records.accounts.some(a=>a.id===data.accountId)){
   state.error='Please create or select a manual account first.';render();return;
  }
  const title=String(data.title||'').trim();
  if(title.length<2){state.error='Please enter a transaction description.';render();return;}
  if(!/^\d{4}-\d{2}-\d{2}$/.test(String(data.date||''))){state.error='Choose a valid date.';render();return;}
  state.records.transactions.push({id:id(),title:title.slice(0,80),amountMinor:data.kind==='income'?amt:-amt,
   kind:data.kind,accountId:String(data.accountId),category:String(data.category),date:String(data.date)});
  state.drawer=null;setToast('Preview transaction recorded. No backend posting occurred.');return;
 }
 if(kind==='bill'){
  if(!data.title?.trim()||!/^\d{4}-\d{2}-\d{2}$/.test(String(data.due||''))){
   state.error='Enter a bill name and valid due date.';render();return;
  }
  state.records.bills.push({id:id(),title:String(data.title).trim().slice(0,80),amountMinor:amt,due:String(data.due),status:'due'});
  state.drawer=null;setToast('Bill added for planning. No payment was made.');return;
 }
 if(kind==='budget'){
  const existing=state.records.budgets.find(b=>b.category===data.category);
  if(existing)existing.limitMinor=amt;
  else state.records.budgets.push({category:String(data.category),limitMinor:amt});
  state.drawer=null;setToast('Monthly planning budget updated.');return;
 }
 if(kind==='goal'){
  if(!data.title?.trim()){state.error='Enter a goal name.';render();return;}
  state.records.goals.push({id:id(),title:String(data.title).trim().slice(0,80),
    targetMinor:amt,progressMinor:0,note:'Virtual planning progress'});
  state.drawer=null;setToast('Goal added. No money was moved.');return;
 }
 if(kind==='allocate'){
  const goal=state.records.goals.find(x=>x.id===data.id);
  if(!goal){state.error='Goal no longer exists.';render();return;}
  if(amt>goal.targetMinor){state.error='Planning progress cannot exceed the target.';render();return;}
  goal.progressMinor=amt;state.drawer=null;setToast('Virtual planning progress updated. No transfer occurred.');return;
 }
}
root.addEventListener('submit',e=>{
 const form=e.target.closest('form[data-form]');
 if(!form)return;
 e.preventDefault();submit(form);
});
root.addEventListener('click',e=>{
 const target=e.target.closest('[data-go],[data-action],[data-open],[data-period],[data-filter],[data-settle],[data-allocate],[data-detail],[data-chart-index],[data-backdrop]');
 if(!target)return;
 if(target.hasAttribute('data-backdrop')&&target!==e.target)return;
 if(target.hasAttribute('data-go')){
  const g=target.dataset.go;
  if(g==='more'){state.more=true;render();}
  else route(g);
  return;
 }
 if(target.hasAttribute('data-open')){openPanel(target.dataset.open);return;}
 if(target.hasAttribute('data-allocate')){openPanel('allocate',target.dataset.allocate);return;}
 if(target.hasAttribute('data-detail')){openPanel('detail',target.dataset.detail);return;}
 if(target.hasAttribute('data-period')){state.period=Number(target.dataset.period);state.chartFocus=null;render();return;}
 if(target.hasAttribute('data-filter')){state.filter=target.dataset.filter;render();return;}
 if(target.hasAttribute('data-chart-index')){state.chartFocus=Number(target.dataset.chartIndex);render();return;}
 if(target.hasAttribute('data-settle')){
  const bill=state.records.bills.find(b=>b.id===target.dataset.settle);
  if(bill&&bill.status!=='settled'){bill.status='settled';setToast('Bill marked settled manually. No payment was initiated.');}
  return;
 }
 if(target.hasAttribute('data-backdrop')){closePanels();return;}
 const action=target.dataset.action;
 if(['close-drawer','close-more'].includes(action)){closePanels();return;}
 if(action==='welcome'||action==='exit'){state.stage='welcome';state.more=false;state.drawer=null;location.hash='';render();return;}
 if(action==='onboarding'){state.stage='onboarding';render();return;}
 if(action==='demo'){state.stage='app';state.route='home';state.records=demoRecords();state.isDemo=true;state.firstName='Alex';state.workspace='Personal workspace';location.hash='home';render();return;}
 if(action==='reset-demo'){state.records=demoRecords();state.isDemo=true;state.route='home';location.hash='home';setToast('Illustrative sample data restored.');return;}
 if(action==='reset-empty'){state.records=emptyRecords();state.isDemo=false;state.route='home';location.hash='home';setToast('Empty preview ready. Add your first account.');return;}
});
root.addEventListener('keydown',e=>{
 if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-chart-index]')){e.preventDefault();state.chartFocus=Number(e.target.dataset.chartIndex);render();return;}
 if(e.key==='Escape'&&(state.drawer||state.more)){e.preventDefault();closePanels();return;}
 if(e.key==='Tab'&&(state.drawer||state.more)){
  const dialog=root.querySelector('[role="dialog"]');
  if(!dialog)return;
  const els=[...dialog.querySelectorAll('button:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex="0"]')].filter(x=>x.getClientRects().length);
  if(!els.length)return;
  if(e.shiftKey&&document.activeElement===els[0]){e.preventDefault();els[els.length-1].focus();}
  else if(!e.shiftKey&&document.activeElement===els[els.length-1]){e.preventDefault();els[0].focus();}
 }
});
window.addEventListener('hashchange',()=>{
 if(state.stage!=='app')return;
 const next=location.hash.replace(/^#/,'');
 if(NAV.some(x=>x[0]===next)&&next!==state.route){state.route=next;state.drawer=null;state.more=false;render();}
});
render();
})();