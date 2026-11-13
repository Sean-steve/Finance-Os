import {useState} from 'react';
import type {ReactNode} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {CheckCircle2,ShieldAlert} from 'lucide-react';
import {useSession} from './session';
import {Drawer,Busy,Failure,Empty,Notice,Segments} from './components';
import {useRead,useItems,refreshFinancialData,formatMoney,parseMinor,today,dateText,describeError} from './finance';
import type {Account,Transaction,Budget,Bill,Category} from './finance';

type Section='activity'|'spending'|'cash-flow'|'goals'|'wealth'|'settings';
type Item={id:string;name?:string;status?:string;amountMinor?:number;requestedBy?:string;active?:boolean;enabled?:boolean;kind?:string;[key:string]:unknown};
type ImportItem=Item&{description:string;date:string;financialAccountId:string;amountMinor:number;currency:string;disposition:string};
type Source=Item&{enabled:boolean;expectedMinor:number};
type BillEvent={billId:string;billName:string;date:string;amountMinor:number;status:string;settlementId:string|null};
type Valuation=Item&{valueMinor:number;recordedOn:string;note:string};
const sections:Record<Section,string>={activity:'Ledger & reconciliation',spending:'Budgets & controls','cash-flow':'Bills & settlements',goals:'Capital & approvals',wealth:'Valuations & obligations',settings:'Privacy & governance'};
const sectionKeys=Object.keys(sections) as Section[];
const future=()=>{const d=new Date();d.setUTCDate(d.getUTCDate()+90);return d.toISOString().slice(0,10);};
const input=(key:string,label:string,type='text',value?:string)=><label className="form-field" key={key}><span>{label}</span><input name={key} type={type} defaultValue={value} required/></label>;
const num=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)?formatMoney(v):'Not available';
const accountLabel=(id:string,items:Account[])=>items.find(a=>a.id===id)?.displayName||'Unlisted account';
const txLabel=(t:Transaction,accounts:Account[])=>t.description+' · '+formatMoney(t.amountMinor)+' · '+accountLabel(t.financialAccountId,accounts);
const toValue=(obj:FormData,key:string)=>String(obj.get(key)||'').trim();
function Select({label,value,onChange,items,empty='Select a record'}:{label:string;value:string;onChange:(value:string)=>void;items:{value:string;label:string}[];empty?:string}){
 return <label className="form-field"><span>{label}</span><select aria-label={label} value={value} onChange={e=>onChange(e.target.value)}><option value="">{empty}</option>{items.map(x=><option key={x.value} value={x.value}>{x.label}</option>)}</select></label>;
}
function ReadPanel({title,children}:{title:string;children:ReactNode}){return <section className="ux21-panel"><h3>{title}</h3>{children}</section>;}
function Records({items,source='Manual workspace records'}:{items:Item[];source?:string}){return <div className="ux21-records">{items.length?items.slice(0,80).map((i,index)=><div className="ux21-item" key={String(i.id||i.providerKind||index)}><div><b>{String(i.name||i.description||i.reference||i.label||i.capability||i.providerKind||i.id?.slice(0,8)||'Record')}</b><small>{String(i.status||i.connectionStatus||i.kind||i.disposition||source)}</small></div>{typeof i.amountMinor==='number'&&<strong>{num(i.amountMinor)}</strong>}</div>):<Empty title="No records in this workspace"/>}{items.length>=80&&<Notice warning>Only the first 80 entries are shown. Inspect backend exports for full history.</Notice>}</div>;}
function KnownError({q}:{q:{isPending:boolean;error:unknown;refetch:()=>unknown}}){if(q.isPending)return <Busy/>;if(q.error)return <Failure error={q.error} retry={()=>void q.refetch()}/>;return null;}
function Evidence({result}:{result:unknown}){return <div className="ux21-evidence"><CheckCircle2 size={18}/><div><b>Server response received</b><pre>{JSON.stringify(result,null,2).slice(0,3000)}</pre></div></div>;}
export function WorkflowHub({initialSection,onClose}:{initialSection:string;onClose:()=>void}){
 const {role,workspaceId,api}=useSession(),queryClient=useQueryClient();
 const sectionInitial=sectionKeys.includes(initialSection as Section)?initialSection as Section:'activity';
 const [section,setSection]=useState<Section>(sectionInitial),[operationChoice,setOperation]=useState(''),[ack,setAck]=useState(false);
 const defaults:Record<Section,string>={activity:'reversals',spending:'budgets','cash-flow':'calendar',goals:'funding',wealth:'value-assets',settings:'preferences'};
 const operation=operationChoice||defaults[section];
 const [chosen,setChosen]=useState(''),[secondary,setSecondary]=useState(''),[tertiary,setTertiary]=useState('');
 const [result,setResult]=useState<unknown>(null),[error,setError]=useState(''),[pending,setPending]=useState(false);
 const [purchaseResult,setPurchaseResult]=useState<unknown>(null);
 const viewer=role==='VIEWER',owner=role==='OWNER';
 const show=(s:Section)=>{setSection(s);reset('');};
 const reset=(op:string)=>{setOperation(op);setAck(false);setChosen('');setSecondary('');setTertiary('');setResult(null);setError('');setPurchaseResult(null);};
 const accounts=useItems<Account>('/accounts',section==='activity'||section==='cash-flow'||section==='wealth');
 const transactions=useItems<Transaction>('/transactions',section==='activity'||section==='cash-flow'||section==='wealth');
 const imports=useItems<ImportItem>('/reconciliation',section==='activity');
 const journals=useItems<Item>('/ledger/journal-entries',section==='activity');
 const budgets=useItems<Budget>('/budgets',section==='spending');
 const guardrails=useItems<Item>('/spending/guardrails',section==='spending');
 const approvals=useItems<Item>('/spending/approvals',section==='spending');
 const categories=useItems<Category>('/categories',section==='spending');
 const bills=useItems<Bill>('/bills',section==='cash-flow');
 const billEvents=useRead<{events:BillEvent[];isProviderVerified:boolean}>('/bills/calendar?from='+today()+'&to='+future(),section==='cash-flow');
 const sources=useItems<Source>('/income/sources',section==='cash-flow');
 const goals=useItems<Item>('/savings-goals',section==='goals');
 const buckets=useItems<Item>('/money-buckets',section==='goals');
 const allocations=useItems<Item>('/capital/allocations',section==='goals');
 const capitalRequests=useItems<Item>('/capital/requests',section==='goals');
 const scenarios=useItems<Item>('/planning/scenarios',section==='goals');
 const asset=useItems<Item>('/wealth/assets',section==='wealth');
 const investment=useItems<Item>('/wealth/investments',section==='wealth');
 const liability=useItems<Item>('/wealth/liabilities',section==='wealth');
 const debts=useItems<Item>('/debts',section==='wealth');
 const tax=useItems<Item>('/tax/obligations',section==='wealth');
 const estate=useItems<Item>('/estate/checklists',section==='wealth'&&owner);
 const setting=useRead<{advisorEnabled:boolean;monthlyReviewDay:number;periodMonths:number;configurationSource:string}>('/settings',section==='settings'&&owner);
 const privacy=useRead<{unresolvedRequests:number;bankSyncActive:boolean;erasureAutomatic:boolean;exportAutomatic:boolean}>('/privacy/status',section==='settings'&&owner);
 const catalog=useItems<Item>('/integrations/catalog',section==='settings');
 const audit=useItems<Item>('/security/audit',section==='settings'&&owner);
 const valuations=useItems<Valuation>(
  '/wealth/'+operation.replace('value-','')+'/'+encodeURIComponent(chosen)+'/valuations',
  section==='wealth'&&Boolean(chosen)&&['value-assets','value-investments','value-liabilities'].includes(operation)
 );
 const billDetail=useRead<Record<string,unknown>>('/bills/'+encodeURIComponent(chosen),section==='cash-flow'&&operation==='bill-detail'&&Boolean(chosen));
 const settlements=useItems<Item>('/bills/'+encodeURIComponent(chosen)+'/settlements',section==='cash-flow'&&operation==='bill-detail'&&Boolean(chosen));
 const scenarioDetail=useRead<Record<string,unknown>>('/planning/scenarios/'+encodeURIComponent(chosen),section==='goals'&&operation==='scenario'&&Boolean(chosen));
 const selectedBill=bills.items.find(b=>b.id===chosen);
 const eligibleExpenses=transactions.items.filter(t=>t.kind==='EXPENSE'&&!transactions.items.some(r=>r.reversesTransactionId===t.id));
 const isSelectedSame=(t:Transaction,amount:number)=>t.currency==='KES'&&Math.abs(t.amountMinor)===amount;
 async function execute(path:string,body:unknown={},readonly=false){
  if(viewer&&!readonly){setError('This workspace role cannot modify financial records.');return;}
  if(!readonly&&!ack){setError('Read and acknowledge the effect of this action first.');return;}
  if(!api||!workspaceId){setError('Select a signed-in workspace.');return;}
  setPending(true);setError('');setResult(null);
  try{
   const response=await api.workspacePost<unknown>(workspaceId,path,body);
   await refreshFinancialData(queryClient,workspaceId,path);
   setAck(false);
   setResult(response);
  }catch(ex){setError(describeError(ex));}finally{setPending(false);}
 }
 function Action({title,path,body={},danger=false,owner:requiredOwner=false,disabled=false,hint}:{title:string;path:string;body?:unknown;danger?:boolean;owner?:boolean;disabled?:boolean;hint?:string}){
   return <div className="ux21-action">{hint&&<p className="tiny muted">{hint}</p>}
    <label className="ux21-ack"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/><span>{danger?'I understand this changes the authoritative manual record or audit evidence and cannot be undone by closing the browser.':'I understand the stated scope and that this is not a bank or provider payment.'}</span></label>
    <button className={'btn '+(danger?'btn-danger':'btn-primary')} disabled={pending||viewer||(requiredOwner&&!owner)||disabled||!ack} onClick={()=>void execute(path,body)}>{pending?'Submitting…':title}</button>
    {requiredOwner&&!owner&&<Notice warning>Only the workspace owner may perform this action.</Notice>}
   </div>;
 }
 function Buttons({items}:{items:{id:string;label:string}[]}){return <Segments items={items} selected={operation} onChange={reset}/>;}
 function Inner(){
  if(section==='activity')return <><Buttons items={[{id:'reversals',label:'Reversals'},{id:'imports',label:'Reconcile'},{id:'journal',label:'Journal'}]}/>
   {operation==='reversals'?<ReadPanel title="Reverse a posted manual transaction"><p className="tiny muted">Creates a compensating journal entry. Never deletes the original transaction or moves funds at a bank.</p><Select label="Original posted transaction" value={chosen} onChange={setChosen} items={transactions.items.filter(t=>t.kind!=='REVERSAL'&&!transactions.items.some(r=>r.reversesTransactionId===t.id)).map(t=>({value:t.id,label:txLabel(t,accounts.items)}))}/>
    {chosen&&<Action title="Post compensating reversal" path={'/transactions/'+encodeURIComponent(chosen)+'/reverse'} danger/>}</ReadPanel>:
    operation==='imports'?<><ReadPanel title="Unverified statement evidence"><KnownError q={imports}/>{imports.items.slice(0,20).map(i=><div key={i.id} className="ux21-item"><div><b>{i.description}</b><small>{dateText(i.date)} · {i.disposition} · {accountLabel(i.financialAccountId,accounts.items)}</small></div><strong>{num(i.amountMinor)}</strong></div>)}</ReadPanel>
    <ReadPanel title="Match to an existing manual entry"><Select label="Unmatched statement row" value={chosen} onChange={v=>{setChosen(v);setSecondary('');}} items={imports.items.filter(i=>i.disposition==='PENDING').map(i=>({value:i.id,label:i.description+' · '+num(i.amountMinor)}))}/>
    <Select label="Same-account / amount manual transaction" value={secondary} onChange={setSecondary} items={transactions.items.filter(t=>{const i=imports.items.find(i=>i.id===chosen);return i&&t.financialAccountId===i.financialAccountId&&t.amountMinor===i.amountMinor&&t.currency===i.currency&&t.kind!=='REVERSAL';}).map(t=>({value:t.id,label:txLabel(t,accounts.items)}))}/>
    {chosen&&secondary&&<Action title="Record evidence match" path="/reconciliation/matches" body={{importRowId:chosen,manualTransactionId:secondary}} danger hint="Reconciliation is a source match, not a new payment or posting."/>}</ReadPanel></>:
    <ReadPanel title="Posted journal entries"><KnownError q={journals}/>{journals.items.map(i=><div className="ux21-item" key={i.id}><div><b>{String(i.memo||i.id.slice(0,8))}</b><small>{dateText(String(i.effectiveOn||''))} · POSTED</small></div><strong>{num(i.totalDebitMinor)} / {num(i.totalCreditMinor)}</strong></div>)}<Notice>Debits and credits should match; the independent owner B8 check evaluates the workspace's ledger integrity.</Notice></ReadPanel>}
   </>;
  if(section==='spending')return <><Buttons items={[{id:'budgets',label:'Budget lifecycle'},{id:'new-rule',label:'New policy'},{id:'rules',label:'Guardrails'},{id:'request',label:'Request approval'},{id:'approvals',label:'Decisions'},{id:'purchase',label:'Purchase check'}]}/>
   {operation==='budgets'?<ReadPanel title="Activate or archive a budget"><KnownError q={budgets}/><Select label="Budget" value={chosen} onChange={setChosen} items={budgets.items.filter(b=>['DRAFT','ACTIVE'].includes(b.status)).map(b=>({value:b.id,label:b.name+' · '+b.status}))}/>{chosen&&<Action title={budgets.items.find(x=>x.id===chosen)?.status==='DRAFT'?'Activate draft budget':'Archive active budget'} path={'/budgets/'+encodeURIComponent(chosen)+'/'+(budgets.items.find(x=>x.id===chosen)?.status==='DRAFT'?'activate':'archive')} danger hint="Budget updates affect planning guardrails, not external accounts."/>}</ReadPanel>:
    operation==='new-rule'?<ReadPanel title="Add an internal spending rule"><form onSubmit={ev=>{ev.preventDefault();const f=new FormData(ev.currentTarget);void (async()=>{try{await execute('/spending/guardrails',{name:toValue(f,'name'),kind:'AMOUNT',action:toValue(f,'action'),minAmountMinor:parseMinor(toValue(f,'amount'))});}catch(ex){setError(describeError(ex));}})();}}>
    {input('name','Rule name','text','Review significant manual expenses')}{input('amount','Minimum trigger · KES','number','1000')}
    <label className="form-field"><span>Internal manual-posting policy</span><select name="action"><option value="WARN">Warn</option><option value="REQUIRE_APPROVAL">Require independent approval</option><option value="BLOCK">Block within Finance OS</option></select></label>
    <label className="ux21-ack"><input type="checkbox" checked={ack} onChange={ev=>setAck(ev.target.checked)}/> I understand these policies apply only to Finance OS manual transaction posting, not a bank or payment provider.</label>
    <button className="btn btn-primary" disabled={!ack||pending||viewer}>Create spending rule</button></form></ReadPanel>:
    operation==='request'?<ReadPanel title="Request independent internal approval"><form onSubmit={ev=>{ev.preventDefault();const f=new FormData(ev.currentTarget);void (async()=>{try{if(!chosen||!secondary)throw Error('Select a matching guardrail and expense category');await execute('/spending/approvals',{guardrailId:chosen,categoryId:secondary,amountMinor:parseMinor(toValue(f,'amount')),reference:toValue(f,'reference'),currency:'KES'});}catch(ex){setError(describeError(ex));}})();}}>
    <Select label="Active approval guardrail" value={chosen} onChange={setChosen} items={guardrails.items.filter(x=>x.active!==false&&x.action==='REQUIRE_APPROVAL').map(x=>({value:x.id,label:String(x.name||x.id)}))}/>
    <Select label="Expense category" value={secondary} onChange={setSecondary} items={categories.items.filter(x=>x.kind==='EXPENSE').map(x=>({value:x.id,label:x.name}))}/>
    {input('amount','Amount to request · KES','number','2000')}{input('reference','Justification','text','Request approval before manual posting')}
    <label className="ux21-ack"><input type="checkbox" checked={ack} onChange={ev=>setAck(ev.target.checked)}/> I understand that an independent owner/admin must approve the request. Self-approval is forbidden and this is not a bank payment.</label>
    <button className="btn btn-primary" disabled={!ack||!chosen||!secondary||pending||viewer}>Submit approval request</button></form></ReadPanel>:
    operation==='rules'?<ReadPanel title="Review active guardrails"><KnownError q={guardrails}/><Select label="Active rule" value={chosen} onChange={setChosen} items={guardrails.items.filter(x=>x.active!==false).map(x=>({value:x.id,label:String(x.name||x.kind||x.id)}))}/>{chosen&&<Action title="Deactivate rule" path={'/spending/guardrails/'+encodeURIComponent(chosen)+'/deactivate'} danger hint="This changes controls on future manual Finance OS transactions."/>}</ReadPanel>:
    operation==='approvals'?<ReadPanel title="Independent approval decisions"><KnownError q={approvals}/><Select label="Pending request" value={chosen} onChange={setChosen} items={approvals.items.filter(i=>i.status==='PENDING').map(i=>({value:i.id,label:String(i.reference||i.id)+' · '+num(i.amountMinor)}))}/>
     <Select label="Decision" value={secondary} onChange={setSecondary} items={[{value:'APPROVED',label:'Approve internal request'},{value:'REJECTED',label:'Reject internal request'}]}/>
     {chosen&&secondary&&<Action title="Record independent decision" path={'/spending/approvals/'+encodeURIComponent(chosen)+'/decision'} body={{decision:secondary}} owner danger hint="The API rejects self-approval. This is not an external purchase authorization."/>}</ReadPanel>:
    <ReadPanel title="Advisory spending check"><form onSubmit={e=>{e.preventDefault();const f=new FormData(e.currentTarget);const id=toValue(f,'categoryId');if(!id){setError('Select an expense category.');return;}void (async()=>{try{setPending(true);setError('');if(!api||!workspaceId)throw Error('No workspace');const out=await api.workspacePost<unknown>(workspaceId,'/spending/purchase-checks',{amountMinor:parseMinor(toValue(f,'amount')),currency:'KES',categoryId:id,reference:toValue(f,'reference')});setPurchaseResult(out);}catch(ex){setError(describeError(ex));}finally{setPending(false);}})();}}>
     {input('reference','Purpose for the proposed expense','text','Proposed purchase')}<label className="form-field"><span>Expense category</span><select name="categoryId" required><option value="">Choose category</option>{categories.items.filter(c=>c.kind==='EXPENSE').map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></label>{input('amount','Proposed amount · KES','number','1000')}<button className="btn btn-outline" disabled={pending}>Evaluate manual controls</button></form>{purchaseResult!==null&&<Evidence result={purchaseResult}/>}<Notice warning>Advisory only. Never authorizes purchases or proves safe-to-spend money.</Notice></ReadPanel>}
  </>;
  if(section==='cash-flow')return <><Buttons items={[{id:'calendar',label:'Calendar'},{id:'bill-detail',label:'Bill history'},{id:'settle',label:'Link payment evidence'},{id:'cancel',label:'Cancel bill'},{id:'source',label:'Income source'}]}/>
   {operation==='calendar'?<ReadPanel title="Upcoming scheduled occurrences"><KnownError q={billEvents}/>{(billEvents.data?.events||[]).slice(0,80).map((x,i)=><div className="ux21-item" key={x.billId+x.date+i}><div><b>{x.billName}</b><small>{dateText(x.date)} · {x.status}</small></div><strong>{num(x.amountMinor)}</strong></div>)}<Notice>Due dates are user-reported; settlement statuses are linked manual evidence, not provider confirmation.</Notice></ReadPanel>:
    operation==='bill-detail'?<ReadPanel title="Bill schedule and recorded settlement evidence"><Select label="Select scheduled bill" value={chosen} onChange={setChosen} items={bills.items.map(x=>({value:x.id,label:x.name+' · '+String(x.status)}))}/>
    {chosen&&<><KnownError q={billDetail}/>{billDetail.data&&<div className="ux21-item"><div><b>{String(billDetail.data.name||'Bill')}</b><small>Recorded obligation details · status {String(billDetail.data.status||'unknown')}</small></div><strong>{num(billDetail.data.amountMinor)}</strong></div>}
    <KnownError q={settlements}/><Records items={settlements.items}/></>}
    <Notice>Settlement records are manual expense evidence only; external providers are never contacted.</Notice></ReadPanel>:
    operation==='settle'?<ReadPanel title="Link a posted expense to a scheduled bill occurrence"><Select label="Bill" value={chosen} onChange={v=>{setChosen(v);setSecondary('');setTertiary('');}} items={bills.items.filter(x=>x.status==='ACTIVE').map(x=>({value:x.id,label:x.name+' · '+num(x.amountMinor)}))}/>
    <Select label="Scheduled occurrence" value={secondary} onChange={v=>{setSecondary(v);setTertiary('');}} items={(billEvents.data?.events||[]).filter(x=>x.billId===chosen&&x.status!=='RECORDED_UNVERIFIED').map(x=>({value:x.date,label:dateText(x.date)+' · '+x.status}))}/>
    <Select label="Matching posted manual expense" value={tertiary} onChange={setTertiary} items={eligibleExpenses.filter(t=>selectedBill&&isSelectedSame(t,selectedBill.amountMinor)).map(t=>({value:t.id,label:txLabel(t,accounts.items)}))}/>
    {chosen&&secondary&&tertiary&&<Action title="Link manual settlement evidence" path={'/bills/'+encodeURIComponent(chosen)+'/settlements'} body={{dueOn:secondary,manualTransactionId:tertiary}} danger hint="A bill is only marked recorded after valid expense evidence; no new payment is initiated."/>}</ReadPanel>:
    operation==='cancel'?<ReadPanel title="Cancel future bill occurrences"><Select label="Active bill" value={chosen} onChange={setChosen} items={bills.items.filter(x=>x.status==='ACTIVE').map(x=>({value:x.id,label:x.name+' · '+num(x.amountMinor)}))}/>{chosen&&<Action title="Cancel bill schedule" path={'/bills/'+encodeURIComponent(chosen)+'/cancel'} danger/>}</ReadPanel>:
    <ReadPanel title="Disable an expected income source"><Select label="Enabled expected income source" value={chosen} onChange={setChosen} items={sources.items.filter(x=>x.enabled).map(x=>({value:x.id,label:String(x.name||x.id)+' · '+num(x.expectedMinor)}))}/>{chosen&&<Action title="Disable future estimates" path={'/income/sources/'+encodeURIComponent(chosen)+'/disable'} danger hint="Disables forecasted receipts; does not affect posted income or bank connections."/>}</ReadPanel>}
  </>;
  if(section==='goals')return <><Buttons items={[{id:'funding',label:'Funding requests'},{id:'decide',label:'Independent decisions'},{id:'allocations',label:'Allocations'},{id:'affordability',label:'Affordability'},{id:'scenario',label:'Scenarios'}]}/>
    {operation==='funding'?<ReadPanel title="Request virtual funding allocation"><form onSubmit={ev=>{ev.preventDefault();const f=new FormData(ev.currentTarget);void execute('/capital/requests',{targetKind:secondary,targetId:chosen,amountMinor:parseMinor(toValue(f,'amount')),rationale:toValue(f,'rationale'),currency:'KES'});}}>
    <Select label="Planning target kind" value={secondary} onChange={v=>{setSecondary(v);setChosen('');}} items={[{value:'GOAL',label:'Savings goal'},{value:'BUCKET',label:'Money bucket'}]}/>
    <Select label="Planning target" value={chosen} onChange={setChosen} items={(secondary==='GOAL'?goals.items:secondary==='BUCKET'?buckets.items:[]).map(x=>({value:x.id,label:String(x.name)}))}/>
    {input('amount','Requested virtual allocation · KES','number','1000')}{input('rationale','Reason','text','Monthly savings review')}
    <label className="ux21-ack"><input type="checkbox" checked={ack} onChange={ev=>setAck(ev.target.checked)}/> I understand this is a virtual planning request and does not transfer bank funds.</label>
    <button className="btn btn-primary" disabled={!chosen||!secondary||!ack||pending||viewer}>Request virtual allocation</button></form></ReadPanel>:
    operation==='decide'?<ReadPanel title="Independent request approval"><Select label="Pending funding request" value={chosen} onChange={setChosen} items={capitalRequests.items.filter(x=>x.status==='PENDING').map(x=>({value:x.id,label:x.targetKind+' · '+num(x.amountMinor)}))}/><Select label="Decision" value={secondary} onChange={setSecondary} items={[{value:'APPROVED',label:'Approve'},{value:'REJECTED',label:'Reject'}]}/>{chosen&&secondary&&<Action title="Save independent decision" path={'/capital/requests/'+encodeURIComponent(chosen)+'/decision'} body={{decision:secondary}} danger owner hint="The server forbids self-approval even for owners; no money is moved."/>}</ReadPanel>:
    operation==='allocations'?<ReadPanel title="Recorded virtual allocations"><Records items={allocations.items}/><Notice>No custodial funds are held, transferred or reserved outside the app.</Notice></ReadPanel>:
    operation==='affordability'?<ReadPanel title="Indicative affordability check"><form onSubmit={ev=>{ev.preventDefault();const f=new FormData(ev.currentTarget);setPending(true);setError('');void (async()=>{try{if(!api||!workspaceId)throw Error('No workspace');const out=await api.workspacePost(workspaceId,'/capital/affordability',{purchaseAmountMinor:parseMinor(toValue(f,'amount')),monthlyPaymentMinor:toValue(f,'monthly')===''||toValue(f,'monthly')==='0'?0:parseMinor(toValue(f,'monthly'))});setPurchaseResult(out);}catch(ex){setError(describeError(ex));}finally{setPending(false);}})();}}>
     {input('amount','Indicative purchase price · KES','number','5000')}{input('monthly','Proposed monthly installment · KES','number','0')}<button className="btn btn-outline" disabled={pending}>Run affordability illustration</button></form>{purchaseResult!==null&&<Evidence result={purchaseResult}/>}<Notice warning>Always returns CANNOT_CONFIRM_AFFORDABILITY. This does not authorize a purchase or verify cash availability.</Notice></ReadPanel>:
    <ReadPanel title="Saved what-if scenarios"><Records items={scenarios.items}/><Select label="Scenario to inspect" value={chosen} onChange={setChosen} items={scenarios.items.map(x=>({value:x.id,label:String(x.name||x.id)}))}/>
    {chosen&&<><KnownError q={scenarioDetail}/>{scenarioDetail.data&&<Evidence result={scenarioDetail.data}/>}</>}
    <Notice>Scenarios are replayable deterministic illustrations. Model assumptions, not actual future balances, investment forecasts or advice.</Notice></ReadPanel>}
  </>;
  if(section==='wealth')return <><Buttons items={[{id:'value-assets',label:'Asset valuations'},{id:'value-investments',label:'Investment valuations'},{id:'value-liabilities',label:'Liability valuations'},{id:'debt-payment',label:'Debt evidence'},{id:'tax-payment',label:'Tax evidence'},{id:'estate',label:'Estate checklist'}]}/>
    {operation.startsWith('value-')?<ReadPanel title="Append a manual valuation"><p className="tiny muted">The valuation history is append-only. Previous estimates remain available; no live price feeds are used.</p>
    <Select label="Valuation target" value={chosen} onChange={setChosen} items={(operation==='value-assets'?asset.items:operation==='value-investments'?investment.items:liability.items).map(x=>({value:x.id,label:String(x.name||x.id)+' · '+num(x.estimatedValueMinor)}))}/>
    {chosen&&<><KnownError q={valuations}/><Records items={valuations.items}/><form onSubmit={ev=>{ev.preventDefault();const f=new FormData(ev.currentTarget);void execute('/wealth/'+operation.replace('value-','')+'/'+encodeURIComponent(chosen)+'/valuations',{valueMinor:toValue(f,'value')==='0'?0:parseMinor(toValue(f,'value')),currency:'KES',note:toValue(f,'note'),recordedOn:toValue(f,'recordedOn')});}}>
     {input('value','New estimate · KES','number','0')}{input('note','Valuation evidence / basis','text','Revised owner estimate')}{input('recordedOn','Recorded on','date',today())}
     <label className="ux21-ack"><input type="checkbox" checked={ack} onChange={ev=>setAck(ev.target.checked)}/> I understand this creates a manual estimate, not an independent valuation.</label>
     <button disabled={!ack||pending||viewer} className="btn btn-primary">Add valuation record</button></form></>}</ReadPanel>:
    operation==='debt-payment'||operation==='tax-payment'?<ReadPanel title="Link existing posted expense evidence"><p className="tiny muted">Linking a posted manual expense reduces the reported obligation. It never sends a payment to a lender or KRA.</p>
    <Select label={operation==='debt-payment'?'Debt':'Tax obligation'} value={chosen} onChange={v=>{setChosen(v);setSecondary('');}} items={(operation==='debt-payment'?debts.items:tax.items).map(x=>({value:x.id,label:String(x.name||x.label||x.id)+' · '+num(x.estimatedOutstandingMinor??x.estimatedRemainingMinor)}))}/>
    <Select label="Posted expense to link" value={secondary} onChange={setSecondary} items={eligibleExpenses.filter(t=>{const v=(operation==='debt-payment'?debts.items:tax.items).find(x=>x.id===chosen);const outstanding=Number(v?.estimatedOutstandingMinor??v?.estimatedRemainingMinor??0);return outstanding>0&&Math.abs(t.amountMinor)<=outstanding&&t.currency==='KES';}).map(t=>({value:t.id,label:txLabel(t,accounts.items)}))}/>
    {chosen&&secondary&&<Action title="Link posted expense as evidence" path={operation==='debt-payment'?'/debts/'+encodeURIComponent(chosen)+'/payments':'/tax/obligations/'+encodeURIComponent(chosen)+'/payments'} body={{manualTransactionId:secondary,amountMinor:Math.abs(transactions.items.find(t=>t.id===secondary)?.amountMinor||0)}} danger/>}</ReadPanel>:
    <ReadPanel title="Owner-only estate review checklist">{!owner?<Notice warning>Only the workspace owner can access sensitive estate information.</Notice>:<><KnownError q={estate}/>{estate.items.slice(0,2).map(x=><div className="ux21-item" key={x.id}><b>Recorded review</b><small>{dateText(String(x.reviewedOn||''))}</small></div>)}
    <form onSubmit={ev=>{ev.preventDefault();const f=new FormData(ev.currentTarget);const bool=(k:string)=>f.get(k)==='on';void execute('/estate/checklists',{willPrepared:bool('willPrepared'),beneficiariesReviewed:bool('beneficiariesReviewed'),executorNominated:bool('executorNominated'),dependantsConsidered:bool('dependantsConsidered'),recordsSecured:bool('recordsSecured'),reviewedOn:today()});}}>
    {['willPrepared','beneficiariesReviewed','executorNominated','dependantsConsidered','recordsSecured'].map(k=><label className="ux21-check" key={k}><input name={k} type="checkbox"/>{k.replace(/([A-Z])/g,' $1')}</label>)}
    <label className="ux21-ack"><input type="checkbox" checked={ack} onChange={ev=>setAck(ev.target.checked)}/> I understand this records only a self-reported checklist, not legal documents.</label><button className="btn btn-primary" disabled={!ack||pending||!owner}>Record review snapshot</button></form></>}</ReadPanel>}
   </>;
  return <><Buttons items={[{id:'preferences',label:'Owner settings'},{id:'privacy',label:'Privacy status'},{id:'catalog',label:'Integration catalog'},{id:'audit',label:'Security audit'}]}/>
  {operation==='preferences'?<ReadPanel title="Owner-governed financial preferences">{!owner?<Notice warning>Owner permission is required.</Notice>:<><KnownError q={setting}/><form onSubmit={ev=>{ev.preventDefault();const f=new FormData(ev.currentTarget);void execute('/settings',{advisorEnabled:f.get('advisorEnabled')==='on',analyticsSharingEnabled:false,monthlyReviewDay:Number(toValue(f,'monthlyReviewDay')),periodMonths:Number(toValue(f,'periodMonths'))});}}>
    <label className="ux21-check"><input name="advisorEnabled" type="checkbox" defaultChecked={setting.data?.advisorEnabled}/> Enable deterministic advisor rules (no external AI)</label>
    {input('monthlyReviewDay','Monthly review day (1–28)','number',String(setting.data?.monthlyReviewDay??1))}
    {input('periodMonths','Reporting period (1–12 months)','number',String(setting.data?.periodMonths??6))}
    <Notice>External analytics sharing remains disabled, independent of these choices.</Notice>
    <label className="ux21-ack"><input type="checkbox" checked={ack} onChange={ev=>setAck(ev.target.checked)}/> I understand this stores an owner settings snapshot.</label>
    <button className="btn btn-primary" disabled={!ack||pending}>Save owner preferences</button></form></>}</ReadPanel>:
   operation==='privacy'?<ReadPanel title="Privacy and data retention"><KnownError q={privacy}/>{privacy.data&&<><p>Unresolved requests: <b>{privacy.data.unresolvedRequests}</b></p><p>Bank sync: <b>{privacy.data.bankSyncActive?'Active':'Inactive'}</b></p><p>Erasure automatic: <b>No</b></p><p>Export automatic: <b>No</b></p></>}<Notice warning>Requests create an auditable review record; they do not automatically delete personal or financial data.</Notice></ReadPanel>:
   operation==='catalog'?<ReadPanel title="Provider integration catalog"><KnownError q={catalog}/><Records items={catalog.items}/><Notice>No live external banking, broker or M-Pesa integration is active.</Notice></ReadPanel>:
   <ReadPanel title="Workspace audit events"><KnownError q={audit}/><Records items={audit.items}/></ReadPanel>}
  </>;
 }
 const body=<Inner/>;
 return <Drawer title={sections[section]} onClose={onClose}><div className="ux21-body"><p className="tiny muted">Advanced, audited actions are separate from the daily command centre. A posted ledger event cannot be overwritten. All requests target the selected authenticated workspace.</p>
   <label className="form-field"><span>Workflow area</span><select aria-label="Workflow area" value={section} onChange={ev=>show(ev.target.value as Section)}>{sectionKeys.map(s=><option value={s} key={s}>{sections[s]}</option>)}</select></label>
   {body}
   {pending&&<div role="status" className="tiny muted">Waiting for Finance OS API…</div>}
   {error&&<div className="form-error" role="alert">{error}</div>}
   {result!==null&&<Evidence result={result}/>}
   <div className="ux21-legal"><ShieldAlert size={17}/><span>FINANCE OS MANUAL MODE: no provider-verified assets, no banking payments, no automatic tax filing. The server remains authoritative.</span></div>
 </div></Drawer>;
}
