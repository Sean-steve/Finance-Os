(()=>{'use strict';
let bridge;let draft=null;let errors=[];
const defs=[
 ['Housing',120000,'#fa6174','⌂'],['Food & Dining',45000,'#239dec','♜'],['Transport',30000,'#2abb8c','▣'],['Utilities',24000,'#f8b957','ϟ'],['Shopping',18000,'#a964e8','▥'],['Health & Medical',15000,'#f67da3','♥'],['Subscriptions',12000,'#3989f0','◉'],['Entertainment',12000,'#c450de','♬'],['Education',9000,'#1eb48e','▥'],['Others',15000,'#96a4b5','⋯']
];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const kes=x=>'KES '+Math.round(Number(x)||0).toLocaleString('en-KE');
const total=()=>defs.reduce((sum,c)=>sum+Number(draft.categories[c[0]]||0),0);
const pct=(a,b)=>Math.round(100*Number(a||0)/Math.max(1,Number(b||0)));
const spend=()=>Math.abs(bridge.model.transactions.filter(x=>Number(x[4])<0).reduce((s,x)=>s+Number(x[4]),0));
function init(ctx){bridge=ctx}
function start(){if(draft)return;const s=bridge.model.spendV2;
draft={name:s.budgetName||'October 2026 Budget',period:s.budgetPeriod||'Monthly',month:s.budgetMonth||'October 2026',
limit:Number(s.budgetLimit||300000),
categories:Object.fromEntries(defs.map(([name,v])=>[name,Number(s.categories?.[name]??v)])),
rollover:{...s.rollover},rules:{alertThreshold:Number(s.rules?.alertThreshold??80),weeklyDigest:!!s.rules?.weeklyDigest,unusual:!!s.rules?.unusual,paused:!!s.rules?.paused},step:1};errors=[]}
const btn=(name,action,cl='')=>'<button type="button" class="bd22-button '+cl+'" data-budget22="'+esc(action)+'">'+esc(name)+'</button>';
const note=(msg,bad=false)=>'<div class="bd22-note '+(bad?'bad':'')+'">'+esc(msg)+'</div>';
function donut(){let from=0,segments=[],sum=total();

segments=[];from=0;
defs.forEach(x=>{const next=from+(Number(draft.categories[x[0]])/Math.max(1,sum))*100;segments.push(x[2]+' '+from.toFixed(2)+'% '+next.toFixed(2)+'%');from=next});
return '<div class="bd22-donut-layout"><div class="bd22-donut" style="background:conic-gradient('+segments.join(',')+')"><div><strong>'+kes(sum)+'</strong><small>Total allocated</small></div></div><div class="bd22-legend">'+defs.map(c=>'<div><i style="background:'+c[2]+'"></i><span>'+esc(c[0])+'</span><em>'+pct(draft.categories[c[0]],sum)+'%</em><b>'+kes(draft.categories[c[0]])+'</b></div>').join('')+'</div></div>'}
function rules(){
const pairs=[['weeklyDigest','Send weekly budget summary','Email delivery is not connected'],['unusual','Alert on unusual spending','Local preference only'],['paused','Pause alerts for this budget','No remote notification system']];
return '<div class="bd22-rule"><span class="bd22-rule-icon">♟</span><span class="grow"><b>Alert when spending reaches</b><small>Percentage of category limit</small></span><select aria-label="Budget alert threshold" data-budget22change="threshold">'+[60,70,80,90,100].map(n=>'<option value="'+n+'" '+(draft.rules.alertThreshold===n?'selected':'')+'>'+n+'%</option>').join('')+'</select></div>'+
pairs.map(([key,label,sub])=>'<label class="bd22-rule"><span class="bd22-rule-icon">'+(key==='paused'?'◉':key==='unusual'?'⚑':'✉')+'</span><span class="grow"><b>'+esc(label)+'</b><small>'+esc(sub)+'</small></span><input type="checkbox" class="bd22-switch" data-budget22-rule="'+key+'" '+(draft.rules[key]?'checked':'')+'></label>').join('')}
function categories(){const sum=total();
return '<div class="bd22-cathead"><span></span><span>Category</span><span>Allocation (KES)</span><span>% of Budget</span><span>Share</span><span>Monthly Limit</span><span>Rollover</span></div>'+
defs.map(([name,value,color,icon])=>{
const v=Number(draft.categories[name]||0);
return '<div class="bd22-catrow"><span class="bd22-cat-ico" style="--cat:'+color+'">'+icon+'</span><span class="bd22-cat-name">'+esc(name)+'</span><input type="number" min="0" step="100" inputmode="numeric" aria-label="'+esc(name)+' allocation KES" data-budget22cat="'+esc(name)+'" value="'+v+'"><span>'+pct(v,sum)+'%</span><span class="bd22-progress" style="--fill:'+pct(v,Math.max(sum,draft.limit))+'%;--cat:'+color+'"><i></i></span><span>'+kes(v)+'</span><input type="checkbox" class="bd22-switch" aria-label="'+esc(name)+' rollover" data-budget22roll="'+esc(name)+'" '+(draft.rollover[name]?'checked':'')+'></div>'}).join('')+
'<div class="bd22-catrow bd22-total"><strong>Σ</strong><strong>Total</strong><strong>'+kes(sum)+'</strong><strong>'+pct(sum,draft.limit)+'%</strong><span class="bd22-progress" style="--fill:'+Math.min(100,pct(sum,draft.limit))+'%;--cat:#0caf81"><i></i></span><strong>'+kes(sum)+'</strong><strong>'+ (sum===draft.limit?'✓':'!')+'</strong></div>'}
function render(){start();const sum=total(),diff=draft.limit-sum,spent=spend(),remain=draft.limit-spent;
const steps=[['Basic Details','Set budget type and amount'],['Category Allocation','Allocate and customize'],['Rules & Settings','Alerts and automation'],['Review & Save','Confirm and activate']];
const stepper='<nav class="bd22-stepper" aria-label="Budget editor steps">'+steps.map((x,i)=>'<button type="button" class="bd22-step '+(draft.step===i+1?'active':'')+'" data-budget22="step:'+(i+1)+'"><span>'+(i+1)+'</span><b>'+x[0]+'<small>'+x[1]+'</small></b></button>').join('')+'</nav>';
const details='<section class="bd22-panel bd22-details" id="bd22-details"><h2>1. Budget Details</h2><div class="bd22-fields">'+
'<label>Budget Name <i>*</i><input data-budget22value="name" maxlength="100" required value="'+esc(draft.name)+'"></label>'+
'<label>Period <i>*</i><select data-budget22value="month">'+['October 2026','November 2026','December 2026','January 2027','February 2027','March 2027'].map(x=>'<option '+(draft.month===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label>'+
'<div><label>Budget Type <i>*</i></label><div class="bd22-segments">'+['Monthly','Weekly','Yearly','Custom Range'].map(x=>btn(x,'type:'+x,draft.period===x?'selected':'')).join('')+'</div></div>'+
'<label>Total Budget Amount (KES) <i>*</i><input type="number" min="1" step="100" data-budget22value="limit" value="'+draft.limit+'" required><span class="bd22-chips">'+[100000,250000,500000].map(x=>btn(x===100000?'KES 100K':x===250000?'KES 250K':'KES 500K','amount:'+x)).join('')+'</span></label></div></section>';
const quick='<div class="bd22-quick"><h3>Quick Setup</h3>'+
[['✦','Use Template','Start from a ready-made budget','template'],['◷','Copy from Last Month','Use the last saved allocation','copy'],['✿','Suggested Split','Rules-based allocation, not an AI service','suggest']].map(([icon,title,sub,key])=>'<button class="bd22-quick-item" data-budget22="'+key+'"><span>'+icon+'</span><b>'+title+'<small>'+sub+'</small></b><em>›</em></button>').join('')+'</div>';
const preview='<section class="bd22-panel bd22-preview"><div class="bd22-title"><h2>Budget Preview</h2><small>Monthly View ⌄</small></div>'+donut()+'</section>';
const projection='<section class="bd22-panel"><h2>Monthly Projection</h2><div class="bd22-project"><div><b>'+kes(draft.limit)+'</b><small>Budget</small></div><div><b>'+kes(spent)+'</b><small>Recorded Spend</small></div><div><b class="'+(remain<0?'bad':'')+'">'+kes(Math.abs(remain))+'</b><small>'+(remain<0?'Over Budget':'Expected Leftover')+'</small></div></div><div class="bd22-progress wide" style="--fill:'+Math.min(100,pct(spent,draft.limit))+'%;--cat:#19b487"><i></i></div><small>Based on current local ledger transactions; not a bank forecast.</small></section>';
return '<div class="bd22-screen"><section class="banner bd22-hero"><div><div class="banner-date">Budgets　›　Create / Edit Budget</div><h1>Create / Edit Budget</h1><p>Set your budget, allocate across categories, and stay on track with your financial goals.</p></div><div class="banner-quote">“A plan today,<br>freedom tomorrow.”</div></section>'+
stepper+'<div class="bd22-message" role="status" aria-live="polite">'+(errors.length?note(errors.join(' '),true):sum!==draft.limit?note('Allocations differ from your overall limit by '+kes(Math.abs(diff))+'. Balance allocations before saving.',true):note('Your budget is balanced. Changes remain a draft until you save.'))+'</div>'+
'<div class="bd22-layout"><div class="bd22-main"><div class="bd22-details-row">'+details+quick+'</div>'+
'<section class="bd22-panel bd22-allocation" id="bd22-allocation"><div class="bd22-title"><h2>2. Allocate by Category</h2><div class="bd22-actions">'+btn('Distribute Evenly','equalize')+btn('Balance Allocations','balance')+btn('Reset','reset')+'</div></div>'+categories()+'</section>'+
'<section class="bd22-panel bd22-footer"><div class="bd22-actions">'+btn('← Budget Management','cancel')+btn('Discard Draft','discard')+'</div><div class="bd22-actions">'+btn('Save as Template','saveTemplate')+btn('✓ Save Budget','save','primary')+'</div></section></div>'+
'<aside class="bd22-side">'+preview+projection+
'<section class="bd22-panel" id="bd22-rules"><h2>Budget Rules & Alerts</h2>'+rules()+'</section>'+
'<section class="bd22-panel"><div class="bd22-title"><h2>Budget Goals</h2>'+btn('View Goals','goals')+'</div><div class="bd22-goal"><span>◎</span><div><b>Stay within budget</b><small>Keep total spending below '+kes(draft.limit)+'</small><div class="bd22-progress" style="--fill:'+Math.min(100,pct(spent,draft.limit))+'%;--cat:#18b78a"><i></i></div><small>'+pct(spent,draft.limit)+'% used · '+kes(Math.max(0,remain))+' remaining</small></div></div></section></aside></div>'+
'<p class="bd22-disclaimer">Designed to match the approved Finance OS visual language. This is a new native Screen 22 because a separate original screenshot was not supplied. Budget alerts are stored as preferences; no external notifications are sent.</p></div>'}
function actClick(e){
const el=e.target.closest?.('[data-budget22]');if(!el||bridge.screen()!==22)return false;
const raw=el.dataset.budget22,[name,...rest]=raw.split(':'),arg=rest.join(':');start();errors=[];
switch(name){
case 'step':draft.step=Number(arg);bridge.render();if(draft.step===2)document.getElementById('bd22-allocation')?.scrollIntoView({block:'nearest'});else if(draft.step===3)document.getElementById('bd22-rules')?.scrollIntoView({block:'nearest'});else window.scrollTo({top:0});break;
case 'type':draft.period=arg;bridge.render();break;
case 'amount':draft.limit=Number(arg);bridge.render();break;
case 'template':draft.categories=Object.fromEntries(defs.map(([n,v])=>[n,v]));draft.limit=300000;bridge.render();break;
case 'copy':{const s=bridge.model.spendV2;draft.categories={...s.categories};draft.limit=Number(s.budgetLimit);draft.name=s.budgetName||draft.name;bridge.render();break}
case 'suggest':{const portions=[.40,.15,.10,.08,.06,.05,.04,.04,.03,.05];let assigned=0;defs.forEach((c,i)=>{const v=i===9?draft.limit-assigned:Math.floor(draft.limit*portions[i]/100)*100;draft.categories[c[0]]=v;assigned+=v});bridge.render();break}
case 'equalize':{const n=defs.length,v=Math.floor(draft.limit/n/100)*100;let allocated=0;defs.forEach((x,i)=>{draft.categories[x[0]]=i===n-1?draft.limit-allocated:v;allocated+=draft.categories[x[0]]});bridge.render();break}
case 'balance':{let allocation=total(),assigned=0;if(allocation<=0){draft.categories=Object.fromEntries(defs.map(([n,v])=>[n,v]));allocation=total()}defs.forEach((x,i)=>{const val=i===defs.length-1?draft.limit-assigned:Math.round(Number(draft.categories[x[0]]||0)/allocation*draft.limit/100)*100;draft.categories[x[0]]=val;assigned+=val});bridge.render();break}
case 'reset':draft=null;start();bridge.render();break;
case 'discard':draft=null;errors=[];bridge.navigate(21);break;
case 'cancel':draft=null;bridge.navigate(21);break;
case 'goals':bridge.navigate(37);break;
case 'saveTemplate':bridge.model.spendV2.budget22Template={name:draft.name,limit:draft.limit,categories:{...draft.categories}};bridge.save();errors=['Budget draft template saved locally.'];bridge.render();break;
case 'save':{
const sum=total();
if(!draft.name.trim())errors.push('Enter a budget name.');
if(!(draft.limit>0))errors.push('Budget amount must be positive.');
if(sum!==draft.limit)errors.push('Category allocations must equal '+kes(draft.limit)+'; currently '+kes(sum)+'.');
if(errors.length){bridge.render();break}
const s=bridge.model.spendV2;
s.budgetName=draft.name.trim();s.budgetLimit=draft.limit;s.budgetPeriod=draft.period;s.budgetMonth=draft.month;s.categories={...draft.categories};s.rollover={...draft.rollover};s.rules={...draft.rules};
bridge.save();draft=null;bridge.navigate(21);break;
}
default:break}
return true}
function actChange(e){
if(bridge.screen()!==22)return false;
const x=e.target;if(x.dataset?.budget22cat){start();let v=Number(x.value);if(!Number.isFinite(v)||v<0){errors=['Enter a non-negative allocation.'];bridge.render();return true}draft.categories[x.dataset.budget22cat]=v;errors=[];bridge.render();return true}
if(x.dataset?.budget22roll){start();draft.rollover[x.dataset.budget22roll]=x.checked;bridge.render();return true}
if(x.dataset?.budget22Rule){start();draft.rules[x.dataset.budget22Rule]=x.checked;bridge.render();return true}
if(x.dataset?.budget22change==='threshold'){start();draft.rules.alertThreshold=Number(x.value);bridge.render();return true}
if(x.dataset?.budget22value){start();const k=x.dataset.budget22value,v=k==='limit'?Number(x.value):x.value;draft[k]=v;errors=[];bridge.render();return true}
return false}
window.FinanceBudget22={init,render,actClick,actChange};
})();