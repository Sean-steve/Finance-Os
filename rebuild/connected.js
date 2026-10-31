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
let data={accounts:[],categories:[],transactions:[],journals:[],reconciliation:[],summary:null};
let selectedAccount='',selectedTransaction='';
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
 }catch(ex){error=String(ex.message||ex);}
}
async function request(path,authenticated=true,options={}){
 if(!apiBase)throw new Error('Finance API is unconfigured.');
 const response=await fetch(apiBase+path,{method:options.method||'GET',cache:'no-store',
  headers:{'Accept':'application/json',...(options.body!==undefined?{'Content-Type':'application/json','Idempotency-Key':random()}:{}),
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
   const routes=['/accounts','/categories','/transactions','/ledger/journal-entries','/reconciliation','/ledger/summary'];
   const result=await Promise.all(routes.map(s=>request(path(s))));
   data={accounts:result[0].items||[],categories:result[1].items||[],transactions:result[2].items||[],
    journals:result[3].items||[],reconciliation:result[4].items||[],summary:result[5]};
   selectedAccount=data.accounts.some(a=>a.id===selectedAccount)?selectedAccount:(data.accounts[0]?.id||'');
   selectedTransaction=data.transactions.some(t=>t.id===selectedTransaction)?selectedTransaction:(data.transactions[0]?.id||'');
  }else data={accounts:[],categories:[],transactions:[],journals:[],reconciliation:[],summary:null};
  error='';
 }catch(ex){error=String(ex.message||ex);}
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
function renderedScreen(){
 const id=screen();
 if(!token)return signIn();
 if(!workspaceId)return workspace();
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
  (busy?'<div role="status">Loading server records…</div>':'')+
  (!apiBase?card('Configuration required','<p>The API endpoint has not been configured for this deployment. No demonstration data is displayed.</p>'):renderedScreen())+
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
    amountMinor:asMinor(d.amount),currency:'KES',description:d.description,effectiveOn:d.effectiveOn}});
  }else if(kind==='import')await request(base+'/statement-imports',true,{method:'POST',
   body:{financialAccountId:d.financialAccountId,rows:[{date:d.date,description:d.description,
     amountMinor:asMinor(d.amount),currency:'KES'}]}});
  else if(kind==='match')await request(base+'/reconciliation/matches',true,{method:'POST',
   body:{importRowId:d.importRowId,manualTransactionId:d.manualTransactionId}});
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
 if(button.hasAttribute('data-oidc-start')){
  try{await startOidc();}catch(ex){error=String(ex.message||ex);draw();}
 }
 if(button.hasAttribute('data-logout')){
  try{if(token&&!provider)await request('/v1/auth/logout',true,{method:'POST'});}catch{}
  token='';identity=null;workspaces=[];workspaceId='';data={accounts:[],categories:[],transactions:[],journals:[],reconciliation:[],summary:null};
  notice='Local API session cleared. Identity-provider single sign-on session must be ended at the provider.';
  draw();
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
 if(t.matches('[data-workspace]')){workspaceId=t.value;void refresh();}
 if(t.name==='selectedAccount'){selectedAccount=t.value;draw();}
 if(t.name==='selectedTransaction'){selectedTransaction=t.value;draw();}
});
window.addEventListener('hashchange',draw);
(async()=>{await initConfig();if(apiBase)try{await finishOidc();}catch(ex){error=String(ex.message||ex);}draw();})();
})();
