
(()=>{
'use strict';
let bridge;
const $=s=>document.querySelector(s);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
const fmt=n=>'KES '+Math.abs(Math.round(Number(n)||0)).toLocaleString('en-KE');
const pct=(a,b)=>Math.round(100*a/Math.max(1,b));
const codeNames={
16:['Spending Intelligence Dashboard','Understand where your money goes, spot trends, and get personalized insights.'],
17:['Expenditure Trends','Analyze your spending patterns over time, identify trends, and make smarter financial decisions.'],
18:['Spending Category Analysis','Dive deep into your spending categories, understand trends, and identify opportunities to save.'],
19:['Merchant & Lifestyle Analysis','Discover where you spend, how often, and what your habits reveal about your lifestyle.'],
20:['Spending Leak Detector','Find hidden expenses, unnecessary spending, and opportunities to save money.'],
21:['Create / Edit Budget','Set your budget, allocate across categories, and stay on track with your financial goals.'],
22:['Create / Edit Budget','Allocate amounts, customize limits, and save your budget. Original Screen 22 design is missing.'],
23:['Daily & Weekly Spending Allowance','Stay in control with personalized daily and weekly spending limits.'],
24:['Spending Guardrails & Purchase Approval Check','Set rules, protect your finances, and make smarter purchase decisions.'],
25:['Subscriptions & Recurring Expenses','Track, manage and optimize recurring expenses. Never miss a renewal and avoid unnecessary subscriptions.'],
26:['Spending Review & Recovery Plan','Understand your spending, find improvement opportunities and get a personalized plan.']
};
const C=[
['Housing',120000,'#fb647a','⌂'],['Food & Dining',45000,'#2b9ef2','🍴'],['Transport',30000,'#31be89','▣'],
['Utilities',24000,'#ffbd57','ϟ'],['Shopping',18000,'#a85ee6','▥'],['Health & Medical',15000,'#f580a6','♥'],
['Subscriptions',12000,'#428ef6','◉'],['Entertainment',12000,'#cb55d4','▣'],
['Education',9000,'#21b98b','▥'],['Others',15000,'#9faab9','···']];
const vendors=[
['House Rent','Housing',80000,'Monthly',100],['Naivas Supermarket','Food & Dining',32450,'Frequent',70],
['KPLC Electricity','Utilities',28500,'Monthly',60],['Safaricom Airtime','Subscriptions',18200,'Weekly',50],
['Uber Kenya','Transport',16400,'Frequent',40],['Internet (Safaricom)','Subscriptions',3500,'Monthly',15],
['Netflix','Subscriptions',1200,'Monthly',13],['Spotify','Subscriptions',650,'Monthly',10],
['Fuel Stations','Transport',14200,'Frequent',30],['Restaurants','Food & Dining',18400,'Weekly',25]];
const seedSubs=[
{id:'sub1',name:'Internet (Safaricom)',category:'Utilities',cost:3500,freq:'Monthly',renew:'2026-11-01',status:'Active',essential:true},
{id:'sub2',name:'Netflix',category:'Entertainment',cost:1200,freq:'Monthly',renew:'2026-11-04',status:'Active',essential:false},
{id:'sub3',name:'Google One',category:'Subscriptions',cost:1150,freq:'Monthly',renew:'2026-11-09',status:'Active',essential:true},
{id:'sub4',name:'Spotify',category:'Entertainment',cost:650,freq:'Monthly',renew:'2026-11-12',status:'Active',essential:false},
{id:'sub5',name:'Microsoft 365',category:'Subscriptions',cost:1300,freq:'Monthly',renew:'2026-11-18',status:'Active',essential:true},
{id:'sub6',name:'Gym',category:'Health & Medical',cost:4500,freq:'Monthly',renew:'2026-11-22',status:'Active',essential:false},
{id:'sub7',name:'Mobile Cloud Backup',category:'Subscriptions',cost:750,freq:'Monthly',renew:'2026-11-26',status:'Active',essential:false}
];
let ui={period:'Last 6 months',category:'All Categories',account:'All Accounts',segment:'Category',merchant:'All Merchants',
trend:'Monthly',budgetPeriod:'Monthly',budgetStep:0,budgetName:'October 2026 Budget',draft:null,
allowanceWeek:'This Week',guard:'All Rules',purchase:25000,subscriptionFilter:'All',subscriptionSearch:'',
selectedSub:null,modal:null,recoveryFilter:'All',notice:'',health:'Needs Improvement'};
const initState=()=>({
 categories:Object.fromEntries(C.map(x=>[x[0],x[1]])),
 budgetName:'October 2026 Budget',budgetPeriod:'Monthly',budgetMonth:'October 2026',budgetLimit:300000,
 budgetRollover:{Housing:true,Utilities:true,'Health & Medical':true},
 rules:{alertThreshold:80,weeklyDigest:true,unusual:true,paused:false},
 allowance:{daily:4500,weekly:28000,locked:0},
 subscriptions:seedSubs.map(x=>({...x})),
 guardrails:[
 {id:'rule1',name:'Daily Spending Limit',limit:4500,active:true,condition:'Per-day cap',trigger:'Warning'},
 {id:'rule2',name:'Large Purchase Review',limit:20000,active:true,condition:'Over KES 20,000',trigger:'Approval required'},
 {id:'rule3',name:'Subscription Monitor',limit:3500,active:true,condition:'Recurring',trigger:'Review'},
 {id:'rule4',name:'Travel & Entertainment',limit:15000,active:true,condition:'Discretionary',trigger:'Warning'},
 {id:'rule5',name:'Emergency Fund Protection',limit:0,active:true,condition:'Protected bucket',trigger:'Always protect'}
 ],
 recovery:{completed:[],targetReduction:75000,notes:''},
 leakStatus:{}
});
function init(ctx){bridge=ctx;if(!bridge.model.spendV2){bridge.model.spendV2=initState();bridge.save()}const p=bridge.model.spendV2;
if(!p.subscriptions)p.subscriptions=seedSubs.map(s=>({...s}));if(!p.guardrails)p.guardrails=initState().guardrails;
if(!p.recovery)p.recovery={completed:[],targetReduction:75000,notes:''};if(!p.budgetRollover)p.budgetRollover={Housing:true,Utilities:true,'Health & Medical':true};if(!p.budgetMonth)p.budgetMonth='October 2026';if(!p.leakStatus)p.leakStatus={};if(!p.rules)p.rules=initState().rules;}
const model=()=>bridge.model,config=()=>model().spendV2;
const save=msg=>{ui.notice=msg||'';bridge.save();bridge.render()};
const nav=n=>bridge.navigate(Number(n));
const sb=(text,command,kind='')=>'<button type="button" class="sp-btn '+kind+'" data-sp="'+esc(command)+'">'+esc(text)+'</button>';
const to=(text,n,kind='')=>'<button type="button" class="sp-btn '+kind+'" data-spnav="'+n+'">'+esc(text)+'</button>';
const tab=(labels,selected,attr)=>'<div class="sp-action-tabs">'+labels.map(x=>'<button type="button" class="'+(x===selected?'on':'')+'" data-sp="tab:'+attr+':'+esc(x)+'">'+esc(x)+'</button>').join('')+'</div>';
function panel(title,body,actions=''){return '<section class="sp-panel"><div class="sp-panel-title"><h2>'+esc(title)+'</h2><div class="sp-buttons">'+actions+'</div></div>'+body+'</section>'}
function metrics(items){return '<div class="sp-metrics">'+items.map(([i,title,num,note])=>'<div class="sp-kpi"><span class="sp-ico">'+i+'</span><div><small>'+esc(title)+'</small><b>'+esc(num)+'</b><small>'+esc(note)+'</small></div></div>').join('')+'</div>'}
function note(s,warn=false){return '<div class="sp-banner-note '+(warn?'warn':'')+'">'+esc(s)+'</div>'}
function bar(val,max,color='#27af7d'){return '<div class="sp-pillbar" style="--c:'+color+';--p:'+Math.max(0,Math.min(100,pct(val,max)))+'%"><i></i></div>'}
function r(icon,name,description,value='',toScreen=null){return '<div class="sp-stat-row"><span style="display:flex;align-items:center;gap:7px"><span class="sp-dot" style="--c:#2dbb88"></span><span>'+esc(name)+'<small style="display:block;color:#73838e">'+esc(description)+'</small></span></span><span>'+esc(value)+'</span>'+(toScreen?to('Open',toScreen):'')+'</div>'}
function kpiTotal(){return 362450+Math.min(0,model().transactions.filter(x=>Number(x[4])<0).reduce((s,x)=>s+Number(x[4]),0)+13800)*-1}
function cats(){return C.map(([name,defaultAmount,color,icon])=>({name,value:Number(config().categories[name]??defaultAmount),color,icon,spend:Math.round(defaultAmount*(name==='Housing'?1: .68))}))}
function budgetTotal(){return Object.values(config().categories).reduce((n,v)=>n+Number(v||0),0)}
function rows(head,content){return '<div class="sp-table-wrap"><table class="sp-table"><thead><tr>'+head.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+content.join('')+'</tbody></table></div>'}
function sparkline(seed=1,color='#0ca878'){let p=Array.from({length:16},(_,i)=>[i*16+5,25-(Math.sin(i*.9+seed)*8+Math.cos(i*.38+seed)*7)]);return '<svg viewBox="0 0 255 50" class="sp-line" style="height:39px" role="img" aria-label="Illustrative activity trend"><path d="'+p.map((x,i)=>(i?'L':'M')+x[0]+' '+x[1]).join(' ')+'" stroke="'+color+'" stroke-width="2" fill="none"/></svg>'}
function chart(type='stack'){let groups=ui.period.includes('6')?7:6,months=['Apr','May','Jun','Jul','Aug','Sep','Oct'];let w=430;let xSize=54;let svg='<svg class="sp-bars" viewBox="0 0 '+w+' 195" role="img" aria-label="Illustrative monthly spending chart">'+[28,67,106,145].map(y=>'<line x1="30" x2="425" y1="'+y+'" y2="'+y+'" stroke="#e9eeee"/>').join('');
for(let i=0;i<groups;i++){let x=48+i*xSize,multi=.67+Math.sin(i*1.65)*.13+i*.018;for(let j=0;j<(type==='stack'?5:2);j++){let h=type==='stack'?(16+j*1.6)*multi:(45+Math.cos(i*.85+j)*12)*multi;let y=152-h*(j+1);svg+='<rect x="'+(x+(type==='stack'?0:j*15))+'" y="'+y+'" width="'+(type==='stack'?29:13)+'" height="'+h+'" fill="'+(type==='stack'?['#f46c83','#399ee6','#39bb8a','#ffbc58','#b572de'][j]:['#46c28d','#f87385'][j])+'"/>'}svg+='<text x="'+x+'" y="174" font-size="10" fill="#627785">'+months[i]+'</text>'}
return svg+'</svg><div class="sp-mini">'+(type==='stack'?'🟥 Housing　🟦 Transport　🟩 Food　🟨 Utilities　🟪 Others　● Total Spending':'🟩 Income　　 🟥 Spending')+'</div>'}
function lineGraph(){let s='<svg viewBox="0 0 440 138" class="sp-line" role="img" aria-label="Monthly trends by category">';for(let j=0;j<4;j++){let points=Array.from({length:7},(_,i)=>[i*69+9,32+j*20+Math.sin((i+j)*1.7)*6]);s+='<path d="'+points.map((x,i)=>(i?'L':'M')+x.join(' ')).join(' ')+'" fill="none" stroke="'+['#f56e83','#2aa5e8','#29b984','#bb7deb'][j]+'" stroke-width="2"/>'}return s+'</svg>'}
function donut(value=362450){const colors=C.slice(0,8).map(x=>x[2]),a=C.map(x=>x[1]),total=a.reduce((n,v)=>n+v,0);let parts=[],prev=0;for(let i=0;i<8;i++){let next=prev+a[i]/total*100;parts.push(colors[i]+' '+prev+'% '+next+'%');prev=next}parts.push('#9eabb7 '+prev+'% 100%');return '<div class="sp-donut-wrap"><div class="sp-donut" style="background:conic-gradient('+parts.join(',')+')"><div class="sp-donut-hole"><b>'+fmt(value)+'</b><small>Total Spending</small></div></div><div class="sp-legend">'+C.slice(0,8).map((x,i)=>'<div class="sp-legend-row"><i class="sp-dot" style="--c:'+x[2]+'"></i><span>'+esc(x[0])+'</span><strong>'+Math.round(x[1]/total*100)+'%</strong></div>').join('')+'</div></div>'}
function filters(extras=''){return '<div class="spend-filters"><select class="sp-select" aria-label="Spending analysis period" data-spchange="period">'+['Last 6 months','Last 30 days','This month','Last 12 months'].map(x=>'<option '+(ui.period===x?'selected':'')+'>'+x+'</option>').join('')+'</select><select class="sp-select" aria-label="Account filter" data-spchange="account">'+['All Accounts',...model().accounts.map(a=>a[0])].map(x=>'<option '+(ui.account===x?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select><select class="sp-select" aria-label="Category filter" data-spchange="category">'+['All Categories',...C.map(x=>x[0])].map(x=>'<option '+(ui.category===x?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select>'+extras+'</div>'}
function shell(n,contents){const [title,sub]=codeNames[n];return '<div class="spend-page"><div class="banner"><div><div class="banner-date">Analytics　›　'+(n>=21&&n<=22?'Budgets':n===25?'Subscriptions':n===26?'Spending Recovery':'Spending Intelligence')+'</div><h1>'+esc(title)+'</h1><p>'+esc(sub)+'</p></div><div class="banner-quote">“Understand your spending<br>today, make better choices<br>tomorrow.”</div></div><div class="spend-inner">'+(ui.notice?'<div role="status" class="sp-banner-note">'+esc(ui.notice)+'</div>':'')+contents+'<p class="sp-mini" style="padding:9px 0">Reference-driven coded UI — illustrative local financial fixtures, not linked to banks. '+sb(n===22?'Related Screen 21 design (22 missing)':'Compare approved screenshot '+n,'reference')+'</p></div>'+modal()+'</div>'}
function listIcons(){return C.map(x=>[x[3],x[0],x[2]])}
function advisorTips(){return [
['↑','Transport spending increased by 28%','You spent KES 14,200 more on transport compared to prior periods.'],
['⚑','You can save ~KES 12,000/month','Consider reviewing recurring subscriptions and discretionary spending.'],
['▧','Your spending is on track','You’re 27% under the illustrative monthly budget. Great job!']
].map(([ic,title,desc],i)=>'<div class="sp-stat-row"><span class="sp-ico" style="font-size:16px;width:30px;height:30px;display:grid;place-items:center;background:#ecf8f0;border-radius:6px">'+ic+'</span><span style="flex:1"><b>'+esc(title)+'</b><small style="display:block">'+esc(desc)+'</small></span>'+sb('Review','tip:'+i)+'</div>').join('')}
function merchantTable(limit=7){return rows(['Merchant','Category','Total Spend','Transactions','Trend'],vendors.slice(0,limit).map(([v,cat,amt,rec],i)=>'<tr><td>'+esc(v)+'</td><td>'+esc(cat)+'</td><td>'+fmt(amt)+'</td><td>'+((i+1)*3)+'</td><td>'+sparkline(i+1)+'</td></tr>'))}
function categoryTable(){return rows(['Category','This Period','Previous Period','Change','Trend'],C.slice(0,8).map(([name,value,color,ic],i)=>'<tr><td>'+ic+' '+esc(name)+'</td><td>'+fmt(Math.round(value*.86))+'</td><td>'+fmt(Math.round(value*.77))+'</td><td class="sp-red">↑ '+(9+i*2)+'%</td><td>'+bar(value,120000,color)+'</td></tr>'))}
function subscriptionsListCompact(){return config().subscriptions.filter(s=>s.status==='Active').slice(0,5).map((s,i)=>'<div class="sp-stat-row"><b>'+esc(s.name)+'</b><span>'+fmt(s.cost)+'</span><small>Monthly</small>'+sparkline(i+1,['#1ca574','#2194d2','#a563d3'][i%3])+'</div>').join('')}
function screen16(){
const cards=[['🍴','Total Spending',fmt(kpiTotal()),'↑ 12% vs previous 6 months'],['▣','Average Monthly Spending',fmt(60408),'↑ 8%'],['♟','Top Category','Housing','KES 120,000 (33%)'],['▣','Remaining Budget',fmt(137550),'of KES 500,000 budget']];
return shell(16,filters(sb('Export Report','export','green'))+metrics(cards)+
'<div class="sp-grid">'+
panel('Spending Trends',chart('stack'),sb('Monthly ▾','trend:Monthly'))+
panel('Spending by Category',donut(kpiTotal()),sb('By Category','segment:Category','active')+sb('By Merchant','segment:Merchant'))+
panel('Top Merchants',vendors.slice(0,5).map(x=>'<div class="sp-stat-row"><span>'+esc(x[0])+'<small style="display:block">'+esc(x[1])+'</small></span><strong>'+fmt(x[2])+'</strong></div>').join('')+to('View all merchants',19))+
panel('Income vs Spending',chart('double'),sb('Monthly ▾','trend:Monthly'))+
panel('Spending Breakdown',tab(['Needs vs Wants','Essential vs Non-essential','Custom'],'Needs vs Wants','breakdown')+'<div class="sp-pillbar" style="height:24px;--p:74%;--c:#2fbb83"><i></i></div><div class="sp-stat-row"><b>74% Needs '+fmt(268200)+'</b><b>26% Wants '+fmt(94250)+'</b></div><div class="sp-tiny-card-grid">'+C.slice(0,4).map(x=>'<div class="sp-tiny-card">'+x[3]+'<br>'+esc(x[0])+'</div>').join('')+'</div>')+
panel('Spending Insights',advisorTips())+
panel('Category Trends',categoryTable(),to('Full analysis',18))+
panel('Bill & Subscription Spending',subscriptionsListCompact(),to('View all',25))+
panel('Smart Recommendations',[
['Reduce dining out','You spent KES 18,400 on restaurants.'],['Switch to time-of-use electricity','Review electricity usage and fees.'],['Use public transport more often','Transport spend rose in demo scenario.']].map(([t,d],i)=>'<div class="sp-stat-row"><span><b>'+esc(t)+'</b><small style="display:block">'+esc(d)+'</small></span>'+sb(i?'Learn More':'Apply','recommendation:'+i)+'</div>').join(''))+
'</div>')}
function screen17(){return shell(17,filters(sb('Export Report','export','green'))+metrics([['▣','Total Expenditure',fmt(kpiTotal()),'↑ 12%'],['▤','Average Per Month',fmt(60408),'↑ 8%'],['♙','Highest Spending Month',fmt(79200),'July 2026'],['↓','Lowest Spending Month',fmt(48500),'May 2026']])+
'<div class="sp-grid">'+panel('Monthly Expenditure Trend',chart(),sb('Monthly','trend:Monthly'))+panel('Expenditure by Category',donut())+
panel('Expenditure by Merchant',vendors.slice(0,6).map(x=>'<div class="sp-stat-row"><span>'+esc(x[0])+'</span><strong>'+fmt(x[2])+'</strong></div>').join(''))+
panel('Year-on-Year Comparison',chart('double'))+panel('Category Trend Highlights',lineGraph())+
panel('Spending Patterns',advisorTips())+panel('Top Spending Days',rows(['Date','Category','Amount'],vendors.slice(0,6).map((x,i)=>'<tr><td>Oct '+(14-i)+', 2026</td><td>'+esc(x[1])+'</td><td>'+fmt(x[2])+'</td></tr>')))+
panel('Spending by Location',donut(300000))+
panel('Recent High-Value Expenses',merchantTable(5))+'</div>')}
function screen18(){return shell(18,filters(sb('Export Report','export','green'))+metrics([['▣','Total Spending',fmt(kpiTotal()),'↑ 12%'],['⚙','Categories Tracked','12','Financial categories'],['↑','Highest Spending','Housing','KES 120,000 (33%)'],['▧','Budget Remaining',fmt(137550),'Against planned spending']])+
'<div class="sp-grid">'+panel('Category Breakdown',donut())+panel('Category Trends Over Time',lineGraph(),sb('Monthly','trend:Monthly'))+
panel('Category Change vs Previous Period',C.slice(0,6).map(x=>'<div class="sp-stat-row"><span>'+x[3]+' '+esc(x[0])+'</span>'+bar(x[1],120000,x[2])+'</div>').join(''))+
panel('Top Subcategories',rows(['Subcategory','Spend','Share'],vendors.slice(0,6).map(x=>'<tr><td>'+esc(x[0])+'</td><td>'+fmt(x[2])+'</td><td>12%</td></tr>')))+
panel('All Categories',rows(['Category','Amount','Change'],C.map(x=>'<tr><td>'+esc(x[0])+'</td><td>'+fmt(x[1])+'</td><td class="sp-red">↑ 8%</td></tr>')))+
panel('Spending Distribution',donut(362450))+
panel('Category Insights',advisorTips())+'</div>')}
function screen19(){return shell(19,filters(sb('Export Report','export','green'))+metrics([['▣','Total Merchant Spending',fmt(kpiTotal()),'Across all merchants'],['▤','Unique Merchants','128','↑ 8 new merchants'],['♧','Most Frequent','House Rent','Monthly payments'],['◈','Avg. Transaction Size',fmt(3020),'Illustrative average']])+
'<div class="sp-grid">'+panel('Top Merchants by Spend',vendors.slice(0,7).map(x=>'<div class="sp-stat-row"><span>'+esc(x[0])+'</span>'+bar(x[2],80000)+'</div>').join(''))+
panel('Merchant Spending Trends',lineGraph())+panel('Spending by Lifestyle Segment',donut())+
panel('Merchant Categories',merchantTable(7))+
panel('Spending by Location',lineGraph())+
panel('Lifestyle Insights',advisorTips())+
panel('Merchant Frequency',rows(['Merchant','Frequency','Spend'],vendors.map(x=>'<tr><td>'+esc(x[0])+'</td><td>'+esc(x[3])+'</td><td>'+fmt(x[2])+'</td></tr>')))+
panel('Lifestyle Overview',donut())+
panel('Merchant Loyalty & Savings',advisorTips())+'</div>')}
function screen20(){
const subs=config().subscriptions.filter(x=>x.status==='Active');const leakTotal=subs.filter(x=>!x.essential).reduce((n,x)=>n+Number(x.cost),0);
const leakRows=vendors.slice(0,6).map(([name,cat,amt,freq],i)=>{const status=config().leakStatus[name]||'Review';return '<tr><td>'+esc(name)+'</td><td>'+esc(cat)+'</td><td>'+fmt(amt)+'</td><td>'+esc(freq)+'</td><td>'+('<span class="sp-chip '+(status==='Reviewed'?'':'red')+'">'+esc(status)+'</span>')+'</td><td>'+sb('Review','leak:'+i)+'</td></tr>'});
return shell(20,filters(sb('Run Leak Scan','scan','green'))+metrics([['⚑','Potential Monthly Leaks',fmt(48000),'↑ 13%'],['✿','Subscription Leaks','3','Possibly unused'],['♛','Potential Savings',fmt(leakTotal*12),'Annual upper bound'],['▣','Spending Discipline Score','72/100','Illustrative estimate']])+
'<div class="sp-grid">'+panel('Spending Leak Overview',donut(48000))+
panel('Monthly Leak Trend',chart('double'))+
panel('Leak Detection Status','<div class="sp-gauge" style="--p:82%"><div><b>82%</b><small>Review coverage</small></div></div>'+['Duplicate charges checked','Inactive services flagged','Recurring fee review','Bank validation pending'].map(x=>r('✓',x,'Manual assessment')).join(''))+
'<section class="sp-panel sp-col2"><div class="sp-panel-title"><h2>Top Detected Leaks</h2>'+sb('Review all','scan')+'</div>'+rows(['Merchant','Category','Amount','Frequency','Status','Action'],leakRows)+'</section>'+
panel('Quick Wins',subs.filter(x=>!x.essential).slice(0,4).map(s=>'<div class="sp-stat-row"><span>'+esc(s.name)+'<small style="display:block">Verify usage before cancellation</small></span>'+fmt(s.cost)+to('Manage',25)+'</div>').join(''))+
panel('Subscriptions Review',subs.map(s=>'<div class="sp-stat-row"><span>'+esc(s.name)+'</span><strong>'+fmt(s.cost)+'</strong></div>').join(''),to('Manage',25))+
panel('Duplicate & Suspicious Charges',r('⚠','Possible recurring overlaps','No transaction-level verification completed','','')+note('Review provider statements before disputing charges.',true))+
panel('Unused Services',subs.filter(s=>!s.essential).map(s=>r('◌',s.name,'Marked discretionary',fmt(s.cost))).join(''))+
panel('AI Recommendations',advisorTips())+'</div>')}



function budgetBuilder(n){
const total=budgetTotal(),target=Number(config().budgetLimit),categories=cats(),spent=198450;
const steps=['Basic Details','Category Allocation','Rules & Settings','Review & Save'];
const stepper='<div class="sp-stepper sp-budget-steps" aria-label="Budget creation progress">'+steps.map((name,i)=>'<button type="button" data-sp="budgetStep:'+i+'" class="sp-step '+(i===ui.budgetStep?'current':'')+'" aria-current="'+(i===ui.budgetStep?'step':'false')+'"><span class="sp-n">'+(i+1)+'</span><span><b>'+name+'</b><small>'+['Set budget type and amount','Allocate and customize','Alerts and automation','Confirm and activate'][i]+'</small></span></button>').join('')+'</div>';
const suffix=n===22?'data-be22-cat':'data-spcat';
const pctString=v=>total>0?Math.round(v/total*100):0;
const rowsHtml=categories.map((c,i)=>{
const rollover=!!(config().budgetRollover||{})[c.name];
return '<div class="sp-budget-line sp-budget-category" data-budget-category="'+esc(c.name)+'">'+
'<span class="sp-budget-category-icon" style="--category-color:'+c.color+'">'+c.icon+'</span>'+
'<span class="sp-budget-category-label">'+esc(c.name)+'</span>'+
'<input type="number" inputmode="numeric" step="100" min="0" '+suffix+'="'+esc(c.name)+'" value="'+c.value+'" aria-label="'+esc(c.name)+' allocation (KES)">'+
'<span>'+pctString(c.value)+'%</span>'+bar(c.value,Math.max(1,target),c.color)+
'<span class="sp-monthly">KES '+Math.round(c.value).toLocaleString('en-KE')+'</span>'+
'<input type="checkbox" class="sp-switch" data-sprollover="'+esc(c.name)+'" aria-label="Roll over unused '+esc(c.name)+' budget" '+(rollover?'checked':'')+'>'+
'<button type="button" class="sp-budget-row-action" data-sp="budgetCategoryAction:'+esc(c.name)+'" aria-label="Review '+esc(c.name)+' allocation">⋯</button></div>';
}).join('');
const categoryHeader='<div class="sp-budget-line sp-budget-header"><span></span><span>Category</span><span>Allocation (KES)</span><span>% of Budget</span><span>Share</span><span class="sp-monthly">Monthly Limit</span><span>Rollover</span><span>Actions</span></div>';
const sum='<div class="sp-budget-line sp-budget-total"><span></span><b>Total</b><strong>KES '+Math.round(total).toLocaleString('en-KE')+'</strong><strong>'+pctString(total)+'%</strong><span></span><strong class="sp-monthly">KES '+Math.round(total).toLocaleString('en-KE')+'</strong><span></span><span></span></div>';
const budgetForm='<form id="sp-budget-form" data-spform="budget"><div class="sp-budget-fields">'+
'<label class="sp-field">Budget Name <span aria-hidden="true">*</span><input name="name" id="sp-budget-name" required value="'+esc(config().budgetName)+'"></label>'+
'<label class="sp-field">Period <span aria-hidden="true">*</span><select name="period" aria-label="Budget month">'+['October 2026','November 2026','December 2026','January 2027'].map(x=>'<option '+(config().budgetMonth===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label>'+
'<div><label class="sp-field">Budget Type <span aria-hidden="true">*</span></label>'+tab(['Monthly','Weekly','Yearly','Custom Range'],config().budgetPeriod,'budgetPeriod')+'</div>'+
'<label class="sp-field">Total Budget Amount (KES) <span aria-hidden="true">*</span><input name="total" type="number" min="1" required value="'+target+'">'+
'<span class="sp-budget-preset-buttons">'+['KES 100K','KES 250K','KES 500K','Custom'].map((x,i)=>sb(x,'budgetAmount:'+i)).join('')+'</span></label></div></form>';
const quick='<div class="sp-budget-quick"><h3>Quick Setup</h3>'+[
['✧','Use Template','Start from a ready-made budget','template'],
['◷','Copy from Last Month','Use your previous budget','lastMonth'],
['✿','AI Recommended','Create a budget based on your spending','aiBudget']
].map(([icon,title,desc,act])=>'<button type="button" class="sp-budget-quick-option" data-sp="budgetQuick:'+act+'"><span class="sp-budget-quick-icon">'+icon+'</span><span><b>'+title+'</b><small>'+desc+'</small></span><span aria-hidden="true">›</span></button>').join('')+'</div>';
const budgetDetails='<section class="sp-panel sp-budget-details"><div class="sp-panel-title"><h2>1. Budget Details</h2></div><div class="sp-budget-top-grid">'+budgetForm+quick+'</div></section>';
const categoriesPanel='<section class="sp-panel sp-budget-allocations"><div class="sp-panel-title"><h2>2. Allocate by Category</h2><div class="sp-buttons">'+sb('Distribute Evenly','spreadBudget')+sb('Reset','resetBudget')+'</div></div>'+categoryHeader+rowsHtml+sum+
'<div class="sp-budget-actions"><button type="button" class="sp-btn" data-sp="budgetCancel">Cancel</button>'+
'<span></span>'+sb('Save as Template','saveTemplate')+sb('➜  Save Budget','saveBudget','green')+'</div></section>';
const previewData=categories.map(c=>({name:c.name,value:c.value,color:c.color}));
let start=0;const stops=previewData.map(c=>{const next=start+c.value/Math.max(1,total)*100;const v=c.color+' '+start.toFixed(3)+'% '+next.toFixed(3)+'%';start=next;return v;});
const donutBudget='<div class="sp-budget-preview-chart"><div class="sp-budget-donut" style="background:conic-gradient('+stops.join(',')+')"><div class="sp-budget-donut-hole"><b>KES '+Math.round(total).toLocaleString('en-KE')+'</b><small>Total Budget</small></div></div>'+
'<div class="sp-budget-preview-legend">'+previewData.map(c=>'<div><i style="background:'+c.color+'"></i><span>'+esc(c.name)+'</span><span>'+pctString(c.value)+'%</span><b>KES '+Math.round(c.value).toLocaleString('en-KE')+'</b></div>').join('')+'</div></div>';
const preview=panel('Budget Preview',donutBudget,'<select class="sp-select" aria-label="Budget preview period"><option>Monthly View</option></select>');
const projection=panel('Monthly Projection','<div class="sp-budget-projection">'+
'<div><b>KES '+Math.round(target).toLocaleString('en-KE')+'</b><small>Budget</small></div>'+
'<div><b>KES '+Math.round(spent).toLocaleString('en-KE')+'</b><small>Projected Spend</small></div>'+
'<div><b>KES '+Math.round(Math.max(0,target-spent)).toLocaleString('en-KE')+'</b><small>Expected Leftover</small></div></div>'+
bar(spent,target)+
'<p class="sp-budget-projection-caption">Based on your current spending patterns</p>');
const rules=config().rules;
const alerts=panel('Budget Rules & Alerts',
'<div class="sp-budget-rules">'+[
['🔔','Alert me when spending reaches','alertThreshold'],
['✉','Send weekly budget summary','weeklyDigest'],
['⚠','Alert me on unusual spending','unusual'],
['⇄','Pause alerts for this budget','paused']
].map(([icon,label,key])=>'<div><span class="sp-budget-rule-icon">'+icon+'</span><span class="sp-budget-rule-title">'+esc(label)+'</span>'+
(key==='alertThreshold'?'<select class="sp-select" data-spchange="alertThreshold" aria-label="Budget threshold">'+[60,70,80,90,100].map(v=>'<option value="'+v+'" '+(rules.alertThreshold===v?'selected':'')+'>'+v+'%</option>').join('')+'</select>':'')+
'<input class="sp-switch" type="checkbox" data-sprule="'+key+'" aria-label="'+esc(label)+'" '+(rules[key]?'checked':'')+'></div>').join('')+'</div>',sb('Edit','budgetStep:2'));
const goals=panel('Budget Goals','<div class="sp-budget-goal"><span class="sp-budget-goal-icon">◎</span><div><b>Stay within budget</b><small>Keep total spending under KES '+target.toLocaleString('en-KE')+'</small>'+bar(spent,target)+'<small>'+pct(spent,target)+'% used · KES '+Math.round(Math.max(0,target-spent)).toLocaleString('en-KE')+' left</small></div></div>',to('Link Goal',37));
const screen22Note=n===22?'<p class="sp-budget-variant-note">Screen 22 uses the supplied Create/Edit Budget visual from Screen 21 as its design reference; no separate Screen 22 screenshot was supplied.</p>':'';
return shell(n,stepper+screen22Note+'<div class="sp-budget-form sp-budget-reference-layout"><div class="sp-left">'+budgetDetails+categoriesPanel+'</div><aside class="sp-right">'+preview+projection+alerts+goals+'</aside></div>');
}
function screen23(){
const allowance=config().allowance;const usedDay=3000,usedWeek=allowance.weekly*.64;
const limits=panel('Daily & Weekly Spending Limits','<div class="sp-allowance"><div class="sp-gauge" style="--p:67%"><div><b>'+fmt(usedDay)+'</b><small>Daily spent</small><b style="font-size:14px">'+pct(usedDay,allowance.daily)+'%</b></div></div><div><div class="sp-stat-row"><b>Daily Allowance</b><strong>'+fmt(allowance.daily)+'</strong></div>'+bar(usedDay,allowance.daily)+'<div class="sp-stat-row"><b>Weekly Allowance</b><strong>'+fmt(allowance.weekly)+'</strong></div>'+bar(usedWeek,allowance.weekly,'#579fe2')+'</div></div>');
const planner=panel('Daily & Weekly Allowance Settings','<form data-spform="allowance" class="sp-fields"><label class="sp-field">Daily Limit (KES)<input name="daily" type="number" min="0" required value="'+allowance.daily+'"></label><label class="sp-field">Weekly Limit (KES)<input name="weekly" type="number" min="0" required value="'+allowance.weekly+'"></label><label class="sp-field">Protected Cash (KES)<input name="locked" type="number" min="0" value="'+allowance.locked+'"></label><div class="sp-buttons" style="align-self:end"><button class="sp-btn green" type="submit">Save allowance</button></div></form>');
const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
return shell(23,metrics([['▣','Daily Spending Allowance',fmt(allowance.daily),'Today’s limit'],['◷','Weekly Spending Allowance',fmt(allowance.weekly),'This week'],['▥','Total Spending This Month',fmt(kpiTotal()),'Illustrative'],['◆','On Track','Yes','Within local rules']])+
'<div class="sp-grid">'+limits+
panel('Weekly Progress','<b>'+fmt(15500)+'</b> spent this week'+bar(usedWeek,allowance.weekly)+chart('double'))+
panel('Monthly Progress',donut(45000))+
planner+
panel('Category Breakdown',C.slice(0,8).map(c=>'<div class="sp-stat-row"><span>'+c[3]+' '+esc(c[0])+'</span><span>'+fmt(c[1])+'</span>'+bar(c[1],120000,c[2])+'</div>').join(''))+
panel('Recent Transactions (Today)',rows(['Merchant','Category','Amount'],model().transactions.slice(0,6).map(x=>'<tr><td>'+esc(x[1])+'</td><td>'+esc(x[2])+'</td><td>'+(x[4]<0?'−':'+')+fmt(x[4])+'</td></tr>')))+
panel('Smart Allowance Tips',advisorTips())+
panel('Spending Guardrails','<div class="sp-buttons">'+to('Purchase check',24,'green')+to('Edit budget',21)+to('Spending review',26)+'</div>')+
panel('Quick Actions','<div class="sp-buttons">'+to('Record Expense',12)+to('View Expenditure',17)+to('Set Guardrails',24)+'</div>')+'</div>');
}
function guardRow(g,i){return '<tr><td>'+(i+1)+'</td><td><b>'+esc(g.name)+'</b></td><td>'+esc(g.condition)+'</td><td>'+fmt(g.limit)+'</td><td>'+esc(g.trigger)+'</td><td><input class="sp-switch" data-spguard="'+esc(g.id)+'" type="checkbox" aria-label="Activate '+esc(g.name)+'" '+(g.active?'checked':'')+'></td></tr>'}
function screen24(){
const active=config().guardrails.filter(g=>g.active).length;
const approvals=[['Amazon','Electronics',52900],['Emirates','Travel',180000],['Apple Store','Electronics',65000]];
const guardRules=panel('Guardrail Rules',tab(['All Rules','Amount Limits','Category Rules','Merchant Rules','Time & Location','Approval Rules'],ui.guard,'guard')+rows(['#','Rule Name','Condition','Limit','Action','Status'],config().guardrails.map(guardRow))+sb('+ Add Rule','newRule','green'));
const approval=panel('Approval Queue',approvals.map(([name,category,amount],i)=>'<div class="sp-plan-item"><span class="sp-ico">⚑</span><span><b>'+esc(name)+'</b><small>'+esc(category)+' · '+fmt(amount)+' · Awaiting review</small></span><div class="sp-buttons">'+sb('Reject','approval:'+i+':reject')+sb('Approve','approval:'+i+':approve','green')+'</div></div>').join(''));
const purchase=panel('Real-time Purchase Check',tab(['Check Purchase','Bulk Check'],'Check Purchase','purchase')+
'<form data-spform="purchase"><div class="sp-fields"><label class="sp-field">Amount (KES) <input name="amount" type="number" min="1" required value="'+ui.purchase+'"></label><label class="sp-field">Merchant<input name="merchant" required value="Samsung Store"></label><label class="sp-field">Category<select name="category">'+C.map(c=>'<option>'+esc(c[0])+'</option>').join('')+'</select></label><label class="sp-field">Location<select name="location"><option>Kenya (Nairobi)</option><option>Outside Kenya</option></select></label></div><button class="sp-btn green" style="margin-top:10px;width:100%" type="submit">◆ Check Against Guardrails</button></form>');
return shell(24,metrics([['◆','Total Rules Active',String(active),'Across demo accounts'],['✖','Purchases Blocked','8','This month, illustrative'],['◷','Pending Approvals','3','Needs your review'],['✓','Approved Purchases','47','This month, illustrative']])+
'<div class="sp-grid"><div class="sp-col2">'+guardRules+'</div>'+approval+purchase+
panel('Rule Impact Summary','<div class="sp-tiny-card-grid">'+[['47','Allowed'],['8','Blocked'],['3','Sent for Approval'],[fmt(412800),'Potential Overspend']].map(x=>'<div class="sp-tiny-card"><b>'+x[0]+'</b>'+x[1]+'</div>').join('')+'</div>')+
panel('Spending Risk Score','<div class="sp-gauge" style="--p:28%"><div><b>28</b><small>Low Risk</small></div></div>')+
panel('AI Recommendations',advisorTips())+
panel('Blocked Purchases (Recent)',rows(['Merchant','Amount','Category','Reason'],vendors.slice(0,5).map(x=>'<tr><td>'+esc(x[0])+'</td><td>'+fmt(x[2])+'</td><td>'+esc(x[1])+'</td><td>Review limit</td></tr>')))+
panel('Recent Approval Activity',rows(['Merchant','Amount','Status'],approvals.map(x=>'<tr><td>'+esc(x[0])+'</td><td>'+fmt(x[2])+'</td><td>'+('Pending')+'</td></tr>')))+
panel('Approval Settings','<div class="sp-tag-list">'+['Approval channels','Trusted reviewers','Auto-approval rules','Cooling-off period','Emergency overrides'].map(x=>r('⚙',x,'Demo workspace')).join('')+'</div>')+'</div>');
}
function screen25(){
const subs=config().subscriptions;const active=subs.filter(s=>s.status==='Active');const monthly=active.reduce((sum,s)=>sum+Number(s.cost),0);
const upcoming=active.slice().sort((a,b)=>a.renew.localeCompare(b.renew)).slice(0,5);
let list=active.concat(subs.filter(s=>s.status!=='Active')).filter(s=>ui.subscriptionFilter==='All'||s.status===ui.subscriptionFilter).filter(s=>s.name.toLowerCase().includes(ui.subscriptionSearch.toLowerCase()));
const table=rows(['','Subscription','Category','Amount (KES)','Billing Cycle','Next Renewal','Status','Actions'],list.map(s=>'<tr><td><input type="checkbox" aria-label="Select '+esc(s.name)+'"></td><td>'+esc(s.name)+'</td><td>'+esc(s.category)+'</td><td>'+fmt(s.cost)+'</td><td>'+esc(s.freq)+'</td><td>'+esc(s.renew)+'</td><td><span class="sp-chip '+(s.status==='Active'?'':'red')+'">'+esc(s.status)+'</span></td><td>'+sb('Manage','editSub:'+s.id)+'</td></tr>'));
return shell(25,metrics([['▤','Monthly Subscription Cost',fmt(monthly),'Active services'],['▧','Yearly Subscription Cost',fmt(monthly*12),'Annualized estimate'],['◷','Upcoming Renewals',String(upcoming.length),'Next scheduled'],['▣','Potential Savings',fmt(active.filter(s=>!s.essential).reduce((n,s)=>n+s.cost,0)),'Review before cancelling']])+
'<div class="sp-grid"><section class="sp-panel sp-col2"><div class="sp-panel-title"><h2>All Subscriptions ('+list.length+')</h2><div class="sp-buttons">'+sb('＋ Add Subscription','newSub','green')+'</div></div>'+
'<div class="sp-buttons" style="margin-bottom:7px">'+tab(['All','Active','Paused','Cancelled'],ui.subscriptionFilter,'subs')+'<input class="sp-search" data-spsearch="subscription" placeholder="Search subscriptions…" aria-label="Search subscriptions" value="'+esc(ui.subscriptionSearch)+'"></div>'+table+'</section>'+
panel('Spending by Category',donut(monthly))+
panel('Subscription Insights','<div class="sp-tiny-card-grid">'+[['7','Tracked services'],[fmt(monthly),'Monthly'],[fmt(monthly*12),'Annual'],[String(active.filter(s=>!s.essential).length),'To review']].map(x=>'<div class="sp-tiny-card"><b>'+x[0]+'</b>'+x[1]+'</div>').join('')+'</div>')+
panel('Upcoming Renewals',upcoming.map(s=>'<div class="sp-stat-row"><span><b>'+esc(s.name)+'</b><small style="display:block">'+esc(s.renew)+'</small></span><b>'+fmt(s.cost)+'</b>'+sb('Manage','editSub:'+s.id)+'</div>').join(''))+
panel('Spending & Renewal Alerts',advisorTips())+
panel('Quick Actions','<div class="sp-buttons">'+sb('Add Subscription','newSub','green')+to('View Bills',30)+to('Spending Leaks',20)+to('Recovery Plan',26)+'</div>')+
panel('Subscriptions By Category',C.filter(x=>['Utilities','Entertainment','Subscriptions','Health & Medical'].includes(x[0])).map(x=>r(x[3],x[0],'Monthly recurring',fmt(active.filter(s=>s.category===x[0]).reduce((a,b)=>a+b.cost,0)))).join(''))+
panel('Review Recommendations',note('Some subscriptions may be essential. No external cancellations are performed by this prototype.')+to('Open leak detector',20))+'</div>');
}
function screen26(){
const plan=[
['Review subscriptions','Identify services you no longer use','subscriptions'],
['Reduce dining out','Set a manageable weekly food limit','dining'],
['Optimize transport','Compare commuting alternatives','transport'],
['Monitor daily allowance','Set a spending boundary you can maintain','allowance'],
['Revisit monthly budget','Adjust category allocations realistically','budget'],
['Weekly progress review','Review actual spending every week','review']];
const marked=config().recovery.completed;
return shell(26,metrics([['▤','Current Monthly Spending',fmt(kpiTotal()),'Illustrative baseline'],['◆','Potential Monthly Savings',fmt(config().recovery.targetReduction),'Target reduction'],['▣','Target Monthly Spend',fmt(Math.max(0,kpiTotal()-config().recovery.targetReduction)),'Based on review target'],['◈','Recovery Progress',Math.round(marked.length/plan.length*100)+'%','Checklist completion']])+
'<div class="sp-grid">'+panel('Spending Trend & Forecast',chart('double'))+panel('Where Your Money Goes',donut())+panel('Spending Health Score','<div class="sp-gauge" style="--p:62%"><div><b>62</b><small>Needs Improvement</small></div></div><div class="sp-banner-note warn">A heuristic based on demo entries, not verified financial advice.</div>')+
panel('Key Insights',advisorTips())+
'<section class="sp-panel sp-col2"><div class="sp-panel-title"><h2>Recovery Plan</h2>'+sb('Save Recovery Plan','saveRecovery','green')+'</div>'+
plan.map(([t,d,key],i)=>'<div class="sp-plan-item"><label style="display:flex;align-items:center;gap:8px"><input type="checkbox" data-sprecovery="'+key+'" '+(marked.includes(key)?'checked':'')+' aria-label="Complete '+esc(t)+'"></label><span><b>'+esc(t)+'</b><small>'+esc(d)+'</small></span><span class="sp-chip">'+(marked.includes(key)?'Completed':'Action needed')+'</span></div>').join('')+'</section>'+
panel('Top Opportunities to Save',vendors.slice(1,6).map(x=>r('⚑',x[0],x[1],fmt(x[2]))).join(''))+
panel('Weekly Recovery Projection',lineGraph())+
panel('Financial Goal Impact',config().recovery.targetReduction?'<b>Potential annual redirection: '+fmt(config().recovery.targetReduction*12)+'</b>'+bar(config().recovery.targetReduction,100000):note('Set a realistic savings target.'))+
panel('Recent Overspending (Last 30 Days)',rows(['Category','Spent','Variance'],C.slice(0,7).map(x=>'<tr><td>'+esc(x[0])+'</td><td>'+fmt(Math.round(x[1]*1.12))+'</td><td class="sp-red">↑ 12%</td></tr>')))+
panel('Recovery Settings','<form data-spform="recovery" class="sp-fields"><label class="sp-field">Monthly reduction target (KES)<input name="target" type="number" min="0" value="'+config().recovery.targetReduction+'"></label><label class="sp-field">Personal notes<input name="notes" value="'+esc(config().recovery.notes)+'"></label><button class="sp-btn green" type="submit">Save plan</button></form>')+'</div>');
}
function modal(){
if(!ui.modal)return '';
const m=ui.modal;let title='',form='';
if(m==='subscription'||m==='editSub'){let sub=config().subscriptions.find(x=>x.id===ui.selectedSub);title=sub?'Edit Subscription':'Add Subscription';form='<form class="sp-fields" data-spform="subscription"><label class="sp-field">Name<input name="name" value="'+esc(sub?.name||'')+'" required></label><label class="sp-field">Amount (KES)<input name="amount" type="number" min="0" required value="'+esc(sub?.cost||1000)+'"></label><label class="sp-field">Category<select name="category">'+C.map(c=>'<option '+(sub?.category===c[0]?'selected':'')+'>'+esc(c[0])+'</option>').join('')+'</select></label><label class="sp-field">Cycle<select name="freq">'+['Monthly','Weekly','Yearly'].map(c=>'<option '+(sub?.freq===c?'selected':'')+'>'+c+'</option>').join('')+'</select></label><label class="sp-field">Renewal date<input name="renew" type="date" required value="'+esc(sub?.renew||'2026-11-01')+'"></label><label class="sp-field"><input type="checkbox" name="essential" '+(sub?.essential?'checked':'')+'> Essential expense</label><button type="submit" class="sp-btn green">Save subscription</button></form>'+(sub?'<div class="sp-buttons">'+sb(sub.status==='Active'?'Pause':'Resume', 'subStatus:'+(sub.status==='Active'?'Paused':'Active'))+sb('Cancel locally','subStatus:Cancelled')+'</div>':'');
}else if(m==='rule'){title='Add Guardrail Rule';form='<form class="sp-fields" data-spform="rule"><label class="sp-field">Rule name<input name="name" required placeholder="Large discretionary purchase"></label><label class="sp-field">Amount threshold<input name="amount" type="number" min="0" required value="20000"></label><label class="sp-field">Action<select name="trigger"><option>Warning</option><option>Approval required</option><option>Block in prototype</option></select></label><button class="sp-btn green" type="submit">Create rule</button></form>'}
else{title=ui.modal;form='<p class="sp-mini">Demo-only planning information; no external payment or banking operation.</p>'}
return '<div class="b-dialog-backdrop" role="presentation"><div class="b-dialog" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><div class="sp-panel-title"><h2>'+esc(title)+'</h2>'+sb('Close','closeModal')+'</div>'+form+'</div></div>';
}
function render(n){
switch(Number(n)){case 16:return screen16();case 17:return screen17();case 18:return screen18();case 19:return screen19();case 20:return screen20();case 21:case 22:return budgetBuilder(Number(n));case 23:return screen23();case 24:return screen24();case 25:return screen25();case 26:return screen26();default:return ''}}


function previewCSV(){
const head=['Date','Merchant','Category','Amount','Status'];
const body=vendors.slice(0,10).map(x=>['October 2026',x[0],x[1],-x[2],'Demonstration']).map(row=>row.map(v=>'"'+String(v).replace(/"/g,'""')+'"').join(','));
const csv=[head.join(','),...body].join('\r\n');
const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),u=URL.createObjectURL(blob),a=document.createElement('a');a.href=u;a.download='finance-os-spending-demo.csv';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),300);
}
function handleClick(e){
const el=e.target.closest?.('[data-sp],[data-spnav]');if(!el)return false;
if(el.dataset.spnav){e.preventDefault();nav(el.dataset.spnav);return true}
const command=el.dataset.sp,parts=command.split(':'),name=parts[0],arg=parts.slice(1).join(':');ui.notice='';
switch(name){
 case 'reference':location.href='index.html#screen/'+(bridge.screen()===22?21:bridge.screen());break;
 case 'export':previewCSV();save('Illustrative spending CSV downloaded (no bank data).');break;
 case 'trend':ui.trend=arg;save('Trend view: '+arg+'. Data are illustrative.');break;
 case 'segment':ui.segment=arg;save('Breakdown mode: '+arg+'.');break;
 case 'tip':case 'recommendation':ui.modal='Review your transactions, existing commitments and budget before taking any suggested action.';save();break;
 case 'scan':ui.notice='Demo review refreshed. No external account scanning was performed.';save();break;
 case 'leak':{let v=vendors[Number(arg)];if(v){config().leakStatus[v[0]]='Reviewed';save(v[0]+' marked reviewed. No actual service was cancelled.')}break}
 case 'tab':{
   const sep=arg.indexOf(':'),key=arg.slice(0,sep),val=arg.slice(sep+1);
   if(key==='subs')ui.subscriptionFilter=val;
   if(key==='budgetPeriod'){config().budgetPeriod=val}
   if(key==='guard')ui.guard=val;
   if(key==='breakdown')ui.segment=val;
   if(key==='recovery')ui.recoveryFilter=val;
   save();break}
 case 'budgetAmount':{const amounts=[100000,250000,500000,budgetTotal()];config().budgetLimit=amounts[Number(arg)]??budgetTotal();save('Budget target updated. Adjust category allocations as needed.');break}
 case 'budgetStep':ui.budgetStep=Number(arg);save();break;
 case 'budgetCancel':nav(21);break;
 case 'budgetCategoryAction':ui.modal='Review the allocation and rollover rule for '+arg+'. Edit its amount directly in the category table.';save();break;
 case 'spreadBudget':{const total=config().budgetLimit,items=C.map(c=>c[0]),n=items.length,base=Math.floor(total/n);items.forEach((c,i)=>config().categories[c]=base+(i===n-1?total-base*n:0));save('Budget distributed evenly across categories.');break}
 case 'resetBudget':{config().categories=Object.fromEntries(C.map(c=>[c[0],c[1]]));config().budgetLimit=300000;save('Restored illustration budget allocations.');break}
 case 'saveBudget':{const form=$('#sp-budget-form');const fd=form?new FormData(form):null;config().budgetName=String(fd?.get('name')||config().budgetName);config().budgetLimit=Number(fd?.get('total')||config().budgetLimit);config().budgetPeriod=String(config().budgetPeriod);config().budgetMonth=String(fd?.get('period')||config().budgetMonth||'October 2026');save('Budget saved locally. It is now used by spending and allowance screens.');break}
 case 'saveTemplate':save('Budget template stored in browser demo state.');break;
 case 'budgetQuick':{
  if(arg==='template'){config().categories=Object.fromEntries(C.map(c=>[c[0],c[1]]));config().budgetLimit=300000}
  else if(arg==='aiBudget'){const p=[40,15,10,8,6,5,4,4,3,5];C.forEach((c,i)=>config().categories[c[0]]=Math.round(config().budgetLimit*p[i]/100))}
  else{config().budgetName='Copied Previous Month Budget'}
  save('Updated budget draft with a '+arg+' preset; verify before saving.');break}
 case 'newSub':ui.selectedSub=null;ui.modal='subscription';save();break;
 case 'editSub':ui.selectedSub=arg;ui.modal='editSub';save();break;
 case 'subStatus':{const sub=config().subscriptions.find(x=>x.id===ui.selectedSub);if(sub){sub.status=arg;ui.modal=null;save(sub.name+' marked '+arg+' in local records. No provider cancellation performed.')}break}
 case 'newRule':ui.modal='rule';save();break;
 case 'approval':{const [i,decision]=arg.split(':');config().approvals??={};config().approvals[Number(i)]=decision==='approve'?'Approved':'Rejected';save('Purchase '+decision+' recorded locally. No payment occurred.');break}
 case 'saveRecovery':save('Recovery checklist saved locally.');break;
 case 'closeModal':ui.modal=null;save();break;
 default:ui.modal='Prototype-only review: no real provider action was performed.';save();break;
}
return true;
}
function handleChange(e){
const el=e.target;
if(el.matches?.('[data-spcat], [data-be22-cat]')){const value=Number(el.value);if(Number.isFinite(value)&&value>=0){config().categories[el.dataset.spcat||el.dataset.be22Cat]=value;bridge.save();bridge.render()}return true}
if(el.matches?.('[data-sprollover]')){config().budgetRollover??={};config().budgetRollover[el.dataset.sprollover]=el.checked;save('Budget rollover preference updated locally.');return true}
if(el.matches?.('[data-sprule]')){config().rules[el.dataset.sprule]=el.checked;save('Budget alert preference saved in this browser.');return true}
if(el.matches?.('[data-spguard]')){const g=config().guardrails.find(x=>x.id===el.dataset.spguard);if(g){g.active=el.checked;save('Guardrail rule updated (demo only).')}return true}
if(el.matches?.('[data-sprecovery]')){const completed=new Set(config().recovery.completed);if(el.checked)completed.add(el.dataset.sprecovery);else completed.delete(el.dataset.sprecovery);config().recovery.completed=[...completed];save('Recovery checklist updated.');return true}
if(el.dataset?.spchange){const key=el.dataset.spchange;if(key==='period')ui.period=el.value;if(key==='account')ui.account=el.value;if(key==='category')ui.category=el.value;if(key==='alertThreshold')config().rules.alertThreshold=Number(el.value);save('Updated '+key+' for demo analysis.');return true}
return false;
}
function handleInput(e){
const el=e.target;
if(el.dataset.spsearch==='subscription'){
 ui.subscriptionSearch=el.value;
 const pos=el.selectionStart;
 bridge.render();
 const input=$('[data-spsearch="subscription"]');if(input){input.focus();input.setSelectionRange(pos,pos)}
 return true;
}
return false;
}
function handleSubmit(e){
const form=e.target;if(!form.dataset.spform)return false;
e.preventDefault();const d=Object.fromEntries(new FormData(form));
switch(form.dataset.spform){
 case 'budget':{let total=Number(d.total);if(total<=0){save('Enter a positive total budget amount.');break}config().budgetLimit=total;config().budgetName=String(d.name||'Monthly Budget');config().budgetMonth=String(d.period||'October 2026');save('Budget details saved locally. Category allocations can be adjusted below.');break}
 case 'allowance':{const a=Number(d.daily),w=Number(d.weekly),locked=Number(d.locked||0);if([a,w,locked].some(v=>!Number.isFinite(v)||v<0)){save('Enter non-negative limits.');break}config().allowance={daily:a,weekly:w,locked};save('Daily and weekly spending allowance updated.');break}
 case 'purchase':{
  const amt=Number(d.amount),merchant=String(d.merchant||''),category=String(d.category||''),location=String(d.location||'');
  if(!(amt>0)||!merchant){save('Enter a valid amount and merchant.');break}
  const triggered=config().guardrails.filter(g=>g.active&&g.limit>0&&amt>g.limit);
  const warning=amt>config().allowance.daily;
  config().lastPurchase={amt,merchant,category,location,at:new Date().toISOString(),decision:triggered.length?'Review required':warning?'Daily allowance warning':'Within configured demo rules'};
  save('Purchase check: '+config().lastPurchase.decision+' (advisory simulation only; no payment was blocked).');break}
 case 'subscription':{
  const cost=Number(d.amount),name=String(d.name||'').trim();if(!name||!Number.isFinite(cost)||cost<0){save('Enter a valid subscription name and amount.');break}
  const v={name,cost,category:String(d.category),freq:String(d.freq),renew:String(d.renew),essential:d.essential==='on'};
  const prev=config().subscriptions.find(x=>x.id===ui.selectedSub);
  if(prev)Object.assign(prev,v);else config().subscriptions.push({id:'local-'+Date.now(),status:'Active',...v});
  ui.modal=null;save('Subscription recorded in browser demo; no subscription provider changed.');break}
 case 'rule':{
  let amount=Number(d.amount);if(!String(d.name||'').trim()||amount<0){save('Valid name and nonnegative amount required.');break}
  config().guardrails.push({id:'rule-'+Date.now(),name:String(d.name),limit:amount,active:true,condition:'Custom limit',trigger:String(d.trigger)});
  ui.modal=null;save('Added local guardrail rule.');break}
 case 'recovery':{let amount=Number(d.target);if(!Number.isFinite(amount)||amount<0){save('Enter a valid savings target.');break}
  config().recovery.targetReduction=amount;config().recovery.notes=String(d.notes||'');save('Recovery plan saved in browser.');break}
}
return true;
}
window.FinanceSpend={init,render,handleClick,handleChange,handleInput,handleSubmit};

})();