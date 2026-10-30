
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

/* REMAINING_SCREENS */
})();