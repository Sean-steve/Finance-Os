
(()=>{
'use strict';
let ctx,draft=null,notice='',step=0,observed='';
const items=[['Housing','⌂','#fa637d',120000],['Food & Dining','♜','#2b9cec',45000],['Transport','▣','#35bc94',30000],['Utilities','ϟ','#ffc260',24000],['Shopping','▥','#b56ee6',18000],['Health & Medical','♥','#fa80a0',15000],['Subscriptions','◉','#3a96e7',12000],['Entertainment','♫','#ba69e0',12000],['Education','▥','#29b886',9000],['Others','···','#9ba5bb',15000]];
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const fmt=n=>'KES '+Math.round(Number(n)||0).toLocaleString('en-KE');
const sum=()=>items.reduce((n,x)=>n+Number(draft.categories[x[0]]||0),0);
const act=(name,key,cl='')=>'<button type="button" data-be22="'+esc(key)+'" class="be22-btn '+cl+'">'+esc(name)+'</button>';
const store=()=>ctx.model.spendV2;
function init(bridge){ctx=bridge}
function snapshot(){const s=store();return JSON.stringify([s.budgetName,s.budgetMonth,s.budgetPeriod,s.budgetLimit,s.categories,s.budgetRollover||s.rollover,s.rules])}
function prepare(){const stateSignature=snapshot();if(draft&&observed===stateSignature)return;const s=store();observed=stateSignature;draft={name:s.budgetName||'October 2026 Budget',month:s.budgetMonth||'October 2026',period:s.budgetPeriod||'Monthly',limit:Number(s.budgetLimit||300000),categories:{...Object.fromEntries(items.map(x=>[x[0],x[3]])),...s.categories},rollover:{...(s.rollover||{}),...(s.budgetRollover||{})},rules:{alertThreshold:80,weeklyDigest:true,unusual:true,paused:false,...s.rules}}}
function pie(){const total=sum();let v=0;const stops=items.map(x=>{const old=v;v+=Number(draft.categories[x[0]]||0)/Math.max(1,total)*100;return x[2]+' '+old.toFixed(2)+'% '+v.toFixed(2)+'%'}).join(',');
return '<div class="be22-pie-wrap"><div class="be22-pie" style="background:conic-gradient('+stops+')"><div><b>'+fmt(total)+'</b><small>Total Budget</small></div></div><div class="be22-legend">'+items.map(x=>'<div><i style="background:'+x[2]+'"></i><span>'+esc(x[0])+'</span><em>'+Math.round(100*Number(draft.categories[x[0]]||0)/Math.max(1,total))+'%</em><strong>'+fmt(draft.categories[x[0]])+'</strong></div>').join('')+'</div></div>'}
function budgetTable(){const total=sum();return '<div class="be22-table-box"><table class="be22-table"><thead><tr><th></th><th>Category</th><th>Allocation (KES)</th><th>% of Budget</th><th>Share</th><th>Monthly Limit</th><th>Rollover</th><th>Actions</th></tr></thead><tbody>'+
items.map(x=>{const value=Number(draft.categories[x[0]]||0),pct=Math.round(100*value/Math.max(1,total));return '<tr><td><span class="be22-cat-icon" style="--accent:'+x[2]+'">'+x[1]+'</span></td><td>'+esc(x[0])+'</td><td><input aria-label="'+esc(x[0])+' allocation in KES" type="number" min="0" step="100" data-be22-cat="'+esc(x[0])+'" value="'+value+'"></td><td>'+pct+'%</td><td><div class="be22-bar"><i style="width:'+pct+'%;background:'+x[2]+'"></i></div></td><td>'+fmt(value)+'</td><td><input aria-label="Rollover '+esc(x[0])+'" type="checkbox" class="be22-switch" data-be22-rollover="'+esc(x[0])+'" '+(draft.rollover[x[0]]??['Housing','Utilities','Health & Medical'].includes(x[0])?'checked':'')+'></td><td>'+act('⋯','category:'+x[0])+'</td></tr>'}).join('')+
'<tr class="be22-sum"><td></td><td>Total</td><td>'+fmt(total)+'</td><td>'+Math.round(total/Math.max(1,draft.limit)*100)+'% of target</td><td><div class="be22-bar"><i style="width:'+Math.min(100,total/Math.max(1,draft.limit)*100)+'%"></i></div></td><td>'+fmt(total)+'</td><td></td><td></td></tr></tbody></table></div>'}
function render(){prepare();const projected=198450;
return '<div class="be22"><div class="be22-hero"><div><small>Budgets　›　Create / Edit Budget</small><h1>Create / Edit Budget</h1><p>Set your budget, allocate across categories, and stay on track with your financial goals.</p></div><blockquote>“A plan today,<br>freedom tomorrow.”</blockquote></div>'+
'<div class="be22-stepper">'+['Basic Details','Category Allocation','Rules & Settings','Review & Save'].map((x,i)=>'<button type="button" data-be22="step:'+i+'" class="'+(step===i?'current':'')+'"><b>'+(i+1)+'</b><span><strong>'+x+'</strong><small>'+['Set budget type and amount','Allocate and customize','Alerts and automation','Confirm and activate'][i]+'</small></span></button>').join('')+'</div>'+
(notice?'<div class="be22-notice" role="status">'+esc(notice)+'</div>':'')+
'<div class="be22-layout"><div class="be22-left"><section class="be22-card"><h2>1. Budget Details</h2><div class="be22-details"><form data-be22-form="budget" class="be22-fields"><label>Budget Name *<input name="name" required value="'+esc(draft.name)+'"></label>'+
'<label>Period *<select name="month">'+['October 2026','November 2026','December 2026','January 2027'].map(x=>'<option '+(draft.month===x?'selected':'')+'>'+x+'</option>').join('')+'</select></label>'+
'<div class="be22-field"><span>Budget Type *</span><div class="be22-types">'+['Monthly','Weekly','Yearly','Custom Range'].map(x=>act(x,'period:'+x,draft.period===x?'selected':'')).join('')+'</div></div>'+
'<label>Total Budget Amount (KES) *<input name="limit" type="number" min="1" value="'+draft.limit+'" required><span class="be22-presets">'+[['KES 100K',100000],['KES 250K',250000],['KES 500K',500000],['Custom',0]].map(x=>act(x[0],'preset:'+x[1])).join('')+'</span></label></form>'+
'<div class="be22-quick"><h3>Quick Setup</h3>'+[['✦','Use Template','Start from a ready-made budget','template'],['◷','Copy from Last Month','Use your previous budget','lastMonth'],['✿','AI Recommended','Illustrative category proportions','suggested']].map(x=>'<button type="button" data-be22="quick:'+x[3]+'"><span>'+x[0]+'</span><b>'+x[1]+'<small>'+x[2]+'</small></b>›</button>').join('')+'</div></div></section>'+
'<section class="be22-card"><header><h2>2. Allocate by Category</h2><div>'+act('Distribute Evenly','even')+act('Reset','reset')+'</div></header>'+budgetTable()+'<div class="be22-footer">'+act('Cancel','cancel')+'<span>'+act('Save as Template','template')+act('→ Save Budget','save','primary')+'</span></div></section></div>'+
'<aside class="be22-right"><section class="be22-card"><header><h2>Budget Preview</h2><small>Monthly View⌄</small></header>'+pie()+'</section>'+
'<section class="be22-card"><h2>Monthly Projection</h2><div class="be22-projection">'+[['Budget',draft.limit],['Projected Spend',projected],['Expected Leftover',draft.limit-projected]].map(x=>'<div><b>'+fmt(x[1])+'</b><small>'+x[0]+'</small></div>').join('')+'</div><div class="be22-bar large"><i style="width:'+Math.min(100,projected/Math.max(1,draft.limit)*100)+'%"></i></div><small>Based on illustrative spending patterns</small></section>'+
'<section class="be22-card"><header><h2>Budget Rules & Alerts</h2>'+act('Edit','step:2')+'</header><div class="be22-rules"><label><span>♧</span>Alert when category spending reaches<select data-be22-threshold>'+[60,70,80,90,100].map(n=>'<option value="'+n+'" '+(draft.rules.alertThreshold===n?'selected':'')+'>'+n+'%</option>').join('')+'</select><input type="checkbox" data-be22-rule="limitEnabled" class="be22-switch" '+(draft.rules.limitEnabled!==false?'checked':'')+'></label>'+
[['weeklyDigest','✉','Send weekly budget summary'],['unusual','⚠','Alert me on unusual spending'],['paused','⌘','Pause alerts for this budget']].map(([k,i,t])=>'<label><span>'+i+'</span>'+t+'<input type="checkbox" class="be22-switch" data-be22-rule="'+k+'" '+(draft.rules[k]?'checked':'')+'></label>').join('')+'</div><small>Preferences only; no notification service connected.</small></section>'+
'<section class="be22-card"><header><h2>Budget Goals</h2>'+act('Link Goal','goals')+'</header><div class="be22-goals">◎ <div><b>Stay within budget</b><small>Keep spending under '+fmt(draft.limit)+'</small><div class="be22-bar large"><i style="width:'+Math.min(100,projected/Math.max(1,draft.limit)*100)+'%"></i></div><small>'+fmt(draft.limit-projected)+' left</small></div></div></section></aside></div>'+
'<p class="be22-caption">Screen 22 recreated using the approved Create / Edit Budget visual language provided for Screen 21. No standalone Screen 22 screenshot was supplied.</p></div>';
}


function syncInputs(){const form=document.querySelector('[data-be22-form="budget"]');if(!form)return;
draft.name=String(form.elements.name.value||draft.name).trim();
draft.month=String(form.elements.month.value||draft.month);
const value=Number(form.elements.limit.value);if(Number.isFinite(value)&&value>0)draft.limit=value}
function change(e){prepare();const el=e.target;
if(el.matches?.('[data-be22-cat]')){const value=Number(el.value);if(Number.isFinite(value)&&value>=0){syncInputs();draft.categories[el.dataset.be22Cat]=value;notice='Category allocation updated. Save to apply changes throughout Finance OS.';ctx.render()}return true}
if(el.matches?.('[data-be22-rollover]')){syncInputs();draft.rollover[el.dataset.be22Rollover]=el.checked;ctx.render();return true}
if(el.matches?.('[data-be22-rule]')){syncInputs();draft.rules[el.dataset.be22Rule]=el.checked;ctx.render();return true}
if(el.matches?.('[data-be22-threshold]')){syncInputs();draft.rules.alertThreshold=Number(el.value);ctx.render();return true}
return false}
function click(e){const el=e.target.closest?.('[data-be22]');if(!el)return false;
e.preventDefault();prepare();syncInputs();
const raw=el.dataset.be22,i=raw.indexOf(':'),key=i===-1?raw:raw.slice(0,i),arg=i===-1?'':raw.slice(i+1);notice='';
switch(key){
case 'step':step=Number(arg);break;
case 'period':draft.period=arg;break;
case 'preset':{const amount=Number(arg);if(amount>0)draft.limit=amount;break}
case 'even':{const per=Math.floor(draft.limit/items.length);items.forEach((c,i)=>draft.categories[c[0]]=per+(i===items.length-1?draft.limit-per*items.length:0));notice='Categories distributed to match your budget target.';break}
case 'reset':items.forEach(c=>draft.categories[c[0]]=c[3]);draft.limit=300000;notice='Default category allocations restored.';break;
case 'quick':{
if(arg==='lastMonth')draft.name='Copied from Previous Month Budget';
if(arg==='template')items.forEach(c=>draft.categories[c[0]]=c[3]);
if(arg==='suggested'){const fractions=[.4,.15,.10,.08,.06,.05,.04,.04,.03,.05];items.forEach((c,i)=>draft.categories[c[0]]=Math.round(fractions[i]*draft.limit))}
notice='Preset added to your draft. Review amounts before saving.';break}
case 'template':{const data=store();data.budgetTemplates??=[];data.budgetTemplates.push({id:'budget-template-'+Date.now(),name:draft.name+' Template',limit:draft.limit,period:draft.period,categories:{...draft.categories},rollover:{...draft.rollover},rules:{...draft.rules}});ctx.save();observed=snapshot();notice='Budget template saved to local planning records; it does not move money.';break}
case 'category':notice='Edit the '+arg+' allocation directly in the row.';break;
case 'goals':ctx.navigate(37);return true;
case 'cancel':draft=null;ctx.navigate(21);return true;
case 'save':{
if(!draft.name){notice='A budget name is required.';break}
if(draft.limit<=0||!Number.isFinite(draft.limit)){notice='Enter a positive budget limit.';break}
if(Math.abs(sum()-draft.limit)>.01){notice='Category allocations must equal the total target before saving. Difference: '+fmt(draft.limit-sum())+'.';break}
const data=store();data.budgetName=draft.name;data.budgetMonth=draft.month;data.budgetPeriod=draft.period;data.budgetLimit=draft.limit;data.categories={...draft.categories};data.rollover={...draft.rollover};data.budgetRollover={...draft.rollover};data.rules={...draft.rules};
ctx.save();observed=snapshot();notice='Budget saved to the shared Finance OS planning records. No real funds have moved.';step=3;break}
default:notice='Local prototype action; no bank or external service contacted.';break
}
ctx.render();return true}
function submit(e){if(e.target.dataset?.be22Form!=='budget')return false;e.preventDefault();syncInputs();step=1;notice='Budget details updated in this draft. Continue to allocate by category and save.';ctx.render();return true}
window.FinanceBudget22={init,render,click,change,submit};

})();