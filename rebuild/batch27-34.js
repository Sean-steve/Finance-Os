
(()=>{
'use strict';
let ctx;
const $=s=>document.querySelector(s),safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])),money=n=>'KES '+Math.abs(Math.round(Number(n)||0)).toLocaleString('en-KE');
const titles={27:['Income Dashboard','Your income, growth and earning performance at a glance.'],28:['Income Sources','Track every source of income, monitor trends and explore opportunities to grow.'],29:['Income Planning & Forecasting','Plan future income, test scenarios and track your earning goals.'],30:['Bills & Financial Obligations','Manage your bills, due dates and obligations. Never miss a payment.'],31:['Bill Details & Payment','View bill details, make payments, track history and manage settings.'],32:['Cash Flow Timeline','Understand where money comes from, where it goes and what is coming next.'],33:['Cash Flow Forecast & Financial Runway','Project your cash position, prepare for obligations and protect your runway.'],34:['Cash Shortfall Recovery','Identify upcoming cash gaps and build a practical plan to recover.']};
const defaults={
 incomes:[
 {id:'inc1',name:'Nflake Technologies',category:'Business Income',frequency:'Monthly',amount:180000,previous:165000,account:'KCB Main Account',status:'Active',expected:'2026-11-05',growth:9},
 {id:'inc2',name:'Haven Oasis Realty',category:'Business Income',frequency:'Monthly',amount:120000,previous:115000,account:'Equity Account',status:'Active',expected:'2026-11-10',growth:4},
 {id:'inc3',name:'Freelance & Consulting',category:'Freelance',frequency:'Variable',amount:62000,previous:48000,account:'KCB Main Account',status:'Active',expected:'2026-11-18',growth:29},
 {id:'inc4',name:'Trading & Investments',category:'Investments',frequency:'Variable',amount:45000,previous:36500,account:'Equity Account',status:'Active',expected:'2026-11-24',growth:23},
 {id:'inc5',name:'Rental Income',category:'Property',frequency:'Monthly',amount:30000,previous:30000,account:'KCB Main Account',status:'Active',expected:'2026-11-01',growth:0},
 {id:'inc6',name:'Other Income',category:'Other',frequency:'Variable',amount:13000,previous:11000,account:'M-Pesa',status:'Active',expected:'2026-11-26',growth:18}
 ],
 bills:[
 {id:'b1',name:'Kenya Power',category:'Utilities',amount:8500,due:'2026-10-20',account:'KCB Main Account',status:'Overdue',reminder:true,autopay:false,customer:'1234 5678 901',period:'01 Sep 2026 – 30 Sep 2026',previous:8000},
 {id:'b2',name:'House Rent',category:'Housing',amount:80000,due:'2026-11-01',account:'KCB Main Account',status:'Upcoming',reminder:true,autopay:false,customer:'RENT-2026-11',period:'01 Nov 2026 – 30 Nov 2026',previous:80000},
 {id:'b3',name:'Nairobi Water',category:'Utilities',amount:2800,due:'2026-11-03',account:'M-Pesa',status:'Upcoming',reminder:false,autopay:false,customer:'WATER-7891',period:'Oct 2026',previous:2900},
 {id:'b4',name:'Safaricom Home Internet',category:'Utilities',amount:3500,due:'2026-11-07',account:'M-Pesa',status:'Upcoming',reminder:true,autopay:false,customer:'HOME-5674',period:'Nov 2026',previous:3500},
 {id:'b5',name:'Medical Insurance',category:'Insurance',amount:7800,due:'2026-11-10',account:'KCB Main Account',status:'Upcoming',reminder:true,autopay:false,customer:'INS-5542',period:'Nov 2026',previous:7800},
 {id:'b6',name:'Nflake Server',category:'Business',amount:12000,due:'2026-11-12',account:'Equity Account',status:'Upcoming',reminder:false,autopay:false,customer:'SRV-1234',period:'Nov 2026',previous:12000},
 {id:'b7',name:'Netflix',category:'Subscriptions',amount:1200,due:'2026-11-15',account:'KCB Main Account',status:'Upcoming',reminder:false,autopay:false,customer:'SUB-2340',period:'Nov 2026',previous:1200},
 {id:'b8',name:'Car Insurance',category:'Insurance',amount:18500,due:'2026-11-19',account:'KCB Main Account',status:'Upcoming',reminder:true,autopay:false,customer:'CAR-INS-789',period:'2026/2027',previous:17000}
 ],
 scenario:{incomeGrowth:5,expenseGrowth:3,horizon:6,buffer:100000,minimum:75000},
 shortfall:{completed:[],actions:[],target:150000,notes:''},
 paymentHistory:[], billDrafts:[], alerts:[],
};
let v={period:'Last 6 months',incomeType:'All Sources',incomeTab:'All Sources',incomeSearch:'',incomeDetail:null, billTab:'All Bills',billSearch:'',billFilter:'All',billId:'b1',billDetailTab:'Overview',paymentMode:'MPESA',cashTab:'Daily',forecastScenario:'Baseline',forecastHorizon:6,modal:null,notice:'',selectedDate:'2026-10-20',groupBy:'Monthly',recoveryTab:'All'};
function init(bridge){
ctx=bridge;
if(!ctx.model.incomeFlowV2){ctx.model.incomeFlowV2=structuredClone(defaults);ctx.save()}
const s=state();for(const k of ['incomes','bills','scenario','shortfall','paymentHistory','billDrafts','alerts'])if(!s[k])s[k]=structuredClone(defaults[k]);
}
const state=()=>ctx.model.incomeFlowV2;
const save=(message='')=>{v.notice=message;ctx.save();ctx.render()},go=n=>ctx.navigate(Number(n));
const bc=(label,act,cls='')=>'<button type="button" class="cf-btn '+cls+'" data-cfa="'+safe(act)+'">'+safe(label)+'</button>';
const nav=(label,n,cls='')=>'<button type="button" class="cf-btn '+cls+'" data-cfnav="'+n+'">'+safe(label)+'</button>';
const tag=(status)=>'<span class="cf-status '+(/overdue|risk|unpaid|failed|blocked/i.test(status)?'bad':/upcoming|pending|planned/i.test(status)?'warn':/manual|forecast/i.test(status)?'blue':'')+'">'+safe(status)+'</span>';
const panel=(title,body,actions='')=>'<section class="cf-panel"><div class="cf-head"><h2>'+safe(title)+'</h2><div class="cf-actions">'+actions+'</div></div>'+body+'</section>';
const metric=(arr)=>'<div class="cf-metrics">'+arr.map(([icon,label,value,info])=>'<div class="cf-metric"><span class="cf-metric-icon">'+icon+'</span><div><small>'+safe(label)+'</small><strong>'+safe(value)+'</strong><em>'+safe(info||'')+'</em></div></div>').join('')+'</div>';
const mtext=(s,type='')=>'<div class="cf-notice '+type+'">'+safe(s)+'</div>';
const progress=(n,max,color='#15ac7a')=>'<div class="cf-progress" style="--p:'+Math.max(0,Math.min(100,Math.round(n/Math.max(1,max)*100)))+'%;--c:'+color+'"><i></i></div>';
const row=(ico,title,desc,value='',action='',color='')=>'<div class="cf-row"><span class="cf-round '+color+'">'+ico+'</span><span class="cf-grow"><b>'+safe(title)+'</b><small>'+safe(desc)+'</small></span><strong>'+safe(value)+'</strong>'+(action?bc('View','view:'+action):'')+'</div>';
const tabs=(labels,active,key)=>'<div class="cf-tabs">'+labels.map(n=>'<button type="button" class="'+(active===n?'on':'')+'" data-cfa="tab:'+key+':'+safe(n)+'">'+safe(n)+'</button>').join('')+'</div>';
const table=(cols,items)=>'<div class="cf-tablebox"><table class="cf-table"><thead><tr>'+cols.map(x=>'<th>'+safe(x)+'</th>').join('')+'</tr></thead><tbody>'+items.join('')+'</tbody></table></div>';
const vals=()=>state().incomes.filter(s=>s.status==='Active').reduce((sum,item)=>sum+Number(item.amount),0);
const monthExpenses=()=>ctx.model.expenses.reduce((sum,item)=>sum+Number(item[1]||0),0);
const outstanding=()=>state().bills.filter(b=>b.status!=='Paid').reduce((sum,b)=>sum+Number(b.amount),0);
const monthDue=()=>state().bills.filter(b=>b.status==='Upcoming'||b.status==='Overdue').reduce((sum,b)=>sum+Number(b.amount),0);
const horizon=()=>Math.min(12,Math.max(3,Number(state().scenario.horizon)||6));
function shell(n,content){
const [title,description]=titles[n];
return '<div class="cfpage"><section class="banner"><div><div class="banner-date">Finance　›　'+(n<=29?'Income':n<=31?'Bills & Financial Obligations':'Cash Flow & Financial Planning')+'</div><h1>'+safe(title)+'</h1><p>'+safe(description)+'</p></div><div class="banner-quote">“Every shilling planned<br>builds your future<br>financial confidence.”</div></section><div class="cfinner">'+(v.notice?'<div class="cf-notice" role="status">'+safe(v.notice)+'</div>':'')+content+'<div class="cf-muted" style="padding:12px">Coded reference-led mockup · Figures are illustrative, stored locally, not connected to payment providers. '+bc('Compare approved Screen '+n,'reference')+'</div></div>'+modal()+'</div>';
}
function graph(kind='bars',series=7){
let svg='<svg class="cf-plot" viewBox="0 0 440 180" role="img" aria-label="Illustrative financial '+safe(kind)+' chart"><defs><linearGradient id="cfgrad" x1="0" x2="0" y1="0" y2="1"><stop stop-color="#2ab788" stop-opacity=".20"/><stop offset="1" stop-color="#2ab788" stop-opacity="0"/></linearGradient></defs>';
for(let y of [28,67,107,149])svg+='<line x1="25" x2="439" y1="'+y+'" y2="'+y+'" stroke="#e9efec"/>';
let labels=['Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec','Jan','Feb','Mar'];let data=[];
for(let i=0;i<series;i++){
 const x=38+i*390/Math.max(1,series-1),h=57+Math.sin(i*.75+1)*20+i*3;
 data.push([x,160-h]);
 if(kind==='bars'||kind==='split'||kind==='stack') {
  if(kind==='split')svg+='<rect x="'+(x-8)+'" y="'+(160-h)+'" width="9" height="'+h+'" rx="2" fill="#43c08d"/><rect x="'+(x+3)+'" y="'+(160-(h*.63+Math.cos(i)*9))+'" width="9" height="'+(h*.63+Math.cos(i)*9)+'" rx="2" fill="#f47785"/>';
  else if(kind==='stack'){let y=160;for(let j=0;j<4;j++){let height=16+j*4+Math.sin(i+j)*3;y-=height;svg+='<rect x="'+(x-10)+'" y="'+y+'" width="19" height="'+height+'" fill="'+['#35bf8a','#2799da','#ae68df','#efac59'][j]+'"/>'}}
  else svg+='<rect x="'+(x-8)+'" y="'+(160-h)+'" width="17" height="'+h+'" rx="2" fill="#37bc86"/>';
 }
 svg+='<text x="'+(x-9)+'" y="177" font-size="10" fill="#667f87">'+labels[i]+'</text>'
}
if(kind==='line'||kind==='area'){let points=data.map((p,i)=>(i?'L':'M')+p.join(' ')).join(' ');if(kind==='area')svg+='<path d="'+points+' L'+data.at(-1)[0]+' 162 L'+data[0][0]+' 162 Z" fill="url(#cfgrad)"/>';svg+='<path d="'+points+'" fill="none" stroke="#13a776" stroke-width="3"/>'}
return svg+'</svg>';
}
const shades=['#2ab789','#299edd','#a86cda','#efb253','#ef7488','#94aab6'];
function donut(items,total){return '<div class="cf-chart-flex"><div class="cf-donut"><div class="hole"><b>'+money(total)+'</b><small>Total</small></div></div><ul>'+items.slice(0,6).map((x,i)=>'<li><span><i style="--color:'+shades[i%6]+'"></i>'+safe(x[0])+'</span><strong>'+Math.round(Number(x[1])/Math.max(1,total)*100)+'%</strong></li>').join('')+'</ul></div>'}
function incomeTable(){
let list=state().incomes.filter(s=>v.incomeType==='All Sources'||s.category===v.incomeType).filter(s=>s.name.toLowerCase().includes(v.incomeSearch.toLowerCase()));
return table(['Source','Type','Frequency','Monthly Income','Previous','Growth','Status','Action'],
list.map(s=>'<tr><td><b>'+safe(s.name)+'</b></td><td>'+safe(s.category)+'</td><td>'+safe(s.frequency)+'</td><td>'+money(s.amount)+'</td><td>'+money(s.previous)+'</td><td style="color:#068d64">↑ '+safe(s.growth)+'%</td><td>'+tag(s.status)+'</td><td>'+bc('Manage','income:'+s.id)+'</td></tr>'))}
function billsTable(){
let list=state().bills.filter(b=>v.billFilter==='All'||v.billFilter==='All Bills'||b.status===v.billFilter).filter(b=>b.name.toLowerCase().includes(v.billSearch.toLowerCase()));
return table(['Bill / Service','Category','Amount','Due Date','Payment Method','Status','Actions'],
list.map(b=>'<tr><td><b>'+safe(b.name)+'</b><small style="display:block;color:#88959a">'+safe(b.customer)+'</small></td><td>'+safe(b.category)+'</td><td>'+money(b.amount)+'</td><td>'+safe(b.due)+'</td><td>'+safe(b.account)+'</td><td>'+tag(b.status)+'</td><td>'+bc('Details','bill:'+b.id)+'</td></tr>'))}
function alertPanel(){return panel('AI Financial Insights & Recommendations',
row('✦','Income is trending upward','Expected monthly growth is positive','','', 'purple')+
row('◷','Review upcoming obligations','Avoid late fees by tracking due dates','','','red')+
row('▣','Keep emergency reserves','Cash estimates exclude unrecorded liabilities','','','blue')+
mtext('Rule-based prototype suggestions. No AI or banking connection is running.'))}
function screen27(){
const income=vals(),current=income,top=state().incomes.slice().sort((a,b)=>b.amount-a.amount);
return shell(27,metric([['▣','Total Income',money(income),'↑ 12% vs last month'],['◈','Average Monthly Income',money(income),'Across income streams'],['▥','Highest Income Month',money(income+28000),'Illustrative'],['▤','Projected Next Month',money(Math.round(income*1.05)),'↑ 5% expected']])+
'<div class="cf-grid">'+panel('Income Trend',graph('bars',7),bc('Last 7 months','period'))+
panel('Income by Source (This Month)',donut(top.map(x=>[x.name,x.amount]),income))+
panel('Income Sources',top.slice(0,5).map(s=>row('▣',s.name,s.category,money(s.amount),'income:'+s.id)).join(''),nav('View all',28))+
panel('Income Overview',incomeTable(),nav('All Sources',28))+
panel('Income Growth',graph('split',7)+mtext('This chart uses a demonstration series, not a verified bank feed.'))+
panel('Income Insights',top.slice(0,4).map((s,i)=>row('↑',s.name,'Previous period: '+money(s.previous),'+'+s.growth+'%')).join(''))+
panel('Monthly Income Breakdown',graph('stack',7))+
panel('Upcoming Income',state().incomes.map(s=>row('▧',s.name,s.expected,money(s.amount))).join(''),nav('Plan income',29))+
panel('Income Goals',state().incomes.slice(0,4).map(s=>'<div class="cf-row"><span class="cf-grow"><b>'+safe(s.name)+'</b><small>Goal: '+money(s.amount*1.1)+'</small>'+progress(s.amount,s.amount*1.1)+'</span>'+tag('On track')+'</div>').join(''))+
'</div>')}
function screen28(){const total=vals(),sources=state().incomes;
return shell(28,metric([['▣','Total Monthly Income',money(total),'All active sources'],['▤','Active Income Sources',String(sources.filter(s=>s.status==='Active').length),'Recorded'],['▥','Average Per Source',money(total/Math.max(1,sources.length)),'This month'],['◈','Income Growth','+12.5%','Illustrative vs last month']])+
'<div class="cf-grid"><section class="cf-panel cf-col2"><div class="cf-head"><h2>Income Sources</h2><div class="cf-actions">'+bc('+ Add Income Source','newIncome','green')+'</div></div>'+
tabs(['All Sources','Business Income','Freelance','Investments','Property','Other'],v.incomeType,'incomeType')+
'<div class="cf-toolbar"><input class="cfsearch" data-cfsearch="income" placeholder="Search income sources…" aria-label="Search income sources" value="'+safe(v.incomeSearch)+'">'+bc('Export CSV','incomeExport')+'</div>'+incomeTable()+'</section>'+
panel('Income by Source',donut(sources.map(s=>[s.name,s.amount]),total))+
panel('Monthly Income Trends',graph('stack',7))+
panel('Income Goals & Targets',sources.slice(0,4).map(s=>'<div class="cf-row"><span class="cf-grow"><b>'+safe(s.name)+'</b><small>Goal '+money(Math.round(s.amount*1.2))+'</small>'+progress(s.amount,s.amount*1.2)+'</span>'+tag('On track')+'</div>').join(''))+
panel('Upcoming Income',sources.slice(0,5).map(s=>row('◈',s.name,s.expected,money(s.amount))).join(''))+
panel('Revenue Breakdown by Type',donut([['Business Income',300000],['Freelance',62000],['Investments',45000],['Property',30000],['Other',13000]],total))+
alertPanel()+
panel('Income Opportunities',sources.filter(s=>s.growth>0).map(s=>row('↑',s.name,'Growth estimate: '+s.growth+'%')).join(''))+'</div>')}
function forecastData(){
const s=state().scenario,total=vals(),spend=monthExpenses(),months=Number(s.horizon);
let cash=ctx.model.accounts.filter((a,i)=>i<3).reduce((a,x)=>a+Number(x[1]),0),rows=[];
for(let i=0;i<months;i++){let income=total*Math.pow(1+Number(s.incomeGrowth)/100,i+1),expenses=spend*Math.pow(1+Number(s.expenseGrowth)/100,i+1);
let commitments=i===0?outstanding():monthDue()*Math.pow(1.01,i),net=income-expenses-commitments;cash+=net;
rows.push({month:['Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct'][i],income:Math.round(income),expenses:Math.round(expenses),obligations:Math.round(commitments),net:Math.round(net),cash:Math.round(cash)})}
return rows
}
function screen29(){const m=forecastData(),total=vals(),goal=Math.round(total*1.25);
return shell(29,metric([['▣','Projected Monthly Income',money(Math.round(total*1.05)),'↑ 5% growth scenario'],['◈','Income Goal',money(goal),'Target monthly'],['▥','Goal Progress',Math.round(total/goal*100)+'%','Current vs target'],['▤','Expected Growth',money(Math.round(total*.05)),'Illustrative next month']])+
'<div class="cf-grid">'+panel('Income Forecast & Growth',graph('stack',12))+
panel('Forecast Summary',row('▧','Projected Next Month', '5% illustrative growth',money(total*1.05))+
row('◈','6-Month Revenue Target','Based on repeatable streams',money(total*6.5))+
row('↑','Growth opportunity','Income growth sensitivity', '5%')+
row('▤','Income at risk','Unconfirmed income not guaranteed',money(35000)))+
panel('Income Gap Analysis',graph('bars',3)+mtext('Projected income and target amounts are editable assumptions.'))+
panel('Expected Income by Source',incomeTable(),nav('Manage Sources',28))+
panel('Income Growth Opportunities',row('↑','Freelance consulting','Increase client retention and recurring work',money(20000))+
row('◈','Rental income','Review occupancy and costs',money(15000))+
row('▣','Business income','Increase predictable contract work',money(25000)))+
panel('Income Scenarios',scenarioControls())+
panel('Monthly Income Projections',table(['Month','Projected Income','Growth'],m.map(x=>'<tr><td>'+safe(x.month)+'</td><td>'+money(x.income)+'</td><td style="color:#098765">+'+state().scenario.incomeGrowth+'%</td></tr>')))+
panel('Income Allocation Targets',donut([['Essentials',160000],['Savings',130000],['Investments',90000],['Discretionary',70000]],450000))+
panel('Financial Planning Recommendations',alertPanelContent())+'</div>')}
function alertPanelContent(){return row('✓','Build predictable income','Track the expected payment dates of clients')+row('◷','Plan for variable earnings','Keep a conservative income estimate')+row('◆','Preserve a cash buffer','Do not treat unconfirmed income as available cash')}


