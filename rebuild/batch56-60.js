
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


function reportTypes(){return [
['Income Statement','Income, expenses and financial surplus','income'],
['Expense Report','Spending categories and transaction activity','expenses'],
['Cash Flow Statement','Income, expenses and cash-position context','cashflow'],
['Net Worth Report','Asset, liability and net-worth snapshot','networth'],
['Investment Performance Report','Holdings, cost basis and estimated unrealized returns','investments'],
['Debt Repayment Report','Current principal balances and repayment obligations','debt'],
['Tax Summary Report','Recorded tax-planning placeholders','tax'],
['Goal Progress Report','Savings targets and amounts saved','goals'],
['Budget Performance','Category allocations and planning estimates','budget'],
['Custom Report','All major finance summaries from local demo records','custom']
]}
function reportData(type){
const h=health();let rows=[['Metric','Amount (KES)'],['Monthly income',income()],['Monthly expenditure',expenses()],['Cash flow headroom',income()-expenses()]];
if(type==='Expense Report'||type==='Budget Performance'){rows=[['Category','Amount (KES)'],...model().expenses.map(x=>[x[0],Number(x[1])])];if(type==='Budget Performance')rows.push(['Budget Target',model().spendV2?.budgetLimit||0])}
if(type==='Net Worth Report')rows=[['Metric','Amount (KES)'],['Total Assets',totalAssets()],['Total Debts',debts()],['Net Worth',nw()],['Personal Cash',cash()]];
if(type==='Investment Performance Report')rows=[['Holding','Estimated Value (KES)'],...(model().wealthV2?.holdings||[]).map(x=>[x.name,x.shares*x.price])];
if(type==='Debt Repayment Report')rows=[['Debt','Outstanding Principal (KES)'],...(model().protectionV2?.debts||[]).map(x=>[x.name,x.balance])];
if(type==='Goal Progress Report')rows=[['Goal','Amount Saved (KES)','Target (KES)'],...model().goals.map(g=>[g[0],g[1],g[2]])];
if(type==='Tax Summary Report')rows=[['Tax Metric','Amount (KES)'],['Estimated tax liability',model().protectionV2?.taxes?.estimatedTax||0],['Recorded tax paid',model().protectionV2?.taxes?.paid||0]];
return rows;
}
function reportHistory(){const reports=state().reports.filter(x=>ui.reportFilter==='All'||x.type===ui.reportFilter).filter(x=>x.type.toLowerCase().includes(ui.reportSearch.toLowerCase()));
return table(['Report Name','Type','Period','Generated','Actions'],reports.map(x=>'<tr><td><b>'+esc(x.name)+'</b></td><td>'+esc(x.type)+'</td><td>'+esc(x.period)+'</td><td>'+esc(x.date)+'</td><td>'+button('Export CSV','reportExport:'+x.id)+'　'+button('View','reportView:'+x.id)+'</td></tr>'))}
function screen58(){const h=health();const st=state(),hist=st.reports;
return shell(58,metric([['▥','Total Income',money(income()),'Recorded monthly'],['▣','Total Expenses',money(expenses()),'Recorded monthly'],['↑','Net Savings Potential',money(income()-expenses()),'Pre-commitment surplus'],['◉','Net Worth',money(nw()),'Shared wealth ledger'],['◆','Health Score',h.score+'/100','Local model']])+
tabs(58,['Overview','Income Reports','Expense Reports','Cash Flow Reports','Investment Reports','Tax Reports','Goal Progress Reports','Custom Reports'])+
'<div class="gv-toolbar">'+select('Reporting Period','period',['Last 30 Days','Last 3 Months','Last 6 Months','Last 12 Months'],ui.reportPeriod)+
button('Generate Report','generateReport','primary')+'</div>'+
'<div class="gv-grid">'+panel('Financial Performance Overview',plot('bars',12)+
info('Chart series are illustrative; exported snapshots use local records only.'),button('Last 12 Months','reportTime'))+
panel('Income vs Expense Breakdown',donut([{name:'Income',value:income()},{name:'Expenses',value:expenses()}],income()+expenses())+
rows([['Monthly Income',money(income())],['Monthly Expenses',money(expenses())],['Remaining Headroom',money(income()-expenses())]]))+
panel('Quick Reports',reportTypes().slice(0,9).map(([name,desc],i)=>item('▤',name,desc,'','reportType:'+i)).join(''))+
panel('Key Financial Ratios',mini([[h.rate.toFixed(1)+'%','Savings rate'],[(debts()/Math.max(1,totalAssets())).toFixed(2),'Debt/assets'],[(cash()/Math.max(1,expenses())).toFixed(1),'Cash months']])+rows([['Net worth',money(nw())],['Recorded debt',money(debts())],['Financial health',h.score+'/100']]))+
panel('Report History',reportHistory()+info('History stores local report metadata. Reports are snapshots generated from the current browser demo records.'),button('Generate New Report','generateReport'))+
panel('Scheduled Reports',reportSchedule())+
panel('Financial Review Notes',[
['✓','Income and expenses reviewed','Cash flow headroom: '+money(income()-expenses())],
['◷','Tax planning records','Check official requirements before filing'],
['◆','Debt and investment positions','Use shared demo values with caution']
].map(x=>item(x[0],x[1],x[2])).join(''))+
panel('Insights from Reports',healthTips().slice(0,3).map(x=>item(x[0],x[1],x[2],'','navigate:'+x[3])).join(''))+
panel('Export & Share',[
['CSV Report','reportCsv'],['Download JSON Summary','reportJson'],['Print / Save as PDF','reportPrint']
].map(x=>item('↓',x[0],'Local export, no sharing service','',x[1])).join(''))+
'</div>')}
function reportSchedule(){const settings=state().reportsSettings;return [
['monthly','Monthly Financial Summary','Stored schedule preference, not delivered'],
['weekly','Weekly Spend Review','Requires notification infrastructure'],
['billReview','Bill & Obligation Report','No automated email or scheduler'],
['goalReview','Goal Progress Report','Review manually in this prototype']
].map(([key,title,desc])=>toggle(key,title,desc,!!settings[key],'reports')).join('')+info('No background job or email provider is configured. These switches only store the desired schedule.')}
function integrAccounts(){const st=state().integrations;
return table(['Institution / Service','Account Name','Type','Demo Status','Last Sync','Actions'],st.filter(x=>ui.providerCategory==='All'||x.category===ui.providerCategory).filter(x=>x.provider.toLowerCase().includes(ui.providerSearch.toLowerCase())).map((x,i)=>'<tr><td><b>'+esc(x.provider)+'</b></td><td>'+esc(x.type)+' Example</td><td>'+esc(x.category)+'</td><td>'+tag(x.demo?'Demo prepared':'Not connected',x.demo?'blue':'warn')+'</td><td>Never — no API</td><td>'+button(x.demo?'Manage':'Preview','provider:'+x.id)+'</td></tr>'))}
function providerTiles(){return state().integrations.filter(x=>ui.providerCategory==='All'||x.category===ui.providerCategory).filter(x=>x.provider.toLowerCase().includes(ui.providerSearch.toLowerCase())).map(x=>
'<div class="gv-provider"><span class="gv-icon blue">▣</span><span class="grow"><b>'+esc(x.provider)+'</b><small>'+esc(x.category)+'</small></span>'+
'<button data-gv="provider:'+x.id+'" type="button">Preview</button></div>').join('')}
function syncPrefs(){const s=state().integrationsPrefs;return [
['notifications','Demo Sync Preferences','Enable demo-only notifications preference'],
['demoAutoSync','Automatic Sync','Unavailable until a real connector is installed'],
['categoryRules','Transaction Categories','Remember manual category choices'],
['importDuplicates','Check Import Duplicates','Preference for future statement imports'],
['securityAlerts','Sync Security Alerts','No live security event source'],
['activityNotifications','Account Activity Notices','Not delivered externally']
].map(([k,title,desc])=>toggle(k,title,desc,!!s[k],'integration')).join('')}
function screen59(){const st=state(),configured=st.integrations.filter(x=>x.demo).length,healthCount=0;
return shell(59,metric([['🔗','Connected Accounts','0','No verified provider connections'],['◷','Last Sync','Never','No live sync workers'],['▥','Total Synced Balance',money(0),'Authoritative balance only'],['◆','Data Security','Not configured','Static browser prototype'],['↻','Sync Status','Unavailable','Real API not connected']])+
tabs(59,['All Integrations','Bank Accounts','Investment Accounts','Payment Services','Crypto & Digital Assets','Property & Assets','Insurance & Policies','Accounting & Business','Other Services','Settings'])+
'<div class="gv-toolbar">'+select('Category','category',['All','Banks','Investment','Payments','Accounting'],ui.providerCategory)+
'<input placeholder="Search institutions…" aria-label="Search integrations" data-gvsearch="provider" value="'+esc(ui.providerSearch)+'">'+button('Connect Account','connectInfo','primary')+'</div>'+
'<div class="gv-grid"><section class="gv-panel gv-span2"><div class="gv-head"><h2>Available Connection Templates</h2>'+tag(configured+' demo-ready · 0 real connections','warn')+'</div>'+integrAccounts()+'</section>'+
panel('Available Integrations', '<div class="gv-provider-grid">'+providerTiles()+'</div>')+
panel('Account Sync Settings',syncPrefs())+
panel('Data & Security',[
['◆','No OAuth tokens','This frontend cannot authorize access to bank accounts.'],
['▤','Browser-only sample data','Financial fixtures remain in localStorage.'],
['◷','No automatic synchronizer','No background worker or API connection exists.'],
['✓','Manual statement import','Use the statement import screen if needed.']
].map(x=>item(x[0],x[1],x[2])).join('')+nav('Statement Import',13))+
panel('Sync Activity',st.syncLog.slice(0,7).map(x=>item('◷',x.event,x.at,x.status)).join('')||info('No actual synchronization history.'))+
panel('Connection Health','<div class="gv-health-orb" style="--p:0%"><div><b>0%</b><small>Verified connections</small></div></div>'+
mini([['0','Connected'],[String(st.integrations.length),'Templates'],[String(configured),'Demo prepared']])+info('No service has been authenticated or had data synchronized.'))+
panel('Provider Onboarding Notes',item('①','Review provider permissions','Connectors must use official APIs and user consent.')+
item('②','Authorize through OAuth where available','Do not paste passwords or banking tokens here.')+
item('③','Verify data retention and deletion','Encrypted storage and server audit are required before production.'))+
'</div>')}


