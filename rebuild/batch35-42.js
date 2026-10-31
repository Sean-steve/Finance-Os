
(()=>{
'use strict';
let ctx;
const $=s=>document.querySelector(s),safe=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const cash=x=>'KES '+Math.abs(Math.round(Number(x)||0)).toLocaleString('en-KE');
const count=x=>Number(x||0).toLocaleString('en-KE');
const percent=(x,y)=>Math.round(Number(x||0)/Math.max(1,Number(y||0))*100);
const names={
35:['Capital Allocation Command Centre','Allocate your capital intentionally. Balance growth, security and liquidity across your financial goals.'],
36:['Allocation Rules & Money Buckets','Automate how your money is distributed. Create rules, manage buckets and stay aligned with your financial goals.'],
37:['Savings & Financial Goals','Turn your dreams into reality! Set goals, track progress and build a more secure financial future.'],
38:['Goal Details & Funding','Track progress, manage funding and take actions to reach your goal faster.'],
39:['Emergency Fund Management','Build and protect your financial safety net. Stay prepared for life’s unexpected events.'],
40:['Affordability & Purchase Simulator','Plan big purchases with confidence. See what you can afford, compare options, and understand the long-term impact.'],
41:['Funding Requests & Approvals','Request, review and approve funding for your personal and business goals. Keep your spending aligned with priorities.'],
42:['Financial Scenario Planning','Model different futures, make smarter decisions, and stay in control of your financial goals.']
};
const swatches=['#12b88b','#258ffd','#a95cf0','#ffae26','#f55370','#aebbc9','#ea8445','#536f8d'];
const seedBuckets=[
{id:'essential',name:'Essentials',icon:'⌂',share:30,goal:120000,amount:115000,kind:'Living',active:true},
{id:'investments',name:'Investments',icon:'▥',share:20,goal:85000,amount:76800,kind:'Growth',active:true},
{id:'emergency',name:'Emergency Fund',icon:'◆',share:10,goal:40000,amount:38400,kind:'Protection',active:true},
{id:'goals',name:'Goals',icon:'◎',share:10,goal:50000,amount:38400,kind:'Saving',active:true},
{id:'debt',name:'Debt Repayment',icon:'▣',share:10,goal:40000,amount:38400,kind:'Obligations',active:true},
{id:'sinking',name:'Sinking Funds',icon:'▥',share:8,goal:40000,amount:30700,kind:'Provisioning',active:true},
{id:'lifestyle',name:'Lifestyle',icon:'♬',share:8,goal:40000,amount:30700,kind:'Discretionary',active:true},
{id:'giving',name:'Giving',icon:'♥',share:4,goal:20000,amount:15400,kind:'Giving',active:true}
];
const seedRules=[
{id:'r1',name:'Primary Income Allocation',trigger:'When income received',share:70,bucket:'Essentials',active:true},
{id:'r2',name:'Investment Auto-Save',trigger:'When income received',share:20,bucket:'Investments',active:true},
{id:'r3',name:'Emergency Fund Build',trigger:'When income received',share:10,bucket:'Emergency Fund',active:true},
{id:'r4',name:'Freelance Income Split',trigger:'When income received',share:50,bucket:'Goals',active:true},
{id:'r5',name:'Windfall Allocation',trigger:'When amount > KES 100,000',share:60,bucket:'Investments',active:true}
];
const additionalGoals=[
{id:'g-house',name:'Buy a House',icon:'⌂',saved:750000,target:2500000,monthly:45000,deadline:'2029-01-01',category:'Housing'},
{id:'g-education',name:'Education',icon:'🎓',saved:120000,target:400000,monthly:11000,deadline:'2028-09-01',category:'Education'},
{id:'g-travel',name:'Travel the World',icon:'✈',saved:70000,target:500000,monthly:10000,deadline:'2028-05-01',category:'Travel'},
{id:'g-business',name:'Grow Business',icon:'▥',saved:320000,target:1500000,monthly:30000,deadline:'2028-12-01',category:'Business'}
];
const demoRequests=[
{id:'q1',title:'Business Capital',category:'Business',amount:250000,date:'2026-10-20',owner:'Steve Nyaga',status:'Pending',justification:'Increase operational capacity'},
{id:'q2',title:'House Repair',category:'Housing',amount:85000,date:'2026-10-18',owner:'Steve Nyaga',status:'Pending',justification:'Essential property maintenance'},
{id:'q3',title:'Education Fees',category:'Education',amount:120000,date:'2026-10-16',owner:'Steve Nyaga',status:'Approved',justification:'Planned learning investment'},
{id:'q4',title:'Laptop & Equipment',category:'Business',amount:150000,date:'2026-10-14',owner:'Steve Nyaga',status:'Approved',justification:'Necessary business equipment'},
{id:'q5',title:'Health Cover',category:'Health',amount:50000,date:'2026-10-12',owner:'Steve Nyaga',status:'Pending',justification:'Insurance top-up'},
{id:'q6',title:'Family Travel',category:'Travel',amount:70000,date:'2026-10-11',owner:'Steve Nyaga',status:'Rejected',justification:'Optional travel budget'}
];
const initial=()=>({
 buckets:structuredClone(seedBuckets),rules:structuredClone(seedRules),
 goals:[],selectedGoal:'g-house',goalFunding:[],allocationHistory:[
 {date:'2026-10-20',source:'Salary',amount:425000,status:'Allocated'},
 {date:'2026-10-15',source:'Freelance Project',amount:120000,status:'Allocated'},
 {date:'2026-10-10',source:'Business',amount:250000,status:'Allocated'}],
 automationPaused:false,
 emergency:{target:850000,monthly:25000,withdrawals:[],contributions:[],isProtected:true},
 purchase:{type:'Car',price:3500000,down:700000,interest:13.5,term:60,costs:200000},
 purchaseSaved:[],
 requests:structuredClone(demoRequests),requestHistory:[],
 scenario:{incomeGrowth:5,expenseGrowth:3,investmentReturn:8,savingsRate:15,horizon:12,scenario:'Balanced'},
 savedScenarios:[],capitalStrategy:{growth:40,stability:35,opportunity:25}
});
let ui={tab:{},notice:'',modal:null,goal:'g-house',bucket:'essential',rule:'r1',request:'q1',purchaseType:'Car',sourcing:'0',status:'All',goalFilter:'All',screen:35};
function state(){return ctx.model.capitalV2}
function syncGoals(){
const g=state().goals;
for(const goal of g){const previous=ctx.model.goals.find(x=>x[0]===goal.name);
 if(previous){previous[1]=goal.saved;previous[2]=goal.target}
 else ctx.model.goals.push([goal.name,goal.saved,goal.target]);}
}
function init(bridge){
 ctx=bridge;
 if(!ctx.model.capitalV2){const d=initial();
  d.goals=ctx.model.goals.map((g,i)=>({id:'legacy-'+i,name:g[0],saved:Number(g[1]),target:Number(g[2]),monthly:12000,icon:['🚙','⌂','◆','▥'][i%4],deadline:'2028-12-01',category:'Personal'}));
  for(const x of additionalGoals)if(!d.goals.some(g=>g.name===x.name))d.goals.push(structuredClone(x));
  ctx.model.capitalV2=d;ctx.save();
 }
 const s=state();if(!s.buckets)s.buckets=structuredClone(seedBuckets);
 if(!s.goals)s.goals=structuredClone(additionalGoals);
 if(!s.requests)s.requests=structuredClone(demoRequests);
 ui.goal=s.selectedGoal||'g-house';
}
const store=(message='')=>{ui.notice=message;ctx.save();ctx.render()};
const navigate=n=>ctx.navigate(Number(n));
const tabValue=(n,d)=>ui.tab[n]||d;
const act=(label,key,style='')=>'<button type="button" data-cap="'+safe(key)+'" class="cap-btn '+style+'">'+safe(label)+'</button>';
const goto=(label,n,style='')=>'<button type="button" class="cap-btn '+style+'" data-capnav="'+n+'">'+safe(label)+'</button>';
const pill=(s,c='')=>'<span class="cap-pill '+c+'">'+safe(s)+'</span>';
const progress=(current,target,color='#11ac80')=>'<div class="cap-progress" style="--p:'+Math.max(0,Math.min(100,percent(current,target)))+'%;--c:'+color+'"><i></i></div>';
const icon=(s)=>'<span class="cap-ic">'+safe(s)+'</span>';
const row=(ic,name,caption,value='',command='')=>'<div class="cap-row">'+icon(ic)+'<span class="grow"><b>'+safe(name)+'</b><small>'+safe(caption)+'</small></span>'+(value?'<strong>'+safe(value)+'</strong>':'')+(command?act('›',command,'tiny'):'')+'</div>';
const panel=(title,html,control='')=>'<section class="cap-panel"><div class="cap-panel-head"><h2>'+safe(title)+'</h2><div class="cap-actions">'+control+'</div></div>'+html+'</section>';
const metrics=(items)=>'<div class="cap-kpis">'+items.map(([i,label,value,sub])=>'<div class="cap-kpi"><span class="ico">'+i+'</span><div><small>'+safe(label)+'</small><b>'+safe(value)+'</b><em>'+safe(sub)+'</em></div></div>').join('')+'</div>';
const tabs=(n,all,selected)=>'<div class="cap-tabs">'+all.map(t=>'<button type="button" data-cap="tab:'+n+':'+safe(t)+'" class="'+(t===selected?'active':'')+'">'+safe(t)+'</button>').join('')+'</div>';
const table=(cols,rows)=>'<div class="cap-tablewrap"><table class="cap-table"><thead><tr>'+cols.map(x=>'<th>'+safe(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
const label=(name,key,value,type='text',extra='')=>'<label class="cap-field">'+safe(name)+'<input name="'+key+'" class="cap-input" type="'+type+'" '+extra+' value="'+safe(value)+'"></label>';
const sel=(name,key,options,current)=>'<label class="cap-field">'+safe(name)+'<select name="'+key+'" class="cap-select">'+options.map(x=>'<option '+(x===current?'selected':'')+'>'+safe(x)+'</option>').join('')+'</select></label>';
function lineGraph(n=10,color='#17b585'){let d='';for(let i=0;i<n;i++){let x=18+i*410/(n-1),y=94-i*5+Math.sin(i*1.4)*8;d+=(i?'L':'M')+x.toFixed(1)+' '+y.toFixed(1)+' '}
return '<svg class="cap-lineplot" viewBox="0 0 455 130" role="img" aria-label="Illustrative financial trend">'+[20,50,80,110].map(y=>'<line x1="0" x2="455" y1="'+y+'" y2="'+y+'" stroke="#e9f0eb"/>').join('')+'<path d="'+d+'" fill="none" stroke="'+color+'" stroke-width="3"/></svg>'}
function barGraph(items,grouped=false){
let svg='<svg class="cap-barplot" viewBox="0 0 455 145" role="img" aria-label="Illustrative monthly allocation chart">'+[25,65,105].map(y=>'<line x1="15" x2="440" y1="'+y+'" y2="'+y+'" stroke="#e9efec"/>').join('');
items.slice(0,12).forEach((x,i)=>{let y=125-Math.max(12,Math.min(96,Number(x.value||0))),w=grouped?13:24,p=26+i*400/items.length;
 svg+='<rect x="'+p+'" y="'+y+'" width="'+w+'" height="'+(125-y)+'" rx="2" fill="'+swatches[i%swatches.length]+'"/>';
 if(grouped)svg+='<rect x="'+(p+15)+'" y="'+(y+16)+'" width="11" height="'+(125-y-16)+'" rx="2" fill="#7bb9dc"/>';
 svg+='<text x="'+p+'" y="141" font-size="9" fill="#7b898f">'+safe(x.name).slice(0,4)+'</text>'});
return svg+'</svg>'}
function donut(sectors,total){
let sum=sectors.reduce((a,x)=>a+Number(x.value),0)||1,position=0,parts=[];
for(let i=0;i<sectors.length;i++){const end=position+sectors[i].value/sum*100;parts.push(swatches[i%swatches.length]+' '+position.toFixed(2)+'% '+end.toFixed(2)+'%');position=end}
return '<div class="cap-donut-flex"><div class="cap-donut" style="background:conic-gradient('+parts.join(',')+')"><div class="hole"><strong>'+cash(total)+'</strong><small>Allocated</small></div></div><div class="cap-legend">'+sectors.map((x,i)=>'<div class="cap-row"><i class="cap-dot" style="--c:'+swatches[i%swatches.length]+'"></i><span class="grow">'+safe(x.name)+'</span><span>'+percent(x.value,sum)+'%</span><strong>'+cash(x.value)+'</strong></div>').join('')+'</div></div>'}
function info(){return '<div class="cap-note">Local prototype only: all values, provider connections, automatic allocations and approvals are illustrative. No real funds move.</div>'}
function shell(n,content){
 ui.screen=n;const [title,description]=names[n];
 return '<div class="cap-page"><section class="banner"><div><div class="banner-date">'+(n===40?'Goals':n===42?'Planning':n===41?'Goals　›　Funding Requests & Approvals':'Capital & Investing')+'　›　'+safe(title)+'</div><h1>'+safe(title)+'</h1><p>'+safe(description)+'</p></div><div class="banner-quote">“Make every shilling<br>work for a brighter<br>tomorrow.”</div></section><div class="cap-inner">'+(ui.notice?'<div role="status" class="cap-note">'+safe(ui.notice)+'</div>':'')+content+'<p class="cap-muted" style="padding:9px 0">Screen '+n+' coded from approved design · Local planning estimates only. '+act('Compare approved design ↗','reference')+'</p></div>'+dialog()+'</div>';
}
const monthlyIncome=()=>ctx.model.incomeFlowV2?.incomes?.filter(x=>x.status==='Active')?.reduce((sum,x)=>sum+Number(x.amount),0)||ctx.model.incomes.reduce((sum,x)=>sum+Number(x[1]),0);
const monthlyCosts=()=>ctx.model.expenses.reduce((sum,x)=>sum+Number(x[1]),0);
const liquid=()=>ctx.model.accounts.filter((x,i)=>i<=2).reduce((sum,x)=>sum+Number(x[1]),0);
const goal=()=>state().goals.find(x=>x.id===ui.goal)||state().goals.find(x=>x.id==='g-house')||state().goals[0];
const emergency=()=>state().goals.find(x=>x.name==='Emergency Fund');


function screen35(){
 const cap=state().capitalSectors||[
 {name:'Investments',value:810000,target:40},{name:'Business Growth',value:470000,target:20},
 {name:'Emergency Fund',value:300000,target:15},{name:'Major Purchases',value:220000,target:10},
 {name:'Debt Repayment',value:170000,target:10},{name:'Cash Reserve',value:160000,target:5}
 ];
 const allocated=cap.reduce((a,x)=>a+x.value,0),total=2480000;
 const allocationRows=[
 ['Equity Portfolio','Investment',450000,20],['Money Market Fund','Investment',180000,10],
 ['SACCO','Savings',220000,10],['Business Capital','Business',470000,20],
 ['Emergency Fund','Savings',300000,15],['Car Purchase Fund','Goal',150000,8],
 ['House Fund','Goal',70000,2],['Cash Wallet','Cash',160000,5]
 ];
 const tabsHtml=tabs(35,['Overview','Allocation','Investments','Debt Allocation','Goals Funding','Liquidity','Scenarios','Optimization','Rules & Policies'],tabValue(35,'Overview'));
 return shell(35,metrics([['🪙','Total Investable Capital',cash(total),'↑ 12% vs last month'],['◕','Allocated Capital',cash(allocated),percent(allocated,total)+'% of investable capital'],['▣','Cash Reserve (Liquidity)',cash(350000),'↑ 14% of total capital'],['▥','Projected Annual Returns',cash(326000),'Illustrative blended return']])+tabsHtml+
 '<div class="cap-grid">'+panel('Capital Allocation Overview',donut(cap,allocated))+
 panel('Allocation vs Target',cap.map((x,i)=>'<div class="cap-row"><span class="grow">'+safe(x.name)+'</span>'+progress(percent(x.value,allocated),x.target,swatches[i%8])+'<small>'+percent(x.value,allocated)+'% / '+x.target+'%</small></div>').join(''))+
 panel('Strategic Allocation',[
 ['◎','Growth','Build long-term wealth through investments and business growth.','40%'],
 ['◆','Stability','Maintain emergency funds and manage debt responsibly.','35%'],
 ['ϟ','Opportunity','Keep liquidity for opportunities and major life goals.','25%']
 ].map(([ic,n,d,p])=>row(ic,n,d,p)).join(''),act('Edit Strategy','editStrategy','tiny'))+
 panel('Capital Allocation by Account',table(['Account','Type','Balance (KES)','Allocation','Target','Status'],allocationRows.map((a,i)=>'<tr><td>'+safe(a[0])+'</td><td>'+safe(a[1])+'</td><td>'+cash(a[2])+'</td><td>'+percent(a[2],allocated)+'%</td><td>'+a[3]+'%</td><td>'+pill(Math.abs(percent(a[2],allocated)-a[3])>2?'Review':'On Track',Math.abs(percent(a[2],allocated)-a[3])>2?'warn':'')+'</td></tr>')),goto('View Accounts',7,'tiny'))+
 panel('Expected Returns (Annual)',barGraph([162,85,28,36,15].map((v,i)=>({name:['Invest','Business','Money','SACCO','Other'][i],value:v/2})))+info())+
 panel('Capital Allocation Actions',[
 ['◎','Rebalance Portfolio','Realign to target allocation','rebalance'],
 ['◆','Fund Emergency Reserve','Top up to 6 months of expenses','emergency'],
 ['↑','Increase Investment Allocation','Move planning share from cash reserve','addInvestment'],
 ['♙','Review Business Capital Needs','Assess upcoming allocations','businessCapital'],
 ['◷','Set Up Automatic Allocation','Review scheduled money buckets','buckets']
 ].map(a=>row(a[0],a[1],a[2],'',a[3])).join(''))+
 panel('Capital Allocation Trend',barGraph(Array.from({length:10},(_,i)=>({name:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct'][i],value:34+i*5})))+
 '<div class="cap-muted">Growth　Investments　Emergency fund　Debt repayment　Cash reserve</div>')+
 panel('Scenario Modelling',[
 ['Conservative','Lower risk, steady growth',cash(178000)],['Balanced','Current strategy',cash(326000)],['Aggressive','Higher risk, higher growth',cash(542000)]
 ].map(x=>row('▥',x[0],x[1],x[2],'scenario')).join(''),goto('View Scenarios',42))+
 panel('AI Insights & Recommendations',[
 ['Increase investment capital','Review whether investing KES 50,000 more fits your goals.'],
 ['Emergency fund buffer','Your reserve target may need another review.'],
 ['Consider market risk','Returns can be negative and are never guaranteed.']
 ].map(x=>row('✦',x[0],x[1])).join(''))+
 '</div>');
}
function screen36(){
 const bs=state().buckets,total=bs.reduce((n,b)=>n+b.amount,0),income=monthlyIncome();
 const targets=bs.map((b,i)=>'<div class="cap-row">'+icon(b.icon)+'<span class="grow"><b>'+safe(b.name)+'</b><small>'+cash(b.amount)+' / '+cash(b.goal)+'</small>'+progress(b.amount,b.goal,swatches[i%8])+'</span><b>'+percent(b.amount,b.goal)+'%</b></div>').join('');
 return shell(36,metrics([['▣','Total Monthly Income',cash(income),'From tracked income sources'],['🪙','Auto-Allocated (Plan)',cash(total),percent(total,income)+'% of income'],['◎','Available to Allocate',cash(Math.max(0,income-total)),'Unallocated planning amount'],['🏆','Active Buckets',String(bs.filter(x=>x.active).length),'Tracked']])+
 tabs(36,['Overview','Allocation Rules','Money Buckets','Automation','Transfers','Exceptions','History','Settings'],tabValue(36,'Overview'))+
 '<div class="cap-grid">'+
 panel('Money Bucket Allocation',donut(bs.map(b=>({name:b.name,value:b.amount})),total))+
 panel('Bucket Targets vs Current',targets)+
 panel('Quick Actions',[
 ['⊕','Create New Money Bucket','newBucket'],['⚙','Set Up Allocation Rule','newRule'],
 ['⇄','Adjust Allocations','adjustBuckets'],['⏸','Pause Automation','pauseAutomation'],
 ['▶','Run Allocation Now','runAllocation'],['▦','View Next Allocation','nextAllocation']
 ].map(([ic,t,cmd])=>row(ic,t,'','',cmd)).join(''))+
 panel('Active Allocation Rules',table(['#','Rule Name','Trigger','Allocation','To Bucket','Status','Action'],state().rules.map((r,i)=>'<tr><td>'+(i+1)+'</td><td>'+safe(r.name)+'</td><td>'+safe(r.trigger)+'</td><td>'+r.share+'%</td><td>'+safe(r.bucket)+'</td><td>'+pill(r.active?'Active':'Paused',r.active?'':'warn')+'</td><td>'+act('Edit','editRule:'+r.id,'tiny')+'</td></tr>')))+
 panel('Money Buckets',targets,goto('View all',36,'tiny'))+
 panel('Rule Templates',[
 ['50/30/20 Rule','Needs 50%, Wants 30%, Save 20%'],
 ['Wealth Builder','Invest 30%, Emergency 20%, Rest 50%'],
 ['Debt Freedom','Prioritize debt repayment'],
 ['Freelancer Income','Split variable income efficiently']
 ].map((x,i)=>row('⚙',x[0],x[1],'','template:'+i)).join(''))+
 panel('Allocation History',table(['Date','Income Source','Amount','Status'],state().allocationHistory.slice(-5).reverse().map(x=>'<tr><td>'+safe(x.date)+'</td><td>'+safe(x.source)+'</td><td>'+cash(x.amount)+'</td><td>'+pill(x.status,x.status==='Allocated'?'':'warn')+'</td></tr>')))+
 panel('Upcoming Allocations',state().incomes?.slice?.(0,5).map(x=>row('▣',x.name,x.expected,cash(x.amount)))?.join('')||
 (ctx.model.incomeFlowV2?.incomes||[]).slice(0,5).map(x=>row('▣',x.name,x.expected,cash(x.amount))).join(''))+
 panel('AI Insights & Recommendations',[
 ['Increase investment allocation','Your investment bucket is slightly below target.'],
 ['Goals funding','Small adjustments can improve goal progress.'],
 ['Automatic allocation','Simulation paused: '+(state().automationPaused?'Yes':'No')]
 ].map(x=>row('✦',x[0],x[1])).join(''))+'</div>');
}
function screen37(){
 const gs=state().goals,goalSum=gs.reduce((a,g)=>a+g.saved,0),target=gs.reduce((a,g)=>a+g.target,0);
 return shell(37,metrics([['◎','Total Savings',cash(goalSum),'Across all tracked goals'],['⚑','Active Goals',String(gs.length),'Savings and milestones'],['🪙','Monthly Savings',cash(gs.reduce((a,g)=>a+g.monthly,0)),'Planned contributions'],['🏆','Goals Achieved',String(gs.filter(g=>g.saved>=g.target).length),'Completed goals']])+
 tabs(37,['Overview','My Goals','Savings Accounts','Milestones','Goal Planning','Auto Save','Insights'],tabValue(37,'Overview'))+
 '<div class="cap-grid">'+panel('Savings Growth',barGraph(Array.from({length:10},(_,i)=>({name:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct'][i],value:28+i*5}))))+
 panel('Goal Allocation',donut(gs.slice(0,6).map(g=>({name:g.name,value:g.saved})),goalSum))+
 panel('Quick Actions',[
 ['⊕','Set a New Goal','newGoal'],['▥','Automate Monthly Savings','autoSave'],
 ['⊕','Top Up a Goal','fundGoal'],['▣','Adjust Goal Target','editGoal'],
 ['↧','Pause Goal','pauseGoal'],['◷','View Goal Simulator','simulator']
 ].map(x=>row(x[0],x[1],'','',x[2])).join(''))+
 '<section class="cap-panel cap-span3"><div class="cap-panel-head"><h2>My Financial Goals</h2>'+act('+ Create Goal','newGoal','primary')+'</div><div class="cap-goal-cards">'+gs.slice(0,8).map((g,i)=>'<button class="cap-goal-card" type="button" data-cap="goal:'+g.id+'"><div class="art">'+safe(g.icon||'◎')+'</div><b>'+safe(g.name)+'</b><small>'+cash(g.saved)+' / '+cash(g.target)+'</small>'+progress(g.saved,g.target,swatches[i%8])+'<small>'+percent(g.saved,g.target)+'% complete</small></button>').join('')+'</div></section>'+
 panel('Upcoming Contributions',gs.slice(0,6).map(g=>row(g.icon||'◎',g.name,'Next planned contribution',cash(g.monthly))).join(''))+
 panel('Savings Milestones',gs.slice(0,6).map(g=>row('✓',g.name,percent(g.saved,g.target)+'% of goal','')).join(''))+
 panel('AI Insights & Recommendations',[
 ['Automate savings','Small monthly transfers can accelerate milestones.'],
 ['Protect emergency savings','Prioritize cash reserves before major commitments.'],
 ['Review goal deadlines','Check contribution feasibility before committing.']
 ].map(x=>row('✦',x[0],x[1])).join(''))+'</div>');
}
function screen38(){
 const g=goal(),percentage=percent(g.saved,g.target),remaining=Math.max(0,g.target-g.saved),contrib=Number(g.monthly||0);
 const projection=remaining/Math.max(1,contrib);
 const selected=tabValue(38,'Overview');
 return shell(38,'<div class="cap-panel" style="margin-bottom:10px;display:flex;align-items:center;gap:15px;flex-wrap:wrap">'+
 icon(g.icon||'◎')+'<div style="flex:1"><b style="font-size:15px">'+safe(g.name)+'</b><small style="display:block;color:#70838d">Personal Goal　·　'+safe(g.deadline||'2028-12-01')+'</small></div>'+
 '<div><small>Target Amount</small><strong style="display:block">'+cash(g.target)+'</strong></div>'+
 '<div><small>Current Saved</small><strong style="display:block">'+cash(g.saved)+'</strong></div>'+
 '<div><small>Remaining Amount</small><strong style="display:block">'+cash(remaining)+'</strong></div></div>'+
 tabs(38,['Overview','Funding','Milestones','Projections','Linked Accounts','Notes & Documents','Settings'],selected)+
 '<div class="cap-grid">'+panel('Progress Overview','<div class="cap-columns"><div class="cap-gauge" style="--p:'+percentage+'%"><div class="inner"><strong>'+percentage+'%</strong><small>'+cash(g.saved)+' saved</small></div></div><div>'+[
 ['Target Amount',g.target],['Current Savings',g.saved],['Remaining',remaining],['Monthly Target',contrib]
 ].map(x=>row('▥',x[0],'',cash(x[1]))).join('')+'</div></div>')+
 panel('Funding Progress',lineGraph(10)+row('↑','Projected Completion',Math.ceil(projection)+' months at current contribution',cash(g.target)))+
 panel('Quick Funding Actions','<form class="cap-form" data-capform="fundGoal">'+
 label('Funding amount (KES)','amount',Math.min(10000,remaining),'number','min="1" required')+
 sel('Funding account','account',ctx.model.accounts.slice(0,3).map(a=>a[0]),ctx.model.accounts[0][0])+
 '<button class="cap-btn primary" type="submit">Simulate Goal Contribution</button></form>'+
 '<div class="cap-note">Simulated internal transfer. Account cash decreases; goal savings increase. No bank transfer occurs.</div>')+
 panel('Milestones',[
 [25,'First Quarter'],[50,'Halfway There'],[75,'Three Quarters'],[100,'Goal Complete']
 ].map(([p,n])=>'<div class="cap-row">'+icon(percentage>=p?'✓':'◷')+'<span class="grow"><b>'+n+'</b><small>Milestone '+p+'% of target</small></span>'+pill(percentage>=p?'Completed':'Upcoming',percentage>=p?'':'warn')+'</div>').join(''))+
 panel('Funding Breakdown',donut([{name:'Accumulated',value:g.saved},{name:'Remaining',value:remaining}],g.target))+
 panel('Goal Insights',row('◆','Keep saving consistently','Monthly plan '+cash(contrib))+row('◷','Estimated timeline','Rough estimate: '+Math.ceil(projection)+' months')+row('◎','Protect essential reserves','Do not fund from money needed for near-term bills.'))+
 panel('Recent Contributions',table(['Date','Amount','Source','Type'],state().goalFunding.filter(x=>x.goalId===g.id).slice(-6).reverse().map(x=>'<tr><td>'+safe(x.date)+'</td><td>'+cash(x.amount)+'</td><td>'+safe(x.account)+'</td><td>Demo transfer</td></tr>')))+
 panel('Projection & Scenarios',lineGraph(8)+goto('View Scenario Planning',42))+
 panel('Documents & Notes','<div class="cap-note warn">No real document vault is connected. Do not upload sensitive financial documents into this demo.</div>')+
 '</div>');
}


function screen39(){
 const eg=emergency(),cfg=state().emergency;
 const current=eg?.saved||0,target=Number(cfg.target),coverage=monthlyCosts()>0?(current/monthlyCosts()).toFixed(1):0;
 return shell(39,metrics([['◆','Current Emergency Fund',cash(current),'↑ 12% vs last month'],['◎','Target Amount',cash(target),percent(current,target)+'% complete'],['▦','Months Covered',coverage+' months','of 6 recommended months'],['☂','Recommended Target',cash(monthlyCosts()*6),'6 months of essential costs']])+
 tabs(39,['Overview','Contributions','Target & Coverage','Account & Allocation','Withdrawals','History','Settings'],tabValue(39,'Overview'))+
 '<div class="cap-grid">'+
 panel('Emergency Fund Progress','<div class="cap-donut-flex"><div class="cap-gauge" style="--p:'+percent(current,target)+'%"><div class="inner"><strong>'+percent(current,target)+'%</strong><small>'+cash(current)+' saved</small></div></div><div class="cap-legend">'+row('◆','Current Balance','',cash(current))+row('◎','Target Amount','',cash(target))+row('▣','Recommended','',cash(monthlyCosts()*6))+'</div></div>')+
 panel('Emergency Fund Growth',lineGraph(9)+row('↑','Monthly Planned Saving','Contribution target',cash(cfg.monthly)))+
 panel('Quick Actions',[
 ['⊕','Add Contribution','Fund your emergency savings','fundEmergency'],
 ['◎','Set / Edit Target','Define your cash reserve goal','editEmergency'],
 ['↗','Adjust Target Amount','Review your reserve needs','editEmergency'],
 ['▧','Make a Withdrawal','Simulate an emergency withdrawal','withdrawEmergency'],
 ['⌂','Pause Contributions','Change planned contributions','pauseEmergency']
 ].map(x=>row(x[0],x[1],x[2],'',x[3])).join(''))+
 panel('Coverage Analysis','<div class="cap-columns">'+[
 ['Housing',80000],['Food & Groceries',40000],['Utilities',15000],['Transport',30000]
 ].map(([x,n])=>row('▥',x,'Estimate of monthly needs',cash(n))).join('')+'</div>'+
 '<h3>Coverage by Month</h3>'+[1,2,3,4,5,6].map(n=>'<div class="cap-row"><b>Month '+n+'</b><span class="grow">'+progress(current,monthlyCosts()*n,n*monthlyCosts()<=current?'#0daf77':'#c9aa51')+'</span>'+pill(current>=n*monthlyCosts()?'Covered':'Target',current>=n*monthlyCosts()?'':'warn')+'</div>').join(''))+
 panel('Monthly Contributions',barGraph(Array.from({length:8},(_,i)=>({name:['Mar','Apr','May','Jun','Jul','Aug','Sep','Oct'][i],value:35+i*6})))+
 row('▥','Planned Contribution','Next recurring month',cash(cfg.monthly)))+
 panel('Emergency Fund Insights',[
 ['Emergency fund target','Protect cash for unexpected obligations.'],
 ['Savings coverage','Verify essential expenses to estimate coverage.'],
 ['Funding consistency','Monthly contributions may improve resilience.']
 ].map(x=>row('✦',x[0],x[1])).join(''))+
 panel('Recent Contributions',table(['Date','Amount','From Account','Status'],cfg.contributions.slice(-6).reverse().map(x=>'<tr><td>'+safe(x.date)+'</td><td>'+cash(x.amount)+'</td><td>'+safe(x.account)+'</td><td>'+pill('Recorded')+'</td></tr>')))+
 panel('Withdrawal History',table(['Date','Amount','Destination','Status'],cfg.withdrawals.slice(-6).reverse().map(x=>'<tr><td>'+safe(x.date)+'</td><td>'+cash(x.amount)+'</td><td>'+safe(x.account)+'</td><td>'+pill('Local transfer')+'</td></tr>')))+
 panel('Emergency Fund Settings',row('◆','Protected savings','Protection reminder is '+(cfg.isProtected?'on':'off'),'','toggleProtection')+
 row('◷','Contribution schedule','Manually planned, not automated',cash(cfg.monthly))+
 act('Adjust Emergency Plan','editEmergency','primary'))+
 '</div>');
}
function loanMetrics(){
 const p=state().purchase,principal=Math.max(0,Number(p.price)-Number(p.down)),rate=Number(p.interest)/1200,n=Math.max(1,Number(p.term));
 const payment=rate===0?principal/n:principal*rate/(1-Math.pow(1+rate,-n));
 const total=payment*n+Number(p.down)+Number(p.costs);
 const net=monthlyIncome()-monthlyCosts();const ratio=net<=0?100:payment/net*100;
 const score=Math.max(0,Math.min(10,10-Math.max(0,ratio-25)/7));
 return {payment,total,principal,interest:Math.max(0,payment*n-principal),net,ratio,score,affordable:ratio<=35&&Number(p.down)<=liquid()};
}

function screen40(){
 const p=state().purchase,k=loanMetrics(),types=[['🚙','Car'],['⌂','House'],['♙','Business'],['🎓','Education'],['···','Other']];
 const alternativePrices=p.type==='Car'?[2200000,3500000,6500000]:[p.price*.65,p.price,p.price*1.35];
 const simulator=panel('Purchase Simulator','<form class="cap-form" id="cap-purchase" data-capform="purchase">'+
 '<label class="cap-field">Purchase Type<div class="cap-purchase-types">'+types.map(([i,n])=>'<button type="button" class="'+(p.type===n?'active':'')+'" data-cap="purchaseType:'+n+'"><strong>'+i+'</strong>'+n+'</button>').join('')+'</div></label>'+
 label('Purchase Price (KES)','price',p.price,'number','min="1000" required')+
 '<input type="range" min="500000" max="15000000" step="50000" data-caprange="price" value="'+p.price+'" aria-label="Purchase price slider">'+
 '<div class="cap40-range-caption"><span>KES 500,000</span><span>KES 15,000,000</span></div>'+
 label('Down Payment (KES)','down',p.down,'number','min="0" required')+
 '<input type="range" min="0" max="'+p.price+'" step="10000" data-caprange="down" value="'+p.down+'" aria-label="Down payment slider">'+
 '<div class="cap40-range-caption"><span>0%</span><span>100%</span></div>'+
 '<div class="cap-formgrid">'+sel('Loan Term','term',['12','24','36','48','60','72','84'],String(p.term))+
 label('Interest Rate (%)','interest',p.interest,'number','min="0" max="100" step="0.1" required')+'</div>'+
 label('Additional Costs (KES)','costs',p.costs,'number','min="0" required')+
 '<button class="cap-btn primary" type="submit">▤ Calculate Affordability　→</button>'+
 '<div class="cap-actions">'+act('Save Simulation','savePurchase')+act('Compare Options','purchaseCompare')+act('Reset','resetPurchase')+'</div></form>');
 const affordability=panel('Affordability Results','<div class="cap-score">'+icon(k.affordable?'✓':'!')+
 '<div><strong>'+(k.affordable?'Within selected guardrails':'Review affordability assumptions')+'</strong>'+
 '<small style="display:block">Based on monthly modeled cash flow; actual loan eligibility requires a lender.</small></div>'+
 '<div class="big">'+k.score.toFixed(1)+' / 10</div></div>'+
 '<div class="cap40-results-metrics">'+[
 ['▦','Monthly Payment',cash(k.payment)],['▣','Total Cost',cash(k.total)],['%','Interest Amount',cash(k.interest)],['↗','Debt-to-income',k.ratio.toFixed(1)+'%']
 ].map(([iconCode,name,value])=>'<div><span class="cap-ic">'+iconCode+'</span><b>'+name+'</b><strong>'+value+'</strong></div>').join('')+'</div>');
 const charts='<div class="cap40-chart-row">'+
 panel('Payment Breakdown',donut([{name:'Principal',value:k.principal},{name:'Interest',value:k.interest},{name:'Down Payment',value:Number(p.down)},{name:'Other Costs',value:Number(p.costs)}],k.total))+
 panel('Monthly Payment Schedule (First 12 Months)',barGraph(Array.from({length:12},(_,i)=>({name:['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i],value:70+i/4})),true))+'</div>';
 const goals=panel('Impact on Financial Goals',state().goals.slice(0,5).map(g=>row(g.icon||'◎',g.name,percent(g.saved,g.target)+'% complete',k.affordable?'On Track':'Review')).join(''));
 const options=panel('Alternative Options','<div class="cap40-options">'+alternativePrices.map((price,i)=>
 '<button type="button" class="cap40-option '+(i===1?'selected':'')+'" data-cap="option:'+i+'"><span class="cap40-mini-car">🚘</span><b>'+safe(p.type)+' '+(i===0?'Corolla':i===1?'RAV4':'Prado')+'</b><strong>'+cash(price)+'</strong><small>Illustrative option</small><span class="cap40-option-action">View Details</span></button>').join('')+'</div>');
 const summary=panel('Purchase Summary',
 '<div class="cap40-car-visual" role="img" aria-label="Vehicle example cropped from the approved design screenshot"></div>'+
 '<b class="cap40-car-name">'+safe(p.type==='Car'?'Toyota RAV4 2023':p.type+' purchase')+'</b>'+
 '<strong class="cap40-car-price">'+cash(p.price)+'</strong>'+
 [
 ['Purchase Price',cash(p.price)],['Down Payment',cash(p.down)],['Loan Amount',cash(k.principal)],
 ['Interest Rate',p.interest+'%'],['Loan Term',p.term+' months'],['Monthly Payment',cash(k.payment)],['Total Repayment',cash(k.total)]
 ].map(x=>'<div class="cap-row"><span class="grow">'+x[0]+'</span><b>'+x[1]+'</b></div>').join('')+
 '<div class="cap40-summary-action">'+act('✎ Edit Details','purchaseCompare')+'</div>');
 const insights=panel('AI Insights & Recommendations',[
 ['✓','Consider affordability alongside your current cash position.'],
 ['✦','Increasing the down payment may reduce interest expense.'],
 ['▣','Compare alternative options before committing.'],
 ['⚑','Protect emergency savings and other financial goals.'],
 ['◎','Loan eligibility and prices are illustrative, not verified.']
 ].map(([sym,txt])=>'<div class="cap40-insight"><span>'+sym+'</span><small>'+txt+'</small></div>').join(''));
 return shell(40,metrics([['🛒','Purchase Budget (Max)',cash(4200000),'Illustrative from assumptions'],['✓','Recommended Range',cash(2800000)+'–'+cash(3500000),'Subject to circumstances'],['◕','Monthly Payment (Max)',cash(85000),'Advisory threshold'],['◷','Affordability Score',k.score.toFixed(1)+'/10','Not lending approval']])+
 tabs(40,['Simulator','Purchase Options','Affordability Analysis','Monthly Impact','Compare Options','Scenarios','Saved Simulations'],tabValue(40,'Simulator'))+
 '<div class="cap40-layout"><div class="cap40-left">'+simulator+'</div>'+
 '<div class="cap40-center">'+affordability+charts+'<div class="cap40-bottom">'+goals+options+'</div></div>'+
 '<aside class="cap40-right">'+summary+insights+'</aside></div>');
}
function screen41(){
 const requests=state().requests,total=requests.reduce((a,x)=>a+x.amount,0),pending=requests.filter(x=>x.status==='Pending');
 const categories=['Business','Housing','Education','Travel','Health','Other'];
 return shell(41,metrics([['▦','Total Requests',String(requests.length),'All recorded requests'],['◷','Pending Approvals',String(pending.length),'Awaiting decisions'],['✓','Approved Requests',cash(requests.filter(x=>x.status==='Approved').reduce((n,x)=>n+x.amount,0)),'No funds automatically transferred'],['✕','Rejected Requests',String(requests.filter(x=>x.status==='Rejected').length),'Reviewed'],['▣','Funding Requested',cash(total),'Local planning entries'].slice(0,4)])+
 tabs(41,['Overview','Funding Requests','Pending Approvals','Approved','Rejected','Request Templates','Approval Rules','Settings'],tabValue(41,'Overview'))+
 '<div class="cap-grid">'+
 panel('Funding Requests by Category',donut(categories.map(n=>({name:n,value:requests.filter(x=>x.category===n).reduce((a,x)=>a+x.amount,0)})),total))+
 panel('Request Status Trend',barGraph(Array.from({length:8},(_,i)=>({name:['Mar','Apr','May','Jun','Jul','Aug','Sep','Oct'][i],value:26+i*8})),true))+
 panel('Quick Actions',[
 ['⊕','Create Funding Request','newRequest'],
 ['◷','View Pending Approvals','pending'],
 ['⚙','Schedule Future Request','newRequest'],
 ['✓','Set Approval Rules','approvalRules'],
 ['▤','Manage Approvers','approvalRules']
 ].map(x=>row(x[0],x[1],'','',x[2])).join(''))+
 panel('Recent Funding Requests',table(['Name','Category','Amount','Status','Date','Actions'],requests.slice(-8).reverse().map(x=>'<tr><td>'+safe(x.title)+'</td><td>'+safe(x.category)+'</td><td>'+cash(x.amount)+'</td><td>'+pill(x.status,x.status==='Pending'?'warn':x.status==='Rejected'?'red':'')+'</td><td>'+safe(x.date)+'</td><td>'+act('Review','request:'+x.id,'tiny')+'</td></tr>')))+
 panel('Approval Workflow',[
 ['▦','1. Submit Request','Request recorded locally'],
 ['◷','2. Review Funding','Confirm priorities and liquidity'],
 ['✓','3. Approve / Reject','Mark administrative status'],
 ['▣','4. Funding Allocation','Must be confirmed separately']
 ].map(x=>row(x[0],x[1],x[2])).join(''))+
 panel('Who Can Approve?',[
 ['Steve Nyaga','Personal Finance Owner','Active'],['Business Manager','Business Funding Reviewer','Demo only'],
 ['Advisor','Financial Reviewer','Not connected']
 ].map(x=>row('♙',x[0],x[1],x[2])).join(''))+
 panel('Pending Approvals',pending.slice(0,6).map(x=>row('◷',x.title,x.category,cash(x.amount),'request:'+x.id)).join(''),act('Review All','pending'))+
 panel('AI Insights & Recommendations',[
 ['Prioritize essential funding','Cash needs and goals should guide approval.'],
 ['Review overlapping requests','Avoid committing the same funds twice.'],
 ['Approvals do not transfer funds','This demo only changes request status.']
 ].map(x=>row('✦',x[0],x[1])).join(''))+
 '</div>');
}
function simulateScenario(){
 const s=state().scenario,initialCash=liquid(),income=monthlyIncome(),costs=monthlyCosts();
 let balance=initialCash,series=[],totalSaved=0,earned=0;
 for(let month=1;month<=Number(s.horizon);month++){
   const cashIn=income*Math.pow(1+Number(s.incomeGrowth)/1200,month);
   const cashOut=costs*Math.pow(1+Number(s.expenseGrowth)/1200,month);
   const surplus=cashIn-cashOut;
   const saveAmt=Math.max(0,surplus*Number(s.savingsRate)/100);
   const invested=saveAmt*Math.pow(1+Number(s.investmentReturn)/1200,Number(s.horizon)-month);
   totalSaved+=saveAmt;earned+=invested-saveAmt;balance+=surplus;
   series.push({month, cash:balance, income:cashIn, expense:cashOut, savings:totalSaved,investmentGain:earned});
 }
 return {end:balance,investmentGain:earned,saved:totalSaved,rows:series};
}
function screen42(){
 const s=state().scenario,sim=simulateScenario(),scenarios=[
 ['Conservative',-3,6,4],['Balanced',5,3,8],['Aggressive',12,6,13]
 ];
 return shell(42,metrics([['▣','Current Net Worth',cash(liquid()+state().goals.reduce((a,x)=>a+x.saved,0)),'Demo financial position'],['↑','Projected 1-Year Growth',cash(Math.max(0,sim.end-liquid())),'Assumption-based'],['◎','Monthly Savings',cash(Math.max(0,(monthlyIncome()-monthlyCosts())*s.savingsRate/100)),'Planned rate'],['◷','Financial Runway',String(s.horizon)+' months','Scenario horizon']])+
 tabs(42,['Scenario Builder','Scenario Comparison','Impact Analysis','Monte Carlo Simulation','Goals Alignment','Reports'],tabValue(42,'Scenario Builder'))+
 '<div class="cap-grid"><section class="cap-panel cap-span2"><div class="cap-panel-head"><h2>Scenario Projections</h2>'+act('Save Scenario','saveScenario')+'</div>'+lineGraph(12)+
 '<div class="cap-actions">'+scenarios.map((x,i)=>pill(x[0],i===1?'':'blue')).join('')+'</div>'+info()+'</section>'+
 panel('Key Outcome Metrics',[
 ['Expected Cash Position',cash(sim.end)],['Investment Growth',cash(sim.investmentGain)],
 ['Estimated Savings',cash(sim.saved)],['Cash Reserve',cash(liquid())]
 ].map(x=>row('▥',x[0],'Scenario assumptions',x[1])).join(''))+
 panel('Cash Flow Projection',barGraph(sim.rows.map(x=>({name:'M'+x.month,value:Math.min(95,40+(x.cash-liquid())/30000)})),true))+
 panel('Scenario Builder','<form class="cap-form" data-capform="scenario">'+
 '<div class="cap-formgrid">'+label('Income Growth (%)','incomeGrowth',s.incomeGrowth,'number','min="-50" max="100" step="0.5"')+
 label('Expense Growth (%)','expenseGrowth',s.expenseGrowth,'number','min="-50" max="100" step="0.5"')+
 label('Investment Return (%)','investmentReturn',s.investmentReturn,'number','min="-100" max="100" step="0.5"')+
 label('Savings Rate (%)','savingsRate',s.savingsRate,'number','min="0" max="100"')+
 sel('Time Horizon','horizon',['6','12','24','36','60'],String(s.horizon))+
 sel('Scenario Type','scenario',['Conservative','Balanced','Aggressive','Custom'],s.scenario)+'</div><button class="cap-btn primary" type="submit">Run Scenario Model</button></form>')+
 panel('Goal Achievement Probability',state().goals.slice(0,5).map(g=>row('◎',g.name,'Timeframe is not guaranteed',percent(g.saved,g.target)+'%')).join(''))+
 panel('What-if Scenarios',[
 ['Higher savings rate','Increase rate by 5 percentage points'],
 ['Business income growth','Test more optimistic income'],
 ['Unexpected expenses','Model higher spending'],
 ['Market downturn','Reduce projected investment return']
 ].map((x,i)=>row('◈',x[0],x[1],'','preset:'+i)).join(''))+
 panel('Scenario Comparison',table(['Scenario','Projected Cash','Savings','Risk'],scenarios.map((x,i)=>'<tr><td>'+x[0]+'</td><td>'+cash(sim.end*(1+(i-1)*.12))+'</td><td>'+cash(sim.saved*(1+(i-1)*.18))+'</td><td>'+pill(i===0?'Lower':i===1?'Moderate':'Higher',i===2?'warn':'')+'</td></tr>')))+
 panel('Scenario Insights',[
 ['Financial projections are uncertain','They may differ materially from real outcomes.'],
 ['Cash reserves matter','Consider unexpected bills and delayed payments.'],
 ['Review regularly','Update assumptions with actual transactions.']
 ].map(x=>row('✦',x[0],x[1])).join(''))+
 panel('Export & Share',act('Export CSV','exportScenario')+' '+act('Save Scenario','saveScenario')+' '+act('Compare Saved','viewSaved'))+
 '</div>');
}


function dialog(){
 const type=ui.modal;
 if(!type)return '';
 let title=String(type),body='';
 const gs=goal(),bucket=state().buckets.find(x=>x.id===ui.bucket),rule=state().rules.find(x=>x.id===ui.rule),req=state().requests.find(x=>x.id===ui.request);
 if(type==='goal'||type==='editGoal'){
  const current=type==='editGoal'?gs:null;title=current?'Edit Savings Goal':'Create Savings Goal';
  body='<form class="cap-form" data-capform="goal">'+label('Goal Name','name',current?.name||'','text','required maxlength="80"')+
  '<div class="cap-formgrid">'+label('Target Amount (KES)','target',current?.target||500000,'number','min="1" required')+
  label('Current Savings (KES)','saved',current?.saved||0,'number','min="0" required')+
  label('Monthly Contribution (KES)','monthly',current?.monthly||10000,'number','min="0" required')+
  label('Target Date','deadline',current?.deadline||'2028-12-01','date','required')+'</div>'+
  '<button class="cap-btn primary" type="submit">Save Goal</button></form>';
 }else if(type==='bucket'||type==='editBucket'){
  const x=type==='editBucket'?bucket:null;title=x?'Edit Money Bucket':'Create Money Bucket';
  body='<form class="cap-form" data-capform="bucket">'+label('Bucket Name','name',x?.name||'','text','required')+
  '<div class="cap-formgrid">'+label('Allocation Share (%)','share',x?.share||10,'number','min="0" max="100" required')+
  label('Target (KES)','goal',x?.goal||40000,'number','min="0" required')+
  label('Current Planned (KES)','amount',x?.amount||0,'number','min="0" required')+
  sel('Bucket Purpose','kind',['Living','Growth','Protection','Saving','Obligations','Discretionary','Giving','Other'],x?.kind||'Other')+'</div>'+
  '<button class="cap-btn primary" type="submit">Save Money Bucket</button></form>';
 }else if(type==='rule'||type==='editRule'){
  const x=type==='editRule'?rule:null;title=x?'Edit Allocation Rule':'Create Allocation Rule';
  body='<form class="cap-form" data-capform="rule">'+label('Rule name','name',x?.name||'','text','required')+
  sel('Destination bucket','bucket',state().buckets.map(b=>b.name),x?.bucket||state().buckets[0].name)+
  '<div class="cap-formgrid">'+label('Allocation (%)','share',x?.share||10,'number','min="0" max="100" required')+
  sel('Trigger','trigger',['When income received','When amount > KES 100,000','Monthly','Manual'],x?.trigger||'When income received')+'</div>'+
  '<button class="cap-btn primary" type="submit">Save Rule</button></form>';
 }else if(type==='fund'||type==='fundEmergency'||type==='withdrawEmergency'){
  const isEmergency=type!=='fund',withdraw=type==='withdrawEmergency';
  title=withdraw?'Simulate Emergency Withdrawal':isEmergency?'Fund Emergency Reserve':'Fund Savings Goal';
  body='<form class="cap-form" data-capform="'+type+'">'+
  '<div class="cap-note">This is an internal browser-demo allocation. It changes local account and goal balances only; no bank transfer.</div>'+
  label('Amount (KES)','amount',10000,'number','min="1" required')+
  sel(withdraw?'Destination Account':'Funding Account','account',ctx.model.accounts.slice(0,3).map(a=>a[0]),ctx.model.accounts[0][0])+
  '<button class="cap-btn primary" type="submit">Confirm Local Transfer</button></form>';
 }else if(type==='emergencySettings'){
  title='Emergency Fund Settings';const e=state().emergency;
  body='<form class="cap-form" data-capform="emergencySettings">'+
  label('Emergency Reserve Target (KES)','target',e.target,'number','min="1" required')+
  label('Monthly Contribution Plan (KES)','monthly',e.monthly,'number','min="0" required')+
  '<button class="cap-btn primary" type="submit">Save Reserve Plan</button></form>';
 }else if(type==='request'||type==='reviewRequest'){
  const x=type==='reviewRequest'?req:null;title=x?'Funding Request Review':'New Funding Request';
  body=x?'<div class="cap-note">Approval is an administrative status only; no money moves or is reserved automatically.</div>'+
  row('▦',x.title,x.justification,cash(x.amount))+row('♙','Request Owner',x.owner,pill(x.status,x.status==='Pending'?'warn':''))+
  (x.status==='Pending'?'<div class="cap-actions">'+act('Approve Request','approveRequest','primary')+act('Reject Request','rejectRequest')+'</div>':'<div class="cap-muted">This request has already been reviewed.</div>'):
  '<form class="cap-form" data-capform="request">'+
  label('Request Title','title','','text','required')+
  '<div class="cap-formgrid">'+label('Amount (KES)','amount',50000,'number','min="1" required')+
  sel('Category','category',['Business','Housing','Education','Travel','Health','Other'],'Business')+'</div>'+
  '<label class="cap-field">Justification<textarea class="cap-input" name="justification" rows="3" required></textarea></label>'+
  '<button class="cap-btn primary" type="submit">Submit Funding Request</button></form>';
 }else if(type==='strategy'){
  title='Strategic Allocation';const a=state().capitalStrategy;
  body='<form class="cap-form" data-capform="strategy">'+
  '<div class="cap-formgrid">'+label('Growth (%)','growth',a.growth,'number','min="0" max="100" required')+
  label('Stability (%)','stability',a.stability,'number','min="0" max="100" required')+
  label('Opportunity (%)','opportunity',a.opportunity,'number','min="0" max="100" required')+'</div>'+
  '<p class="cap-muted">Shares must add to 100%. Changes are planning preferences only.</p>'+
  '<button class="cap-btn primary" type="submit">Save Strategy</button></form>';
 }else{title=String(type);body='<div class="cap-note warn">This is a guided demonstration. No external provider transaction or authorization is available.</div>'}
 return '<div class="cap-dialog-wrap"><div class="cap-dialog" role="dialog" aria-modal="true" aria-label="'+safe(title)+'">'+
 '<div class="cap-panel-head"><h2>'+safe(title)+'</h2>'+act('Close','closeModal')+'</div>'+body+'</div></div>';
}
function download(file,heading,rows){
 const csv=[heading,...rows].map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\r\n');
 const link=document.createElement('a'),object=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8'}));
 link.href=object;link.download=file;document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(object),500);
}
function render(n){switch(Number(n)){
 case 35:return screen35();case 36:return screen36();case 37:return screen37();case 38:return screen38();
 case 39:return screen39();case 40:return screen40();case 41:return screen41();case 42:return screen42();default:return ''}}
function actClick(e){
 const node=e.target.closest?.('[data-cap],[data-capnav]');if(!node)return false;
 if(node.dataset.capnav){e.preventDefault();navigate(node.dataset.capnav);return true}
 const raw=node.dataset.cap,name=raw.split(':')[0],arg=raw.slice(name.length+1);ui.notice='';
 switch(name){
 case 'reference':location.href='index.html#screen/'+ctx.screen();break;
 case 'tab':{const split=arg.indexOf(':'),id=Number(arg.slice(0,split)),value=arg.slice(split+1);ui.tab[id]=value;store();break}
 case 'newBucket':ui.bucket='';ui.modal='bucket';store();break;
 case 'editBucket':ui.bucket=arg;ui.modal='editBucket';store();break;
 case 'adjustBuckets':ui.modal='Edit individual money buckets to adjust their allocations. Automatic transfers are not connected.';store();break;
 case 'newRule':ui.rule='';ui.modal='rule';store();break;
 case 'editRule':ui.rule=arg;ui.modal='editRule';store();break;
 case 'pauseAutomation':state().automationPaused=!state().automationPaused;store('Automation '+(state().automationPaused?'paused':'enabled')+' in demo preferences; no background transfer service exists.');break;
 case 'runAllocation':state().allocationHistory.push({date:'2026-10-30',source:'Allocation Preview',amount:state().buckets.reduce((n,b)=>n+b.amount,0),status:'Preview'});
   store('Allocation preview saved. No funds were moved from any account.');break;
 case 'nextAllocation':ui.modal='Next proposed allocation: November 2026. No recurring financial automation is active.';store();break;
 case 'template':{const n=Number(arg);if(n===0){const shares=[50,20,20,5,5,0,0,0];state().buckets.forEach((b,i)=>b.share=shares[i]||0)}
   else if(n===1){state().buckets[1].share=30;state().buckets[2].share=20}
   else if(n===2){state().buckets[4].share=30}
   else{ui.modal='Create your own custom allocation rule.';store();break}
   store('Template applied to planned shares. Review the percentages before use.');break}
 case 'rebalance':ui.modal='Portfolio rebalancing is a financial-provider action; this coded prototype only previews an allocation plan.';store();break;
 case 'editStrategy':ui.modal='strategy';store();break;
 case 'emergency':navigate(39);break;
 case 'addInvestment':navigate(36);break;
 case 'businessCapital':navigate(41);break;
 case 'buckets':navigate(36);break;
 case 'scenario':navigate(42);break;
 case 'newGoal':ui.modal='goal';store();break;
 case 'goal':ui.goal=arg;state().selectedGoal=arg;ctx.save();navigate(38);break;
 case 'fundGoal':ui.modal='fund';store();break;
 case 'fundEmergency':ui.modal='fundEmergency';store();break;
 case 'withdrawEmergency':ui.modal='withdrawEmergency';store();break;
 case 'editEmergency':ui.modal='emergencySettings';store();break;
 case 'pauseEmergency':state().emergency.monthly=0;store('Monthly emergency contribution plan paused locally.');break;
 case 'toggleProtection':state().emergency.isProtected=!state().emergency.isProtected;store('Protection reminder preference saved locally.');break;
 case 'editGoal':ui.modal='editGoal';store();break;
 case 'autoSave':navigate(36);break;
 case 'pauseGoal':ui.modal='Goal contributions are manually recorded. No automatic funding is running.';store();break;
 case 'simulator':navigate(40);break;
 case 'purchaseType':state().purchase.type=arg;store('Purchase category updated.');break;
 case 'savePurchase':state().purchaseSaved.push({id:'sim-'+Date.now(),...state().purchase,created:'2026-10-30'});store('Illustrative purchase simulation saved locally.');break;
 case 'purchaseCompare':ui.tab[40]='Compare Options';store('Compare the three illustrative options below.');break;
 case 'resetPurchase':state().purchase=structuredClone(initial().purchase);store('Restored initial purchase assumptions.');break;
 case 'option':{const k=[.65,1,1.35][Number(arg)]||1;state().purchase.price=Math.round(state().purchase.price*k);store('Selected illustrative purchase price. Recalculate to review the impact.');break}
 case 'newRequest':ui.request='';ui.modal='request';store();break;
 case 'request':ui.request=arg;ui.modal='reviewRequest';store();break;
 case 'pending':ui.tab[41]='Pending Approvals';store('Pending requests are shown in the review panel.');break;
 case 'approveRequest':case 'rejectRequest':{
   const r=state().requests.find(x=>x.id===ui.request);if(r&&r.status==='Pending'){r.status=name==='approveRequest'?'Approved':'Rejected';
    state().requestHistory.push({id:r.id,status:r.status,at:'2026-10-30'});ui.modal=null;store('Funding request '+r.status.toLowerCase()+' locally. No funds were disbursed.')}break}
 case 'approvalRules':ui.modal='Approval rules and multi-party authorization are not connected; review remains local in this prototype.';store();break;
 case 'preset':{const presets=[[8,3,8],[12,3,8],[-5,12,0],[-10,6,-6]],p=presets[Number(arg)]||[5,3,8];
    state().scenario.incomeGrowth=p[0];state().scenario.expenseGrowth=p[1];state().scenario.investmentReturn=p[2];state().scenario.scenario='Custom';store('Applied a what-if financial planning assumption.');break}
 case 'saveScenario':state().savedScenarios.push({id:'scenario-'+Date.now(),...state().scenario,created:'2026-10-30',projected:simulateScenario().end});store('Financial scenario saved locally.');break;
 case 'viewSaved':ui.modal='Saved scenarios: '+state().savedScenarios.length+'. Open Scenario Builder to change assumptions.';store();break;
 case 'exportScenario':download('finance-os-scenario-model.csv',['Month','Income','Expenses','Cash','Savings'],simulateScenario().rows.map(x=>[x.month,x.income,x.expense,x.cash,x.savings]));store('Illustrative scenario CSV exported.');break;
 case 'closeModal':ui.modal=null;store();break;
 default:ui.modal='Feature not connected to a live provider. This is a working UI prototype.';store();break;
 }
 return true
}
function actChange(e){
 const el=e.target;
 if(el.matches?.('[data-caprange]')){
   const k=el.dataset.caprange;const value=Number(el.value);
   if(k==='down')state().purchase.down=Math.min(value,state().purchase.price);
   if(k==='price'){state().purchase.price=value;state().purchase.down=Math.min(state().purchase.down,value)}
   store('Purchase slider updated.');return true;
 }
 return false;
}
function actSubmit(e){
 const form=e.target;if(!form.dataset?.capform)return false;
 e.preventDefault();const d=Object.fromEntries(new FormData(form));
 switch(form.dataset.capform){
 case 'goal':{
   const target=Number(d.target),saved=Number(d.saved),monthly=Number(d.monthly),name=String(d.name||'').trim();
   if(!name||!(target>0)||saved<0||monthly<0){store('Enter valid goal amounts.');break}
   const record={name,target,saved,monthly,deadline:d.deadline,category:'Personal',icon:'◎'};
   const old=state().goals.find(x=>x.id===ui.goal);
   if(ui.modal==='editGoal'&&old)Object.assign(old,record);else{record.id='g-'+Date.now();state().goals.push(record);ui.goal=record.id}
   state().selectedGoal=ui.goal;syncGoals();ui.modal=null;store('Goal saved in both the goals workspace and shared financial demo state.');navigate(37);break}
 case 'bucket':{
   const share=Number(d.share),goal=Number(d.goal),amount=Number(d.amount),name=String(d.name||'').trim();
   if(!name||share<0||share>100||goal<0||amount<0){store('Provide valid allocation inputs.');break}
   const record={name,share,goal,amount,kind:d.kind,icon:'▥',active:true};
   const old=state().buckets.find(x=>x.id===ui.bucket);
   if(ui.modal==='editBucket'&&old)Object.assign(old,record);else state().buckets.push({id:'bucket-'+Date.now(),...record});
   ui.modal=null;store('Money bucket plan updated locally. No cash moved.');break}
 case 'rule':{
   const share=Number(d.share),name=String(d.name||'').trim();
   if(!name||share<0||share>100){store('Enter a valid rule and percentage.');break}
   const record={name,share,trigger:d.trigger,bucket:d.bucket,active:true};
   const old=state().rules.find(x=>x.id===ui.rule);
   if(ui.modal==='editRule'&&old)Object.assign(old,record);else state().rules.push({id:'r-'+Date.now(),...record});
   ui.modal=null;store('Allocation rule updated as a local demonstration.');break}
 case 'fund':case 'fundGoal':case 'fundEmergency':case 'withdrawEmergency':{
   const amount=Number(d.amount),withdraw=form.dataset.capform==='withdrawEmergency';
   const eg=emergency();const g=['fund','fundGoal'].includes(form.dataset.capform)?goal():eg;
   const account=ctx.model.accounts.find(x=>x[0]===d.account);
   if(!g||!account||!Number.isFinite(amount)||amount<=0){store('Select an account and positive amount.');break}
   if(withdraw){if(amount>g.saved){store('Insufficient emergency savings for this simulated withdrawal.');break}g.saved-=amount;account[1]+=amount}
   else{if(amount>Number(account[1])){store('Insufficient demo account balance for this contribution.');break}account[1]-=amount;g.saved+=amount}
   const record={date:'2026-10-30',amount,account:account[0],goalId:g.id};
   if(withdraw)state().emergency.withdrawals.push(record);
   else if(g===eg)state().emergency.contributions.push(record);
   state().goalFunding.push({...record,type:withdraw?'Withdrawal':'Contribution'});
   syncGoals();ui.modal=null;
   store('Local '+(withdraw?'withdrawal':'funding')+' recorded with matching demo balances. No real transfer occurred.');break}
 case 'emergencySettings':{
   const target=Number(d.target),monthly=Number(d.monthly);
   if(!(target>0)||monthly<0){store('Set a valid target and monthly savings amount.');break}
   state().emergency.target=target;state().emergency.monthly=monthly;
   const eg=emergency();if(eg){eg.target=target;eg.monthly=monthly;syncGoals()}
   ui.modal=null;store('Emergency reserve settings saved locally.');break}
 case 'purchase':{
   const price=Number(d.price),down=Number(d.down),interest=Number(d.interest),term=Number(d.term),costs=Number(d.costs);
   if(!(price>0)||down<0||down>price||interest<0||term<1||costs<0){store('Purchase assumptions are invalid. Ensure down payment does not exceed price.');break}
   state().purchase={...state().purchase,price,down,interest,term,costs};
   store('Affordability recalculated from local assumptions only, not lender approval.');break}
 case 'request':{
   const amount=Number(d.amount),title=String(d.title||'').trim(),why=String(d.justification||'').trim();
   if(!title||!why||!(amount>0)){store('Enter a title, justification and positive amount.');break}
   const request={id:'q-'+Date.now(),title,justification:why,category:d.category,amount,date:'2026-10-30',owner:'Personal Finance Owner',status:'Pending'};
   state().requests.push(request);ui.modal=null;store('Funding request recorded locally. No balance reserved.');break}
 case 'strategy':{
   const a=Number(d.growth),b=Number(d.stability),c=Number(d.opportunity);
   if([a,b,c].some(x=>x<0||x>100)||a+b+c!==100){store('Strategy percentages must total exactly 100%.');break}
   state().capitalStrategy={growth:a,stability:b,opportunity:c};ui.modal=null;store('Strategic allocation targets saved locally.');break}
 case 'scenario':{
   const keys=['incomeGrowth','expenseGrowth','investmentReturn','savingsRate','horizon'];
   const values=keys.map(x=>Number(d[x]));
   if(values.some(x=>!Number.isFinite(x))||values[3]<0||values[3]>100||values[4]<1||values[4]>60){store('Invalid scenario assumptions.');break}
   keys.forEach((x,i)=>state().scenario[x]=values[i]);state().scenario.scenario=d.scenario;
   store('Financial scenario recalculated from your assumptions. These are not guaranteed returns.');break}
 }
 return true;
}
window.FinanceCapital={init,render,actClick,actChange,actSubmit};

})();