function billsTable(){let list=state().bills.filter(b=>v.billFilter==='All'||v.billFilter==='All Bills'||b.status===v.billFilter).filter(b=>b.name.toLowerCase().includes(v.billSearch.toLowerCase()));return table(['Bill / Service','Category','Amount','Due Date','Payment Method','Status','Actions'],list.map(b=>'<tr><td><b>'+safe(b.name)+'</b></td><td>'+safe(b.category)+'</td><td>'+money(b.amount)+'</td><td>'+safe(b.due)+'</td><td>'+safe(b.account)+'</td><td>'+tag(b.status)+'</td><td>'+bc('Details','bill:'+b.id)+'</td></tr>'))}
function calGrid(){let out='<div class="cf-calendar">'+['Mon','Tue','Wed','Thu','Fri','Sat','Sun'].map(d=>'<b style="font-size:10px;text-align:center">'+d+'</b>').join('');for(let i=0;i<35;i++){const d=i-2;if(d<1||d>31){out+='<span></span>';continue}const related=state().bills.filter(x=>Number(x.due.slice(8))===d&&x.status!=='Paid');out+='<button type="button" class="cf-day '+(related.length?'pay':'')+'" data-cfa="calendarDay:'+d+'">'+d+(related.length?'<small>'+related.length+' bill</small>':'')+'</button>'}return out+'</div><p class="cf-muted">🔴 Overdue　🟠 Upcoming　🔵 Scheduled</p>'}
function screen30(){
 const all=state().bills,open=all.filter(b=>b.status!=='Paid'),late=all.filter(b=>b.status==='Overdue'),total=outstanding();
 return shell(30,metric([['▦','Total Monthly Obligations',money(total),'Tracked bills'],['▣','Total Annual Obligations',money(total*12),'Projected recurring costs'],['⚑','Overdue Amount',money(late.reduce((n,b)=>n+b.amount,0)),late.length+' overdue'],['◷','Upcoming Next 7 Days',money(open.slice(0,5).reduce((n,b)=>n+b.amount,0)),'5 tracked bills']])+
 '<div class="cf-toolbar">'+tabs(['All Bills','Upcoming','Overdue','Paid','Recurring','One-off','Insurance','Taxes'],v.billTab,'billTab')+
 '<input class="cfsearch" aria-label="Search bills" placeholder="Search bills or providers" data-cfsearch="bill" value="'+safe(v.billSearch)+'">'+bc('+ Add Bill','newBill','green')+'</div>'+
 '<div class="cf-grid"><section class="cf-panel cf-col2"><div class="cf-head"><h2>Bills & Obligations ('+all.length+')</h2>'+bc('Export Bills','billExport')+'</div>'+billsTable()+'</section>'+
 panel('Payment Calendar (October 2026)',calGrid(),nav('View Calendar',6))+
 panel('Spending Breakdown',donut([['Housing',80000],['Insurance',26300],['Utilities',11300],['Business',12000],['Subscriptions',1200]],130500))+
 panel('Obligation Timeline',graph('stack',7))+
 panel('Upcoming Bills',open.slice(0,5).map(b=>row('▦',b.name,b.due,money(b.amount),'bill:'+b.id)).join(''))+
 panel('Quick Actions',bc('Add a new bill','newBill','green')+row('◷','Set payment reminders','Check upcoming obligations')+row('✓','Reduce recurring bills','Review all subscriptions')+nav('Financial Calendar',6))+
 '</div>')}