function profileDetails(){
const profile=model().profile,setting=state().security;return '<div class="gv-row"><span class="gv-icon purple">♙</span><span class="grow"><b>'+esc(profile.name)+'</b><small>'+esc(profile.email||'Sample profile, email not set')+'</small></span>'+button('Edit Profile','editProfile')+'</div>'+
rows([['Full Name',profile.name],['Email Address',profile.email||'Not entered'],['Phone Number',profile.phone||'Not entered'],['Timezone',setting.timezone],['Currency',setting.currency],['Language',setting.language],['Date Format',setting.dateFormat]])+
'<div class="gv-actions">'+button('Light Theme','theme:Light',setting.theme==='Light'?'active':'')+button('Dark Theme','theme:Dark',setting.theme==='Dark'?'active':'')+button('System','theme:System',setting.theme==='System'?'active':'')+'</div>'+
info('These settings are saved locally; no user account profile or authenticated session exists.')}
function securityRows(){
return [
['⚑','Password','Not managed in this static prototype','password'],
['◆','Two-Factor Authentication','Unavailable without a backend identity provider','mfa'],
['▤','Biometric Login','No device-integrated authentication','biometric'],
['◷','Login Notifications','Preference only; no login-alert service','notification'],
['▣','Device Management','Only this browser\'s local demo state is visible','devices'],
['☼','Session Timeout','Not enforced; frontend cannot secure a session','session'],
['▤','Recovery Options','Requires an authenticated backend','recovery']
].map(x=>item(x[0],x[1],x[2],'','security:'+x[3])).join('')}
function privacyRows(){
const set=state().security;return [
item('◆','Data Usage','Browser-only local data; no cloud account','', 'privacy:data'),
item('♧','Data Sharing','No third-party data sharing is configured','', 'privacy:sharing'),
item('↓','Download My Data','Export the browser prototype state in JSON','', 'exportData'),
item('▤','Delete My Demo Data','Permanently clear the Finance OS browser record','', 'deleteData','warn'),
toggle('activityAnalytics','Optional usage analytics','Not enabled; preference stored locally',set.activityAnalytics),
toggle('personalization','Personalization','Local guidance may use demo figures; no remote AI',set.personalization),
item('▣','Cookies & Local Storage','Local storage is used for demo persistence','', 'privacy:cookies')
].join('')}
function notificationRows(){const set=state().security;return [
['emailNotifications','Transaction Alerts','Browser-only preference, no email delivered'],
['billReminders','Bill Reminders','No actual reminders scheduled'],
['goalReminders','Goal Progress','No notification infrastructure installed'],
['weeklyDigest','Financial Digest','Saved preference only'],
['securityNotices','Security Alerts','No authenticated login events generated'],
['productUpdates','Product Updates','No marketing service configured']
].map(x=>toggle(x[0],x[1],x[2],!!set[x[0]])).join('')}
function connectedSummary(){return [
['Bank Account Providers','0 connected','KCB, Equity, Absa available as previews'],
['Investment Providers','0 connected','No live brokerage integration'],
['Mobile Money / Cards','0 connected','No M-Pesa or card permission obtained'],
['Insurance Providers','0 connected','No linked policies'],
['Property & Assets','0 connected','Local sample records only'],
['Accounting & Business','0 connected','No financial data sync']
].map(x=>item('▣',x[0],x[2],x[1],'integrations')).join('')}
function auditTable(){
const list=state().audit.slice(0,15),out=list.map(x=>'<tr><td>'+esc(new Date(x.at).toLocaleString('en-KE',{dateStyle:'short',timeStyle:'short'}))+'</td><td>Local user</td><td>'+esc(x.event)+'</td><td>'+esc(x.detail)+'</td><td>Local browser</td></tr>');
return table(['Date & Time','Actor','Action','Details','Scope'],out.length?out:['<tr><td colspan="5">No local audit events yet. This is not an immutable server audit trail.</td></tr>']);
}
function systemRows(){return [
item('◈','Subscription & Billing','No billing subscription is configured','', 'system:billing'),
item('▣','Regional Settings','Currency and date preferences only','', 'editProfile'),
item('⊕','API Access','No API keys can be created on GitHub Pages','', 'system:api'),
item('⚙','Advanced Settings','Prototype has no backend services','', 'system:advanced'),
item('▤','Data Retention','Clear local browser storage on request','', 'deleteData'),
item('♧','Privacy Preferences','Settings are not provider-enforced','', 'privacy:sharing')
].join('')}
function screen60(){
const set=state().security;
return shell(60,metric([['◆','Account Security','Demo Only','No authenticated backend'],['▣','Data Privacy','Local Browser','Not encrypted by this app'],['▥','Connected Accounts','0','Verified integrations'],['♙','Active Sessions','Not Tracked','No server sessions'],['◷','Last Login','Unknown','Login service not connected']])+
tabs(60,['Profile & Preferences','Security Settings','Privacy & Data Control','Connected Accounts','Notifications','User Management','Audit History','System Settings','Billing & Subscription'])+
'<div class="gv-grid">'+panel('Profile & Preferences',profileDetails())+
panel('Security Settings',info('A server-side identity provider is required for real passwords, MFA, session invalidation or security history.',true)+securityRows())+
panel('Privacy & Data Control',privacyRows())+
panel('Notifications',notificationRows())+
panel('Connected Accounts',connectedSummary(),nav('Manage Preview Integrations',59))+
panel('User Management',table(['Member','Role','Access','Actions'],[
'<tr><td>'+esc(model().profile.name)+'</td><td>Local Demo Owner</td><td>'+tag('Browser only','blue')+'</td><td>—</td></tr>',
'<tr><td>Example Family Member</td><td>View only (mock)</td><td>'+tag('Not invited','warn')+'</td><td>—</td></tr>',
'<tr><td>Example Adviser</td><td>Adviser (mock)</td><td>'+tag('Not invited','warn')+'</td><td>—</td></tr>'
])+info('Multi-user access permissions are not enforced. Do not assume anyone else can view this prototype.'))+
'<section class="gv-panel gv-span2"><div class="gv-head"><h2>Audit History — Local Actions Only</h2>'+button('Export Audit','auditExport')+'</div>'+auditTable()+'</section>'+
panel('System Settings',systemRows())+
'</div>')}


