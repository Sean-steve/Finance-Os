
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

/* APPEND_SCREENS */
})();