function bill(){return state().bills.find(x=>x.id===v.billId)||state().bills[0]}
function screen31(){
 const b=bill();const paid=state().paymentHistory.filter(x=>x.billId===b.id);
 const details=[['Previous Balance',money(b.previous)],['Current Charges',money(Math.max(0,b.amount-650))],['Taxes & Levies',money(650)],['Total Amount Due',money(b.amount)],['Due Date',b.due],['Billing Period',b.period],['Status',b.status]];
 return shell(31,'<div class="cf-bill-banner"><div class="cf-actions"><span class="cf-round">ϟ</span><div><small>Bills　›　Bill Details & Payment</small><h2>'+safe(b.name)+'</h2><small>Customer Number　'+safe(b.customer)+'　 ·　 Billing Period　'+safe(b.period)+'</small></div></div><div class="cf-actions">'+tag(b.status)+bc('⋯','billSettings')+'</div><div class="cf-billamount"><small>Amount Due</small><strong>'+money(b.status==='Paid'?0:b.amount)+'</strong><small>Due Date　'+safe(b.due)+'</small></div></div>'+
 tabs(['Overview','Payment','Usage & History','Documents','Reminders','Settings'],v.billDetailTab,'billDetailTab')+
 '<div class="cf-grid"><div class="cf-panel-stack">'+panel('Bill Summary (October 2026)',details.map(x=>'<div class="cf-row"><span class="cf-grow">'+safe(x[0])+'</span><strong>'+safe(x[1])+'</strong></div>').join(''),bc('Statement','billPdf'))+
 panel('Usage & Consumption',row('ϟ','320 kWh','Illustrative consumption','↑ 8%')+graph('bars',7))+
 panel('Payment History',table(['Date','Amount','Method','Status','Receipt'],paid.map(p=>'<tr><td>'+safe(p.date)+'</td><td>'+money(p.amount)+'</td><td>'+safe(p.method)+'</td><td>'+tag('Demo Paid')+'</td><td>'+bc('View','receipt:'+p.id)+'</td></tr>')))+'</div>'+
 '<div class="cf-panel-stack">'+panel('Make a Payment','<div class="cf-paymodes">'+['MPESA','Card','Bank Transfer'].map(x=>'<button type="button" class="'+(v.paymentMode===x?'active':'')+'" data-cfa="payMode:'+x+'">'+x+'</button>').join('')+'</div>'+
 mtext('Simulation only. No M-Pesa prompt, bank transfer or card charge will be initiated.')+
 '<form class="cf-form" data-cfform="payBill" style="margin-top:10px"><label class="cf-label">Phone / Reference<input class="cfinput" name="destination" required value="'+(v.paymentMode==='MPESA'?'+254712345678':'DEMO-REFERENCE')+'"></label><label class="cf-label">Amount (KES)<input class="cfinput" type="number" name="amount" min="1" max="'+(b.status==='Paid'?0:b.amount)+'" value="'+(b.status==='Paid'?0:b.amount)+'" required></label><button type="submit" class="cf-btn green" '+(b.status==='Paid'?'disabled':'')+'>Record simulated payment</button></form>')+
 panel('Spending Trend',graph('area',10))+'</div>'+
 '<div class="cf-panel-stack">'+panel('Bill Actions','<div class="cf-actions">'+bc('Download Statement','billPdf')+bc('Set Reminder','billReminder')+bc('Auto Pay '+(b.autopay?'ON':'OFF'),'billAutopay')+bc('Manage Bill','billSettings')+'</div>')+
 panel('Upcoming Bills (Next 3)',state().bills.filter(x=>x.id!==b.id&&x.status!=='Paid').slice(0,3).map(x=>row('▦',x.name,x.due,money(x.amount),'bill:'+x.id)).join(''))+
 panel('AI Insights & Recommendations',alertPanelContent())+'</div></div>')
}