function dialog(){
if(!ui.modal)return '';
let title='',body='';
if(ui.modal==='profile'){const p=model().profile,set=state().security;title='Edit Profile & Preferences';
body='<form data-gvform="profile" class="gv-form"><div class="gv-fields">'+
field('Display Name','name',p.name,'text','required maxlength="100"')+
field('Email (demo only)','email',p.email||'','email','maxlength="150"')+
field('Phone (demo only)','phone',p.phone||'','tel','maxlength="30"')+
select('Currency','currency',['KES','USD','EUR','GBP'],set.currency)+
select('Language','language',['English','Kiswahili'],set.language)+
select('Timezone','timezone',['Africa/Nairobi','UTC'],set.timezone)+
select('Date Format','dateFormat',['DD MMM YYYY','YYYY-MM-DD','DD/MM/YYYY'],set.dateFormat)+
'</div><button class="gv-btn primary" type="submit">Save Profile</button></form>'+info('This is not an authenticated or verified account.');
}else if(ui.modal==='report'){title='Generate Local Financial Report';
body='<form data-gvform="report" class="gv-form">'+
select('Report Type','type',reportTypes().map(x=>x[0]),ui.reportType||'Income Statement')+
select('Period','period',['Last 30 Days','Last 3 Months','Last 6 Months','Last 12 Months'],ui.reportPeriod)+
field('Report Name','name',(ui.reportType||'Income Statement')+' — Snapshot','text','required maxlength="100"')+
info('Saves a snapshot from locally recorded figures, not a certified report.')+
'<button class="gv-btn primary" type="submit">Generate Snapshot</button></form>';
}else if(ui.modal==='provider'){const p=state().integrations.find(x=>x.id===ui.selectedProvider);title=(p?.provider||'Provider')+' — Preview';
body=info('Local template only; there is NO OAuth, no API, no stored credentials, and no live synchronization.',true)+
rows([['Provider',p?.provider||''],['Category',p?.category||''],['Verified Connection','None'],['Last Successful Sync','Never'],['Authorized Tokens','None']])+
'<div class="gv-actions">'+button(p?.demo?'Reset Demo Template':'Prepare Demo Template','providerPrepare','primary')+nav('Manual Statement Import',13)+'</div>';
}else if(ui.modal==='reportView'){const report=state().reports.find(x=>x.id===ui.reportId);title=report?.name||'Report';
body=info('Locally generated snapshot: '+(report?.date||'Unknown date'))+
table(report?.rows?.[0]||['Metric','Value'],(report?.rows||[]).slice(1,17).map(r=>'<tr>'+r.map(x=>'<td>'+esc(x)+'</td>').join('')+'</tr>'))+
button('Export Snapshot CSV','reportExport:'+report?.id,'primary');
}else if(ui.modal==='deleteConfirm'){title='Permanently Delete Local Demo Data';
body=info('Clears the entire Finance OS browser-local demo record: saved edits, reports, chat history and settings. No cloud account exists. This cannot be undone.',true)+
'<div class="gv-actions">'+button('Cancel','closeModal')+button('Confirm Deletion','deleteConfirm','warn')+'</div>';
}else if(ui.modal==='scenarioResult'){const v=ui.scenario||{};title='Purchase Affordability Scenario';
body=rows([['Target amount',money(v.target)],['Personal cash',money(cash())],['Planned allocation',money(v.monthly)],['Months until target',String(v.months)]])+
info('This simple scenario excludes taxes, inflation, loan financing and future expenses.');
}else{title='Unavailable in Static Prototype';body=info('This requires a real identity provider, bank, secure storage, notification or regulatory service. No external request was sent.',true)}
return '<div class="gv-dialog-shade"><div class="gv-dialog" role="dialog" aria-modal="true" aria-label="'+esc(title)+'"><div class="gv-head"><h2>'+esc(title)+'</h2>'+button('Close','closeModal')+'</div>'+body+'</div></div>'}
function download(filename,data,mime='text/plain;charset=utf-8'){const blob=new Blob([data],{type:mime}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500)}
const csvRows=records=>records.map(r=>r.map(x=>'"'+String(x).replace(/"/g,'""')+'"').join(',')).join('\r\n');
function exportReport(type,id){const report=state().reports.find(x=>x.id===id),rows=report?.rows||reportData(type||ui.reportType||'Income Statement');download('finance-os-'+(report?.type||type||'finance').toLowerCase().replace(/[^a-z0-9]+/g,'-')+'-demo.csv',csvRows(rows),'text/csv;charset=utf-8');audit('Export Report',report?.name||type||'Financial Snapshot');save('Local report CSV generated. Figures are illustrative.')}
function render(n){switch(Number(n)){case 56:return screen56();case 57:return screen57();case 58:return screen58();case 59:return screen59();case 60:return screen60();default:return ''}}

/* ACTION_HANDLERS */
})();