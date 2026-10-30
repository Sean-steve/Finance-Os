
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

/* APPEND_MORE_SCREENS */
})();