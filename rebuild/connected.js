/*
 * Finance OS B1.1 — canonical authenticated frontend.
 * Never imports the seeded 60-screen prototype's localStorage or fake account balances.
 * No JWT, financial record, or access token is written to localStorage/sessionStorage.
 * SessionStorage holds a short-lived PKCE verifier + OAuth state only during a redirect.
 */
(()=>{
'use strict';
const groups=[
 ['ESSENTIAL',[1,2,3,4,5,6,7,8,9,10,11,12,13,14,15]],
 ['SPENDING & BUDGETING',[16,17,18,19,20,21,22,23,24,25,26]],
 ['INCOME & CASH FLOW',[27,28,29,30,31,32,33,34]],
 ['CAPITAL & PLANNING',[35,36,37,38,39,40,41,42]],
 ['DEBT & PROTECTION',[43,44,45,46,47,48,49]],
 ['WEALTH',[50,51,52,53,54,55]],
 ['INTELLIGENCE & SETTINGS',[56,57,58,59,60]]
];
const names=['','Welcome & Authentication','Financial Onboarding','Financial Profile & Setup','Financial Command Centre',
 'Today: Safe to Spend','Financial Calendar & Action Centre','Accounts Overview','Account Details','Add / Connect Financial Account',
 'Transaction Management','Transaction Details','Record / Edit Transaction','Statement Import','Transfers & Payments','Reconciliation & Financial Ledger',
 'Spending Intelligence','Expenditure Trends','Spending Category Analysis','Merchant & Lifestyle Analysis','Spending Leak Detector',
 'Budget Management','Create / Edit Budget','Daily / Weekly Spending Allowance','Spending Guardrails & Purchase Approval Check',
 'Subscriptions & Recurring Expenses','Spending Review & Recovery Plan','Income Dashboard','Income Sources',
 'Income Planning & Forecasting','Bills & Financial Obligations','Bill Details & Payment','Cash Flow Timeline',
 'Cash Flow Forecast & Financial Runway','Cash Shortfall Recovery','Capital Allocation Command Centre',
 'Allocation Rules & Money Buckets','Savings & Financial Goals','Goal Details & Funding','Emergency Fund Management',
 'Affordability & Purchase Simulator','Funding Requests & Approvals','Financial Scenario Planning',
 'Debt Management Centre','Debt Details & Repayment Schedule','Debt Repayment Optimizer','Tax Overview & Planning',
 'Insurance & Financial Protection','Retirement Planning','Estate & Beneficiary Planning','Net Worth Dashboard',
 'Assets & Liabilities Overview','Asset Details & Valuation','Investment Portfolio','Investment Details & Performance',
 'Wealth Growth & Risk Analysis','Financial Health & Insights','AI Financial Advisor','Financial Reports & Reviews',
 'Integrations & Account Synchronization','Settings, Privacy, Security & Audit History'];
const root=document.querySelector('#app');
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
const currency=minor=>Number(minor/100).toLocaleString('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2});
const asMinor=input=>{
 const t=String(input||'').trim(),m=/^(-?)(\d{1,11})(?:\.(\d{1,2}))?$/.exec(t);
 if(!m)throw new Error('Enter a valid amount with up to two decimal places.');
 const value=Number(m[2])*100+Number((m[3]||'').padEnd(2,'0'));
 if(!Number.isSafeInteger(value)||value===0)throw new Error('Invalid or zero amount.');
 return m[1]?-value:value;
};
const random=()=>crypto.randomUUID()+'-'+crypto.randomUUID();
let apiBase=null,token='',identity=null,provider=null,workspaces=[],workspaceId='',busy=false,notice='',error='';
let data={accounts:[],categories:[],transactions:[],journals:[],reconciliation:[],summary:null,budgets:[],insights:null,guardrails:[],approvals:[],incomeSources:[],incomeOverview:null,incomeForecast:null,bills:[],billOverview:null,billCalendar:[],cashflow:null,history:null,shortfalls:null};
let selectedAccount='',selectedTransaction='',selectedBill='',lastEval=null,lastCheck=null,b3LoadedFor='',loadFailed=false,billHistory=null;
let b4={summary:null,buckets:[],goals:[],allocations:[],requests:[],scenarios:[],scenario:null,affordability:null};
let b4LoadedFor='',selectedGoal='';
const screen=()=>{const n=Number((location.hash.match(/screen\/(\d+)/)||[])[1]||1);return Number.isInteger(n)&&n>=1&&n<=60?n:1;};
const isLocal=()=>['localhost','127.0.0.1'].includes(location.hostname)&&location.protocol==='http:';
async function initConfig(){
 let cfg={apiBase:null};
 try{const r=await fetch('connected-config.json',{cache:'no-store'});if(r.ok)cfg=await r.json();}catch{}
 const proposed=cfg.apiBase||(isLocal()?'http://127.0.0.1:3101':null);
 if(!proposed){error='The finance API is not configured for this deployment. No demonstration data is shown.';return;}
 let url;
 try{url=new URL(proposed);}catch{error='Invalid API configuration.';return;}
 if((location.protocol==='https:'&&url.protocol!=='https:')||
    !(['https:'].includes(url.protocol)||isLocal()&&url.protocol==='http:'&&['127.0.0.1','localhost'].includes(url.hostname))||
    url.username||url.password||url.search||url.hash){
  error='Insecure API endpoint configuration rejected.';return;
 }
 apiBase=url.origin+url.pathname.replace(/\/$/,'');
 try{
  const meta=await request('/v1/meta',false);
  if(!meta.financialEndpointsAvailable||!meta.authenticationAvailable)throw new Error('Finance API is not enabled for authenticated accounts.');
  if(meta.authenticationScope==='OIDC_VERIFIED_MFA')provider=await request('/v1/auth/provider',false);
  else if(meta.authenticationScope!=='LOCAL_TEST_ONLY'||!isLocal())throw new Error('Local password mode is only permitted on localhost.');
 }catch(ex){error=String(ex.message||ex);apiBase=null;}
}
async function request(path,authenticated=true,options={}){
 if(!apiBase)throw new Error('Finance API is unconfigured.');
 const response=await fetch(apiBase+path,{method:options.method||'GET',cache:'no-store',credentials:'omit',
  headers:{'Accept':'application/json',...(options.body!==undefined?{'Content-Type':'application/json'}:{}),
   ...(options.method&&options.method!=='GET'?{'Idempotency-Key':random()}:{}),
   ...(authenticated&&token?{'Authorization':'Bearer '+token}:{})},...(options.body===undefined?{}:{body:JSON.stringify(options.body)})});
 let body={};
 try{body=await response.json();}catch{}
 if(response.status===401&&authenticated){
  token='';identity=null;workspaces=[];workspaceId='';
  throw new Error('Authentication expired. Please sign in again.');
 }
 if(!response.ok)throw new Error(body.error?.message||'Server request failed ('+response.status+').');
 return body;
}
const path=segment=>'/v1/workspaces/'+encodeURIComponent(workspaceId)+segment;
async function refresh(){
 if(!token)return;
 busy=true;draw();
 try{
  identity=await request('/v1/me');
  workspaces=(await request('/v1/workspaces')).items||[];
  workspaceId=workspaces.some(w=>w.id===workspaceId)?workspaceId:workspaces[0]?.id||'';
  if(workspaceId){
   const b3Active=screen()>=27&&screen()<=34;
   const b4Active=screen()>=35&&screen()<=42;
   const routes=['/accounts','/categories','/transactions','/ledger/journal-entries','/reconciliation','/ledger/summary','/budgets','/spending/insights?months=6','/spending/guardrails','/spending/approvals',
    ...(b3Active?['/income/sources','/income/overview?months=6','/income/forecast?days=90','/bills','/bills/calendar','/cash-flow/forecast?days=90','/cash-flow/timeline?days=90','/cash-flow/shortfalls?days=90']:[]),
    ...(b4Active?['/capital/summary','/money-buckets','/savings-goals','/capital/allocations','/capital/requests','/planning/scenarios']:[])];
   const result=await Promise.all(routes.map(s=>request(path(s))));
   data={accounts:result[0].items||[],categories:result[1].items||[],transactions:result[2].items||[],
    journals:result[3].items||[],reconciliation:result[4].items||[],summary:result[5],
    budgets:result[6].items||[],insights:result[7],guardrails:result[8].items||[],approvals:result[9].items||[],
    incomeSources:b3Active?result[10].items||[]:data.incomeSources||[],
    incomeOverview:b3Active?result[11]:data.incomeOverview||null,
    incomeForecast:b3Active?result[12]:data.incomeForecast||null,
    bills:b3Active?result[13].items||[]:data.bills||[],
    billOverview:b3Active?result[13].overview:data.billOverview||null,
    billCalendar:b3Active?result[14].events||[]:data.billCalendar||[],
    cashflow:b3Active?result[15]:data.cashflow||null,
    history:b3Active?result[16]:data.history||null,
    shortfalls:b3Active?result[17]:data.shortfalls||null};
   if(b4Active){
    const offset=b3Active?18:10;
    b4={...b4,summary:result[offset],buckets:result[offset+1].items||[],
      goals:result[offset+2].items||[],allocations:result[offset+3].items||[],
      requests:result[offset+4].items||[],scenarios:result[offset+5].items||[]};
    b4LoadedFor=workspaceId;
    selectedGoal=b4.goals.some(g=>g.id===selectedGoal)?selectedGoal:(b4.goals[0]?.id||'');
   }
   if(b3Active){
    b3LoadedFor=workspaceId;
    billHistory=null;
    if(screen()===31){
     selectedBill=data.bills.some(b=>b.id===selectedBill)?selectedBill:(data.bills[0]?.id||'');
     if(selectedBill)billHistory=await request(path('/bills/'+encodeURIComponent(selectedBill)));
    }
   }
   selectedAccount=data.accounts.some(a=>a.id===selectedAccount)?selectedAccount:(data.accounts[0]?.id||'');
   selectedTransaction=data.transactions.some(t=>t.id===selectedTransaction)?selectedTransaction:(data.transactions[0]?.id||'');
  }else data={accounts:[],categories:[],transactions:[],journals:[],reconciliation:[],summary:null,budgets:[],insights:null,guardrails:[],approvals:[],incomeSources:[],incomeOverview:null,incomeForecast:null,bills:[],billOverview:null,billCalendar:[],cashflow:null,history:null,shortfalls:null};
  error='';loadFailed=false;
 }catch(ex){error=String(ex.message||ex);loadFailed=true;b3LoadedFor='';b4LoadedFor='';billHistory=null;data={accounts:[],categories:[],transactions:[],journals:[],reconciliation:[],summary:null,budgets:[],insights:null,guardrails:[],approvals:[],incomeSources:[],incomeOverview:null,incomeForecast:null,bills:[],billOverview:null,billCalendar:[],cashflow:null,history:null,shortfalls:null};}
 finally{busy=false;draw();}
}
const nav=(n)=>{location.hash='screen/'+n;window.scrollTo(0,0);draw();};
const card=(title,html)=>'<section class="connected-card"><h2>'+esc(title)+'</h2>'+html+'</section>';
const btn=(text,screen)=>'<button type="button" data-go="'+screen+'">'+esc(text)+'</button>';
const field=(caption,name,type='text',required=true,value='',opts='')=>
 '<label class="connected-field">'+esc(caption)+'<input name="'+name+'" type="'+type+'" value="'+esc(value)+'" '+(required?'required ':'')+opts+'></label>';
const select=(caption,name,list,selected='')=>'<label class="connected-field">'+esc(caption)+'<select name="'+name+'" required>'+
 list.map(v=>'<option value="'+esc(v[0])+'"'+(v[0]===selected?' selected':'')+'>'+esc(v[1])+'</option>').join('')+'</select></label>';
const money=(n,unit='KES')=>esc(unit)+' '+currency(Number(n||0));
const soon=(id)=>card(names[id]+' — domain not activated',
 '<p>This route is part of Finance OS’s 60-screen architecture. Its authoritative server module is not certified yet. '+ 
 'The connected application deliberately does <b>not</b> display invented balances, purchases, budgets, goals, debt or financial advice.</p>'+
 (id>=16?'<p class="connected-muted">After B2/B3 implement this financial domain, it will use your current workspace’s PostgreSQL records.</p>':'')+
 btn('View real financial accounts',7));
function signIn(){
 if(provider)return card('Continue with your verified identity provider',
  '<p>Sign in through your organization’s trusted OIDC provider. Multifactor verification is required by the API.</p>'+
  '<button data-oidc-start>Sign in securely</button><p class="connected-muted">The identity provider owns password recovery, MFA enrollment and sign-in verification. Finance OS never receives your password.</p>');
 if(isLocal())return card('Local development sign-in',
  '<p class="connected-muted">Test accounts only. Do not use real financial records. Password authentication is disabled in production.</p>'+
  '<form data-form="login">'+field('Email','email','email')+field('Password','password','password')+
  '<button type="submit">Sign in</button></form><details><summary>Create a disposable test user</summary>'+
  '<form data-form="register">'+field('Display name','displayName')+field('Email','email','email')+
  field('Password (at least 12 characters)','password','password',true,'','minlength="12"')+
  '<button type="submit">Register locally</button></form></details>');
 return soon(1);
}
function profile(){
 return card('Verified identity', '<dl class="connected-dl"><dt>Name</dt><dd>'+esc(identity?.displayName)+'</dd><dt>Email</dt><dd>'+esc(identity?.email)+'</dd>'+
  '<dt>Authorization</dt><dd>Server validates your session and membership before each financial request</dd></dl>')+
  card('Active workspace',workspaces.length?'<p>'+esc(workspaces.find(w=>w.id===workspaceId)?.name)+' · '+
  esc(workspaces.find(w=>w.id===workspaceId)?.role)+'</p>':'<p>No active workspace.</p>');
}
function workspace(){
 return card('Workspaces',workspaces.length?'<ul class="connected-list">'+workspaces.map(w=>'<li><b>'+esc(w.name)+'</b>'+
  '<span>'+esc(w.kind)+' · '+esc(w.role)+' · '+esc(w.baseCurrency)+'</span></li>').join('')+'</ul>':'<p>No workspace found.</p>')+
  card('Create workspace','<form data-form="workspace">'+field('Workspace name','name')+
   select('Kind','kind',[['PERSONAL','Personal'],['HOUSEHOLD','Household'],['BUSINESS','Business']])+
   '<button type="submit">Create workspace</button></form>');
}
function dashboard(){
 const summary=data.summary?.totalByCurrency||[];
 const balance=summary.find(x=>x.currency==='KES')?.amountMinor??0;
 const current=new Date().toISOString().slice(0,7);
 const month=data.transactions.filter(t=>String(t.occurredAt).startsWith(current));
 const byId=new Map(data.transactions.map(t=>[t.id,t]));
 const sourceKind=t=>t.kind==='REVERSAL'?byId.get(t.reversesTransactionId)?.kind:t.kind;
 // Reversal entries negate the original financial effect in the posting month.
 const inc=month.filter(t=>sourceKind(t)==='INCOME').reduce((n,t)=>n+t.amountMinor,0);
 const spent=-month.filter(t=>sourceKind(t)==='EXPENSE').reduce((n,t)=>n+t.amountMinor,0);
 return '<div class="connected-kpis"><article><span>Posted manual balance (KES)</span><strong>'+money(balance)+'</strong><small>Not a verified bank balance</small></article>'+
  '<article><span>Recorded income this month</span><strong>'+money(inc)+'</strong><small>Manual journal transactions</small></article>'+
  '<article><span>Recorded expenses this month</span><strong>'+money(spent)+'</strong><small>Includes reversals in net balance only</small></article>'+
  '<article><span>Accounts and records</span><strong>'+data.accounts.length+' / '+data.transactions.length+'</strong><small>Account and posted transaction counts</small></article></div>'+
  card('Next steps',btn('Manage accounts',7)+btn('Record income or expense',12)+btn('Reconcile a statement',15))+
  card('Financial truth disclaimer','<p>These figures come exclusively from the authenticated workspace ledger. There is no connected bank or M-Pesa account. No budget, commitment or safe-to-spend amount can be assumed from these figures.</p>');
}
function accounts(){
 return card('Financial accounts',data.accounts.length?'<div class="connected-table"><table><thead><tr><th>Account</th><th>Type</th><th>Source</th><th>Posted balance</th></tr></thead><tbody>'+
  data.accounts.map(a=>'<tr><td><b>'+esc(a.displayName)+'</b></td><td>'+esc(a.kind)+'</td><td>'+esc(a.providerStatus)+'</td><td>'+money(a.balanceMinor,a.currency)+'</td></tr>').join('')+
  '</tbody></table></div>':'<p>No recorded accounts. Create your first account to begin.</p>')+btn('Add account',9);
}
function newAccount(){
 return card('Create a manual account','<p>Only cash, bank and mobile-money asset accounts are currently supported. Adding an account does not connect your bank or verify its balance.</p>'+
  '<form data-form="account">'+field('Account name','displayName')+
  select('Type','kind',[['CASH','Cash wallet'],['BANK','Bank (manually tracked)'],['MOBILE_MONEY','Mobile money (manually tracked)']])+
  '<button type="submit">Create account</button></form>');
}
function accountDetails(){
 const selected=data.accounts.find(a=>a.id===selectedAccount);
 return card('Account details',select('Account','selectedAccount',data.accounts.map(a=>[a.id,a.displayName]),selectedAccount)+
  (selected?'<div class="connected-focus">'+money(selected.balanceMinor,selected.currency)+
   '<small>Manual posted ledger balance · '+esc(selected.providerStatus)+'</small></div>':
   '<p>Choose an account, or create one.</p>')+
   btn('Record transaction',12));
}
function transactions(){
 return card('Posted manual transactions',data.transactions.length?'<div class="connected-table"><table><thead><tr><th>Date</th><th>Memo</th><th>Kind</th><th>Amount</th><th>Action</th></tr></thead><tbody>'+
 data.transactions.map(t=>'<tr><td>'+esc(String(t.occurredAt).slice(0,10))+'</td><td>'+esc(t.description)+'</td><td>'+esc(t.kind)+'</td>'+
 '<td>'+money(t.amountMinor,t.currency)+'</td><td>'+(t.kind!=='REVERSAL'?'<button data-reverse="'+esc(t.id)+'">Reverse</button>':'—')+'</td></tr>').join('')+
 '</tbody></table></div>':'<p>No posted transactions in this workspace.</p>')+btn('Record income or expense',12);
}
function transactionDetails(){
 const t=data.transactions.find(x=>x.id===selectedTransaction);
 return card('Transaction details',select('Transaction','selectedTransaction',
  data.transactions.map(x=>[x.id,x.description+' — '+money(x.amountMinor)]),selectedTransaction)+
  (t?'<dl class="connected-dl"><dt>Amount</dt><dd>'+money(t.amountMinor,t.currency)+'</dd>'+
   '<dt>Type</dt><dd>'+esc(t.kind)+'</dd><dt>Recorded</dt><dd>'+esc(t.occurredAt)+'</dd>'+
   '<dt>Journal</dt><dd>'+esc(t.journalEntryId)+'</dd><dt>Status</dt><dd>POSTED · Immutable</dd></dl>':
   '<p>No transaction selected.</p>'));
}
function formTransaction(){
 if(!data.accounts.length)return card('Add a transaction','<p>Create a manual financial account first.</p>'+btn('Add account',9));
 if(!data.categories.length)return card('Add a transaction','<p>Create a category first.</p>'+categoryForm());
 return card('Record income or expense','<p>Financial postings are journal-backed and immutable. Correct errors by posting a reversal.</p>'+
  '<form data-form="transaction">'+select('Financial account','financialAccountId',data.accounts.map(a=>[a.id,a.displayName]))+
  select('Transaction type','kind',[['INCOME','Income'],['EXPENSE','Expense']])+
  select('Category','categoryId',data.categories.map(c=>[c.id,c.kind+' · '+c.name]))+
  field('Amount in KES (e.g. 1250.50)','amount','text',true,'','pattern="[0-9]+(\\.[0-9]{1,2})?"')+
  field('Description','description')+field('Economic date','effectiveOn','date',true,new Date().toISOString().slice(0,10))+
  '<fieldset class="connected-allocations"><legend>Independent approvals for EXPENSE postings (select all applicable)</legend>'+
  (data.approvals.filter(a=>a.status==='APPROVED'&&a.requestedBy===identity?.id).length?
   data.approvals.filter(a=>a.status==='APPROVED'&&a.requestedBy===identity?.id).map(a=>
   '<label class="connected-approval-choice"><input type="checkbox" name="approvalRequestIds" value="'+esc(a.id)+'">'+
   esc(a.reference)+' · '+money(a.amountMinor)+'</label>').join(''):
  '<p>No approved requests. Large expenses may require a separate person to approve them first.</p>')+'</fieldset>'+
  '<button type="submit">Post immutable transaction</button></form>')+
  card('Categories',categoryForm());
}
function categoryForm(){
 return '<form data-form="category">'+field('New category name','name')+
  select('Category type','kind',[['INCOME','Income'],['EXPENSE','Expense']])+
  '<button type="submit">Create category</button></form>';
}
function imports(){
 return card('Stage an unverified statement entry',
  '<p>Manual entry only. Statement evidence is unverified until matched to an already-posted journal. No bank connectivity or OCR is enabled.</p>'+
  '<form data-form="import">'+select('Financial account','financialAccountId',data.accounts.map(a=>[a.id,a.displayName]))+
  field('Transaction date','date','date',true,new Date().toISOString().slice(0,10))+
  field('Description','description')+field('Signed amount (KES)','amount','text',true,'','pattern="-?[0-9]+(\\.[0-9]{1,2})?"')+
  '<button type="submit">Stage record for review</button></form>');
}
function reconciliation(){
 return card('Statement reconciliation',data.reconciliation.length?'<div class="connected-table"><table><thead><tr><th>Description</th><th>Date</th><th>Amount</th><th>Status</th><th>Action</th></tr></thead><tbody>'+
  data.reconciliation.map(r=>'<tr><td>'+esc(r.description)+'</td><td>'+esc(r.date)+'</td><td>'+money(r.amountMinor,r.currency)+'</td>'+
  '<td>'+esc(r.disposition)+'</td><td>'+(r.disposition==='PENDING'?'<form data-form="match"><input name="importRowId" type="hidden" value="'+esc(r.id)+'">'+
   select('Match posted journal','manualTransactionId',data.transactions.filter(t=>t.financialAccountId===r.financialAccountId&&
    t.amountMinor===r.amountMinor&&t.currency===r.currency).map(t=>[t.id,t.description+' · '+money(t.amountMinor)]))+
   '<button type="submit">Match</button></form>':'Recorded')+'</td></tr>').join('')+'</tbody></table></div>':
  '<p>No staged statement rows in this workspace.</p>')+btn('Stage a statement record',13)+
  card('Posted journals',data.journals.length?'<ul class="connected-list">'+data.journals.map(j=>
   '<li><b>'+esc(j.memo)+'</b><span>'+esc(j.effectiveOn)+' · '+money(j.totalDebitMinor,j.currency)+
   ' debit / '+money(j.totalCreditMinor,j.currency)+' credit · '+esc(j.status)+'</span></li>').join('')+'</ul>':
   '<p>No posted journals.</p>');
}

const formatSigned=v=>money(v);
const monthStart=()=>new Date().toISOString().slice(0,7)+'-01';
const monthEnd=()=>new Date(new Date().getUTCFullYear(),new Date().getUTCMonth()+1,0).toISOString().slice(0,10);
const spendCategories=()=>data.categories.filter(c=>c.kind==='EXPENSE');
function spendingPanels(){
 const x=data.insights;
 if(!x)return card('Spending Intelligence','<p>Financial report is not yet loaded.</p>');
 const total=x.categories.reduce((acc,c)=>acc+c.netSpentMinor,0);
 return '<div class="connected-kpis"><article><span>Net recorded expense (selected months)</span>'+
  '<strong>'+formatSigned(total)+'</strong><small>Manual posted ledger only</small></article>'+
  '<article><span>Recorded expense categories</span><strong>'+x.categories.length+
  '</strong><small>No merchant/Paybill verification</small></article>'+
  '<article><span>Spending evidence</span><strong>Manual</strong><small>Not provider-verified</small></article></div>'+
  card('Category breakdown',x.categories.length?'<div class="connected-table"><table><thead><tr><th>Category</th><th>Posted net spend</th><th>Expense entries</th></tr></thead><tbody>'+
    x.categories.map(c=>'<tr><td>'+esc(c.name)+'</td><td>'+formatSigned(c.netSpentMinor)+'</td><td>'+esc(c.transactionCount)+'</td></tr>').join('')+
    '</tbody></table></div>':'<p>No posted expenses for this time window.</p>')+
  card('Monthly spending trend',x.monthlyTotals.length?
    '<div class="connected-bars">'+x.monthlyTotals.map(p=>{
      const max=Math.max(1,...x.monthlyTotals.map(v=>Math.abs(v.netSpentMinor)));
      const width=Math.min(100,Math.max(0,Math.abs(p.netSpentMinor)/max*100));
      return '<div class="connected-bar"><b>'+esc(p.period)+'</b><i style="width:'+width.toFixed(1)+'%"></i>'+
      '<span>'+formatSigned(p.netSpentMinor)+'</span></div>';
    }).join('')+'</div>':'<p>At least one posted journal entry is needed for a trend.</p>')+
  '<p class="connected-muted">Corrections recorded in later months affect that later month. Trends are not audited bank statements.</p>';
}
function recurringSuggestions(){
 const rows=data.insights?.potentialRecurringDescriptions||[];
 return card('Potential recurring descriptions — review only',
 rows.length?'<ul class="connected-list">'+rows.map(r=>'<li><b>'+esc(r.description)+'</b><span>'+
   esc(r.occurrences)+' manually entered occurrences · '+money(r.recordedGrossMinor)+
   ' total gross expense · NOT a confirmed subscription</span></li>').join('')+'</ul>':
  '<p>Not enough repeated, manually posted descriptions to suggest subscriptions or possible spending leaks.</p>')+
 '<p class="connected-muted">No merchant identity verification, provider feed, automatic cancellation or subscription prediction is available.</p>';
}
function budgetList(){
 return card('Budgets · workspace-scoped and versioned',data.budgets.length?
  '<div class="connected-table"><table><thead><tr><th>Budget</th><th>Period</th><th>Status</th><th>Amount</th><th>Allocated</th><th>Spent</th><th>Action</th></tr></thead><tbody>'+
  data.budgets.map(b=>'<tr><td><b>'+esc(b.name)+'</b><small> · v'+esc(b.version)+'</small></td>'+
   '<td>'+esc(b.startsOn)+' → '+esc(b.endsOn)+'</td><td>'+esc(b.status)+'</td>'+
   '<td>'+money(b.amountMinor)+'</td><td>'+money(b.allocatedMinor)+'</td>'+
   '<td>'+money(b.spentMinor)+'</td><td>'+(b.status==='DRAFT'?'<button data-activate-budget="'+esc(b.id)+'">Activate</button>':b.status==='ACTIVE'?'<button data-archive-budget="'+esc(b.id)+'">Archive</button>':'—')+
   '</td></tr>').join('')+'</tbody></table></div>':'<p>No server budgets created yet.</p>')+
  btn('Create category budget',22)+btn('View spending intelligence',16);
}
function budgetDetails(){
 const rows=data.budgets.filter(b=>b.status==='ACTIVE');
 return card('Active budget allocations',rows.length?
  rows.map(b=>'<h3>'+esc(b.name)+' · '+esc(b.startsOn)+' to '+esc(b.endsOn)+'</h3>'+
   '<div class="connected-table"><table><thead><tr><th>Expense category</th><th>Limit</th><th>Net spent</th><th>Remaining</th><th>Status</th></tr></thead><tbody>'+
   b.allocations.map(a=>'<tr><td>'+esc(a.categoryName)+'</td><td>'+money(a.limitMinor)+'</td>'+
    '<td>'+money(a.spentMinor)+'</td><td>'+money(a.remainingMinor)+'</td><td>'+
    (a.remainingMinor<0?'Over allocation':'Within allocation')+'</td></tr>').join('')+'</tbody></table></div>').join(''):
   '<p>No active budgets. Draft and activate a category budget to track utilization.</p>')+
 '<p class="connected-muted">Remaining allocation is not a safe-to-spend or verified bank-balance calculation. Rollover is not active.</p>';
}
function createBudget(){
 const categories=spendCategories();
 return card('Create an immutable budget draft',
 '<p>Allocate the manual-spending budget to one or more expense categories. Each allocation is tracked against posted manual journals. Activate after reviewing; editing financial definitions requires a new budget.</p>'+
 '<form data-form="budget" class="connected-budget-form">'+field('Budget name','name')+
 field('Starts on','startsOn','date',true,monthStart())+
 field('Ends on','endsOn','date',true,monthEnd())+
 field('Total amount KES','amount','text',true,'','pattern="[0-9]+(\\.[0-9]{1,2})?"')+
 '<fieldset class="connected-allocations"><legend>Category allocations (one or more)</legend>'+
 (categories.length?categories.map(c=>'<label class="connected-alloc-row"><input type="checkbox" name="budgetCategory" value="'+esc(c.id)+'">'+
  '<span>'+esc(c.name)+'</span><input type="text" name="allocation-'+esc(c.id)+'" placeholder="Amount KES" pattern="[0-9]+(\\.[0-9]{1,2})?" aria-label="Amount for '+esc(c.name)+'"></label>').join(''):
  '<p>No EXPENSE categories. Create one under Transactions first.</p>')+'</fieldset>'+
 '<button type="submit">Save draft</button></form>')+btn('Review budgets',21);
}
function allowance(){
 const active=data.budgets.filter(b=>b.status==='ACTIVE');
 return card('Budget-based allowance (not bank-verified safe-to-spend)',
 active.length?'<p>The following values represent unspent category allocation only. They are not verified available cash.</p>'+
 active.flatMap(b=>b.allocations.map(a=>'<div class="connected-budget-meter"><b>'+esc(b.name)+' · '+esc(a.categoryName)+
 '</b><div class="connected-meter"><i style="width:'+Math.min(100,Math.max(0,a.limitMinor?100*a.spentMinor/a.limitMinor:0))+'%"></i></div>'+
 '<p>Limit '+money(a.limitMinor)+' · Posted '+money(a.spentMinor)+' · Allocation remaining '+money(a.remainingMinor)+'</p></div>')).join(''):
 '<p>No active budget allocations to summarize.</p>')+
 '<p class="connected-muted">Final affordability requires actual income, obligations, cash availability, and authoritative provider data in later phases.</p>';
}
function guardrails(){
 const rules=data.guardrails||[],approvals=data.approvals||[];
 const purchase=lastCheck;
 const decision=lastEval;
 return card('Active financial posting rules',rules.length?
 '<ul class="connected-list">'+rules.map(r=>'<li><b>'+esc(r.name)+'</b><span>'+esc(r.kind)+' · '+esc(r.action)+
 ' · '+esc(r.kind==='AMOUNT'?money(r.conditions.minAmountMinor):data.categories.find(c=>c.id===r.conditions.categoryId)?.name||'Unknown category')+
 '</span>'+( ['OWNER','ADMIN'].includes(workspaces.find(w=>w.id===workspaceId)?.role)?'<button data-deactivate-rule="'+esc(r.id)+'">Deactivate</button>':'')+'</li>').join('')+'</ul>':'<p>No guardrails configured. Manual expense entries currently have no policy restrictions beyond accounting validation.</p>')+
 card('Create an amount guardrail','<form data-form="guardrail-amount">'+
 field('Policy name','name')+field('Minimum expense amount KES','amount','text',true,'','pattern="[0-9]+(\\.[0-9]{1,2})?"')+
 select('Action','action',[['WARN','Warn'],['REQUIRE_APPROVAL','Require independent approval'],['BLOCK','Block manual posting']])+
 '<button type="submit">Create policy</button></form>')+
 card('Create a category guardrail','<form data-form="guardrail-category">'+field('Policy name','name')+
 select('Expense category','categoryId',spendCategories().map(c=>[c.id,c.name]))+
 select('Action','action',[['WARN','Warn'],['REQUIRE_APPROVAL','Require independent approval'],['BLOCK','Block manual posting']])+
 '<button type="submit">Create policy</button></form>')+
 card('Evaluate a proposed manual expense','<p>The check is an advisory preview. Actual money is not moved. Matching BLOCK and approval rules also apply at the manual transaction posting endpoint.</p>'+
 '<form data-form="purchase-check">'+
 field('Proposed amount KES','amount','text',true,'','pattern="[0-9]+(\\.[0-9]{1,2})?"')+
 select('Expense category','categoryId',spendCategories().map(c=>[c.id,c.name]))+
 field('Reference','reference')+
 '<button type="submit">Evaluate without posting</button></form>'+
 (decision?'<div class="connected-policy-result"><strong>'+esc(decision.decision)+'</strong>'+
 '<p>'+esc(decision.rules.map(r=>r.name+' ('+r.action+')').join('; ')||'No matching guardrail')+'</p>'+
 '<p>'+esc(decision.budgetWarnings.filter(w=>w.wouldExceed).length)+' budget allocations would be exceeded by the proposed entry.</p>'+
 (decision.rules.filter(r=>r.action==='REQUIRE_APPROVAL').map(rule=>'<button type="button" data-request-approval="'+esc(rule.id)+'">Request independent approval for '+esc(rule.name)+'</button>').join(''))+
 '</div>':''));
}
function approvalQueue(){
 const approvals=data.approvals||[];
 const isApprover=['OWNER','ADMIN'].includes(workspaces.find(w=>w.id===workspaceId)?.role);
 return card('Two-person approval queue',approvals.length?
 '<div class="connected-table"><table><thead><tr><th>Reference</th><th>Amount</th><th>Status</th><th>Requested by</th><th>Decision</th></tr></thead><tbody>'+
 approvals.map(a=>'<tr><td>'+esc(a.reference)+'</td><td>'+money(a.amountMinor)+'</td>'+
 '<td>'+esc(a.status)+'</td><td>'+esc(a.requestedBy)+'</td><td>'+
 (a.status==='PENDING'&&isApprover&&a.requestedBy!==identity.id?
 '<button data-approval-decision="'+esc(a.id)+'" data-decision="APPROVED">Approve</button>'+
 '<button data-approval-decision="'+esc(a.id)+'" data-decision="REJECTED">Reject</button>':
 'Independent decision required')+'</td></tr>').join('')+'</tbody></table></div>':
 '<p>No approval requests in this workspace.</p>')+
 '<p class="connected-muted">An approval authorizes a matching manual posting only once. It does NOT move funds or approve a bank/card payment.</p>';
}
function spendingRecovery(){
 const flagged=data.budgets.filter(b=>b.status==='ACTIVE').flatMap(b=>b.allocations.filter(a=>a.remainingMinor<0)
  .map(a=>({budget:b.name,category:a.categoryName,over:-a.remainingMinor})));
 return card('Category budget review',
 flagged.length?'<ul class="connected-list">'+flagged.map(x=>'<li><b>'+esc(x.category)+' · '+esc(x.budget)+
 '</b><span>Manual allocation exceeded by '+money(x.over)+'</span></li>').join('')+'</ul>':
 '<p>No active, recorded category allocation is currently over its budget. This is not a guarantee that all financial obligations are covered.</p>')+
 recurringSuggestions()+btn('Set spending guardrails',24);
}


function incomeDashboard(){
 const view=data.incomeOverview;
 if(!view)return card('Income records','<p>Loading authoritative income records…</p>');
 const months=view.monthlyRecordedIncome||[],plans=view.plannedSources||[];
 const latest=months.find(m=>m.period===new Date().toISOString().slice(0,7))||null;
 return '<div class="connected-kpis">'+
  '<article><span>Net recorded income · last '+esc(view.months)+' months</span><strong>'+money(view.recordedIncomeMinor)+'</strong><small>POSTED manual journals only</small></article>'+
  '<article><span>Current reporting month</span><strong>'+money(latest?latest.netRecordedIncomeMinor:0)+'</strong><small>Manual entries, net of reversals</small></article>'+
  '<article><span>Expected sources</span><strong>'+plans.filter(p=>p.enabled).length+'</strong><small>User estimates, NOT received</small></article>'+
  '</div>'+
 card('Actual recorded income by month',months.length?
  '<div class="connected-table"><table><thead><tr><th>Month</th><th>Net posted income</th><th>Recorded income entries</th></tr></thead><tbody>'+
  months.map(m=>'<tr><td>'+esc(m.period)+'</td><td>'+money(m.netRecordedIncomeMinor)+'</td><td>'+esc(m.incomeEntries)+'</td></tr>').join('')+
  '</tbody></table></div>':'<p>No posted income records in the selected reporting period.</p>')+
 card('Next steps',btn('Manage expected income',28)+btn('Review forecast estimates',29)+btn('Record income',12))+
 card('Evidence warning','<p>Income recorded manually is not a bank-verified deposit. Source expectations are separate estimates and never credited to your actual account ledger.</p>');
}
function incomeSourcesScreen(){
 const sources=data.incomeSources||[],categories=data.categories.filter(c=>c.kind==='INCOME');
 const listHtml=sources.length?'<div class="connected-table"><table><thead><tr><th>Income source</th><th>Cadence</th><th>Estimated amount</th><th>First expected</th><th>Evidence</th><th>Status</th><th>Action</th></tr></thead><tbody>'+
 sources.map(x=>'<tr><td><b>'+esc(x.name)+'</b></td><td>'+esc(x.cadence)+'</td><td>'+money(x.expectedMinor)+'</td>'+
 '<td>'+esc(x.firstExpectedOn)+'</td><td>User estimate</td><td>'+esc(x.enabled?'ENABLED':'DISABLED')+'</td>'+
 '<td>'+(x.enabled?'<button data-disable-income="'+esc(x.id)+'">Disable</button>':'—')+'</td></tr>').join('')+
 '</tbody></table></div>':'<p>No expected income sources. These are optional forecasts and do not create deposits.</p>';
 return card('Expected income sources',listHtml)+
 card('Add an estimated income source','<p>Expected amounts and dates are plans, not recorded earnings. Editing terms requires a new source after disabling the old one.</p>'+
 '<form data-form="income-source">'+field('Source name','name')+
 select('Income category','categoryId',categories.map(c=>[c.id,c.name]))+
 select('Frequency','cadence',[['MONTHLY','Monthly'],['WEEKLY','Weekly'],['QUARTERLY','Quarterly'],['YEARLY','Yearly'],['VARIABLE','One-time / variable estimate']])+
 field('Expected KES amount','amount','text',true,'','pattern="[0-9]+(\\.[0-9]{1,2})?"')+
 field('First expected date','firstExpectedOn','date',true,new Date().toISOString().slice(0,10))+
 field('Optional final expected date','lastExpectedOn','date',false)+
 '<button type="submit">Save estimate</button></form>')+
 (categories.length?'':card('Income category required',btn('Create an income category',12)));
}
function incomeForecastScreen(){
 const estimate=data.incomeForecast;
 if(!estimate)return card('Income forecast','<p>Loading income estimates…</p>');
 const rows=estimate.events||[];
 return '<div class="connected-kpis"><article><span>Expected, NOT received · next '+esc(estimate.days)+' days</span>'+
 '<strong>'+money(estimate.expectedMinor)+'</strong><small>Unverified user-estimated income</small></article>'+
 '<article><span>Scheduled expectations</span><strong>'+rows.length+'</strong><small>No automatic posting to accounts</small></article></div>'+
 card('Expected income schedule',rows.length?
 '<div class="connected-table"><table><thead><tr><th>Expected date</th><th>Income source</th><th>Estimate</th><th>Quality</th></tr></thead><tbody>'+
 rows.map(x=>'<tr><td>'+esc(x.date)+'</td><td>'+esc(x.name)+'</td><td>'+money(x.amountMinor)+'</td>'+
 '<td>'+esc(x.evidence)+' · NOT RECEIVED</td></tr>').join('')+'</tbody></table></div>':
 '<p>No active estimated receipts in this period.</p>')+
 card('Income planning boundary','<p>Each expected date is a projection. Do not treat a planned payment as available cash. Only actual recorded manual receipts affect the posted ledger.</p>'+
 btn('Record an actual income entry',12)+btn('Review full cash flow',33));
}
function billsScreen(){
 const bills=data.bills||[],overview=data.billOverview||{};
 const cats=data.categories.filter(c=>c.kind==='EXPENSE');
 const rows=bills.length?'<div class="connected-table"><table><thead><tr><th>Obligation</th><th>Payee label</th><th>Schedule</th><th>Amount</th><th>First due</th><th>Status</th><th>Action</th></tr></thead><tbody>'+
  bills.map(x=>'<tr><td><b>'+esc(x.name)+'</b></td><td>'+esc(x.payeeLabel||'Not specified')+'</td>'+
   '<td>'+esc(x.cadence)+'</td><td>'+money(x.amountMinor)+'</td><td>'+esc(x.firstDueOn)+'</td>'+
   '<td>'+esc(x.status)+'</td><td><button data-open-bill="'+esc(x.id)+'">Details</button>'+
   (x.status==='ACTIVE'?'<button data-cancel-bill="'+esc(x.id)+'">Cancel future dues</button>':'')+
   '</td></tr>').join('')+'</tbody></table></div>':'<p>No user-reported bills or obligations recorded.</p>';
 return '<div class="connected-kpis">'+
 '<article><span>Next 90 days · unpaid scheduled obligations</span><strong>'+money(overview.upcomingUnverifiedMinor||0)+'</strong><small>User-reported, not bank confirmed</small></article>'+
 '<article><span>Past 366 days · overdue exposure</span><strong>'+money(overview.overdueUnverifiedMinor||0)+'</strong><small>Unverified outstanding occurrences</small></article>'+
 '</div>'+card('Bills and financial obligations',rows)+
 card('Register an obligation','<p>This records a future obligation only. It will NOT pay it, establish a mandate or make a ledger posting.</p>'+
 '<form data-form="bill-create">'+field('Bill or obligation name','name')+
 field('Payee / label (optional)','payeeLabel','text',false)+
 select('Expense category','categoryId',cats.map(c=>[c.id,c.name]))+
 select('Due frequency','cadence',[['ONCE','One-time'],['MONTHLY','Monthly'],['WEEKLY','Weekly'],['QUARTERLY','Quarterly'],['YEARLY','Yearly']])+
 field('Scheduled amount KES','amount','text',true,'','pattern="[0-9]+(\\.[0-9]{1,2})?"')+
 field('First due date','firstDueOn','date',true,new Date().toISOString().slice(0,10))+
 field('Optional last due date','lastDueOn','date',false)+
 '<button type="submit">Add unpaid obligation</button></form>')+
 (cats.length?'':card('Expense category required',btn('Create an expense category',12)));
}
async function loadSelectedBill(){
 if(!token||!workspaceId||!selectedBill||!apiBase)return;
 const target=selectedBill;
 billHistory=null;
 try{
  const details=await request(path('/bills/'+encodeURIComponent(target)));
  if(target===selectedBill){billHistory=details;error='';draw();}
 }catch(ex){
  if(target===selectedBill){billHistory=null;error=String(ex.message||ex);draw();}
 }
}
function billDetailScreen(){
 const bills=data.bills||[];
 if(!bills.length)return card('Obligation details', '<p>Create a bill to view expected dues and link manually posted evidence.</p>'+btn('Add a bill',30));
 if(!bills.some(x=>x.id===selectedBill))selectedBill=bills[0].id;
 const bill=bills.find(x=>x.id===selectedBill);
 const events=(data.billCalendar||[]).filter(x=>x.billId===bill.id);
 const unpaid=events.filter(e=>e.status!=='RECORDED_UNVERIFIED');
 const reversals=new Set(data.transactions.filter(t=>t.kind==='REVERSAL').map(t=>t.reversesTransactionId));
 const eligible=data.transactions.filter(t=>t.kind==='EXPENSE'&&t.categoryId===bill.categoryId&&
  t.currency==='KES'&&t.amountMinor===-bill.amountMinor&&!reversals.has(t.id));
 return card('Select an obligation',select('Bill','selectedBill',bills.map(x=>[x.id,x.name]),selectedBill)+
  '<dl class="connected-dl"><dt>Payee label</dt><dd>'+esc(bill.payeeLabel||'Not provided')+'</dd>'+
  '<dt>Amount</dt><dd>'+money(bill.amountMinor)+'</dd>'+
  '<dt>Frequency</dt><dd>'+esc(bill.cadence)+'</dd>'+
  '<dt>Status</dt><dd>'+esc(bill.status)+'</dd>'+
  '<dt>Evidence</dt><dd>User-reported obligation, not a payment mandate</dd></dl>')+
 card('Due occurrences · recent 30 / next 90 days',
  events.length?'<div class="connected-table"><table><thead><tr><th>Due date</th><th>Amount</th><th>Payment evidence</th></tr></thead><tbody>'+
  events.map(e=>'<tr><td>'+esc(e.date)+'</td><td>'+money(e.amountMinor)+'</td><td>'+
   esc(e.status.replaceAll('_',' '))+'</td></tr>').join('')+'</tbody></table></div>':
  '<p>No due occurrences in the displayed period.</p>')+
 card('Link an existing posted expense to one due occurrence',
  '<p>This does NOT send money or verify a bill was paid. It associates an existing manual expense of the exact amount and category with the selected due date. Reversal reopens the obligation.</p>'+
  (unpaid.length&&eligible.length?'<form data-form="bill-settlement">'+
   '<input type="hidden" name="billId" value="'+esc(bill.id)+'">'+
   select('Unrecorded due date','dueOn',unpaid.map(e=>[e.date,e.date+' · '+e.status]))+
   select('Matching manually POSTED expense','manualTransactionId',eligible.map(t=>[t.id,t.description+' · '+money(-t.amountMinor)]))+
   '<button type="submit">Link manual record (unverified)</button></form>':
   '<p>Requires an unrecorded due occurrence and a matching POSTED expense visible in your most recent 100 transactions.</p>')+
   btn('Record a manual expense',12))+
 card('Recorded settlement evidence history',
  billHistory?.bill?.id===bill.id?
   (billHistory.settlements?.length?
    '<div class="connected-table"><table><thead><tr><th>Due date</th><th>Record status</th><th>Linked</th><th>Evidence</th></tr></thead><tbody>'+
    billHistory.settlements.map(e=>'<tr><td>'+esc(e.dueOn)+'</td><td>'+esc(e.status)+'</td>'+
     '<td>'+esc(String(e.linkedAt).slice(0,10))+'</td><td>'+esc(e.paymentEvidence)+'</td></tr>').join('')+
    '</tbody></table></div>':
    '<p>No manually recorded settlement history for this obligation.</p>'):
   '<p>Loading authoritative settlement history…</p>');
}
function cashflowHistoryScreen(){
 const history=data.history;
 if(!history)return card('Recorded cash-flow timeline','<p>Loading posted journal evidence…</p>');
 const rows=history.daysWithRecords||[];
 return '<div class="connected-kpis"><article><span>Net manually recorded cash flow · last '+esc(history.days)+' days</span>'+
 '<strong>'+money(history.netRecordedCashFlowMinor)+'</strong><small>Double-entry, POSTED manual entries only</small></article>'+
 '<article><span>Days with records</span><strong>'+rows.length+'</strong><small>Corrections net in reversal dates</small></article></div>'+
 card('Economic-date cash-flow ledger',rows.length?
 '<div class="connected-table"><table><thead><tr><th>Economic date</th><th>Net manual income</th><th>Net manual expenses</th><th>Entries</th></tr></thead><tbody>'+
 rows.map(r=>'<tr><td>'+esc(r.date)+'</td><td>'+money(r.incomeMinor)+'</td>'+
 '<td>'+money(r.expenseMinor)+'</td><td>'+esc(r.recordedEntries)+'</td></tr>').join('')+
 '</tbody></table></div>':'<p>No posted manual journals in this reporting interval.</p>')+
 card('Accuracy boundary','<p>This is not a reconciled bank statement. Forecasted income and scheduled bills are intentionally absent from historical posted totals.</p>'+
 btn('Open cash-flow forecast',33));
}
function cashflowForecastScreen(){
 const x=data.cashflow;
 if(!x)return card('Indicative cash-flow forecast','<p>Loading workspace cash-flow estimate…</p>');
 const rows=x.timeline||[];
 return '<div class="connected-kpis">'+
 '<article><span>Manual ledger balance · as of '+esc(x.asOf)+'</span><strong>'+money(x.manualBalanceMinor)+'</strong><small>Not independently provider verified</small></article>'+
 '<article><span>Future estimated income</span><strong>'+money(x.expectedIncomeMinor)+'</strong><small>NOT received / not recorded</small></article>'+
 '<article><span>Upcoming unpaid obligations</span><strong>'+money(x.futureObligationsMinor)+'</strong><small>Unverified user-reported bills</small></article>'+
 '<article><span>Indicative end · '+esc(x.days)+' days</span><strong>'+money(x.endingIndicativeMinor)+'</strong><small>Not available-to-spend cash</small></article>'+
 '</div>'+
 card('Projected event timeline',rows.length?
 '<div class="connected-table"><table><thead><tr><th>Date</th><th>Estimated income</th><th>Expected bills</th><th>Indicative ledger after event</th></tr></thead><tbody>'+
 rows.map(r=>'<tr><td>'+esc(r.date)+'</td><td>'+money(r.estimatedIncomeMinor)+'</td>'+
 '<td>'+money(r.unverifiedBillsDueMinor)+'</td><td>'+money(r.projectionMinor)+'</td></tr>').join('')+
 '</tbody></table></div>':'<p>No planned income or bill occurrences in this period.</p>')+
 card('Overdue obligations', '<p>Unverified overdue exposure: <b>'+money(x.overdueUnverifiedMinor)+'</b>. '+
 'Indicative end after overdue exposure: <b>'+money(x.endingAfterOverdueExposureMinor)+'</b>.</p>'+
 '<p>Overdue obligations are a separate exposure, not a journal entry or an assumed payment.</p>')+
 card('Forecast limitations','<ul class="connected-list">'+(x.limitations||[]).map(t=>
 '<li>'+esc(t)+'</li>').join('')+'</ul>'+btn('Review shortfall exposure',34));
}
function shortfallScreen(){
 const x=data.shortfalls;
 if(!x)return card('Potential cash shortfalls','<p>Loading conservative cash-flow review…</p>');
 const issues=x.risks||{};
 const flagged=Object.values(issues).some(Boolean);
 return '<div class="connected-kpis"><article><span>First potential shortfall</span><strong>'+
 esc(x.firstPotentialShortfallOn||'Not projected')+'</strong><small>Estimate, not confirmed liquidity</small></article>'+
 '<article><span>Unverified overdue exposure</span><strong>'+money(x.overdueUnverifiedMinor)+'</strong>'+
 '<small>Review before any additional obligation</small></article>'+
 '<article><span>After-overdue indicative end</span><strong>'+money(x.endingAfterOverdueExposureMinor)+'</strong>'+
 '<small>Not a guaranteed runway</small></article></div>'+
 card('Cash-flow exposure',flagged?
 '<p class="connected-b3-warning">One or more indicative risk conditions is present. Verify actual bank balances, outstanding obligations, and income dates before acting.</p>':
 '<p>No potential shortfall was identified from these user-entered estimates. This does not establish solvency or mean all obligations have been captured.</p>')+
 card('Suggested review actions','<ul class="connected-list">'+(x.recommendations||[]).map(t=>'<li>'+esc(t)+'</li>').join('')+
 '</ul><p class="connected-muted">Advisory review only. No payment, bank mandate, emergency transfer or automated financial decision is initiated.</p>'+
 btn('Review unverified bills',30)+btn('Inspect income assumptions',29));
}


const b4Money=n=>money(n||0);
const b4Minor=s=>String(s??'0').trim()==='0'?0:asMinor(s);
const b4MonthNote='<p class="connected-muted">Planning labels are NOT bank balances, protected deposits, investment holdings or actual money transfers. Source: manually POSTED journal entries.</p>';
const b4TargetOptions=()=>[
 ...b4.buckets.filter(x=>x.status==='ACTIVE').map(x=>['BUCKET:'+x.id,'Bucket · '+x.name]),
 ...b4.goals.filter(x=>x.status==='ACTIVE').map(x=>['GOAL:'+x.id,'Goal · '+x.name])
];
function capitalCommand(){
 const x=b4.summary;
 if(!x)return card('Capital allocation data unavailable','<p>Authenticated capital service has not been loaded. No zero balance is implied.</p>');
 return '<div class="connected-kpis">'+
 '<article><span>Manually posted liquidity</span><strong>'+b4Money(x.manualPostedLiquidityMinor)+'</strong><small>Unverified, journal-backed</small></article>'+
 '<article><span>Virtual capital assigned</span><strong>'+b4Money(x.virtualReservedMinor)+'</strong><small>Planning envelope only</small></article>'+
 '<article><span>Unassigned in manual records</span><strong>'+b4Money(x.unassignedMinor)+'</strong><small>NOT certified free cash</small></article>'+
 '<article><span>Active planning targets</span><strong>'+esc(b4.buckets.filter(x=>x.status==='ACTIVE').length+b4.goals.filter(x=>x.status==='ACTIVE').length)+'</strong><small>Bucket and goal definitions</small></article>'+
 '</div>'+
 card('Allocation Command Center',b4MonthNote+
 (x.unassignedNegative?'<div class="connected-alert">Virtual reservations now exceed manually recorded liquidity. Review actual expenses and release reservations where appropriate.</div>':'')+
 '<p>Plan within posted manual funds without transferring money. Funding a goal or bucket never debits or credits a financial account.</p>'+
 btn('Manage money buckets',36)+btn('Savings & goals',37)+btn('Emergency cover',39)+btn('Financial scenarios',42))+
 card('Current capital distribution',
 '<div class="connected-table"><table><thead><tr><th>Planning target</th><th>Kind</th><th>Virtual assigned</th><th>Status</th></tr></thead><tbody>'+
 [...b4.buckets.map(x=>[x.name,x.purpose,x.allocatedMinor,x.status]),
 ...b4.goals.map(x=>[x.name,x.kind,x.allocatedMinor,x.status])].map(x=>
 '<tr><td>'+esc(x[0])+'</td><td>'+esc(x[1])+'</td><td>'+b4Money(x[2])+'</td><td>'+esc(x[3])+'</td></tr>').join('')+
 '</tbody></table></div>')+
 card('Recorded allocation history',b4.allocations.length?
 '<ul class="connected-list">'+b4.allocations.slice(0,20).map(x=>
 '<li><b>'+esc(x.note)+'</b><span>'+esc(x.targetKind)+' · '+b4Money(x.amountMinor)+' · virtual '+(x.amountMinor<0?'release':'assignment')+'</span></li>').join('')+'</ul>':
 '<p>No virtual assignments. Your ledger balance remains unaffected.</p>');
}
function b4FundingForm(kind,targetId){
 const choices=[['','No request — allowable below approval threshold'],
  ...b4.requests.filter(r=>r.status==='APPROVED'&&r.requestedBy===identity?.id&&r.targetKind===kind&&r.targetId===targetId)
   .map(r=>[r.id,r.rationale+' · '+b4Money(r.amountMinor)+' · approved'])];
 return '<form data-form="b4-assign">'+
 '<input type="hidden" name="targetKind" value="'+esc(kind)+'"><input type="hidden" name="targetId" value="'+esc(targetId)+'">'+
 field('Amount to assign (+) or release (-) · KES','amount','text',true,'','pattern="-?[0-9]+(\\.[0-9]{1,2})?"')+
 field('Reason / note','note')+select('Matching independent approval (if required)','approvalRequestId',choices)+
 '<button type="submit">Record virtual allocation</button></form>';
}
function bucketManagement(){
 return card('Money buckets — planning envelopes',
 '<p>Create named priority envelopes, then virtually assign or release amounts against existing posted manual liquidity. This never segregates bank funds.</p>'+
 '<form data-form="b4-bucket">'+field('Bucket name','name')+
 select('Purpose','purpose',[['ESSENTIALS','Essential bills'],['SAVINGS','Savings'],['EMERGENCY','Emergency reserve'],['INVESTMENT','Investment planning'],['DISCRETIONARY','Discretionary'],['OTHER','Other']])+
 select('Priority (1 = highest)','priority',[['1','1 — essential'],['2','2 — high'],['3','3 — normal'],['4','4 — lower'],['5','5 — optional']])+
 '<button type="submit">Create money bucket</button></form>')+
 (b4.buckets.length?b4.buckets.map(x=>card(x.name+' · '+x.purpose,
 '<p><b>'+b4Money(x.allocatedMinor)+'</b> virtually assigned · Priority '+esc(x.priority)+' · '+esc(x.status)+'</p>'+
 (x.status==='ACTIVE'?b4FundingForm('BUCKET',x.id)+
 '<button data-b4-archive="BUCKET:'+esc(x.id)+'">Archive empty bucket</button>':'<p>Archived — historic allocations preserved.</p>'))).join(''):
 card('No buckets','<p>Start by creating a money bucket. No virtual funding exists yet.</p>'))+
 b4MonthNote;
}
function b4GoalCard(x){
 const pct=x.targetMinor?Math.max(0,Math.min(100,(x.allocatedMinor/x.targetMinor)*100)):0;
 return card(x.name+' · '+x.kind,
 '<p><b>'+b4Money(x.allocatedMinor)+'</b> virtually assigned of '+b4Money(x.targetMinor)+' target · '+esc(x.status)+'</p>'+
 '<div class="connected-meter"><i style="width:'+pct.toFixed(1)+'%"></i></div>'+
 '<p>Unassigned goal target: '+b4Money(x.remainingMinor)+
 (x.dueOn?' · Due '+esc(x.dueOn):' · No due date')+
 (x.kind==='EMERGENCY'?' · '+esc(x.emergencyCoverageMonths)+' months of user-reported essentials':'')+'</p>'+
 '<button data-b4-goal="'+esc(x.id)+'">Open goal funding</button>');
}
function savingsGoals(){
 return card('Savings & financial goals','<p>Create immutable planning targets. Funding them only earmarks a portion of your MANUAL financial records; it does not move money.</p>'+
 '<form data-form="b4-goal">'+field('Goal name','name')+
 select('Goal type','kind',[['SAVINGS','Savings'],['EMERGENCY','Emergency fund']])+
 field('Target KES','targetAmount','text',true,'','pattern="[0-9]+(\\.[0-9]{1,2})?"')+
 field('Target date (optional)','dueOn','date',false)+
 field('Essential monthly costs KES (only for emergency fund)','monthlyEssential','text',false,'','pattern="[0-9]+(\\.[0-9]{1,2})?"')+
 '<button type="submit">Create goal</button></form>')+
 (b4.goals.length?b4.goals.map(b4GoalCard).join(''):card('No goals','<p>Add your first target to model funding without changing the ledger.</p>'))+
 b4MonthNote;
}
function goalDetails(){
 const x=b4.goals.find(g=>g.id===selectedGoal)||b4.goals[0];
 if(!x)return card('Goal details','<p>No savings goals registered in this workspace.</p>'+btn('Create a goal',37));
 return card('Selected goal',select('Choose a goal','b4SelectedGoal',b4.goals.map(g=>[g.id,g.name]),x.id))+
 b4GoalCard(x)+
 (x.status==='ACTIVE'?card('Virtual funding or release',b4FundingForm('GOAL',x.id)+
 '<button data-b4-archive="GOAL:'+esc(x.id)+'">Archive empty goal</button>'):
 card('Archived','<p>Goal definition and allocation history are retained.</p>'))+
 b4MonthNote;
}
function emergencyGoals(){
 const emergency=b4.goals.filter(g=>g.kind==='EMERGENCY');
 return card('Emergency fund coverage — self-reported',
 '<p>Coverage divides virtually assigned KES by the monthly essential-expense amount you entered when creating a goal. It does not confirm bank liquidity.</p>')+
 (emergency.length?emergency.map(b4GoalCard).join(''):
 card('No emergency fund','<p>Create an EMERGENCY goal with a target and monthly essential living-cost estimate.</p>'+btn('New savings / emergency goal',37)))+
 b4MonthNote;
}
function affordabilityScreen(){
 const x=b4.affordability;
 return card('Affordability & purchase simulator','<p>Purchasing power cannot be confirmed from unverified manual records. This is a non-authorizing exposure check.</p>'+
 '<form data-form="b4-afford">'+field('Proposed purchase KES','purchaseAmount','text',true,'','pattern="[0-9]+(\\.[0-9]{1,2})?"')+
 field('Optional future monthly repayment KES','monthlyPayment','text',false,'0','pattern="[0-9]+(\\.[0-9]{1,2})?"')+
 '<button type="submit">Evaluate without purchase</button></form>')+
 (x?card('Advisory assessment · '+x.verdict,
 '<div class="connected-kpis"><article><span>Manual unassigned amount</span><strong>'+b4Money(x.unassignedMinor)+'</strong></article>'+
 '<article><span>After hypothetical purchase</span><strong>'+b4Money(x.remainingAfterPurchaseMinor)+'</strong></article>'+
 '<article><span>90-day user-reported unpaid bills</span><strong>'+b4Money(x.upcoming90DayBillsUnverifiedMinor)+'</strong></article>'+
 '<article><span>Overdue unverified bills</span><strong>'+b4Money(x.overdueBillsUnverifiedMinor)+'</strong></article></div>'+
 '<p><b>'+(x.insufficientManualUnassigned?'Insufficient unassigned manual funds':'Manual reserve test not failed')+
 '</b>; neither result confirms true affordability. No funds moved, payment authorized, or loan approved.</p>'):'')+
 b4MonthNote;
}
function fundingApprovals(){
 const targets=b4TargetOptions();
 const isApprover=['OWNER','ADMIN'].includes(workspaces.find(w=>w.id===workspaceId)?.role);
 return card('Funding request · virtual capital governance',
 '<p>Cumulative assignments above KES 100,000 per target require an independently approved request for the exact increment. Self-approvals are rejected.</p>'+
 '<form data-form="b4-request">'+select('Target bucket or savings goal','target',targets)+
 field('Requested amount KES','amount','text',true,'','pattern="[0-9]+(\\.[0-9]{1,2})?"')+
 field('Funding rationale','rationale')+'<button type="submit">Request independent approval</button></form>')+
 card('Independent decisions',(b4.requests.length?
 '<div class="connected-table"><table><thead><tr><th>Target</th><th>Amount</th><th>Status</th><th>Requester</th><th>Action</th></tr></thead><tbody>'+
 b4.requests.map(x=>'<tr><td>'+esc(x.targetKind)+'</td><td>'+b4Money(x.amountMinor)+'</td>'+
 '<td>'+esc(x.status)+'</td><td>'+esc(x.requestedBy)+'</td><td>'+
 (isApprover&&x.status==='PENDING'&&x.requestedBy!==identity?.id?
 '<button data-b4-decision="'+esc(x.id)+'" data-b4-choice="APPROVED">Approve</button>'+
 '<button data-b4-decision="'+esc(x.id)+'" data-b4-choice="REJECTED">Reject</button>':
 'Independent review required')+'</td></tr>').join('')+'</tbody></table></div>':
 '<p>No funding requests in this workspace.</p>')+
 '<p class="connected-muted">Approval only permits a subsequent matching virtual assignment. No bank, wallet or card is charged.</p>')+
 btn('Assign to buckets',36)+btn('Assign to goals',38);
}
function scenarioScreen(){
 const s=b4.scenario;
 return card('Financial scenario planning — deterministic what-if',
 '<p>Set explicit KES monthly assumptions. Shock changes cashflow; savings changes discretionary planning only, not actual liquid money or future investment returns.</p>'+
 '<form data-form="b4-scenario">'+field('Scenario name','name')+
 select('Horizon','horizonMonths',Array.from({length:24},(_,i)=>[String(i+1),String(i+1)+' months']))+
 field('Monthly income estimate KES','monthlyIncome','text',true,'0','pattern="[0-9]+(\\.[0-9]{1,2})?"')+
 field('Monthly expense estimate KES','monthlyExpense','text',true,'0','pattern="[0-9]+(\\.[0-9]{1,2})?"')+
 field('Monthly planned savings KES','monthlySavings','text',true,'0','pattern="[0-9]+(\\.[0-9]{1,2})?"')+
 field('One-time purchase KES','oneTimePurchase','text',true,'0','pattern="[0-9]+(\\.[0-9]{1,2})?"')+
 field('Income change % (e.g. -10)','incomeShock','number',true,'0','min="-100" max="100" step="1"')+
 field('Expense change % (e.g. +5)','expenseShock','number',true,'0','min="-100" max="200" step="1"')+
 '<button type="submit">Save non-executing scenario</button></form>')+
 card('Saved simulations',b4.scenarios.length?
 '<ul class="connected-list">'+b4.scenarios.map(x=>'<li><b>'+esc(x.name)+'</b>'+
 '<span>'+esc(x.horizonMonths)+' months</span><button data-b4-scenario="'+esc(x.id)+'">View saved result</button></li>').join('')+'</ul>':
 '<p>No scenarios saved yet.</p>')+
 (s?card('What-if results for '+s.name,
 '<p><strong>Hypothetical end cash:</strong> '+b4Money(s.simulation.endingCashAfterExpensesMinor)+
 ' · <strong>After virtual savings allocation:</strong> '+b4Money(s.simulation.endingDiscretionaryAfterPlannedSavingsMinor)+'</p>'+
 '<div class="connected-table"><table><thead><tr><th>Month</th><th>Income assumption</th><th>Expense assumption</th><th>Hypothetical cash</th><th>After planned savings</th></tr></thead><tbody>'+
 s.simulation.months.map(m=>'<tr><td>'+esc(m.month)+'</td><td>'+b4Money(m.incomeMinor)+'</td>'+
 '<td>'+b4Money(m.expensesMinor)+'</td><td>'+b4Money(m.cashAfterExpensesMinor)+'</td>'+
 '<td>'+b4Money(m.discretionaryAfterPlannedSavingsMinor)+'</td></tr>').join('')+
 '</tbody></table></div><p class="connected-muted">Model '+esc(s.modelVersion)+' · user-defined assumptions, no investment advice or provider-verified balances.</p>'):'')+
 b4MonthNote;
}

function renderedScreen(){
 const id=screen();
 if(!token)return signIn();
 if(!workspaceId)return workspace();
 if(loadFailed)return card('Financial records unavailable',
  '<p>Authenticated workspace data could not be loaded. No balance, income, bill or cash-flow zero is implied. Check the API connection and retry.</p>'+
  '<button data-retry>Retry loading records</button>');
 switch(id){
 case 1:case 3:case 60:return profile();
 case 2:return workspace();
 case 4:return dashboard();
 case 7:return accounts();
 case 8:return accountDetails();
 case 9:return newAccount();
 case 10:return transactions();
 case 11:return transactionDetails();
 case 12:return formTransaction();
 case 13:return imports();
 case 15:return reconciliation();
 case 16:case 17:case 18:return spendingPanels();
 case 19:case 20:case 25:return recurringSuggestions();
 case 21:return budgetList()+budgetDetails();
 case 22:return createBudget()+budgetList();
 case 23:return allowance();
 case 24:return guardrails()+approvalQueue();
 case 26:return spendingRecovery();
 case 27:return incomeDashboard();
 case 28:return incomeSourcesScreen();
 case 29:return incomeForecastScreen();
 case 30:return billsScreen();
 case 31:return billDetailScreen();
 case 32:return cashflowHistoryScreen();
 case 33:return cashflowForecastScreen();
 case 34:return shortfallScreen();
 case 35:return capitalCommand();
 case 36:return bucketManagement();
 case 37:return savingsGoals();
 case 38:return goalDetails();
 case 39:return emergencyGoals();
 case 40:return affordabilityScreen();
 case 41:return fundingApprovals();
 case 42:return scenarioScreen();

 default:return soon(id);
 }
}
function draw(){
 if(!root)return;
 const id=screen();
 root.innerHTML='<div class="connected-app"><header class="connected-top"><a href="index.html" class="connected-logo">◉ &nbsp; FINANCE <b>OS</b>'+
  '<small>Authenticated financial workspace</small></a><div class="connected-top-actions">'+
  (identity?'<span>'+esc(identity.displayName)+'</span><button data-logout>Sign out</button>':'<span>Identity required</span>')+
  '<a href="rebuild.html#screen/'+id+'">View visual prototype ↗</a></div></header>'+
  '<div class="connected-layout"><aside class="connected-side"><p class="connected-sidebar-label">AUTHENTICATED EXPERIENCE</p>'+
  (identity?'<label class="connected-field">Workspace<select data-workspace>'+workspaces.map(w=>
    '<option value="'+esc(w.id)+'" '+(w.id===workspaceId?'selected':'')+'>'+esc(w.name)+'</option>').join('')+
    '</select></label>':'')+
  groups.map(([label,ids])=>'<details '+(ids.includes(id)||id<5?'open':'')+'><summary>'+esc(label)+'</summary>'+
   ids.map(n=>'<button type="button" data-go="'+n+'" class="'+(id===n?'active':'')+'"><span>'+String(n).padStart(2,'0')+'</span>'+esc(names[n])+'</button>').join('')+'</details>').join('')+
  '<p class="connected-sidebar-foot">Server-backed truth only. No demo balance is imported.</p></aside>'+
  '<main id="main" class="connected-main"><div class="connected-hero"><span>FINANCE OS · LIVE WORKSPACE</span>'+
  '<h1>'+esc(names[id])+'</h1><p>'+esc(identity?'Workspace-scoped PostgreSQL records':'Sign in to access server-verified financial data')+'</p></div>'+
  (error?'<div class="connected-alert" role="alert">'+esc(error)+'</div>':'')+
  (notice?'<div class="connected-note" role="status">'+esc(notice)+'</div>':'')+
  (busy?'<div role="status">Loading server records…</div>':
  (!apiBase?card('Configuration required','<p>The API endpoint has not been configured for this deployment. No demonstration data is displayed.</p>'):renderedScreen()))+
  '<footer class="connected-disclaimer">Finance OS · Authenticated mode · No provider-connected balances, automated payments or financial advice. '+
  'The separate visual prototype uses illustrative data. This connected mode never does.</footer></main></div></div>';
}
function qs(form){return Object.fromEntries(new FormData(form));}
async function submit(form){
 const d=qs(form),kind=form.dataset.form;
 try{
  busy=true;error='';notice='';draw();
  if(kind==='login'||kind==='register'){
   const output=await request('/v1/auth/'+kind,false,{method:'POST',body:kind==='login'?
    {email:d.email,password:d.password}:{email:d.email,password:d.password,displayName:d.displayName}});
   token=output.accessToken;notice='Authenticated into a real local database test account.';await refresh();return;
  }
  if(!token||!workspaceId)throw new Error('An authenticated workspace is required.');
  if(kind==='workspace'){
   await request('/v1/workspaces',true,{method:'POST',body:{name:d.name,kind:d.kind}});
   notice='Workspace created.';await refresh();return;
  }
  const base=path('');
  if(kind==='account')await request(base+'/accounts',true,{method:'POST',
   body:{displayName:d.displayName,kind:d.kind,currency:'KES'}});
  else if(kind==='category')await request(base+'/categories',true,{method:'POST',
   body:{name:d.name,kind:d.kind}});
  else if(kind==='transaction'){
   const cat=data.categories.find(c=>c.id===d.categoryId);
   if(cat?.kind!==d.kind)throw new Error('Choose a category matching the transaction type.');
   await request(base+'/transactions',true,{method:'POST',body:{
    financialAccountId:d.financialAccountId,categoryId:d.categoryId,kind:d.kind,
    amountMinor:asMinor(d.amount),currency:'KES',description:d.description,effectiveOn:d.effectiveOn,
    approvalRequestIds:[...new FormData(form).getAll('approvalRequestIds')]}});
  }else if(kind==='import')await request(base+'/statement-imports',true,{method:'POST',
   body:{financialAccountId:d.financialAccountId,rows:[{date:d.date,description:d.description,
     amountMinor:asMinor(d.amount),currency:'KES'}]}});
  else if(kind==='match')await request(base+'/reconciliation/matches',true,{method:'POST',
   body:{importRowId:d.importRowId,manualTransactionId:d.manualTransactionId}});
  else if(kind==='budget'){
   const ids=[...new FormData(form).getAll('budgetCategory')];
   const allocations=ids.map(id=>({categoryId:id,limitMinor:asMinor(d['allocation-'+id]),rollover:false}));
   if(!allocations.length)throw new Error('Select at least one expense category allocation.');
   await request(base+'/budgets',true,{method:'POST',body:{name:d.name,
    currency:'KES',startsOn:d.startsOn,endsOn:d.endsOn,amountMinor:asMinor(d.amount),allocations}});
  }else if(kind==='guardrail-amount'){
   await request(base+'/spending/guardrails',true,{method:'POST',
    body:{name:d.name,kind:'AMOUNT',minAmountMinor:asMinor(d.amount),action:d.action}});
  }else if(kind==='guardrail-category'){
   await request(base+'/spending/guardrails',true,{method:'POST',
    body:{name:d.name,kind:'CATEGORY',categoryId:d.categoryId,action:d.action}});
  }else if(kind==='purchase-check'){
   lastCheck={amountMinor:asMinor(d.amount),currency:'KES',categoryId:d.categoryId,reference:d.reference};
   lastEval=await request(base+'/spending/purchase-checks',true,{method:'POST',body:lastCheck});
   notice='Policy preview completed. No account was charged and no payment was authorized.';
   await refresh();return;
  }
  else if(kind==='income-source'){
   await request(base+'/income/sources',true,{method:'POST',body:{
    name:d.name,categoryId:d.categoryId,cadence:d.cadence,
    expectedMinor:asMinor(d.amount),currency:'KES',firstExpectedOn:d.firstExpectedOn,
    lastExpectedOn:d.lastExpectedOn||null
   }});
  }else if(kind==='bill-create'){
   await request(base+'/bills',true,{method:'POST',body:{
    name:d.name,payeeLabel:d.payeeLabel||null,categoryId:d.categoryId,
    cadence:d.cadence,amountMinor:asMinor(d.amount),currency:'KES',
    firstDueOn:d.firstDueOn,lastDueOn:d.lastDueOn||null
   }});
  }else if(kind==='bill-settlement'){
   await request(base+'/bills/'+encodeURIComponent(d.billId)+'/settlements',true,{
    method:'POST',body:{dueOn:d.dueOn,manualTransactionId:d.manualTransactionId}
   });
   notice='A POSTED manual expense was linked as unverified evidence. No payment was initiated.';
   await refresh();return;
  }
  else if(kind==='b4-bucket'){
   await request(base+'/money-buckets',true,{method:'POST',body:{
    name:d.name,purpose:d.purpose,priority:Number(d.priority),currency:'KES'}});
  }else if(kind==='b4-goal'){
   const essential=d.monthlyEssential?asMinor(d.monthlyEssential):null;
   if(d.kind==='EMERGENCY'&&!essential)throw new Error('Emergency goal requires a monthly essential-expense estimate.');
   await request(base+'/savings-goals',true,{method:'POST',body:{
    name:d.name,kind:d.kind,targetMinor:asMinor(d.targetAmount),currency:'KES',
    dueOn:d.dueOn||null,monthlyEssentialMinor:d.kind==='EMERGENCY'?essential:null}});
  }else if(kind==='b4-assign'){
   await request(base+'/capital/allocations',true,{method:'POST',body:{
    targetKind:d.targetKind,targetId:d.targetId,amountMinor:asMinor(d.amount),
    note:d.note,approvalRequestId:d.approvalRequestId||null}});
   notice='Virtual allocation recorded. No bank or ledger transfer occurred.';await refresh();return;
  }else if(kind==='b4-request'){
   if(!d.target)throw new Error('Create a bucket or goal before requesting funding.');
   const [targetKind,targetId]=d.target.split(':');
   await request(base+'/capital/requests',true,{method:'POST',body:{
    targetKind,targetId,amountMinor:asMinor(d.amount),rationale:d.rationale,currency:'KES'}});
   notice='Independent funding review requested. No funds moved.';await refresh();return;
  }else if(kind==='b4-afford'){
   b4.affordability=await request(base+'/capital/affordability',true,{method:'POST',body:{
    purchaseAmountMinor:asMinor(d.purchaseAmount),monthlyPaymentMinor:b4Minor(d.monthlyPayment)}});
   notice='Hypothetical affordability evaluated; no purchase authorized.';busy=false;draw();return;
  }else if(kind==='b4-scenario'){
   const body={name:d.name,horizonMonths:Number(d.horizonMonths),currency:'KES',
    monthlyIncomeMinor:b4Minor(d.monthlyIncome),monthlyExpenseMinor:b4Minor(d.monthlyExpense),
    monthlySavingsMinor:b4Minor(d.monthlySavings),oneTimePurchaseMinor:b4Minor(d.oneTimePurchase),
    incomeShockBasisPoints:Math.round(Number(d.incomeShock)*100),
    expenseShockBasisPoints:Math.round(Number(d.expenseShock)*100)};
   const saved=await request(base+'/planning/scenarios',true,{method:'POST',body});
   b4.scenario=saved;notice='Non-executing what-if scenario saved.';await refresh();return;
  }
  else throw new Error('This form is not connected to an authoritative service.');
  notice='Saved to the current workspace in PostgreSQL.';await refresh();
 }catch(ex){error=String(ex.message||ex);busy=false;draw();}
}
async function startOidc(){
 if(!provider)throw new Error('OIDC provider is not configured.');
 const bytes=new Uint8Array(32);crypto.getRandomValues(bytes);
 const verifier=Array.from(bytes,b=>String.fromCharCode(b)).join('');
 const codeVerifier=btoa(verifier).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 const state=random(),challengeRaw=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(codeVerifier));
 const challenge=btoa(String.fromCharCode(...new Uint8Array(challengeRaw))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
 // Only non-secret PKCE authorization metadata survives the IdP round-trip.
 sessionStorage.setItem('finance-os-pkce',JSON.stringify({state,verifier:codeVerifier,created:Date.now()}));
 const url=new URL(provider.authorizationEndpoint);
 url.searchParams.set('response_type','code');url.searchParams.set('client_id',provider.clientId);
 url.searchParams.set('redirect_uri',provider.redirectUri);url.searchParams.set('scope',provider.scope);
 url.searchParams.set('state',state);url.searchParams.set('code_challenge',challenge);
 url.searchParams.set('code_challenge_method','S256');url.searchParams.set('acr_values',provider.requiredAcr);
 location.assign(url.toString());
}
async function finishOidc(){
 const url=new URL(location.href),code=url.searchParams.get('code'),state=url.searchParams.get('state');
 const rejected=url.searchParams.get('error');
 if(!code&&!rejected)return;
 history.replaceState(null,'',location.pathname+location.hash);
 const stored=sessionStorage.getItem('finance-os-pkce');sessionStorage.removeItem('finance-os-pkce');
 if(rejected)throw new Error('Identity provider authentication failed.');
 if(!provider||!stored)throw new Error('Missing OIDC authorization state; sign in again.');
 let values;try{values=JSON.parse(stored);}catch{throw new Error('Invalid OIDC authorization state.');}
 if(values.state!==state||Date.now()-values.created>5*60_000)throw new Error('Expired or invalid OIDC state.');
 const params=new URLSearchParams({grant_type:'authorization_code',code,redirect_uri:provider.redirectUri,
  client_id:provider.clientId,code_verifier:values.verifier});
 const response=await fetch(provider.tokenEndpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},
  body:params,cache:'no-store',credentials:'omit',redirect:'error'});
 if(!response.ok)throw new Error('Identity provider refused authorization code exchange.');
 const result=await response.json();
 if(result.token_type?.toLowerCase()!=='bearer'||typeof result.access_token!=='string'||
  result.access_token.split('.').length!==3)throw new Error('OIDC access token is incompatible with API JWT verification.');
 token=result.access_token;notice='Verified identity token obtained. The API will validate signature and MFA assurance.';
 await refresh();
}
document.addEventListener('click',async event=>{
 const button=event.target.closest('button');
 if(!button)return;
 if(button.hasAttribute('data-go')){nav(Number(button.dataset.go));return;}
 if(button.hasAttribute('data-retry')){void refresh();return;}
 if(button.hasAttribute('data-oidc-start')){
  try{await startOidc();}catch(ex){error=String(ex.message||ex);draw();}
 }
 if(button.hasAttribute('data-logout')){
  try{if(token&&!provider)await request('/v1/auth/logout',true,{method:'POST'});}catch{}
  token='';identity=null;workspaces=[];workspaceId='';lastEval=null;lastCheck=null;b3LoadedFor='';b4LoadedFor='';b4={summary:null,buckets:[],goals:[],allocations:[],requests:[],scenarios:[],scenario:null,affordability:null};billHistory=null;loadFailed=false;data={accounts:[],categories:[],transactions:[],journals:[],reconciliation:[],summary:null,budgets:[],insights:null,guardrails:[],approvals:[],incomeSources:[],incomeOverview:null,incomeForecast:null,bills:[],billOverview:null,billCalendar:[],cashflow:null,history:null,shortfalls:null};
  notice='Local API session cleared. Identity-provider single sign-on session must be ended at the provider.';
  draw();
 }
 if(button.hasAttribute('data-b4-goal')){
  selectedGoal=button.dataset.b4Goal;nav(38);return;
 }
 if(button.hasAttribute('data-b4-archive')){
  const [kind,id]=button.dataset.b4Archive.split(':');
  if(!['BUCKET','GOAL'].includes(kind)||!id)return;
  if(!confirm('Archive this empty planning target? Release allocations first; historic records remain immutable.'))return;
  try{await request(path('/'+(kind==='BUCKET'?'money-buckets':'savings-goals')+'/'+encodeURIComponent(id)+'/archive'),
   true,{method:'POST'});notice='Planning target archived; prior records retained.';await refresh();}
  catch(ex){error=String(ex.message||ex);draw();}return;
 }
 if(button.hasAttribute('data-b4-decision')){
  if(!confirm('Submit an irreversible independent virtual-funding decision?'))return;
  try{await request(path('/capital/requests/'+encodeURIComponent(button.dataset.b4Decision)+'/decision'),
   true,{method:'POST',body:{decision:button.dataset.b4Choice}});
   notice='Planning decision recorded; no real money moved.';await refresh();}
  catch(ex){error=String(ex.message||ex);draw();}return;
 }
 if(button.hasAttribute('data-b4-scenario')){
  try{b4.scenario=await request(path('/planning/scenarios/'+encodeURIComponent(button.dataset.b4Scenario)));
   notice='Saved assumptions loaded.';draw();}
  catch(ex){error=String(ex.message||ex);draw();}return;
 }
 if(button.hasAttribute('data-disable-income')){
  if(!confirm('Disable this estimated income schedule? The original expectation will remain auditable.'))return;
  try{
   await request(path('/income/sources/'+encodeURIComponent(button.dataset.disableIncome)+'/disable'),true,{method:'POST'});
   notice='Estimated income source disabled. No actual income was changed.';await refresh();
  }catch(ex){error=String(ex.message||ex);draw();}
  return;
 }
 if(button.hasAttribute('data-open-bill')){
  selectedBill=button.dataset.openBill;nav(31);return;
 }
 if(button.hasAttribute('data-cancel-bill')){
  if(!confirm('Cancel future bill occurrences? Historical manual payment records remain untouched.'))return;
  try{
   await request(path('/bills/'+encodeURIComponent(button.dataset.cancelBill)+'/cancel'),true,{method:'POST'});
   notice='Future bill schedule cancelled; historical records preserved.';await refresh();
  }catch(ex){error=String(ex.message||ex);draw();}
  return;
 }
 if(button.hasAttribute('data-archive-budget')){
  if(!confirm('Archive this active budget? The original budget remains auditable and a replacement can be activated.'))return;
  try{await request(path('/budgets/'+encodeURIComponent(button.dataset.archiveBudget)+'/archive'),true,{method:'POST'});
   notice='Budget archived. Previous records are preserved.';await refresh();}
  catch(ex){error=String(ex.message||ex);draw();}
  return;
 }
 if(button.hasAttribute('data-deactivate-rule')){
  if(!confirm('Deactivate this rule? A new policy must be created to replace it.'))return;
  try{await request(path('/spending/guardrails/'+encodeURIComponent(button.dataset.deactivateRule)+'/deactivate'),true,{method:'POST'});
   notice='Policy deactivated with an audit record; prior decisions remain.';lastEval=null;lastCheck=null;await refresh();}
  catch(ex){error=String(ex.message||ex);draw();}
  return;
 }
 if(button.hasAttribute('data-activate-budget')){
  if(!confirm('Activate this immutable budget? Category allocations cannot be edited after activation.'))return;
  try{await request(path('/budgets/'+encodeURIComponent(button.dataset.activateBudget)+'/activate'),true,{method:'POST'});
   notice='Budget activated and checked against overlapping category budgets.';await refresh();}
  catch(ex){error=String(ex.message||ex);draw();}
  return;
 }
 if(button.hasAttribute('data-request-approval')){
  if(!lastCheck||!lastEval)throw new Error('Evaluate a purchase first.');
  try{await request(path('/spending/approvals'),true,{method:'POST',body:{
   ...lastCheck,guardrailId:button.dataset.requestApproval}});
   notice='Request submitted. A different owner/admin must decide before eligible manual posting.';await refresh();}
  catch(ex){error=String(ex.message||ex);draw();}
  return;
 }
 if(button.hasAttribute('data-approval-decision')){
  if(!confirm('Submit an independent '+button.dataset.decision+' decision? It cannot be edited.'))return;
  try{await request(path('/spending/approvals/'+encodeURIComponent(button.dataset.approvalDecision)+'/decision'),
    true,{method:'POST',body:{decision:button.dataset.decision}});
   notice='Approval decision recorded in the workspace audit trail.';await refresh();}
  catch(ex){error=String(ex.message||ex);draw();}
  return;
 }
 if(button.hasAttribute('data-reverse')){
  if(!confirm('Post a compensating journal entry? The original entry remains immutable.'))return;
  try{await request(path('/transactions/'+encodeURIComponent(button.dataset.reverse)+'/reverse'),true,{method:'POST'});
   notice='New reversal journal posted. Original record is unchanged.';await refresh();}
  catch(ex){error=String(ex.message||ex);draw();}
 }
});
document.addEventListener('submit',event=>{
 const form=event.target.closest('form[data-form]');if(!form)return;
 event.preventDefault();void submit(form);
});
document.addEventListener('change',event=>{
 const t=event.target;
 if(t.matches('[data-workspace]')){workspaceId=t.value;b4LoadedFor='';b4={summary:null,buckets:[],goals:[],allocations:[],requests:[],scenarios:[],scenario:null,affordability:null};lastEval=null;lastCheck=null;b3LoadedFor='';billHistory=null;data={accounts:[],categories:[],transactions:[],journals:[],reconciliation:[],summary:null,budgets:[],insights:null,guardrails:[],approvals:[],incomeSources:[],incomeOverview:null,incomeForecast:null,bills:[],billOverview:null,billCalendar:[],cashflow:null,history:null,shortfalls:null};void refresh();}
 if(t.name==='b4SelectedGoal'){selectedGoal=t.value;draw();}
 if(t.name==='selectedAccount'){selectedAccount=t.value;draw();}
 if(t.name==='selectedTransaction'){selectedTransaction=t.value;draw();}
 if(t.name==='selectedBill'){selectedBill=t.value;billHistory=null;draw();void loadSelectedBill();}
});
window.addEventListener('hashchange',()=>{
 // Invalidate cached planning data whenever the user leaves B3, as B1/B2 postings
 // and reversals can change authoritative cash flow without a B3 mutation.
 const active=screen()>=27&&screen()<=34;
 if(!active)b3LoadedFor='';
 draw();
 if(token&&workspaceId&&active&&b3LoadedFor!==workspaceId&&!busy)void refresh();
 else if(token&&workspaceId&&active&&screen()===31&&selectedBill&&billHistory?.bill?.id!==selectedBill&&!busy)
  void loadSelectedBill();
});
window.addEventListener('hashchange',()=>{
 const active=screen()>=35&&screen()<=42;
 if(!active)b4LoadedFor='';
 if(token&&workspaceId&&active&&b4LoadedFor!==workspaceId&&!busy){
  b4={...b4,summary:null,buckets:[],goals:[],allocations:[],requests:[],scenarios:[]};
  void refresh();
 }
});
(async()=>{await initConfig();if(apiBase)try{await finishOidc();}catch(ex){error=String(ex.message||ex);}draw();})();
})();