function cashItems(){return [
 ...state().incomes.filter(x=>x.status==='Active').map(x=>({kind:'Income',name:x.name,category:x.category,amount:x.amount,date:x.expected})),
 ...state().bills.filter(x=>x.status!=='Paid').map(x=>({kind:'Expense',name:x.name,category:x.category,amount:-x.amount,date:x.due}))
].sort((a,b)=>a.date.localeCompare(b.date))}
function cashTable(kind){return table(['Date','Description','Category','Amount','Status'],cashItems().filter(x=>kind==='All'||x.kind===kind).map(x=>'<tr><td>'+safe(x.date)+'</td><td>'+safe(x.name)+'</td><td>'+safe(x.category)+'</td><td style="color:'+(x.amount>=0?'#079666':'#cb4257')+'">'+(x.amount>=0?'+':'−')+money(x.amount)+'</td><td>'+tag(x.kind==='Income'?'Expected':'Upcoming')+'</td></tr>'))}
function screen32(){
const income=vals(),bills=outstanding(),spend=monthExpenses(),cash=ctx.model.accounts.slice(0,3).reduce((n,x)=>n+Number(x[1]),0);
return shell(32,metric([['▣','Total Inflows',money(income),'Monthly estimate'],['↘','Total Outflows',money(spend+bills),'Expenses + tracked obligations'],['▥','Net Cash Flow',money(income-spend-bills),'Illustrative'],['◷','Projected Closing Balance',money(cash+income-spend-bills),'Unverified projection']])+
'<div class="cf-toolbar">'+tabs(['Daily','Weekly','Monthly','Yearly'],v.cashTab,'cashTab')+bc('Previous','cashPrev')+bc('Next','cashNext')+nav('Forecast & Runway',33,'green')+'</div>'+
'<div class="cf-grid"><section class="cf-panel cf-col2"><div class="cf-head"><h2>Cash Flow Timeline</h2>'+bc('Current Month','cashToday')+'</div>'+graph('split',12)+'<div class="cf-legend">🟢 Inflows　🔴 Outflows　🟦 Closing Balance</div></section>'+
panel('Account Balance Projection',graph('area',8))+
panel('Upcoming Inflows',cashTable('Income'))+
panel('Upcoming Outflows',cashTable('Expense'))+
panel('Cash Flow Insights',alertPanelContent())+
panel('Daily Cash Flow Summary',table(['Day','Inflow','Outflow','Net'],Array.from({length:9},(_,i)=>'<tr><td>Oct '+(16+i)+'</td><td>'+money(8000+i*800)+'</td><td>'+money(3500+i*360)+'</td><td>'+money(4500+i*440)+'</td></tr>')))+
panel('Cash Flow Distribution',donut([['Income',income],['Bills',bills],['Expenses',spend]],income+bills+spend))+
panel('Upcoming Financial Obligations',state().bills.filter(x=>x.status!=='Paid').slice(0,5).map(b=>row('◷',b.name,b.due,money(b.amount),'bill:'+b.id)).join(''))+'</div>')}
function scenarioControls(){
const s=state().scenario;
return '<form data-cfform="scenario" class="cf-form"><div class="cf-fields"><label class="cf-label">Income Growth (% per month)<input class="cfinput" name="incomeGrowth" type="number" min="-50" max="100" value="'+s.incomeGrowth+'" required></label><label class="cf-label">Expense Growth (% per month)<input class="cfinput" name="expenseGrowth" type="number" min="-50" max="100" value="'+s.expenseGrowth+'" required></label><label class="cf-label">Forecast horizon<select class="cf-select" name="horizon">'+[3,6,9,12].map(n=>'<option '+(s.horizon===n?'selected':'')+' value="'+n+'">'+n+' months</option>').join('')+'</select></label><label class="cf-label">Minimum Buffer (KES)<input class="cfinput" name="minimum" type="number" min="0" value="'+s.minimum+'"></label></div><button class="cf-btn green" type="submit">Recalculate Forecast</button></form>'
}
function screen33(){
const projections=forecastData(),last=projections.at(-1),low=Math.min(...projections.map(x=>x.cash)),breach=projections.filter(x=>x.cash<state().scenario.minimum);
const base=ctx.model.accounts.slice(0,3).reduce((n,x)=>n+Number(x[1]),0);
return shell(33,metric([['▣','Current Cash Position',money(base),'Manual personal accounts'],['▥','Projected Ending Balance',money(last.cash),'Selected horizon'],['✓','Runway Indicator',breach.length?'Needs attention':'Within buffer',breach.length+' forecast breaches'],['◈','Cash Flow Headroom',money(Math.max(0,low-state().scenario.minimum)),'Worst projected period']])+
'<div class="cf-grid"><section class="cf-panel cf-col2"><div class="cf-head"><h2>Cash Flow Forecast (Next '+state().scenario.horizon+' Months)</h2>'+bc('Export Forecast','forecastExport')+'</div>'+graph('split',12)+'<div class="cf-legend">🟩 Projected inflow　🟥 Outflow　🟦 Ending balance</div></section>'+
panel('Financial Runway Projection',graph('area',9)+mtext('Assumes all planned income arrives and obligations are paid.'))+
panel('Projected Income & Expenses',table(['Month','Income','Expenses','Bills','Net','Cash Balance'],projections.map(x=>'<tr><td>'+safe(x.month)+'</td><td>'+money(x.income)+'</td><td>'+money(x.expenses)+'</td><td>'+money(x.obligations)+'</td><td>'+money(x.net)+'</td><td>'+money(x.cash)+'</td></tr>')))+
panel('Forecast Scenarios',tabs(['Baseline','Conservative','Optimistic'],v.forecastScenario,'scenario')+scenarioControls())+
panel('Runway & Risk Analysis',row('⚑','Months below cash buffer','Minimum '+money(state().scenario.minimum),breach.length+' months')+
row('◷','Lowest projected balance','Across this scenario',money(low))+row('✓','Emergency Reserve Goal','Plan ahead',money(state().scenario.buffer))+nav('Recovery Plan',34,'green'))+
panel('Cash Flow Distribution',donut([['Income',vals()],['Bills',outstanding()],['Expenses',monthExpenses()]],vals()+outstanding()+monthExpenses()))+
panel('Upcoming Obligations',state().bills.filter(x=>x.status!=='Paid').slice(0,5).map(b=>row('▣',b.name,b.due,money(b.amount))).join(''))+
panel('Financial Insights',alertPanelContent())+'</div>')}
function screen34(){
const projections=forecastData(),low=Math.min(...projections.map(x=>x.cash)),shortfall=Math.max(0,state().scenario.minimum-low),rec=state().shortfall;
const tasks=[
['Defer non-essential purchases','Review discretionary purchases','defer'],
['Collect outstanding receivables','Confirm expected client invoices','collect'],
['Reduce short-term expenses','Review category spending','reduce'],
['Protect minimum cash buffer','Keep essential obligations funded','buffer'],
['Review subscription spend','Pause unused recurring services','subscriptions'],
['Reforecast weekly','Update actual financial assumptions','forecast']
];
return shell(34,metric([['⚑','Projected Cash Shortfall',money(shortfall),'Forecast, not bank verified'],['▦','Time to Risk',projections.findIndex(x=>x.cash<state().scenario.minimum)>=0?(projections.findIndex(x=>x.cash<state().scenario.minimum)+1)+' months':'No breach','Scenario dependent'],['↘','Recovery Target',money(rec.target),'Manually chosen'],['◈','Current Cash',money(ctx.model.accounts.slice(0,3).reduce((n,x)=>n+Number(x[1]),0)),'Demo accounts']])+
'<div class="cf-grid"><section class="cf-panel cf-col2"><div class="cf-head"><h2>Cash Position & Shortfall Forecast</h2>'+nav('Full Forecast',33)+'</div>'+graph('split',12)+mtext('Projected numbers are estimates. Unrecorded commitments and delayed income affect runway.',shortfall?'danger':'')+'</section>'+
panel('Shortfall Distribution',donut([['Bills',outstanding()],['Housing',80000],['Utilities',11300],['Other',21000]],outstanding()+112300))+
panel('Primary Shortfall Drivers',state().bills.filter(x=>x.status!=='Paid').slice(0,6).map(b=>row('⚑',b.name,b.due,money(b.amount))).join(''))+
panel('Emergency Cash Recovery Actions',tasks.map(([name,detail,key])=>'<div class="cf-row"><input type="checkbox" data-cfrecovery="'+safe(key)+'" aria-label="Complete '+safe(name)+'" '+(rec.completed.includes(key)?'checked':'')+'><span class="cf-grow"><b>'+safe(name)+'</b><small>'+safe(detail)+'</small></span>'+tag(rec.completed.includes(key)?'Complete':'Open')+'</div>').join(''))+
panel('Recovery Plan Timeline','<div class="cf-timeline">'+tasks.slice(0,5).map((x,i)=>'<div><b>'+safe(x[0])+'</b><small>Step '+(i+1)+' — review</small></div>').join('')+'</div>')+
panel('Cash Recovery Projection',graph('area',8))+
panel('Recovery Opportunities',alertPanelContent())+
panel('Financial Recovery Settings','<form data-cfform="recovery" class="cf-form"><label class="cf-label">Recovery Target (KES)<input name="target" class="cfinput" type="number" min="0" value="'+rec.target+'"></label><label class="cf-label">Notes<input name="notes" class="cfinput" value="'+safe(rec.notes)+'"></label><button class="cf-btn green" type="submit">Save Recovery Plan</button></form>')+
panel('Recovery Progress','<div class="cf-health" style="--p:'+Math.round(rec.completed.length/tasks.length*100)+'%"><div><b>'+Math.round(rec.completed.length/tasks.length*100)+'%</b><small>Tasks reviewed</small></div></div>'+nav('Forecast Cash Flow',33))+'</div>')}


