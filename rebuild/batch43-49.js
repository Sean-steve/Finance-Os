
(()=>{
'use strict';
let ctx;
const $=s=>document.querySelector(s),esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>'KES '+Math.abs(Math.round(Number(n)||0)).toLocaleString('en-KE');
const percent=(a,b)=>Math.round((Number(a)||0)/(Math.max(1,Number(b)||0))*100);
const today='2026-10-30';
const pages={
 43:['Debt Management Centre','Take control of your debts. Track balances, manage payments, reduce interest and become debt-free faster.'],
 44:['Home Loan — KCB Bank','View loan details, track payments, and manage your repayment schedule.'],
 45:['Debt Repayment Optimizer','Find the fastest and most cost-effective way to become debt-free. Compare strategies, simulate extra payments, and see your savings.'],
 46:['Tax Overview & Planning','Track your tax position, maximize deductions, and plan ahead with confidence.'],
 47:['Insurance & Financial Protection','Manage your insurance policies, protect what matters, and plan for a more secure future.'],
 48:['Retirement Planning','Build the retirement you want with clear goals, projections and a personalized plan.'],
 49:['Estate & Beneficiary Planning','Protect your legacy, provide for your loved ones, and ensure your assets are distributed according to your wishes.']
};
const seed=()=>({
 debts:[
  {id:'d-home',name:'Home Loan',lender:'KCB Bank',kind:'Home Loan',balance:2400000,original:3500000,rate:11.5,payment:78000,dueDay:15,next:'2026-11-15',status:'On Track',term:48},
  {id:'d-car',name:'Car Loan',lender:'NCBA',kind:'Car Loan',balance:850000,original:1250000,rate:13.8,payment:28500,dueDay:18,next:'2026-11-18',status:'On Track',term:35},
  {id:'d-person',name:'Personal Loan',lender:'Equity Bank',kind:'Personal Loan',balance:620000,original:800000,rate:16.5,payment:15500,dueDay:12,next:'2026-11-12',status:'On Track',term:48},
  {id:'d-card',name:'Credit Card',lender:'Absa',kind:'Credit Card',balance:180000,original:250000,rate:23.0,payment:3800,dueDay:20,next:'2026-11-20',status:'Needs Review',term:62},
  {id:'d-business',name:'Business Loan',lender:'Co-operative Bank',kind:'Business Loan',balance:540000,original:650000,rate:14.5,payment:11000,dueDay:24,next:'2026-11-24',status:'On Track',term:60},
  {id:'d-other',name:'Other Debt',lender:'SACCO',kind:'SACCO Loan',balance:260000,original:360000,rate:10.5,payment:9000,dueDay:27,next:'2026-11-27',status:'On Track',term:32}
 ],
 debtPayments:[],debtAlerts:{},extraPayment:10000,strategy:'Avalanche',
 taxes:{estimatedTax:620000,paid:450000,deductions:280000,refund:0,filingDate:'2027-06-30',filings:[{name:'Individual Income Tax Return',period:'FY 2026',due:'2027-06-30',status:'Planning'},{name:'Business Income Tax Review',period:'2026',due:'2027-06-30',status:'Review'},{name:'Estimated Tax Check',period:'Q4 2026',due:'2026-12-31',status:'Planning'}],entries:[],deductionItems:[['Pension Contributions',96000],['Insurance Relief (Illustrative)',24000],['Business Expenses',120000],['Professional Development',40000]],checklist:[]},
 policies:[
 {id:'p-life',name:'Life Insurance',provider:'Britam',category:'Life',coverage:6000000,premium:12000,renew:'2027-05-01',status:'Active',beneficiary:'Designated separately'},
 {id:'p-health',name:'Health Insurance',provider:'Jubilee',category:'Medical',coverage:4500000,premium:7800,renew:'2027-04-01',status:'Active',beneficiary:'Policyholder'},
 {id:'p-car',name:'Motor Insurance',provider:'APA',category:'Motor',coverage:3500000,premium:18500,renew:'2027-03-01',status:'Active',beneficiary:'Policyholder'},
 {id:'p-home',name:'Home Protection',provider:'CIC',category:'Property',coverage:4500000,premium:3600,renew:'2027-07-01',status:'Active',beneficiary:'Policyholder'},
 {id:'p-travel',name:'Travel Insurance',provider:'AAR',category:'Travel',coverage:1000000,premium:2800,renew:'2027-01-01',status:'Active',beneficiary:'Policyholder'},
 {id:'p-personal',name:'Personal Accident',provider:'Madison',category:'Accident',coverage:3000000,premium:2600,renew:'2027-02-01',status:'Active',beneficiary:'Policyholder'}
 ], claims:[],policyNotes:{},
 retirement:{age:32,retireAge:60,lifeExpectancy:85,saved:8500000,monthly:55000,monthlyIncomeTarget:350000,annualReturn:6,inflation:4,reviewed:false,contributionHistory:[]},
 estate:{assets:[['Property & Real Estate',4500000],['Investments',3600000],['Cash & Bank Accounts',1700000],['Business Interests',1500000],['Personal Assets',850000],['Other Assets',350000]],beneficiaries:[
 {id:'e1',name:'Beneficiary A',relationship:'Spouse / Partner',share:40,status:'Primary'},
 {id:'e2',name:'Beneficiary B',relationship:'Child',share:30,status:'Primary'},
 {id:'e3',name:'Beneficiary C',relationship:'Child',share:20,status:'Primary'},
 {id:'e4',name:'Beneficiary D',relationship:'Other',share:10,status:'Contingent'}],
 documents:[{name:'Last Will & Testament',status:'Not uploaded'},{name:'Power of Attorney',status:'Not uploaded'},{name:'Life Insurance Policy',status:'Not uploaded'},{name:'Property Ownership',status:'Not uploaded'},{name:'Beneficiary Designations',status:'Not uploaded'},{name:'Trust Documents',status:'Not uploaded'}],
 checklist:[['Draft / Review Will',false],['Choose Executor',false],['Assign Beneficiaries',true],['Create Asset Inventory',true],['Review Guardianship Needs',false],['Check Policy Beneficiaries',false],['Store Critical Documents',false],['Schedule Legal Review',false]]}
});
let ui={tabs:{},debt:'d-home',policy:'p-life',period:'Last 6 months',filter:'All',strategy:'Avalanche',extra:10000,modal:null,editId:null,notice:'',compare:false};
function init(bridge){ctx=bridge;if(!ctx.model.protectionV2){ctx.model.protectionV2=seed();ctx.save()}const s=state();for(const [key,value] of Object.entries(seed()))if(s[key]===undefined)s[key]=structuredClone(value)}
const state=()=>ctx.model.protectionV2;
const save=(notice='')=>{ui.notice=notice;ctx.save();ctx.render()};
const go=n=>ctx.navigate(Number(n));
const action=(label,key,cl='')=>'<button type="button" class="pr-btn '+cl+'" data-pr="'+esc(key)+'">'+esc(label)+'</button>';
const link=(label,n,cl='')=>'<button type="button" class="pr-btn '+cl+'" data-prnav="'+n+'">'+esc(label)+'</button>';
const field=(label,key,value,type='text',extra='')=>'<label class="pr-field">'+esc(label)+'<input name="'+esc(key)+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></label>';
const select=(label,key,items,value)=>'<label class="pr-field">'+esc(label)+'<select name="'+esc(key)+'">'+items.map(i=>'<option '+(i===value?'selected':'')+'>'+esc(i)+'</option>').join('')+'</select></label>';
const bar=(a,b,c='#16ad7f')=>'<div class="pr-progress" style="--p:'+Math.max(0,Math.min(100,percent(a,b)))+'%;--c:'+c+'"><i></i></div>';
const pill=(x,t='')=>'<span class="pr-tag '+t+'">'+esc(x)+'</span>';
const row=(symbol,name,caption,value='',cmd='',color='')=>'<div class="pr-row"><span class="pr-icon '+color+'">'+symbol+'</span><span class="grow"><b>'+esc(name)+'</b><small>'+esc(caption)+'</small></span>'+(value?'<strong>'+esc(value)+'</strong>':'')+(cmd?action('Open',cmd):'')+'</div>';
const panel=(title,body,buttons='')=>'<section class="pr-panel"><div class="pr-head"><h2>'+esc(title)+'</h2><div class="pr-actions">'+buttons+'</div></div>'+body+'</section>';
const metrics=xs=>'<div class="pr-kpis">'+xs.map(([icon,label,num,sub])=>'<div class="pr-kpi"><span class="pr-kpi-icon">'+icon+'</span><div><small>'+esc(label)+'</small><strong>'+esc(num)+'</strong><em>'+esc(sub||'')+'</em></div></div>').join('')+'</div>';
const tabs=(n,labels)=>'<div class="pr-tabs">'+labels.map(label=>'<button type="button" class="'+((ui.tabs[n]||labels[0])===label?'selected':'')+'" data-pr="tab:'+n+':'+esc(label)+'">'+esc(label)+'</button>').join('')+'</div>';
const table=(heads,rows)=>'<div class="pr-tablewrap"><table class="pr-table"><thead><tr>'+heads.map(x=>'<th>'+esc(x)+'</th>').join('')+'</tr></thead><tbody>'+rows.join('')+'</tbody></table></div>';
const notice=(msg,warning=false)=>'<div class="pr-note '+(warning?'warn':'')+'">'+esc(msg)+'</div>';
const palette=['#0dac79','#2e98d9','#a16cda','#f0aa5a','#e96e86','#98a9b9'];
function donut(items,total){let sum=items.reduce((n,x)=>n+Number(x[1]),0),from=0,slices=[];
for(let i=0;i<items.length;i++){let to=from+(Number(items[i][1])/Math.max(1,sum)*100);slices.push(palette[i%palette.length]+' '+from.toFixed(2)+'% '+to.toFixed(2)+'%');from=to}
return '<div class="pr-donut-wrap"><div class="pr-donut" style="background:conic-gradient('+slices.join(',')+')"><div class="pr-hole"><b>'+fmt(total??sum)+'</b><small>Total</small></div></div><div class="pr-legend">'+items.slice(0,7).map((x,i)=>'<div class="pr-legend-row"><i style="--c:'+palette[i%palette.length]+'"></i><span class="grow">'+esc(x[0])+'</span><b>'+percent(x[1],sum)+'%</b></div>').join('')+'</div></div>'}
function chart(kind='line',periods=8){
let x0=20,width=420,series=Array.from({length:periods},(_,i)=>{let x=x0+i*(width-40)/Math.max(1,periods-1);return [x,120-i*7+Math.sin(i*1.7)*7]});
let svg='<svg viewBox="0 0 440 175" class="pr-plot" role="img" aria-label="Illustrative '+kind+' trend">'
+[24,62,100,138].map(y=>'<line x1="12" x2="435" y1="'+y+'" y2="'+y+'" stroke="#e8eeeb"/>').join('');
for(let i=0;i<series.length;i++){const [x,y]=series[i];if(kind==='bars'||kind==='stack'){let y2=150;for(let z=0;z<(kind==='stack'?4:1);z++){let h=kind==='stack'?14+z*4+i:45+(i%4)*9;svg+='<rect x="'+(x-7)+'" y="'+(y2-h)+'" width="15" height="'+h+'" fill="'+palette[z]+'"/>';y2-=h}}
svg+='<text x="'+(x-12)+'" y="166" font-size="9" fill="#768690">'+['Nov','Dec','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct'][i%12]+'</text>'}
if(kind==='line'||kind==='area'){let p=series.map((q,i)=>(i?'L':'M')+q.join(' ')).join(' ');if(kind==='area')svg+='<path d="'+p+' L'+series.at(-1)[0]+' 151 L'+series[0][0]+' 151 Z" fill="#e5f6ee"/>';svg+='<path d="'+p+'" fill="none" stroke="#24a77c" stroke-width="3"/><path d="'+series.map((q,i)=>(i?'L':'M')+q[0]+' '+(q[1]+22+Math.sin(i)*5)).join(' ')+'" fill="none" stroke="#dc778c" stroke-width="2"/>'}
return svg+'</svg>'}
function shell(n,body){const [title,sub]=pages[n];
return '<div class="pr-page"><section class="banner"><div><div class="banner-date">'+(n<=45?'Debts':n===46?'Taxes':n===47?'Protection':n===48?'Retirement Planning':'Estate & Beneficiary Planning')+'　›　'+esc(title)+'</div><h1>'+esc(title)+'</h1><p>'+esc(sub)+'</p></div><div class="banner-quote">“Plan today<br>for a stronger<br>tomorrow.”</div></section><div class="pr-inner">'+(ui.notice?'<div role="status" class="pr-note">'+esc(ui.notice)+'</div>':'')+body+'<div class="pr-note warn">Demo planning only. No verified lending, tax filing, insurance cover, investment forecast or legally valid estate documents. Do not enter sensitive real records here. '+action('Compare Screen '+n,'reference')+'</div></div>'+dialog()+'</div>'}
const debts=()=>state().debts, selectedDebt=()=>debts().find(x=>x.id===ui.debt)||debts()[0];
const debtTotal=()=>debts().reduce((n,x)=>n+x.balance,0),debtMonthly=()=>debts().reduce((n,x)=>n+x.payment,0);
const coverage=()=>state().policies.filter(p=>p.status==='Active').reduce((n,p)=>n+p.coverage,0);
const annualPremiums=()=>state().policies.filter(p=>p.status==='Active').reduce((n,p)=>n+p.premium*12,0);
function detailsPairs(rows){return rows.map(([label,value])=>'<div class="pr-row"><span class="grow">'+esc(label)+'</span><strong>'+esc(value)+'</strong></div>').join('')}


function debtRows(){return table(['Debt / Account','Lender','Balance','Interest Rate','Monthly Payment','Next Due','Status','Actions'],
debts().map(d=>'<tr><td><b>'+esc(d.name)+'</b></td><td>'+esc(d.lender)+'</td><td>'+fmt(d.balance)+'</td><td>'+d.rate+'%</td><td>'+fmt(d.payment)+'</td><td>'+esc(d.next)+'</td><td>'+pill(d.status,d.status==='Needs Review'?'warn':'')+'</td><td>'+action('Details','debt:'+d.id)+'</td></tr>'))}
function amortize(d,extra=0){let bal=d.balance,rate=d.rate/1200,monthly=d.payment+extra,rows=[],interestTotal=0;
for(let i=0;i<360&&bal>0.01;i++){let interest=bal*rate;if(monthly<=interest)return {rows,months:360,interest:Infinity,error:true};let pay=Math.min(monthly,bal+interest),principal=pay-interest;bal=Math.max(0,bal-principal);interestTotal+=interest;rows.push({month:i+1,payment:Math.round(pay),principal:Math.round(principal),interest:Math.round(interest),balance:Math.round(bal)})}
return {rows,months:rows.length,interest:interestTotal}}
function screen43(){
const weighted=debts().reduce((n,d)=>n+d.balance*d.rate,0)/Math.max(1,debtTotal());
return shell(43,metrics([['▣','Total Debt Balance',fmt(debtTotal()),'Illustrative debt portfolio'],['▧','Monthly Debt Payments',fmt(debtMonthly()),'Required payments'],['%','Average Interest Rate',weighted.toFixed(1)+'%','Balance-weighted'],['◷','Debt-Free Target','Dec 2031','Planning milestone']])+
tabs(43,['Overview','All Debts','Payment Schedule','Repayment Strategy','Refinancing Options','Debt Analytics','Documents','Settings'])+
'<div class="pr-grid">'+panel('Debt Breakdown',donut(debts().map(d=>[d.kind,d.balance]),debtTotal()))+
panel('Debt Balance Trend',chart('line'),action('Last 6 Months','period'))+
panel('Quick Actions',[
['⊕','Add Debt Account','addDebt'],['▣','Make a Payment','payment'],['⇄','Set Up Auto Payment','autopay'],['✦','Create Payoff Plan','optimizer'],['◈','Compare Refinancing','refinance'],['▥','Upload Documents','documents']
].map(x=>row(x[0],x[1],'Local demo only','',x[2])).join(''))+
panel('Monthly Payment Commitments',chart('stack'))+
panel('Debt Payoff Progress',donut([['Repaid',debts().reduce((n,d)=>n+d.original-d.balance,0)],['Remaining',debtTotal()]],debtTotal()))+
panel('Debt Insights',row('⚑','Review highest-interest debt','Credit card APR could dominate costs',fmt(debts().find(d=>d.id==='d-card').balance),'optimizer')+row('✓','Stay on payment schedules','Review the next due dates','','schedule')+row('◷','Compare extra repayments','Repayment scenario review','','optimizer'))+
'<section class="pr-panel pr-col2"><div class="pr-head"><h2>All Debt Accounts</h2>'+action('+ Add Debt','addDebt','primary')+'</div>'+debtRows()+'</section>'+
panel('Payoff Strategies','<div class="pr-mini-grid">'+[['Avalanche','Highest APR'],['Snowball','Smallest balance'],['Refinance','Check fees'],['Extra Payments','Accelerate payoff']].map(x=>'<div class="pr-mini"><b>'+x[0]+'</b>'+x[1]+'</div>').join('')+'</div>'+link('View optimizer',45,'primary'))+
panel('Payment Alerts',debts().slice(0,3).map(d=>row('◷',d.name,'Due '+d.next,fmt(d.payment),'debt:'+d.id)).join(''))+'</div>')}
function screen44(){
const d=selectedDebt(),schedule=amortize(d),repaid=d.original-d.balance;
return shell(44,metrics([['⌂','Outstanding Balance',fmt(d.balance),percent(repaid,d.original)+'% paid down'],['▣','Monthly Payment',fmt(d.payment),'Scheduled'],['%','Interest Rate',d.rate+'%','Annual nominal'],['◷','Remaining Payments',schedule.months+' months','Illustrative model']])+
tabs(44,['Overview','Repayment Schedule','Payment History','Amortization','Extra Payments','Refinancing Options','Documents','Settings'])+
'<div class="pr-grid">'+panel('Loan Details',detailsPairs([['Loan Type',d.kind],['Lender',d.lender],['Original Loan',fmt(d.original)],['Outstanding Balance',fmt(d.balance)],['Interest Rate',d.rate+'%'],['Monthly Payment',fmt(d.payment)],['Next Due',d.next],['Status',d.status]]))+
panel('Balance & Payoff Projection',chart('area',10)+bar(repaid,d.original)+detailsPairs([['Principal repaid',fmt(repaid)],['Principal remaining',fmt(d.balance)]]))+
panel('Payoff Scenarios',[0,10000,25000].map(extra=>row('◈',extra?'Extra '+fmt(extra):'Current Plan',amortize(d,extra).months+' months to pay off',fmt(d.payment+extra),'extra:'+extra)).join(''))+
panel('Payment Breakdown (Monthly)',donut([['Principal',Math.max(0,d.payment-d.balance*d.rate/1200)],['Interest',d.balance*d.rate/1200]],d.payment))+
'<section class="pr-panel pr-col2"><div class="pr-head"><h2>Amortization Schedule — Next 12 Payments</h2>'+action('Export CSV','loanExport')+'</div>'+table(['Month','Payment','Principal','Interest','Ending Balance','Status'],schedule.rows.slice(0,12).map(r=>'<tr><td>'+r.month+'</td><td>'+fmt(r.payment)+'</td><td>'+fmt(r.principal)+'</td><td>'+fmt(r.interest)+'</td><td>'+fmt(r.balance)+'</td><td>'+pill('Projected','blue')+'</td></tr>'))+'</section>'+
panel('Quick Actions',[['Make a Payment','payment'],['Debt Optimizer','optimizer'],['Update Interest Rate','editDebt'],['Request Refinancing','refinance'],['Download Schedule','loanExport']].map(x=>row('▣',x[0],'Demo only','',x[1])).join(''))+
panel('Payment History',table(['Date','Amount','Method'],state().debtPayments.filter(x=>x.debtId===d.id).slice(-5).map(x=>'<tr><td>'+esc(x.date)+'</td><td>'+fmt(x.amount)+'</td><td>Local simulation</td></tr>')))+
panel('Extra Payments Impact',detailsPairs([['Extra '+fmt(10000)+' monthly',amortize(d,10000).months+' months'],['Interest difference',fmt(Math.max(0,schedule.interest-amortize(d,10000).interest))]])+link('Compare plans',45))+
panel('Lender Insights',notice('Projections assume constant interest and payment amounts; verify contract terms and fees.'))+'</div>')}
function optimization(){const list=debts().slice().sort((a,b)=>ui.strategy==='Snowball'?a.balance-b.balance:b.rate-a.rate);
return list.map((d,i)=>({...d,result:amortize(d,i===0?ui.extra:0)}))}
function screen45(){
const plan=optimization(),before=debts().reduce((n,d)=>n+amortize(d).interest,0),after=plan.reduce((n,d)=>n+d.result.interest,0),saved=Math.max(0,before-after);
return shell(45,metrics([['▣','Total Debt Balance',fmt(debtTotal()),'Shared debts'],['▧','Monthly Payments',fmt(debtMonthly()),'Before extra contributions'],['%','Estimated Interest Saved',fmt(saved),'Illustrative'],['◷','Remaining Payoff',Math.max(...plan.map(d=>d.result.months))+' months','Not a lender quote']])+
tabs(45,['Optimizer','Strategy Comparison','Extra Payments','Debt Priority List','Savings Analysis','Recommended Plan','Settings'])+
'<div class="pr-grid">'+
panel('Optimization Settings','<form data-prform="optimizer" class="pr-form">'+select('Optimization Goal','strategy',['Avalanche','Snowball','Minimum Payments'],ui.strategy)+field('Extra Monthly Payment (KES)','extra',ui.extra,'number','min="0" required')+field('Start Date','start','2026-11-01','date')+'<button class="pr-btn primary" type="submit">Optimize Plan</button></form>'+notice('This model does not include changing rates or lender fees.'))+
panel('Strategy Comparison','<div class="pr-strategy">'+[['Avalanche','Highest APR First','Usually minimizes interest'],['Snowball','Smallest Balance First','Earlier milestone wins'],['Minimum Payments','Current Schedule','No extra allocation'],['Custom Strategy','Not yet configured','Manual priority needed']].map(x=>'<button class="'+(ui.strategy===x[0]?'selected':'')+'" data-pr="strategy:'+x[0]+'" type="button"><b>'+esc(x[1])+'</b><small>'+esc(x[2])+'</small></button>').join('')+'</div>')+
panel('Projected Benefits',detailsPairs([['Baseline interest',fmt(before)],['Optimized interest',fmt(after)],['Difference',fmt(saved)],['Extra payment',fmt(ui.extra)]])+bar(saved,before))+
panel('Debt Payoff Timeline',chart('area',12))+
'<section class="pr-panel pr-col2"><div class="pr-head"><h2>Recommended Debt Priority</h2>'+action('Export Plan','optimizerExport')+'</div>'+table(['Priority','Debt','Balance','APR','Monthly Pay','Months','Interest'],plan.map((d,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(d.name)+'</td><td>'+fmt(d.balance)+'</td><td>'+d.rate+'%</td><td>'+fmt(d.payment+(i===0?ui.extra:0))+'</td><td>'+d.result.months+'</td><td>'+fmt(d.result.interest)+'</td></tr>'))+'</section>'+
panel('Extra Payment Impact',chart('bars',8)+detailsPairs([['Extra per month',fmt(ui.extra)],['Total debt',fmt(debtTotal())]])+action('Save Simulation','optimizerApply','primary'))+
panel('Advisor Notes',row('⚑','Highest APR priority','Consider fees before refinancing',fmt(23)+'%','optimizer')+row('✓','Protect savings buffer','Avoid exhausting emergency funds','','reserve'))+'</div>')}

/* REMAINING_SCREENS */
})();