
(()=>{
'use strict';
let bridge;
const $=s=>document.querySelector(s);
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=n=>(Number(n)<0?'−':'')+'KES '+Math.abs(Math.round(Number(n)||0)).toLocaleString('en-KE');
const percent=(a,b)=>Math.round(100*Number(a||0)/Math.max(1,Number(b)||0));
const palette=['#18b88a','#338cda','#a974da','#f2b24f','#ef7790','#8baec2','#39a6b2'];
const pages={
56:['Financial Health & Insights','Get a complete view of your financial health with personalized insights, recommendations and next steps.'],
57:['AI Financial Advisor','Get personalized financial advice, insights and recommendations powered by AI.'],
58:['Financial Reports & Reviews','Generate, view and analyze your financial performance with comprehensive reports and insights.'],
59:['Integrations & Account Synchronization','Connect your financial accounts, sync your data securely, and keep everything in one place.'],
60:['Settings, Privacy, Security & Audit History','Manage your preferences, protect your data, and keep track of all account activities.']
};
const defaults=()=>({
 chat:[
 {kind:'assistant',text:'Hello! I can help you explore spending, budgets, cash flow and savings in this demo. My answers use a fixed set of rules and your local example records; no AI model or external financial service is connected.',at:'Demo'}
 ],
 reports:[],reportsSettings:{monthly:true,weekly:false,billReview:true,goalReview:false},reportFilter:'All',
 integrations:[
 {id:'kcb',provider:'KCB Bank',category:'Banks',type:'Bank Account',demo:false},
 {id:'equity',provider:'Equity Bank',category:'Banks',type:'Bank Account',demo:false},
 {id:'absa',provider:'Absa Bank',category:'Banks',type:'Bank Account',demo:false},
 {id:'mpesa',provider:'M-PESA',category:'Payments',type:'Mobile Money',demo:false},
 {id:'safaricom',provider:'Safaricom',category:'Payments',type:'Mobile Money',demo:false},
 {id:'nse',provider:'Nairobi Securities Exchange',category:'Investment',type:'Investment',demo:false},
 {id:'cooperative',provider:'Co-operative Bank',category:'Banks',type:'Bank Account',demo:false},
 {id:'cbk',provider:'Government Securities',category:'Investment',type:'Fixed Income',demo:false},
 {id:'stanbic',provider:'Stanbic Bank',category:'Banks',type:'Bank Account',demo:false},
 {id:'wise',provider:'Wise',category:'Payments',type:'Payment Service',demo:false},
 {id:'stripe',provider:'Stripe',category:'Payments',type:'Payments',demo:false},
 {id:'quickbooks',provider:'QuickBooks',category:'Accounting',type:'Accounting',demo:false}
 ],
 syncLog:[],
 integrationsPrefs:{notifications:true,demoAutoSync:false,categoryRules:true,importDuplicates:true,securityAlerts:true,activityNotifications:true},
 security:{theme:'Light',language:'English',dateFormat:'DD MMM YYYY',currency:'KES',timezone:'Africa/Nairobi',displayName:'',emailNotifications:true,billReminders:true,goalReminders:true,weeklyDigest:true,securityNotices:true,productUpdates:false,activityAnalytics:false,personalization:false,dataRetention:'Local browser only',privacyMode:true},
 audit:[],advisorPrefs:{shortAnswers:true,currency:'KES',showAssumptions:true},
 shareLinks:[],lastDataExport:null
});
let ui={tabs:{},notice:'',modal:null,dialogId:null,reportPeriod:'Last 12 Months',reportType:'Income Statement',reportFilter:'All',reportSearch:'',providerCategory:'All',providerSearch:'',chatDraft:'',selectedRecommendation:'',selectedProvider:null,reportId:null,settingTab:'Profile & Preferences'};
function init(ctx){bridge=ctx;if(!bridge.model.governanceV2){bridge.model.governanceV2=defaults();bridge.save()}
const st=state();const d=defaults();for(const [key,val] of Object.entries(d))if(st[key]===undefined)st[key]=structuredClone(val);
}
const model=()=>bridge.model,state=()=>model().governanceV2;
const save=message=>{ui.notice=message||'';bridge.save();bridge.render()};
const goto=n=>bridge.navigate(Number(n));
function audit(event,detail){state().audit.unshift({at:new Date().toISOString(),event,detail});if(state().audit.length>60)state().audit.length=60}
const button=(name,act,variant='')=>'<button type="button" class="gv-btn '+variant+'" data-gv="'+esc(act)+'">'+esc(name)+'</button>';
const nav=(label,n,variant='')=>'<button type="button" class="gv-btn '+variant+'" data-gvnav="'+n+'">'+esc(label)+'</button>';
const panel=(title,body,actions='')=>'<section class="gv-panel"><div class="gv-head"><h2>'+esc(title)+'</h2><div class="gv-actions">'+actions+'</div></div>'+body+'</section>';
const metric=arr=>'<div class="gv-kpis">'+arr.map(x=>'<div class="gv-kpi"><span>'+x[0]+'</span><div><small>'+esc(x[1])+'</small><strong>'+esc(x[2])+'</strong><em>'+esc(x[3]||'')+'</em></div></div>').join('')+'</div>';
const tabs=(n,labels)=>'<div class="gv-tabs">'+labels.map(label=>'<button type="button" class="'+((ui.tabs[n]||labels[0])===label?'on':'')+'" data-gv="tab:'+n+':'+esc(label)+'">'+esc(label)+'</button>').join('')+'</div>';
const tag=(s,type='')=>'<span class="gv-tag '+type+'">'+esc(s)+'</span>';
const field=(label,name,value,type='text',extra='')=>'<label class="gv-field">'+esc(label)+'<input name="'+esc(name)+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></label>';
const select=(label,name,values,chosen)=>'<label class="gv-field">'+esc(label)+'<select name="'+esc(name)+'">'+values.map(v=>'<option '+(v===chosen?'selected':'')+'>'+esc(v)+'</option>').join('')+'</select></label>';
const progress=(a,b,color='#12b082')=>'<div class="gv-progress" style="--w:'+Math.max(0,Math.min(100,percent(a,b)))+'%;--c:'+color+'"><i></i></div>';
const info=(message,warn=false)=>'<div class="gv-note '+(warn?'warn':'')+'">'+esc(message)+'</div>';
const item=(icon,name,sub,val='',act='',variant='')=>'<div class="gv-row"><span class="gv-icon '+variant+'">'+icon+'</span><span class="grow"><b>'+esc(name)+'</b><small>'+esc(sub)+'</small></span>'+(val?'<strong>'+esc(val)+'</strong>':'')+(act?button('View',act):'')+'</div>';
const rows=values=>values.map(([l,v])=>'<div class="gv-row"><span class="grow">'+esc(l)+'</span><strong>'+esc(v)+'</strong></div>').join('');
const mini=arr=>'<div class="gv-mini">'+arr.map(v=>'<div><b>'+esc(v[0])+'</b>'+esc(v[1])+'</div>').join('')+'</div>';
const table=(header,data)=>'<div class="gv-tablebox"><table class="gv-table"><thead><tr>'+header.map(h=>'<th>'+esc(h)+'</th>').join('')+'</tr></thead><tbody>'+data.join('')+'</tbody></table></div>';
const toggle=(key,label,desc,checked,mode='settings')=>'<label class="gv-check"><input type="checkbox" data-gvtoggle="'+esc(mode+':'+key)+'" '+(checked?'checked':'')+'><span style="flex:1"><b>'+esc(label)+'</b><small style="display:block;color:#798a91">'+esc(desc)+'</small></span></label>';
const income=()=>model().incomes.reduce((a,x)=>a+Number(x[1]||0),0);
const expenses=()=>model().expenses.reduce((a,x)=>a+Number(x[1]||0),0);
const accounts=()=>model().accounts;
const cash=()=>accounts().filter((x,i)=>i<=2||String(x[0]).toLowerCase().includes('cash wallet')).reduce((a,x)=>a+Number(x[1]||0),0);
const debts=()=>model().protectionV2?.debts?.reduce((a,d)=>a+Number(d.balance||0),0)||0;
const totalAssets=()=>{
 const v=model().wealthV2;if(!v)return cash();
 return cash()+v.assets.reduce((s,x)=>s+Number(x.value||0),0)+v.holdings.reduce((s,h)=>s+Number(h.shares||0)*Number(h.price||0),0)
};
const nw=()=>totalAssets()-debts();
const savings=()=>model().goals?.filter(g=>/savings|emergency|investments/i.test(g[0])).reduce((sum,g)=>sum+Number(g[1]||0),0)||0;
const saveRate=()=>Math.max(0,Math.min(100,100*(income()-expenses())/Math.max(1,income())));
const debtIncome=()=>debts()/Math.max(1,income()*12);
const goalsProgress=()=>model().goals?.length?model().goals.reduce((s,g)=>s+Math.min(1,Number(g[1])/Math.max(1,Number(g[2]))),0)/model().goals.length:0;
function health(){
 const rate=saveRate(),dti=debtIncome(),buffer=cash()/Math.max(1,expenses());
 const savingsScore=Math.max(0,Math.min(100,Math.round(rate*2.3)));
 const debtScore=Math.max(0,Math.min(100,Math.round(100-55*dti)));
 const cashScore=Math.max(0,Math.min(100,Math.round(buffer*28)));
 const goalScore=Math.round(goalsProgress()*100);
 const investScore=Math.min(100,Math.round((model().wealthV2?.holdings?.length||0)*12));
 const insuranceScore=Math.min(100,(model().protectionV2?.policies?.filter(x=>x.status==='Active')?.length||0)*18);
 const score=Math.round(.23*savingsScore+.21*debtScore+.20*cashScore+.16*goalScore+.12*investScore+.08*insuranceScore);
 return {score,savingsScore,debtScore,cashScore,goalScore,investScore,insuranceScore,rate,buffer,dti,investments:model().wealthV2?.holdings?.reduce((s,h)=>s+h.shares*h.price,0)||0};
}
function donut(data,total){
const sum=data.reduce((a,x)=>a+Number(x.value||0),0);let from=0,pieces=[];
data.forEach((r,i)=>{const next=from+Number(r.value||0)*100/Math.max(1,sum);pieces.push(palette[i%palette.length]+' '+from.toFixed(2)+'% '+next.toFixed(2)+'%');from=next});
return '<div class="gv-donut-wrap"><div class="gv-donut" style="background:conic-gradient('+pieces.join(',')+')"><div class="gv-hole"><b>'+money(total===undefined?sum:total)+'</b><small>Breakdown</small></div></div><div class="gv-legend">'+data.map((x,i)=>'<div class="gv-legend-line"><i style="--c:'+palette[i%palette.length]+'"></i><span class="grow">'+esc(x.name)+'</span><b>'+percent(x.value,sum)+'%</b></div>').join('')+'</div></div>';
}
function plot(style='line',points=12){let path=[],svg='<svg class="gv-chart" role="img" aria-label="Illustrative financial trend chart" viewBox="0 0 430 170">';
for(const y of [24,64,103,141])svg+='<line x1="20" x2="419" y1="'+y+'" y2="'+y+'" stroke="#e9f0ea"/>';
for(let i=0;i<points;i++){const x=28+i*380/Math.max(1,points-1),y=120-i*6+Math.sin(i*.95)*8;path.push([x,y]);
if(style==='bars'||style==='stack'){let base=146;for(let j=0;j<(style==='stack'?3:1);j++){let ht=style==='bars'?40+15*Math.sin(i)+i*3:10+j*9+Math.sin(i+j)*3;base-=ht;svg+='<rect x="'+(x-8)+'" y="'+base+'" width="16" height="'+ht+'" fill="'+palette[j]+'"/>'}}}
if(style==='line'||style==='area'){const d=path.map(([x,y],i)=>(i?'L':'M')+x+' '+y).join(' ');
if(style==='area')svg+='<path d="'+d+' L'+path.at(-1)[0]+' 144 L'+path[0][0]+' 144 Z" fill="#e1f7ee"/>';
svg+='<path d="'+d+'" fill="none" stroke="#12b58a" stroke-width="2.5"/><path d="'+path.map(([x,y],i)=>(i?'L':'M')+x+' '+(y+22+Math.cos(i)*6)).join(' ')+'" fill="none" stroke="#3b8ada" stroke-width="2"/>'}
for(let i=0;i<Math.min(points,12);i++){if(i%Math.ceil(points/6)!==0)continue;svg+='<text x="'+path[i][0]+'" y="163" font-size="9" fill="#728792">'+['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'][i%12]+'</text>'}
return svg+'</svg>';
}
function radar(stats){let out='<svg class="gv-radar" viewBox="0 0 260 160" role="img" aria-label="Financial health factor comparison">';
const names=['Savings','Debt','Cash','Goals','Investments','Insurance'],values=[stats.savingsScore,stats.debtScore,stats.cashScore,stats.goalScore,stats.investScore,stats.insuranceScore],cx=130,cy=77;
for(let step=1;step<=4;step++){const pts=names.map((_,i)=>[cx+Math.cos(-Math.PI/2+i*Math.PI/3)*step*16,cy+Math.sin(-Math.PI/2+i*Math.PI/3)*step*16].join(',')).join(' ');out+='<polygon points="'+pts+'" fill="none" stroke="#ddeae2"/>'}
const path=values.map((v,i)=>[cx+Math.cos(-Math.PI/2+i*Math.PI/3)*(v/100*64),cy+Math.sin(-Math.PI/2+i*Math.PI/3)*(v/100*64)].join(',')).join(' ');
out+='<polygon points="'+path+'" fill="#23bf8d" fill-opacity=".22" stroke="#0ba87a" stroke-width="2"/>';
for(let i=0;i<names.length;i++){const x=cx+Math.cos(-Math.PI/2+i*Math.PI/3)*84,y=cy+Math.sin(-Math.PI/2+i*Math.PI/3)*80;out+='<text x="'+x+'" y="'+y+'" font-size="9" fill="#697c88" text-anchor="middle">'+names[i]+'</text>'}
return out+'</svg>';
}
function shell(n,body){return '<div class="gv-page"><section class="banner"><div><div class="banner-date">Finance　›　'+esc(pages[n][0])+'</div><h1>'+esc(pages[n][0])+'</h1><p>'+esc(pages[n][1])+'</p></div><div class="banner-quote">“Make better decisions<br>today for a better<br>financial tomorrow.”</div></section><div class="gv-inner">'+(ui.notice?'<div class="gv-note" role="status">'+esc(ui.notice)+'</div>':'')+body+
'<p class="gv-note warn">Public static prototype: demo records in your browser. No live AI advice, banking connections, actual financial reports, managed identities, encryption service or server-side account security. '+button('Compare approved Screen '+n,'reference')+'</p></div>'+dialog()+'</div>'}


function healthTips(){const h=health();return [
['✦','Review expense allocations','Aim to keep savings sustainable without missing essential bills.',21],
['◉','Protect an emergency cash reserve','Available personal cash covers '+h.buffer.toFixed(1)+' illustrative months of expenses.',39],
['▣','Check high-interest debt','Debt-to-income and required payment obligations affect resilience.',43],
['↑','Evaluate investment concentration','Review the share held in each asset class; market returns are simulated.',55]
]}
function screen56(){const h=health();const breakdown=[
['Savings & Cash Reserve',h.savingsScore,'#0db887',23],
['Debt Management',h.debtScore,'#3d98d8',21],
['Cash Flow Stability',h.cashScore,'#0db887',20],
['Financial Goals',h.goalScore,'#b280d6',16],
['Investment Balance',h.investScore,'#ffb95a',12],
['Insurance Coverage',h.insuranceScore,'#e87e9c',8]];
const healthByMonth=['Apr','May','Jun','Jul','Aug','Sep','Oct'];
return shell(56,metric([['◈','Financial Health Score',h.score+'/100','Illustrative index'],['▥','Net Worth',money(nw()),'Shared wealth records'],['↗','Monthly Cash Flow',money(income()-expenses()),'Income less expenses'],['◆','Savings Rate',h.rate.toFixed(1)+'%','Derived from demo cash flow'],['▤','Debt to Income',h.dti.toFixed(2),'Debt / 12× income']])+
tabs(56,['Overview','Cash Flow Health','Spending Analysis','Savings & Goals','Debt Health','Investment Health','Risk & Protection','Key Insights','Recommendations'])+
'<div class="gv-grid">'+panel('Financial Health Overview',radar(h)+
mini([[h.score+'/100','Current Score'],[h.score>=70?'Good':'Needs Review','Health Rating'],['Rule-based','Method']])+
info('Your score combines six local factors. It is not an externally validated credit or clinical assessment.'))+
panel('Financial Health Score Breakdown',breakdown.map(([title,val,color,weight])=>'<div class="gv-row"><span style="width:112px">'+esc(title)+'</span><div class="grow">'+progress(val,100,color)+'</div><strong>'+val+'/100</strong><span style="color:#7a9098;width:23px">'+weight+'%</span></div>').join(''))+
panel('Financial Health Trend',plot('line',7)+info('Historical score series are illustrative until actual snapshots are recorded.'))+
panel('Cash Flow Health',plot('stack',7)+mini([[money(income()),'Income'],[money(expenses()),'Expenses'],[money(income()-expenses()),'Net cash flow']]),nav('Cash Flow Timeline',32))+
panel('Spending Insights',donut(model().expenses.map(x=>({name:x[0],value:Number(x[1])})),expenses()),nav('Analyze Spending',16))+
panel('Top Insights',[
['✓','Your income covers recorded expenses',money(income()-expenses())+' monthly remaining',4],
['⚑','Some liabilities remain outstanding',money(debts())+' in the debt ledger',43],
['◉','Monitor goals and cash runway',model().goals.length+' saved goal records',37],
['◷','Review recurring obligations','Monthly spending estimates can omit unrecorded bills',30]
].map(x=>item(x[0],x[1],x[2],'','navigate:'+x[3])).join(''))+
panel('Goals Progress',model().goals.slice(0,5).map(g=>'<div class="gv-row"><span class="grow"><b>'+esc(g[0])+'</b><small>'+money(g[1])+' / '+money(g[2])+'</small>'+progress(g[1],g[2])+'</span><strong>'+percent(g[1],g[2])+'%</strong></div>').join(''),nav('All Goals',37))+
panel('Areas to Improve',[['Emergency reserve',h.cashScore],['Debt interest exposure',h.debtScore],['Goal funding',h.goalScore],['Investing diversification',h.investScore]].map(([title,value])=>'<div class="gv-row"><span class="grow"><b>'+esc(title)+'</b>'+progress(value,100,value<45?'#e78187':'#19ac83')+'</span>'+tag(value<45?'Review':'On Track',value<45?'warn':'')+'</div>').join(''))+
panel('AI Advisor Recommendations',healthTips().map(x=>item(x[0],x[1],x[2],'','navigate:'+x[3])).join('')+
info('Recommendations are deterministic, not generated by a connected AI model.'),nav('Open Advisor',57,'primary'))+
'</div>')}
function deterministicAnswer(question){
const q=String(question||'').toLowerCase(),h=health();
if(/(home|house|property|buy.*house|mortgage)/.test(q))return 'Your recorded cash is '+money(cash())+' and existing debt is '+money(debts())+'. Compare your deposit goal with available cash, then review loan rates and affordability. The app cannot approve a mortgage or determine current house prices. Open the affordability simulator for a local scenario.';
if(/(save|saving|goal|emergency|budget)/.test(q))return 'Your demo monthly income is '+money(income())+', expenses are '+money(expenses())+', and your calculated savings headroom is '+money(income()-expenses())+'. Consider directing a portion to your emergency fund while protecting bill payments. Review your budget and existing goals before committing funds.';
if(/(invest|portfolio|stock|risk|diversif)/.test(q))return 'The recorded net worth is '+money(nw())+' and the investment workspace contains '+(model().wealthV2?.holdings?.length||0)+' demo holdings. Market prices and performance are synthetic. For a real allocation decision, consider diversification, liquidity, fees and professional advice.';
if(/(debt|loan|repayment|credit)/.test(q))return 'Your recorded outstanding debt is '+money(debts())+'. A repayment optimizer can compare paying the highest-interest debt first with clearing smaller balances first. Verify real contract rates and payment penalties before taking action.';
if(/(tax|kra|deduct)/.test(q))return 'Tax figures here are planning placeholders. Use the official Kenya Revenue Authority systems and a qualified tax professional to determine obligations, filing deadlines and eligible reliefs; this prototype cannot submit returns.';
if(/(cash|flow|bill|expense|spend)/.test(q))return 'Estimated monthly inflows are '+money(income())+' against spending of '+money(expenses())+'. This excludes any unrecorded expenses. Review upcoming bills in the cash-flow calendar and use the forecast to test a conservative scenario.';
if(/(retire|retirement|pension)/.test(q))return 'Your retirement plan can test savings, inflation and investment return assumptions, but projections are not guarantees. Use the retirement screen to review your monthly contribution and expected years until retirement.';
return 'I can review savings, debt, cash flow, budgets, investing, retirement and taxes using the demo records. Try asking about a concrete goal. This is a scripted assistant, not a connected AI or licensed financial adviser.';
}
function advisorInsights(){const h=health();return [
['▤','Income and spending','Cash flow headroom is '+money(income()-expenses()),'cashflow'],
['◆','Savings progress',model().goals.length+' local goals need ongoing review','savings'],
['⚑','Debt position',money(debts())+' in outstanding principal','debt'],
['◉','Portfolio overview',(model().wealthV2?.holdings.length||0)+' illustrative investment holdings','investments']
]}
function screen57(){const h=health(),ch=state().chat;
return shell(57,metric([['◈','Financial Health Score',h.score+'/100','Local assessment'],['▥','Net Worth',money(nw()),'Demo financial position'],['↗','Monthly Cash Flow',money(income()-expenses()),'Income less expenses'],['◆','Savings Rate',h.rate.toFixed(1)+'%','Monthly headroom'],['▤','Investment Holdings',String(model().wealthV2?.holdings.length||0),'Not live prices']])+
tabs(57,['Chat Advisor','Personalized Insights','Recommendations','What-if Scenarios','Goal Planning','Tax Advisor','Investment Advisory','Retirement Advisory','Knowledge Hub','Settings'])+
'<div class="gv-ai-layout">'+panel('Chat with Your AI Financial Advisor','<div class="gv-chat">'+
'<div class="gv-chatlog" role="log" aria-label="Local financial guidance chat">'+ch.slice(-14).map(msg=>'<div class="gv-chat-msg '+esc(msg.kind)+'">'+(msg.kind==='assistant'?'✦　':'')+esc(msg.text)+'<small>'+esc(msg.at)+'</small></div>').join('')+'</div>'+
'<div class="gv-promptbox"><b>Demo assistant</b> — scripted suggestions generated locally from the sample financial records. It cannot access an AI model, your bank, or personal data outside this browser.</div>'+
'<form class="gv-form" data-gvform="chat"><div class="gv-chat-input"><input name="question" maxlength="700" required aria-label="Ask the local financial advisor" placeholder="Ask about a budget, goal or financial decision…"><button class="gv-btn primary" type="submit">➤ Send</button></div></form>'+
'<div class="gv-chat-actions">'+['How much can I save monthly?','What is my debt situation?','How can I afford a house?','Review my investments'].map((q,i)=>button(q,'prompt:'+i)).join('')+'</div>'+
'</div>')+
'<div class="gv-grid equal" style="grid-template-columns:repeat(2,minmax(0,1fr))">'+
panel('Personalized Insights',advisorInsights().map(x=>item(x[0],x[1],x[2],'','advisor:'+x[3])).join(''))+
panel('Recommended Actions',healthTips().slice(0,4).map(x=>item(x[0],x[1],x[2],'','navigate:'+x[3])).join(''))+
panel('What-if Scenarios','<h3>Home Purchase — Planning Example</h3>'+
mini([[money(cash()),'Current Cash'],[money(debts()),'Current Debts'],[money(Math.max(0,income()-expenses())),'Monthly Headroom']])+
'<form data-gvform="scenario" class="gv-form">'+
'<div class="gv-fields">'+field('Desired Purchase Amount (KES)','target',2500000,'number','min="1" required')+
field('Monthly Allocation (KES)','monthly',30000,'number','min="1" required')+'</div><button class="gv-btn primary" type="submit">Run Scenario</button></form>')+
panel('Goal Progress & Advisor Notes',model().goals.slice(0,4).map(g=>'<div class="gv-row"><span class="grow"><b>'+esc(g[0])+'</b>'+progress(g[1],g[2])+'</span><span>'+percent(g[1],g[2])+'%</span></div>').join('')+nav('Review all Goals',37))+
panel('Recent Questions',ch.filter(x=>x.kind==='user').slice(-4).reverse().map(x=>item('◷',x.text.slice(0,55),'Local chat history')).join('')||info('Ask a question to build a local chat history.'))+
'</div></div>')}

/* SCREENS_58_60 */
})();