function modal(){
if(!v.modal)return '';
let title='',form='';
if(v.modal==='income'){const x=state().incomes.find(s=>s.id===v.incomeDetail);title=x?'Edit Income Source':'New Income Source';
form='<form class="cf-form" data-cfform="income">'+
'<label class="cf-label">Name<input class="cfinput" required name="name" value="'+safe(x?.name||'')+'"></label>'+
'<label class="cf-label">Monthly amount (KES)<input class="cfinput" required type="number" min="0" name="amount" value="'+(x?.amount||0)+'"></label>'+
'<label class="cf-label">Category<select class="cf-select" name="category">'+['Business Income','Freelance','Investments','Property','Other'].map(c=>'<option '+(x?.category===c?'selected':'')+'>'+c+'</option>').join('')+'</select></label>'+
'<label class="cf-label">Frequency<select class="cf-select" name="frequency">'+['Monthly','Weekly','Variable','Quarterly'].map(c=>'<option '+(x?.frequency===c?'selected':'')+'>'+c+'</option>').join('')+'</select></label>'+
'<label class="cf-label">Expected receipt date<input type="date" class="cfinput" name="expected" value="'+safe(x?.expected||'2026-11-20')+'"></label>'+
'<button type="submit" class="cf-btn green">Save Income Source</button></form>';
}else if(v.modal==='bill'){const b=state().bills.find(x=>x.id===v.editBillId);title=b?'Edit Bill':'Add Bill';
form='<form data-cfform="bill" class="cf-form">'+
'<label class="cf-label">Bill name<input class="cfinput" name="name" required value="'+safe(b?.name||'')+'"></label>'+
'<label class="cf-label">Amount (KES)<input class="cfinput" name="amount" type="number" required min="0" value="'+(b?.amount||0)+'"></label>'+
'<label class="cf-label">Category<select class="cf-select" name="category">'+['Housing','Utilities','Business','Insurance','Subscriptions','Other'].map(c=>'<option '+(b?.category===c?'selected':'')+'>'+c+'</option>').join('')+'</select></label>'+
'<label class="cf-label">Due date<input name="due" type="date" class="cfinput" required value="'+safe(b?.due||'2026-11-30')+'"></label>'+
'<label class="cf-label">Payment account<select class="cf-select" name="account">'+ctx.model.accounts.map(x=>'<option>'+safe(x[0])+'</option>').join('')+'</select></label>'+
'<button class="cf-btn green" type="submit">Save Bill</button></form>'
}else{title=v.modal;form='<p class="cf-muted">Demonstration-only action. No external financial provider or authenticated document storage is connected.</p>'}
return '<div class="cf-dialog-backdrop"><div role="dialog" aria-modal="true" class="cf-dialog" aria-label="'+safe(title)+'"><div class="cf-head"><h2>'+safe(title)+'</h2>'+bc('Close','closeModal')+'</div>'+form+'</div></div>'
}
function download(name,headers,records){
const csv=[headers,...records].map(row=>row.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\r\n');
const blob=new Blob([csv],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500)}
function render(n){switch(Number(n)){case 27:return screen27();case 28:return screen28();case 29:return screen29();case 30:return screen30();case 31:return screen31();case 32:return screen32();case 33:return screen33();case 34:return screen34();default:return ''}}
function click(e){
const element=e.target.closest?.('[data-cfa],[data-cfnav]');if(!element)return false;
if(element.dataset.cfnav){e.preventDefault();go(element.dataset.cfnav);return true}
const raw=element.dataset.cfa,name=raw.split(':')[0],arg=raw.slice(name.length+1);v.notice='';
switch(name){
 case 'reference':location.href='index.html#screen/'+ctx.screen();break;
 case 'tab':{const i=arg.indexOf(':'),key=arg.slice(0,i),val=arg.slice(i+1);
   if(key==='incomeType')v.incomeType=val;
   else if(key==='billTab'){v.billTab=val;v.billFilter=['All Bills','Recurring','One-off','Insurance','Taxes'].includes(val)?'All':val}
   else if(key==='billDetailTab')v.billDetailTab=val;
   else if(key==='cashTab')v.cashTab=val;
   else if(key==='scenario'){v.forecastScenario=val;const growth={Baseline:[5,3],Conservative:[-8,7],Optimistic:[12,2]};let g=growth[val]||[5,3];state().scenario.incomeGrowth=g[0];state().scenario.expenseGrowth=g[1]}
   save();break}
 case 'income':v.incomeDetail=arg;v.modal='income';save();break;
 case 'newIncome':v.incomeDetail=null;v.modal='income';save();break;
 case 'newBill':v.editBillId=null;v.modal='bill';save();break;
 case 'bill':v.billId=arg;go(31);break;
 case 'billSettings':v.editBillId=v.billId;v.modal='bill';save();break;
 case 'billPdf':v.modal='PDF bill generation requires a verified statement or uploaded document; no real statement exists in this demo.';save();break;
 case 'billReminder':bill().reminder=!bill().reminder;save('Bill reminder '+(bill().reminder?'enabled':'disabled')+' in browser state. No actual notification service is connected.');break;
 case 'billAutopay':bill().autopay=!bill().autopay;save('Automatic payment preference stored locally only. No automatic bank payments will run.');break;
 case 'payMode':v.paymentMode=arg;save();break;
 case 'receipt':v.modal='The simulated payment receipt is a local demonstration; a provider receipt does not exist.';save();break;
 case 'incomeExport':download('finance-os-income-demo.csv',['Source','Category','Amount','Frequency','Expected Date'],state().incomes.map(s=>[s.name,s.category,s.amount,s.frequency,s.expected]));save('Income CSV exported.');break;
 case 'billExport':download('finance-os-bills-demo.csv',['Bill','Category','Amount','Due','Status'],state().bills.map(b=>[b.name,b.category,b.amount,b.due,b.status]));save('Bill summary CSV exported.');break;
 case 'forecastExport':download('finance-os-cash-forecast-demo.csv',['Month','Income','Expenses','Bills','Net','Projected Cash'],forecastData().map(x=>[x.month,x.income,x.expenses,x.obligations,x.net,x.cash]));save('Forecast CSV exported.');break;
 case 'calendarDay':v.selectedDate='2026-10-'+String(arg).padStart(2,'0');save('Selected '+v.selectedDate+' on payment calendar.');break;
 case 'cashPrev':case 'cashNext':case 'cashToday':save('Timeline view updated; reference chart uses illustrative month data.');break;
 case 'period':save('This reference view displays a representative multi-month scenario.');break;
 case 'closeModal':v.modal=null;save();break;
 default:v.modal='Not connected to a live financial provider.';save();break;
}
return true
}
function change(e){
const el=e.target;if(!el.dataset?.cfchange)return false;
if(el.dataset.cfchange==='incomeType')v.incomeType=el.value;
if(el.dataset.cfchange==='billFilter')v.billFilter=el.value;
save();return true
}
function input(e){
const el=e.target,key=el.dataset?.cfsearch;if(!key)return false;
if(key==='income')v.incomeSearch=el.value;
if(key==='bill')v.billSearch=el.value;
const pos=el.selectionStart;ctx.render();
const found=$('[data-cfsearch="'+key+'"]');if(found){found.focus();found.setSelectionRange(pos,pos)}
return true;
}

function mirrorLegacyIncome(record,formerName){
 const entries=ctx.model.incomes;
 if(!Array.isArray(entries))return;
 let prior=entries.find(x=>x[0]===formerName||x[0]===record.name);
 if(prior){prior[0]=record.name;prior[1]=record.amount}
 else entries.push([record.name,record.amount]);
}
function mirrorLegacyBill(record,formerName){
 const entries=ctx.model.bills;
 if(!Array.isArray(entries))return;
 let prior=entries.find(x=>x[0]===formerName||x[0]===record.name);
 if(prior){prior[0]=record.name;prior[1]=record.due;prior[2]=record.amount;prior[3]=record.status}
 else entries.push([record.name,record.due,record.amount,record.status]);
}

function submit(e){
const form=e.target;if(!form.dataset?.cfform)return false;
e.preventDefault();
const d=Object.fromEntries(new FormData(form));
switch(form.dataset.cfform){
 case 'income':{
  const amount=Number(d.amount),name=String(d.name||'').trim();if(!name||!Number.isFinite(amount)||amount<0){save('Provide a valid income amount and source.');break}
  const exists=state().incomes.find(x=>x.id===v.incomeDetail);
  const record={name,amount,category:d.category,frequency:d.frequency,expected:d.expected,account:'KCB Main Account',status:'Active'};
  const formerName=exists?.name;
  if(exists)Object.assign(exists,record);
  else state().incomes.push({id:'inc-'+Date.now(),previous:0,growth:0,...record});
  mirrorLegacyIncome(record,formerName);
  v.modal=null;save('Income source saved to local financial planning records.');break}
 case 'bill':{
  let amount=Number(d.amount),name=String(d.name||'').trim();if(!name||!Number.isFinite(amount)||amount<0){save('Provide a valid bill and amount.');break}
  let exists=state().bills.find(x=>x.id===v.editBillId);
  const record={name,amount,due:d.due,category:d.category,account:d.account,status:exists?.status||'Upcoming',customer:exists?.customer||'MANUAL',period:'Manual',previous:exists?.previous||amount,reminder:exists?.reminder??false,autopay:exists?.autopay??false};
  const formerName=exists?.name;
  if(exists)Object.assign(exists,record);else state().bills.push({id:'bill-'+Date.now(),...record});
  mirrorLegacyBill(record,formerName);
  v.modal=null;save('Bill saved to local demonstration obligations.');break}
 case 'payBill':{
  const b=bill(),amount=Number(d.amount),destination=String(d.destination||'').trim();
  if(!(amount>0)||amount>b.amount||!destination||b.status==='Paid'){save('Enter a valid payment amount for an unpaid bill.');break}
  state().paymentHistory.push({id:'payment-'+Date.now(),billId:b.id,date:'2026-10-30',amount,method:v.paymentMode,reference:'DEMO-ONLY'});
  b.amount=Math.max(0,b.amount-amount);if(b.amount===0)b.status='Paid';
  mirrorLegacyBill(b,b.name);
  // Do not debit cash or assert provider settlement without an authorized payment allocation.
  save('Simulated payment recorded locally. This is NOT a completed bank or M-Pesa payment.');break}
 case 'scenario':{
  for(const key of ['incomeGrowth','expenseGrowth','minimum','horizon']){const val=Number(d[key]);if(!Number.isFinite(val)){save('Enter valid forecast assumptions.');return true}state().scenario[key]=val}
  save('Forecast recalculated using updated assumptions.');break}
 case 'recovery':{
  const val=Number(d.target);if(val<0||!Number.isFinite(val)){save('Enter a non-negative recovery target.');break}
  state().shortfall.target=val;state().shortfall.notes=String(d.notes||'');save('Recovery plan saved locally.');break}
}
return true
}
function onChange(e){
const el=e.target;if(!el.matches?.('[data-cfrecovery]'))return false;
const list=new Set(state().shortfall.completed);if(el.checked)list.add(el.dataset.cfrecovery);else list.delete(el.dataset.cfrecovery);
state().shortfall.completed=[...list];save('Recovery progress saved locally.');return true
}
window.FinanceIncomeFlow={init,render,click,change,input,submit,onChange};

})();