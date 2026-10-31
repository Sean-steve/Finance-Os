/* Finance OS B1 — opt-in LOCAL backend bridge.
 * Only active for http://localhost:8080/rebuild.html?b1=local or 127.0.0.1;
 * never loads credentials from localStorage, demo state, URL query or third parties.
 * Preserves the approved 60-screen demo unless explicitly opted in.
 */
(()=>{
 'use strict';
 if(new URLSearchParams(location.search).get('b1')!=='local')return;
 if(!['127.0.0.1','localhost'].includes(location.hostname)||location.protocol!=='http:')return;
 const base='http://127.0.0.1:3101';
 let token='',workspaceId='',data={accounts:[],categories:[],transactions:[],reconciliation:[],journals:[]},message='';
 const e=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
 const money=n=>'KES '+(Number(n||0)/100).toLocaleString('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2});
 const el=document.createElement('section');
 el.className='b1-local-panel';el.setAttribute('aria-label','Finance OS local backend connection');
 const activeScreen=()=>Number((location.hash.match(/screen\/(\d+)/)||[])[1]||1);
 const title=()=>({1:'Authentication',7:'Financial Accounts',10:'Transactions',15:'Reconciliation'})[activeScreen()]||'Backend B1';
 const uuid=()=>crypto.randomUUID()+'-'+crypto.randomUUID();
 function label(name,key,type='text',value='',extra=''){
  return '<label class="b1-field">'+e(name)+'<input name="'+e(key)+'" type="'+type+'" value="'+e(value)+'" '+extra+'></label>';
 }
 const signin=()=>'<p class="b1-caution">This operates against your local PostgreSQL backend, NOT the illustrative Finance OS demo. No tokens are persisted in the browser.</p>'+
  '<form data-b1-form="login"><h3>Sign in to local backend</h3>'+label('Email','email','email','','required autocomplete="username"')+
  label('Password','password','password','','required autocomplete="current-password"')+
  '<button type="submit">Sign in</button></form>'+
  '<details><summary>Create local test account</summary><form data-b1-form="register">'+
  label('Name','displayName','text','','required')+label('Email','email','email','','required')+
  label('Password (12+ characters)','password','password','','required minlength="12"')+
  '<button type="submit">Create local account</button></form></details>';
 const accounts=()=>'<form data-b1-form="account"><h3>Add manual account</h3>'+label('Name','displayName','text','','required')+
  '<label class="b1-field">Type<select name="kind"><option>CASH</option><option>BANK</option><option>MOBILE_MONEY</option></select></label><button type="submit">Add account</button></form>'+
  '<h3>Server accounts (not demo)</h3>'+ (data.accounts.length?'<ul>'+data.accounts.map(a=>'<li>'+e(a.displayName)+' — '+money(a.balanceMinor)+'</li>').join('')+'</ul>':'<p>No server accounts recorded.</p>');
 const transactions=()=>'<form data-b1-form="category"><h3>Add category</h3>'+label('Category name','name','text','','required')+
  '<label class="b1-field">Kind<select name="kind"><option>INCOME</option><option>EXPENSE</option></select></label><button type="submit">Add category</button></form>'+
  '<form data-b1-form="transaction"><h3>Record journal-backed entry</h3><label class="b1-field">Manual account<select name="financialAccountId">'+
  data.accounts.map(a=>'<option value="'+e(a.id)+'">'+e(a.displayName)+'</option>').join('')+'</select></label>'+
  '<label class="b1-field">Kind<select name="kind"><option>INCOME</option><option>EXPENSE</option></select></label>'+
  '<label class="b1-field">Category<select name="categoryId">'+data.categories.map(c=>'<option value="'+e(c.id)+'" data-kind="'+e(c.kind)+'">'+e(c.kind+' · '+c.name)+'</option>').join('')+'</select></label>'+
  label('Amount (KES, e.g. 1250.50)','amount','text','','required pattern="[0-9]+(\\.[0-9]{1,2})?"')+
  label('Description','description','text','','required')+
  label('Economic date','effectiveOn','date',new Date().toISOString().slice(0,10),'required')+
  '<button type="submit">Post locally (immutable)</button></form>'+
  '<h3>Posted manual transactions</h3>'+(data.transactions.length?'<ul>'+data.transactions.map(t=>'<li>'+e(t.description)+' · '+money(t.amountMinor)+' ('+e(t.kind)+')</li>').join('')+'</ul>':'<p>No local journal entries.</p>');
 const reconciliation=()=>'<form data-b1-form="import"><h3>Stage a local statement row</h3>'+
  '<label class="b1-field">Account<select name="financialAccountId">'+data.accounts.map(a=>'<option value="'+e(a.id)+'">'+e(a.displayName)+'</option>').join('')+'</select></label>'+
  label('Date','date','date',new Date().toISOString().slice(0,10),'required')+
  label('Description','description','text','','required')+
  label('Signed amount KES','amount','text','','required pattern="-?[0-9]+(\\.[0-9]{1,2})?"')+
  '<button type="submit">Stage unverified row</button></form>'+
  '<h3>Statement reconciliation</h3>'+data.reconciliation.map(row=>'<div class="b1-recon"><b>'+e(row.description)+'</b> '+money(row.amountMinor)+
  '<small>'+e(row.disposition)+'</small>'+(row.disposition==='PENDING'?'<form data-b1-form="match"><input type="hidden" name="importRowId" value="'+e(row.id)+'">'+
  '<select name="manualTransactionId">'+data.transactions.filter(t=>t.financialAccountId===row.financialAccountId&&
    t.amountMinor===row.amountMinor).map(t=>'<option value="'+e(t.id)+'">'+e(t.description)+'</option>').join('')+
  '</select><button type="submit">Match posted entry</button></form>':'')+'</div>').join('')+
  '<p>Matched rows link existing journals; they do not post money twice.</p>';
 const main=()=>'<div class="b1-head"><strong>B1 · Local PostgreSQL</strong><button type="button" data-b1-toggle aria-expanded="true">Hide</button></div>'+
  '<p class="b1-kicker">'+e(title())+' · server-backed test mode</p>'+
  (message?'<p role="status" class="b1-message">'+e(message)+'</p>':'')+
  (token?'<div><button type="button" data-b1-logout>Log out</button>'+
   '<label class="b1-field">Workspace<select data-b1-workspace></select></label>'+
   '<div class="b1-panels">'+(activeScreen()===7?accounts():activeScreen()===10?transactions():activeScreen()===15?reconciliation():
    '<p>Session authenticated. Open Accounts (07), Transactions (10), or Reconciliation (15) from the sidebar.</p>')+'</div></div>':signin());
 function draw(){
  if(el.dataset.hidden==='true'){el.innerHTML='<button type="button" data-b1-toggle aria-expanded="false">Show B1 backend</button>';return;}
  el.innerHTML=main();
  const selector=el.querySelector('[data-b1-workspace]');
  if(selector&&window._b1Workspaces){const rows=window._b1Workspaces;selector.innerHTML=rows.map(w=>'<option value="'+e(w.id)+'" '+(w.id===workspaceId?'selected':'')+'>'+e(w.name)+' · '+e(w.kind)+'</option>').join('');}
 }
 async function api(path,options={}){
  const response=await fetch(base+path,{...options,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{}),
   ...(options.method&&options.method!=='GET'?{'Idempotency-Key':uuid()}:{})}});
  let body={};try{body=await response.json()}catch{}
  if(!response.ok)throw new Error(body.error?.message||'Backend '+response.status);
  return body;
 }
 function amountMinor(text){
  const m=/^(-?)(\d+)(?:\.(\d{1,2}))?$/.exec(String(text).trim());
  if(!m)throw new Error('Enter a valid amount with at most two decimals');
  const cents=Number(m[2])*100+Number((m[3]||'').padEnd(2,'0'));
  if(!Number.isSafeInteger(cents)||cents<=0)throw new Error('Invalid amount');
  return m[1]? -cents:cents;
 }
 async function load(){
  if(!token)return;
  const ws=await api('/v1/workspaces');
  // Workspace names are display-only; selection always checked by the backend.
  window._b1Workspaces=ws.items;workspaceId=ws.items.find(w=>w.id===workspaceId)?.id||ws.items[0]?.id||'';
  if(!workspaceId){draw();return;}
  const prefix='/v1/workspaces/'+encodeURIComponent(workspaceId);
  const [a,c,t,r,j]=await Promise.all([api(prefix+'/accounts'),api(prefix+'/categories'),
   api(prefix+'/transactions'),api(prefix+'/reconciliation'),api(prefix+'/ledger/journal-entries')]);
  data={accounts:a.items,categories:c.items,transactions:t.items,reconciliation:r.items,journals:j.items};
  draw();
 }
 document.addEventListener('submit',async event=>{
  const form=event.target.closest?.('[data-b1-form]');
  if(!form)return;
  event.preventDefault();event.stopImmediatePropagation();
  const kind=form.dataset.b1Form;
  const d=Object.fromEntries(new FormData(form));
  try{
   if(kind==='register'||kind==='login'){
    const response=await api('/v1/auth/'+(kind==='login'?'login':'register'),{method:'POST',
     body:JSON.stringify(kind==='login'?{email:d.email,password:d.password}:
      {email:d.email,password:d.password,displayName:d.displayName})});
    token=response.accessToken;message='Local session established.';await load();return;
   }
   if(!workspaceId)throw new Error('Select a workspace');
   const prefix='/v1/workspaces/'+encodeURIComponent(workspaceId);
   let route='',payload={};
   if(kind==='account'){route='/accounts';payload={displayName:d.displayName,kind:d.kind,currency:'KES'};}
   if(kind==='category'){route='/categories';payload={name:d.name,kind:d.kind};}
   if(kind==='transaction'){route='/transactions';payload={financialAccountId:d.financialAccountId,categoryId:d.categoryId,
    kind:d.kind,amountMinor:amountMinor(d.amount),currency:'KES',description:d.description,effectiveOn:d.effectiveOn};}
   if(kind==='import'){route='/statement-imports';payload={financialAccountId:d.financialAccountId,
    rows:[{date:d.date,description:d.description,amountMinor:amountMinor(d.amount),currency:'KES'}]};}
   if(kind==='match'){route='/reconciliation/matches';payload={importRowId:d.importRowId,manualTransactionId:d.manualTransactionId};}
   if(!route)throw new Error('Unknown operation');
   await api(prefix+route,{method:'POST',body:JSON.stringify(payload)});
   message='Saved in local PostgreSQL. No real bank was contacted.';await load();
  }catch(error){message=String(error.message||error);draw();}
 },true);
 document.addEventListener('click',async event=>{
  if(event.target.closest?.('[data-b1-toggle]')){el.dataset.hidden=el.dataset.hidden==='true'?'false':'true';draw();}
  if(event.target.closest?.('[data-b1-logout]')){
   try{await api('/v1/auth/logout',{method:'POST'});}catch{}
   token='';workspaceId='';data={accounts:[],categories:[],transactions:[],reconciliation:[],journals:[]};message='Session cleared from memory.';draw();
  }
 });
 document.addEventListener('change',async event=>{
  if(!event.target.matches?.('[data-b1-workspace]'))return;
  workspaceId=event.target.value;
  try{await load();message='';}catch(error){message=String(error.message||error);draw();}
 });
 window.addEventListener('hashchange',()=>{message='';if(token){load().catch(error=>{message=String(error.message);draw();});}else draw();});
 document.body.appendChild(el);draw();
})();
