
(()=>{
'use strict';
let ctx;
const $=s=>document.querySelector(s);
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const money=x=>'KES '+Math.round(Math.abs(Number(x)||0)).toLocaleString('en-KE');
const signed=x=>(Number(x)<0?'−':'+')+money(x);
const fnum=x=>Number(x||0).toLocaleString('en-KE',{maximumFractionDigits:2});
const pct=(a,b)=>Math.round(Number(a||0)*100/Math.max(1,Number(b||0)));
const palette=['#14b98b','#2fa4e1','#9865d0','#f1b252','#ef788f','#8baab6','#6e93d0'];
const titles={
 50:['Net Worth Dashboard','Get a complete view of your financial position, track progress over time, and build long-term wealth.'],
 51:['Assets & Liabilities Overview','Get a detailed view of everything you own and owe, and track and understand your financial position.'],
 52:['Asset Details & Valuation','View, manage and track detailed information, valuation, performance and documents for your assets.'],
 53:['Investment Portfolio','Track, analyze and grow your investments across all asset classes in one place.'],
 54:['Investment Details & Performance','Deep dive into a specific investment with detailed performance, analytics and management tools.'],
 55:['Wealth Growth & Risk Analysis','Understand your wealth trajectory, analyze risk, and make smarter decisions for a more secure future.']
};
const seed=()=>({
 assets:[
 {id:'asset-home',name:'Family Home',kind:'Real Estate',icon:'⌂',value:8500000,purchase:6800000,annualGrowth:5.2,location:'Karen, Nairobi, Kenya',date:'2020-03-15',status:'Owner-Occupied',type:'Primary Residence',size:'350 m²',notes:'Illustrative property asset. No title deed verified.'},
 {id:'asset-rental',name:'Apartment (Rental)',kind:'Real Estate',icon:'▥',value:2900000,purchase:2450000,annualGrowth:8,location:'Nairobi, Kenya',date:'2021-05-01',status:'Rental',type:'Residential Property',size:'125 m²',notes:'Illustrative rental unit.'},
 {id:'asset-car',name:'Toyota Prado (2022)',kind:'Vehicle',icon:'▰',value:2200000,purchase:2350000,annualGrowth:-2,location:'Nairobi, Kenya',date:'2022-10-01',status:'In Use',type:'Motor Vehicle',size:'',notes:'Estimated resale value only.'},
 {id:'asset-business',name:'Business Equipment',kind:'Business',icon:'▤',value:1450000,purchase:1250000,annualGrowth:5,location:'Nairobi, Kenya',date:'2022-05-01',status:'Active',type:'Business Asset',size:'',notes:'Equipment and inventory estimates.'},
 {id:'asset-land',name:'Land Plot – Kitengela',kind:'Real Estate',icon:'△',value:1200000,purchase:900000,annualGrowth:6,location:'Kitengela, Kenya',date:'2019-01-01',status:'Held',type:'Land',size:'0.25 acre',notes:'Market estimate, not an official valuation.'},
 {id:'asset-gold',name:'Gold & Collectibles',kind:'Other',icon:'◆',value:1130000,purchase:960000,annualGrowth:12,location:'Personal Holdings',date:'2023-06-01',status:'Held',type:'Collectibles',size:'',notes:'Unverified appraisal estimate.'}
 ],
 holdings:[
 {id:'h-safaricom',name:'Safaricom PLC',ticker:'SCOM',kind:'Kenyan Equities',shares:67568,price:18.5,avg:16.4,change:2.5,platform:'NSE · Demo Portfolio',currency:'KES',notes:'Illustrative prices, not NSE market data.'},
 {id:'h-equity',name:'Equity Group',ticker:'EQTY',kind:'Kenyan Equities',shares:14000,price:80,avg:71.2,change:1.8,platform:'NSE · Demo Portfolio',currency:'KES',notes:'Illustrative prices only.'},
 {id:'h-treasury',name:'Kenya Treasury Bonds',ticker:'KTB',kind:'Fixed Income',shares:15000,price:100,avg:98,change:0.2,platform:'Government securities demo',currency:'KES',notes:'Coupon terms not modelled.'},
 {id:'h-mmf',name:'Money Market Fund',ticker:'MMF',kind:'Money Market Funds',shares:12000,price:100,avg:98,change:0.1,platform:'Demo Fund',currency:'KES',notes:'Returns exclude tax and fees.'},
 {id:'h-etf',name:'Global Equity ETF',ticker:'GETF',kind:'Global ETFs',shares:6000,price:220,avg:193,change:1.2,platform:'Demo Fund',currency:'KES',notes:'Exchange rate conversion not modelled.'},
 {id:'h-reit',name:'Kenya Property REIT',ticker:'KREIT',kind:'Real Estate (REITs)',shares:10000,price:50,avg:47,change:-0.4,platform:'Demo Exchange',currency:'KES',notes:'Illustrative price only.'},
 {id:'h-crypto',name:'Digital Asset Basket',ticker:'DAB',kind:'Other Investments',shares:13,price:20000,avg:22000,change:-3.2,platform:'Demo Portfolio',currency:'KES',notes:'Highly volatile simulated instrument.'}
 ],
 assetNotes:[],assetValuations:[],investEvents:[],activity:[],riskPreferences:{tolerance:'Moderate',horizon:10,annualReturn:6,volatility:12,monthlyAdd:25000},benchmarks:{market:'Illustrative Kenya Market Index',annual:9.2}
});
let ui={tab:{},asset:'asset-home',holding:'h-safaricom',assetSearch:'',assetFilter:'All',holdingSearch:'',holdFilter:'All',holdType:'All',time:'Last 12 Months',modal:null,editId:null,tradeSide:'buy',alert:''};
function state(){return ctx.model.wealthV2}
function init(c){ctx=c;if(!ctx.model.wealthV2){ctx.model.wealthV2=seed();ctx.save()}const st=state(),fallback=seed();for(const [k,v] of Object.entries(fallback))if(st[k]===undefined)st[k]=structuredClone(v);ui.asset=st.assets[0]?.id||null;ui.holding=st.holdings[0]?.id||null}
const save=(message='')=>{ui.alert=message;ctx.save();ctx.render()};
const go=n=>ctx.navigate(Number(n));
const button=(s,cmd,cl='')=>'<button type="button" class="we-btn '+cl+'" data-we="'+esc(cmd)+'">'+esc(s)+'</button>';
const goto=(s,n,cl='')=>'<button type="button" class="we-btn '+cl+'" data-wenav="'+n+'">'+esc(s)+'</button>';
const tag=(s,cl='')=>'<span class="we-tag '+cl+'">'+esc(s)+'</span>';
const field=(title,name,value,type='text',extra='')=>'<label class="we-field">'+esc(title)+'<input name="'+esc(name)+'" type="'+type+'" value="'+esc(value)+'" '+extra+'></label>';
const options=(title,name,values,selected)=>'<label class="we-field">'+esc(title)+'<select name="'+esc(name)+'">'+values.map(x=>'<option '+(x===selected?'selected':'')+'>'+esc(x)+'</option>').join('')+'</select></label>';
const panel=(title,content,actions='')=>'<section class="we-panel"><div class="we-title"><h2>'+esc(title)+'</h2><div class="we-actions">'+actions+'</div></div>'+content+'</section>';
const rows=(xs)=>xs.map(([name,value])=>'<div class="we-row"><span class="grow">'+esc(name)+'</span><strong>'+esc(value)+'</strong></div>').join('');
const mini=(xs)=>'<div class="we-four">'+xs.map(x=>'<div class="we-mini"><b>'+esc(x[0])+'</b>'+esc(x[1])+'</div>').join('')+'</div>';
const bar=(a,b,color='#0fa97e')=>'<div class="we-progress" style="--width:'+Math.min(100,Math.max(0,pct(a,b)))+'%;--bar:'+color+'"><i></i></div>';
const note=(msg,warn=false)=>'<div class="we-note '+(warn?'warn':'')+'">'+esc(msg)+'</div>';
const item=(icon,name,detail,number,cmd='',color='')=>'<div class="we-row"><span class="we-icon '+color+'">'+icon+'</span><span class="grow"><b>'+esc(name)+'</b><small>'+esc(detail)+'</small></span><strong>'+esc(number)+'</strong>'+(cmd?button('View',cmd):'')+'</div>';
const kpis=xs=>'<div class="we-kpis">'+xs.map(x=>'<div class="we-kpi"><span class="we-kpi-icon">'+x[0]+'</span><div><small>'+esc(x[1])+'</small><strong>'+esc(x[2])+'</strong><em>'+esc(x[3]||'')+'</em></div></div>').join('')+'</div>';
const tabs=(n,values)=>'<div class="we-tabs">'+values.map(x=>'<button type="button" class="'+((ui.tab[n]||values[0])===x?'on':'')+'" data-we="tab:'+n+':'+esc(x)+'">'+esc(x)+'</button>').join('')+'</div>';
const table=(cols,records)=>'<div class="we-tablebox"><table class="we-table"><thead><tr>'+cols.map(c=>'<th>'+esc(c)+'</th>').join('')+'</tr></thead><tbody>'+records.join('')+'</tbody></table></div>';
const investmentValue=h=>h.shares*h.price;
const investTotal=()=>state().holdings.reduce((sum,h)=>sum+investmentValue(h),0);
const costTotal=()=>state().holdings.reduce((sum,h)=>sum+h.shares*h.avg,0);
const personalCash=()=>ctx.model.accounts.filter((x,i)=>i<=2||String(x[0]).toLowerCase().includes('cash wallet')).reduce((sum,a)=>sum+Number(a[1]||0),0);
const assetsValue=()=>state().assets.reduce((sum,a)=>sum+Number(a.value||0),0);
const assetsTotal=()=>assetsValue()+investTotal()+personalCash();
const debtData=()=>ctx.model.protectionV2?.debts||[];
const liabilities=()=>debtData().reduce((sum,d)=>sum+Number(d.balance||0),0);
const networth=()=>assetsTotal()-liabilities();
const selAsset=()=>state().assets.find(x=>x.id===ui.asset)||state().assets[0];
const selHolding=()=>state().holdings.find(x=>x.id===ui.holding)||state().holdings[0];
const assetBuckets=()=>[{name:'Real Estate',value:state().assets.filter(x=>x.kind==='Real Estate').reduce((sum,a)=>sum+a.value,0)},{name:'Investments',value:investTotal()},{name:'Business',value:state().assets.filter(x=>x.kind==='Business').reduce((sum,a)=>sum+a.value,0)},{name:'Vehicles',value:state().assets.filter(x=>x.kind==='Vehicle').reduce((sum,a)=>sum+a.value,0)},{name:'Cash & Bank Accounts',value:personalCash()},{name:'Other Assets',value:state().assets.filter(x=>x.kind==='Other').reduce((sum,a)=>sum+a.value,0)}].filter(x=>x.value>0);
const debtBuckets=()=>{const groups={};for(const x of debtData())groups[x.kind]=(groups[x.kind]||0)+x.balance;return Object.entries(groups).map(([name,value])=>({name,value}))};
const holdingKinds=()=>{const groups={};for(const h of state().holdings)groups[h.kind]=(groups[h.kind]||0)+investmentValue(h);return Object.entries(groups).map(([name,value])=>({name,value}))};
function donut(data,total){let sum=data.reduce((n,x)=>n+Number(x.value),0),from=0,slices=[];
for(let i=0;i<data.length;i++){let next=from+Number(data[i].value)*100/Math.max(1,sum);slices.push(palette[i%palette.length]+' '+from.toFixed(2)+'% '+next.toFixed(2)+'%');from=next}
return '<div class="we-donut-layout"><div class="we-donut" style="background:conic-gradient('+slices.join(',')+')"><div class="we-donut-hole"><b>'+money(total??sum)+'</b><small>Total '+(total===undefined?'value':'')+'</small></div></div><div class="we-legend">'+data.slice(0,7).map((d,i)=>'<div class="we-legend-line"><i style="--color:'+palette[i%palette.length]+'"></i><span class="grow">'+esc(d.name)+'</span><b>'+pct(d.value,sum)+'%</b></div>').join('')+'</div></div>'}
function plot(type='area',points=12){const main=networth(),y=Number.isFinite(main)?main:10000000;
let series=Array.from({length:points},(_,i)=>[22+i*389/Math.max(1,points-1),129-((i+1)/points*72)-Math.sin(i*.92)*8]),svg='<svg role="img" aria-label="Illustrative historical wealth trend" class="we-chart '+(type==='small'?'small':'')+'" viewBox="0 0 430 170">';
for(const yy of [22,58,94,130])svg+='<line x1="18" y1="'+yy+'" x2="417" y2="'+yy+'" stroke="#e8eeeb"/>';
if(type==='bars'||type==='stack'){for(let i=0;i<series.length;i++){let [x,h]=series[i],start=148;for(let j=0;j<(type==='stack'?3:1);j++){let ht=type==='stack'?14+j*7+Math.sin(i)*2:135-h;start-=ht;svg+='<rect x="'+(x-7)+'" y="'+start+'" width="14" height="'+ht+'" rx="1" fill="'+palette[j]+'"/>'}}}
else{const d=series.map(([x,h],i)=>(i?'L':'M')+x+' '+h).join(' ');svg+='<path d="'+d+'L'+series.at(-1)[0]+' 148 L'+series[0][0]+' 148 Z" fill="#e7f7ef"/><path d="'+d+'" fill="none" stroke="#11aa82" stroke-width="2.8"/>';svg+='<path d="'+series.map(([x,h],i)=>(i?'L':'M')+x+' '+(h+18+Math.sin(i)*5)).join(' ')+'" fill="none" stroke="#3987d4" stroke-width="2.1"/>'}
for(let i=0;i<Math.min(points,12);i++){if(i%Math.ceil(points/6)!==0)continue;svg+='<text x="'+series[i][0]+'" y="163" font-size="9" fill="#7b8a92">'+['Jan','Mar','May','Jul','Sep','Nov','Jan','Mar','May','Jul','Sep','Nov'][i%12]+'</text>'}
return svg+'</svg><div class="we-legend" style="display:flex;gap:14px;flex-wrap:wrap"><span>🟩 Assets / Portfolio</span><span>🟦 Net worth trend</span><span class="grow">Illustrative, not historical market data</span></div>'}
function shell(n,body){return '<div class="we-page"><section class="banner"><div><div class="banner-date">Wealth　›　'+esc(titles[n][0])+'</div><h1>'+esc(titles[n][0])+'</h1><p>'+esc(titles[n][1])+'</p></div><div class="banner-quote">“Measure today.<br>Grow responsibly.<br>Build tomorrow.”</div></section><div class="we-inner">'+(ui.alert?'<div role="status" class="we-note">'+esc(ui.alert)+'</div>':'')+body+
'<p class="we-note warn">All valuations, securities and prices are illustrative. No verified banking or brokerage feed. Personal financial records are stored in this browser only. '+button('Compare Approved Screen '+n,'reference')+'</p></div>'+dialog()+'</div>'}
function incomeNotice(){return note('Business bank accounts and saved-goal allocations are excluded from personal cash to avoid double counting. Debt balances are read from the shared debt workspace. Figures are not audited.')}


function assetBreakdown(){return assetBuckets().map((a,i)=>item(['⌂','▣','◈','▰','▤','◆'][i]||'◎',a.name,'Recorded demo asset category',money(a.value),'category:'+a.name,['','blue','purple','','blue',''][i]||'')).join('')}
function liabilityBreakdown(){return debtData().map((d,i)=>item(['⌂','▰','♙','▤','◈','▥'][i]||'◎',d.name,d.lender,money(d.balance),'viewDebt:'+d.id,i===0?'red':i%2?'blue':'')).join('')}
function assetChart(){const b=assetBuckets();let out='<svg viewBox="0 0 430 170" class="we-chart" role="img" aria-label="Asset and liability category comparison">';
for(let yy of [28,66,104,142])out+='<line x1="20" y1="'+yy+'" x2="423" y2="'+yy+'" stroke="#e7efeb"/>';
for(let i=0;i<Math.min(6,b.length);i++){const x=38+i*65,height=b[i].value/Math.max(1,assetsTotal())*150,liab=i<debtData().length?debtData()[i].balance/Math.max(1,liabilities())*80:0;
out+='<rect x="'+x+'" y="'+(145-height)+'" height="'+height+'" width="13" fill="#11b98d"/><rect x="'+(x+15)+'" y="'+(145-liab)+'" height="'+liab+'" width="13" fill="#ee7b90"/><text x="'+(x-4)+'" y="163" font-size="9" fill="#75868f">'+['Real','Invest','Business','Vehicle','Cash','Other'][i]+'</text>'}
return out+'</svg>'}
function screen50(){const assets=assetsTotal(),debts=liabilities(),worth=networth(),target=50000000;
return shell(50,kpis([
['▥','Net Worth',money(worth),'Based on demo asset values'],['▤','Total Assets',money(assets),'Includes investments and personal cash'],['▣','Total Liabilities',money(debts),'Shared debt workspace'],['◉','Net Worth Goal (2030)',money(target),pct(worth,target)+'% of illustrative goal']
])+tabs(50,['Overview','Assets','Liabilities','Net Worth Trend','Allocation','Goals & Projections','Accounts','Insights','Settings'])+
'<div class="we-grid">'+panel('Net Worth Trend',plot('area',12),button('Last 24 Months ▾','time:Last 24 Months'))+
panel('Asset Allocation',donut(assetBuckets(),assets),goto('View Details',51))+
'<section class="we-panel we-col2"><div class="we-title"><h2>Asset Breakdown</h2>'+goto('View All',51)+'</div>'+assetBreakdown()+'</section>'+
panel('Liability Breakdown',liabilityBreakdown(),goto('View Debt Centre',43))+
panel('Net Worth by Category',assetChart(),goto('View All',51))+
panel('Financial Position Summary',mini([[money(assets),'Assets'],[money(debts),'Liabilities'],[money(worth),'Net worth'],[pct(worth,assets)+'%','Equity share']])+incomeNotice())+
panel('Key Wealth Metrics',mini([[money(worth),'Net Worth'],[(assets/Math.max(1,debts)).toFixed(1),'Asset/Debt Ratio'],[money(personalCash()),'Personal Liquidity'],[money(investTotal()),'Investments']]))+
panel('AI Insights & Recommendations',item('✓','Build a monthly wealth review','Reconcile actual valuations before decisions','', 'insight')+item('◉','Avoid goal double counting','Saved-goal buckets are earmarks, not new assets','', 'insight')+
item('↑','Diversification review','Spread exposure across asset classes','', 'insight')+goto('Wealth Growth & Risk',55))+'</div>')}
function assetsAndLiabilitiesTable(){const parts=assetBuckets(),debt=debtBuckets();
return table(['#','Category','Current Value','Change','Account'],parts.map((a,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(a.name)+'</td><td>'+money(a.value)+'</td><td class="we-positive">Planning estimate</td><td>'+button('Details','category:'+a.name)+'</td></tr>'))+
'<h3 style="margin:12px 0 5px;font-size:11px">Liabilities</h3>'+
table(['Debt','Lender','Outstanding','Interest','Action'],debtData().map(d=>'<tr><td>'+esc(d.name)+'</td><td>'+esc(d.lender)+'</td><td>'+money(d.balance)+'</td><td>'+d.rate+'%</td><td>'+button('Open','viewDebt:'+d.id)+'</td></tr>'))}
function screen51(){const assets=assetsTotal(),debt=liabilities(),worth=networth();
return shell(51,kpis([
['▤','Total Assets',money(assets),'Personal demo holdings'],['▣','Total Liabilities',money(debt),'Shared debt register'],['▥','Net Position',money(worth),'Assets less liabilities'],['⚖','Asset to Liability Ratio',(assets/Math.max(1,debt)).toFixed(1),'Illustrative leverage measure']
])+tabs(51,['Overview','Assets','Liabilities','Account Connections','Valuation & Equity','Trends & Analysis','Documents','Settings'])+
'<div class="we-grid">'+panel('Assets Breakdown',donut(assetBuckets(),assets),goto('View Asset Detail',52))+
panel('Liabilities Breakdown',donut(debtBuckets(),debt),goto('View Liabilities',43))+
panel('Net Position Trend',plot('area'),button('Last 24 Months ▾','time:Last 24 Months'))+
'<section class="we-panel we-col2"><div class="we-title"><h2>Top Assets</h2>'+button('+ Add Asset','newAsset','primary')+'</div>'+
table(['#','Asset','Category','Current Value','Growth','Action'],[...state().assets.map(a=>({...a})),{id:'portfolio',name:'Investment Portfolio',kind:'Investments',value:investTotal(),annualGrowth:12.6}].sort((a,b)=>b.value-a.value).map((a,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(a.name)+'</td><td>'+esc(a.kind)+'</td><td>'+money(a.value)+'</td><td class="'+(a.annualGrowth<0?'we-negative':'we-positive')+'">'+(a.annualGrowth||0)+'%</td><td>'+button('View',a.id==='portfolio'?'portfolio':'asset:'+a.id)+'</td></tr>'))+'</section>'+
panel('Top Liabilities',table(['#','Debt','Balance','APR','Action'],debtData().map((d,i)=>'<tr><td>'+(i+1)+'</td><td>'+esc(d.name)+'</td><td>'+money(d.balance)+'</td><td>'+d.rate+'%</td><td>'+button('View','viewDebt:'+d.id)+'</td></tr>')))+
panel('Asset vs Liability Comparison',assetChart())+
panel('Equity Position',table(['Asset Group','Value','Liability','Net Equity'],[['Property',state().assets.filter(x=>x.kind==='Real Estate').reduce((s,x)=>s+x.value,0),debtData().filter(x=>x.kind==='Home Loan').reduce((s,x)=>s+x.balance,0)],['Investments',investTotal(),0],['Vehicles',state().assets.filter(x=>x.kind==='Vehicle').reduce((s,x)=>s+x.value,0),debtData().filter(x=>x.kind==='Car Loan').reduce((s,x)=>s+x.balance,0)]].map(x=>'<tr><td>'+x[0]+'</td><td>'+money(x[1])+'</td><td>'+money(x[2])+'</td><td>'+money(x[1]-x[2])+'</td></tr>')))+
panel('Quick Actions',[['Add New Asset','newAsset'],['Add New Liability','newLiability'],['Update Asset Value','valuation'],['Review Asset Documents','assetDocs'],['Run Net Worth Analysis','netWorth'],['Download Portfolio Report','exportWealth']].map(x=>item('▤',x[0],'Planning workspace','',x[1])).join(''))+
panel('AI Insights & Recommendations',note('Recorded values are user estimates. Cross-screen totals update immediately when debt balances or investments change.')+item('✓','Review concentrated holdings','Portfolio allocation can affect risk')+item('◷','Revalue assets periodically','Track when an appraisal was last obtained'))+
'</div>')}
function assetList(){let assets=state().assets.filter(x=>ui.assetFilter==='All'||x.kind===ui.assetFilter).filter(x=>x.name.toLowerCase().includes(ui.assetSearch.toLowerCase()));
return '<div class="we-toolbar"><input placeholder="Search assets…" aria-label="Search asset list" value="'+esc(ui.assetSearch)+'" data-wesearch="asset"></div>'+
tabs(520,['All','Real Estate','Vehicle','Business','Other'])+
'<div class="we-asset-list">'+assets.map(a=>'<button type="button" class="we-asset-item '+(selAsset()?.id===a.id?'selected':'')+'" data-we="asset:'+a.id+'"><span class="we-asset-thumb">'+esc(a.icon)+'</span><span class="grow"><b>'+esc(a.name)+'</b><small>'+esc(a.kind)+'</small></span><b>'+money(a.value)+'</b></button>').join('')+'</div>'}
function assetDetailPanel(){let a=selAsset();if(!a)return note('No asset selected.');
const initial=Number(a.purchase||0),gain=a.value-initial;
return '<div class="we-asset-header"><div><strong>'+esc(a.icon)+'　'+esc(a.name)+'</strong><small>'+esc(a.kind)+'　·　'+esc(a.location||'Location not recorded')+'</small></div><div class="we-actions">'+tag(a.type)+tag(a.status,'blue')+button('Actions ▾','assetActions')+'</div></div>'+
'<section class="we-panel" style="margin-bottom:9px"><div class="we-title"><h2>Asset Financial Overview</h2>'+button('Edit Asset','editAsset')+'</div>'+mini([[money(a.value),'Current Value'],[money(a.purchase),'Purchase Price'],[signed(gain),'Estimated Gain'],[(a.annualGrowth||0)+'%','Annual Change']])+'</section>'+
tabs(52,['Overview','Valuation','Financials','Documents','Maintenance','Insurance','Rental / Income','History','Notes'])+
'<div class="we-grid"><div class="we-col2">'+panel('Valuation & Market Analysis',plot('area',8)+
mini([[money(Math.round(a.value*.95)),'Low Estimate'],[money(a.value),'Estimated'],[money(Math.round(a.value*1.05)),'High Estimate']])+button('Update Valuation','valuation','primary'))+'</div>'+
panel('Asset Media','<div class="we-property-hero" role="img" aria-label="Illustrative property visual">'+esc(a.icon)+'</div><div class="we-photo-grid">'+Array.from({length:8},(_,i)=>'<span>'+(['⌂','▥','◈','△'][i%4])+'</span>').join('')+'</div>'+note('Illustrative iconography; no original asset photography or file storage.'))+
panel('Asset Details',rows([['Type',a.type],['Location',a.location],['Size',a.size||'Not applicable'],['Purchase Date',a.date],['Purchase Price',money(a.purchase)],['Status',a.status],['Notes',a.notes||'None']])+button('Edit Details','editAsset'))+
panel('Value Projection',plot('line',10)+mini([[money(a.value*1.3),'Optimistic'],[money(a.value*1.05),'Conservative'],[(a.annualGrowth||0)+'%','Annual Change'],[money(gain),'Gain']]))+
panel('Quick Actions',[['Update Valuation','valuation'],['Add Note','assetNote'],['Documents','assetDocs'],['Review Insurance','assetInsurance'],['Review Liabilities','assetDebt'],['Compare with Market','market']].map(x=>item('◉',x[0],'Local workspace','',x[1])).join(''))+
panel('Recent Activity',state().assetValuations.filter(x=>x.assetId===a.id).slice(-5).reverse().map(x=>item('↑','Valuation edited',x.date,money(x.value))).join('')||notice('No recorded valuation activity'))+
'</div>'}
function screen52(){const a=selAsset(),all=state().assets;return shell(52,'<div class="we-side-asset">'+
'<aside class="we-panel"><div class="we-title"><h2>My Assets</h2>'+button('+ Add Asset','newAsset','primary')+'</div>'+assetList()+
'<div class="we-note">Personal assets: '+all.length+' · External valuation feeds unavailable.</div></aside>'+
'<div>'+assetDetailPanel()+'</div></div>')}


function holdingTable(limit=20){let h=state().holdings.filter(x=>ui.holdFilter==='All'||x.kind===ui.holdFilter).filter(x=>x.name.toLowerCase().includes(ui.holdingSearch.toLowerCase())||x.ticker.toLowerCase().includes(ui.holdingSearch.toLowerCase())).sort((a,b)=>investmentValue(b)-investmentValue(a));
return table(['#','Holding','Asset Type','Market Value (KES)','Portfolio Weight','Unrealized Gain','Actions'],h.slice(0,limit).map((x,i)=>'<tr><td>'+(i+1)+'</td><td><b>'+esc(x.name)+'</b><small style="display:block;color:#73868e">'+esc(x.ticker)+'</small></td><td>'+esc(x.kind)+'</td><td>'+money(investmentValue(x))+'</td><td>'+pct(investmentValue(x),investTotal())+'%</td><td class="'+(x.price>=x.avg?'we-positive':'we-negative')+'">'+signed(x.shares*(x.price-x.avg))+'</td><td>'+button('Details','holding:'+x.id)+'</td></tr>'))}
function investMetrics(){let inv=investTotal(),cost=costTotal(),profit=inv-cost;return kpis([['▥','Total Portfolio Value',money(inv),'Illustrative market values'],['▤','Total Invested',money(cost),'Cost basis of recorded holdings'],['↗','Total Gain / Loss',signed(profit),pct(Math.abs(profit),cost)+'% change from cost'],['◉','Return on Cost',((profit/cost)*100||0).toFixed(1)+'%','Not XIRR or market feed']])}
function dividendBars(){let out='<svg viewBox="0 0 430 172" role="img" aria-label="Illustrative income by month" class="we-chart">';
for(let i=0;i<12;i++){let x=20+i*33,total=46+i*2+Math.sin(i)*12,y=150;for(let j=0;j<3;j++){let h=(total*(j===0?.44:j===1?.34:.22));y-=h;out+='<rect x="'+x+'" y="'+y+'" width="21" height="'+h+'" fill="'+['#228ce0','#0fac83','#ffbd57'][j]+'"/>'}
out+='<text x="'+(x-2)+'" y="165" font-size="9" fill="#7a8990">'+['J','F','M','A','M','J','J','A','S','O','N','D'][i]+'</text>'}
return out+'</svg><p style="font-size:9px;color:#73868b">Blue: dividends · Green: interest · Yellow: other income — illustrative, not recorded distributions.</p>'}
function screen53(){const total=investTotal(),cost=costTotal(),gain=total-cost;
return shell(53,investMetrics()+
tabs(53,['Overview','Holdings','Performance','Asset Allocation','Income & Dividends','Transactions','Risk & Analytics','Watchlist','Goals','Documents','Settings'])+
'<div class="we-grid">'+panel('Portfolio Value Trend',plot('area',12),button('Last 12 Months','time:Last 12 Months'))+
panel('Asset Allocation',donut(holdingKinds(),total))+
panel('Portfolio Performance',mini([[(100*gain/Math.max(cost,1)).toFixed(1)+'%','Return on cost'],['9.2%','Demo benchmark'],[money(gain),'Unrealized gain'],[money(cost),'Cost basis']])+plot('bars',5))+
'<section class="we-panel we-col2"><div class="we-title"><h2>Top Holdings</h2>'+goto('View All',54)+'</div>'+holdingTable(8)+'</section>'+
panel('Income & Dividends',mini([['KES 0','Verified distributions'],['N/A','Verified yield'],['0','Posted transactions'],['Demo','Chart mode']])+dividendBars())+
panel('Quick Actions',[['Buy Investment','tradeBuy'],['Sell Investment','tradeSell'],['Add External Holding','newHolding'],['Record Dividend / Income','dividend'],['Transfer Between Accounts','transfer'],['Set Investment Goal','investGoal'],['Rebalance Portfolio','rebalance'],['Download Portfolio Report','exportPortfolio']].map(x=>item('▣',x[0],'Brokerage not connected','',x[1])).join(''))+
panel('Investment Goals',state().holdings.slice(0,3).map((x,i)=>'<div class="we-row"><span class="grow"><b>'+['Grow Portfolio','Retirement Fund','Purchase Rental Property'][i]+'</b><small>Illustrative milestone</small>'+bar(investmentValue(x),Math.max(1,investTotal()*.32))+'</span><b>'+pct(investmentValue(x),investTotal())+'%</b></div>').join(''))+
panel('Risk Analysis',rows([['Number of holdings',String(state().holdings.length)],['Portfolio exposure',money(total)],['Top holding weight',pct(Math.max(...state().holdings.map(investmentValue)),total)+'%'],['Single-market risk','Review'],['Realized dividends','Not connected']])+goto('Detailed Wealth Risk',55))+
panel('AI Insights & Recommendations',item('✓','Portfolio diversification','Review weight by category')+
item('⚑','Price data is simulated','Do not act on displayed quotes')+
item('◷','Review contribution plan','Consider goals and liquidity before trading')+
note('Buy and sell controls simulate internal cash-to-holding transfers. They do not send orders to brokers.'))+
'</div>')}
function holdingMetrics(h){let value=investmentValue(h),cost=h.avg*h.shares;return [money(h.price),money(value),signed(value-cost),pct(Math.abs(value-cost),cost)+'%']}
function stockChart(h){let s='<svg role="img" aria-label="Illustrative share price and volume over time" class="we-chart large" viewBox="0 0 450 202">';
for(let y of [30,68,106,144,182])s+='<line x1="20" y1="'+y+'" x2="442" y2="'+y+'" stroke="#ebf0ec"/>';
for(let i=0;i<50;i++){let x=24+i*8.1,vol=6+Math.sin(i*1.8)*5+i*.13;s+='<rect x="'+x+'" y="'+(181-vol)+'" width="4" height="'+vol+'" fill="#b5c9e7" opacity=".75"/>'}
for(let j=0;j<2;j++){let pts=Array.from({length:50},(_,i)=>[24+i*8.1,95+j*33-i*.85-Math.sin(i*.35+j)*8-Math.cos(i*.7)*3]);s+='<path d="'+pts.map(([x,y],i)=>(i?'L':'M')+x+' '+y).join(' ')+'" fill="none" stroke="'+(j===0?'#13b58a':'#3b92de')+'" stroke-width="'+(j===0?2.7:2)+'"/>'}
return s+'</svg><div class="we-actions"><span class="we-tag">Demo price trend</span><span class="we-tag blue">Demo portfolio value</span><span class="we-tag orange">Not live exchange data</span></div>'}
function screen54(){const h=selHolding();if(!h)return shell(54,note('Create a holding to review investment performance.'));
let val=investmentValue(h),gain=val-h.avg*h.shares,weighted=pct(Math.abs(gain),h.avg*h.shares);
return shell(54,'<div class="we-stock-header"><div class="we-stock-logo">↗</div><div class="we-stock-meta"><strong>'+esc(h.name)+'</strong><small>'+esc(h.kind)+' · '+esc(h.platform)+' · '+esc(h.ticker)+'</small><div class="we-actions">'+tag('Demo instrument')+tag(h.change>=0?'Gain':'Loss',h.change<0?'red':'blue')+'</div></div>'+
'<div class="we-actions">'+mini([[money(h.price),'Current Price'],[money(val),'Market Value'],[signed(gain),'Unrealized Gain']])+button('Buy','tradeBuy','primary')+button('Sell','tradeSell','danger')+button('Edit','editHolding')+'</div></div>'+
tabs(54,['Overview','Performance','Transactions','Dividends','Analysis','News & Insights','Documents','Alerts','Settings'])+
'<div class="we-grid"><section class="we-panel we-col2"><div class="we-title"><h2>Price & Value Performance</h2>'+button('1Y','time:1Y')+'</div>'+stockChart(h)+'</section>'+
panel('Key Metrics',mini([[money(h.price),'Current Price'],[fnum(h.shares),'Total Units'],[money(h.avg),'Avg. Cost'],[money(val),'Market Value']])+rows([['Total Invested',money(h.avg*h.shares)],['Unrealized Gain / Loss',signed(gain)],['Return on Cost',weighted+'%'],['Demo 52-week High',money(h.price*1.12)],['Demo 52-week Low',money(h.price*.84)]]))+
panel('Holding Details',rows([['Investment Type',h.kind],['Ticker',h.ticker],['Platform',h.platform],['Shares / Units',fnum(h.shares)],['Average Cost',money(h.avg)],['Market Value',money(val)],['Unrealized Gain',signed(gain)],['Notes',h.notes]])+button('Edit Holding','editHolding'))+
panel('Distribution History',table(['Date','Distribution','Units','Total'],state().investEvents.filter(x=>x.type==='dividend'&&x.holdingId===h.id).map(x=>'<tr><td>'+esc(x.date)+'</td><td>'+money(x.perShare)+'</td><td>'+fnum(x.shares)+'</td><td>'+money(x.amount)+'</td></tr>'))+note('Blank until you record a demo distribution. No dividends are imported from brokers.'))+
panel('Performance vs Benchmarks',plot('line',8)+note('Benchmark comparisons are illustrative, not an investment performance claim.'))+
panel('Recent Transactions',table(['Date','Type','Units','Price','Amount'],state().investEvents.filter(x=>x.holdingId===h.id&&x.type!=='dividend').slice(-6).reverse().map(x=>'<tr><td>'+esc(x.date)+'</td><td>'+esc(x.type)+'</td><td>'+fnum(x.shares)+'</td><td>'+money(x.price)+'</td><td>'+money(x.amount)+'</td></tr>')))+
panel('Analyst Insights & Latest News',item('◷','No verified analyst reports','Live market and news feeds are disconnected')+item('◆','Review concentration risk','Single holding '+pct(val,investTotal())+'% of portfolio')+item('✓','Revisit investment thesis','Document your goals and risk tolerance'))+
panel('AI Insights & Recommendations',note('Displayed pricing, returns, dividends and chart series are synthetic. All trades are local simulations.',true)+goto('Review Portfolio',53)+goto('Risk Analysis',55))+
'</div>')}
function wealthRisk(){let total=investTotal(),top=Math.max(...state().holdings.map(investmentValue)),share=pct(top,total),debt=liabilities(),a=assetsTotal(),r=state().riskPreferences;return {concentration:share,liquidity:pct(personalCash(),a),debt:pct(debt,a),score:Math.max(0,Math.round(100-share*.5-debt/a*40)),return:r.annualReturn}}
function riskGauge(score){return '<div class="we-donut" style="background:conic-gradient(#10b988 0 '+score+'%,#e6f0ec '+score+'% 100%);margin:auto"><div class="we-donut-hole"><b style="font-size:19px">'+score+'/100</b><small>Illustrative risk health</small></div></div>'}
function screen55(){const worth=networth(),total=assetsTotal(),risk=wealthRisk(),invest=investTotal(),target=50000000,r=state().riskPreferences;
return shell(55,kpis([['▥','Current Net Worth',money(worth),'Assets − debts'],['◉','Wealth Goal',money(target),'Planning milestone'],['↗','Annual Return Scenario',r.annualReturn+'%','Assumed, not earned'],['◆','Risk Score',risk.score+'/100','Heuristic only']])+
tabs(55,['Overview','Wealth Growth','Risk Analysis','Scenario Planning','Goals Progress','Insights & Recommendations','Settings'])+
'<div class="we-grid"><section class="we-panel we-col2"><div class="we-title"><h2>Wealth Growth Forecast</h2>'+button('Next '+r.horizon+' Years','time:Next 10 Years')+'</div>'+plot('area',12)+
note('Growth scenarios use a fixed assumed return on invested assets, not audited performance.')+'</section>'+
panel('Net Worth Breakdown',donut(assetBuckets(),total)+rows([['Liabilities',money(liabilities())],['Net Worth',money(worth)]]))+
panel('Key Wealth Metrics',rows([['Net Worth',money(worth)],['Assets',money(total)],['Liabilities',money(liabilities())],['Personal Cash',money(personalCash())],['Investments',money(invest)],['Portfolio Holdings',state().holdings.length]]))+
panel('Risk Analysis',riskGauge(risk.score)+rows([['Largest holding share',risk.concentration+'%'],['Liquidity share',risk.liquidity+'%'],['Debt / assets',risk.debt+'%'],['Risk tolerance',r.tolerance]]))+
panel('Scenario Analysis',table(['Scenario','Annual Growth','Estimated Future Net Worth'],[['Conservative',Math.max(0,r.annualReturn-3)],['Expected',r.annualReturn],['Optimistic',r.annualReturn+3]].map(x=>'<tr><td>'+x[0]+'</td><td>'+x[1]+'%</td><td>'+money(worth*Math.pow(1+x[1]/100,r.horizon))+'</td></tr>'))+button('Edit Assumptions','riskSettings','primary'))+
panel('Stress Testing',rows([['10% decline in investments',money(worth-invest*.10)],['20% decline in property',money(worth-assetBuckets().find(x=>x.name==='Real Estate').value*.20)],['Interest-rate shock','Review loan repayment estimates'],['Emergency funds',money(personalCash())]]))+
panel('Goals Progress',mini([[money(worth),'Current Worth'],[money(target),'Target'],[pct(worth,target)+'%','Progress'],[r.horizon+' years','Horizon']])+bar(worth,target)+goto('Savings & Financial Goals',37))+
panel('Top Opportunities',item('◉','Diversify investment exposure','Consider concentration and liquidity')+item('↗','Increase consistent saving','Maintain a realistic emergency buffer')+item('▣','Revisit long-term objectives','Link plans with existing financial goals'))+
panel('AI Insights & Recommendations',note('Financial projections are mathematical scenarios, not investment advice or guaranteed returns.',true)+
item('✓','Reconcile real asset valuations','Last appraisals may be out of date')+
item('◷','Update debt repayment plan','Net worth updates when you edit shared debts')+
item('◆','Review asset allocation','Choose an approach appropriate to your risks'))+
'</div>')}

/* HANDLERS */
})();