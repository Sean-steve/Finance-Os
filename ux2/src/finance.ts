import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import type {QueryClient} from '@tanstack/react-query';
import {useSession} from './session';
import type {Items} from './api';
export type Account={id:string;displayName:string;kind:string;currency:string;balanceMinor:number;balanceQuality:string;providerStatus:string};
export type Category={id:string;name:string;kind:'INCOME'|'EXPENSE'};
export type Transaction={id:string;description:string;kind:'INCOME'|'EXPENSE'|'REVERSAL';amountMinor:number;currency:string;occurredAt:string;financialAccountId:string;categoryId:string;reversesTransactionId?:string|null;status:string;origin?:string};
export type Ledger={totalByCurrency:{currency:string;amountMinor:number;quality:string}[];asOf:string};
export type Bill={id:string;name:string;amountMinor:number;firstDueOn:string;cadence:string;status:string;currency:string};
export type Goal={id:string;name:string;kind:string;targetMinor:number;allocatedMinor?:number;fundedMinor?:number;status:string};
export type Budget={id:string;name:string;amountMinor:number;spentMinor?:number;startsOn:string;endsOn:string;status:string;allocations?:{categoryId:string;limitMinor:number}[]};
export type Source={id:string;name:string;expectedMinor:number;firstExpectedOn:string;cadence:string};
export type Entity={id:string;name?:string;label?:string;status?:string;currency?:string;[key:string]:unknown};
export const formatMoney=(value:unknown,currency='KES')=>{
 const n=Number(value);if(!Number.isSafeInteger(n))return 'Amount unavailable';
 return currency+' '+(n/100).toLocaleString('en-KE',{minimumFractionDigits:2,maximumFractionDigits:2});
};
export function parseMinor(input:string){
 const m=/^(\d{1,11})(?:\.(\d{1,2}))?$/.exec(input.trim());if(!m)throw new Error('Enter an amount with up to 2 decimal places.');
 const n=Number(m[1])*100+Number((m[2]||'').padEnd(2,'0'));
 if(!Number.isSafeInteger(n)||n<=0||n>1_000_000_000_000)throw new Error('Enter a positive amount within the permitted range.');
 return n;
}
export const today=()=>new Date().toISOString().slice(0,10);
export const startOfMonth=()=>today().slice(0,7)+'-01';
export const endOfMonth=()=>new Date(Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth()+1,0)).toISOString().slice(0,10);
export const dateText=(value?:string|null)=>value?new Date(value.slice(0,10)+'T12:00:00Z').toLocaleDateString('en-KE',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}):'Not scheduled';
export function useRead<T>(tail:string,enabled=true){
 const {api,workspaceId,status}=useSession();
 return useQuery<T>({queryKey:['ws',workspaceId,tail],enabled:enabled&&Boolean(api&&workspaceId&&status==='signed-in'),
 queryFn:()=>api!.workspace<T>(workspaceId,tail)});
}
export function useItems<T>(tail:string,enabled=true){
 const q=useRead<Items<T>>(tail,enabled);
 return {...q,items:q.data?.items??[]};
}
// Avoid redundant concurrent refetches of EVERY active finance panel after each write.
// Mark all workspace cache entries stale, then refresh only the affected active views.
// Inactive modules refetch as soon as they are opened, with their normal tenant-specific keys.
export async function refreshFinancialData(qc:QueryClient,workspaceId:string,path:string){
 if(!workspaceId)return;
 const core=['/accounts','/transactions','/ledger/summary','/reports/monthly?months=6','/reports/categories?months=6'];
 const groups:Record<string,string[]>={
  '/accounts':['/accounts','/ledger/summary','/wealth/summary'],
  '/categories':['/categories','/reports/categories?months=6'],
  '/transactions':[...core,'/spending/insights?months=6','/budgets','/financial-health','/advisor','/wealth/summary','/bills'],
  '/budgets':['/budgets','/spending/insights?months=6'],
  '/spending/guardrails':['/spending/guardrails','/spending/approvals'],
  '/spending/approvals':['/spending/approvals'],
  '/income/sources':['/income/sources','/income/overview','/income/forecast','/cash-flow/forecast?days=90','/cash-flow/shortfalls?days=90'],
  '/bills':['/bills','/cash-flow/forecast?days=90','/cash-flow/shortfalls?days=90'],
  '/savings-goals':['/savings-goals','/capital/summary'],
  '/money-buckets':['/money-buckets','/capital/summary'],
  '/capital/allocations':['/capital/allocations','/savings-goals','/money-buckets','/capital/summary'],
  '/capital/requests':['/capital/requests'],
  '/planning/scenarios':['/planning/scenarios'],
  '/debts':['/debts','/wealth/summary','/financial-health'],
  '/wealth/assets':['/wealth/assets','/wealth/summary','/wealth/analytics'],
  '/wealth/investments':['/wealth/investments','/wealth/summary','/wealth/analytics'],
  '/wealth/liabilities':['/wealth/liabilities','/wealth/summary','/wealth/analytics'],
  '/tax/obligations':['/tax/obligations'],
  '/insurance/policies':['/insurance/policies'],
  '/retirement/scenarios':['/retirement/scenarios'],
  '/estate/checklists':['/estate/checklists'],
  '/settings':['/settings','/advisor','/privacy/status'],
  '/privacy/requests':['/privacy/requests','/privacy/status'],
  '/integrations/requests':['/integrations/requests'],
  '/statement-imports':['/reconciliation'],
  '/reconciliation/matches':['/reconciliation']
 };
 const key=Object.keys(groups).filter(prefix=>path===prefix||path.startsWith(prefix+'/')).sort((a,b)=>b.length-a.length)[0];
 const affected=new Set(groups[key||'']||[]);
 if(path.includes('/reverse'))core.forEach(x=>affected.add(x));
 if(path.includes('/reverse'))['/budgets','/spending/insights?months=6','/bills','/wealth/summary'].forEach(x=>affected.add(x));
 if(path.includes('/settlements')||path.includes('/cancel'))affected.add('/bills');
 if(path.includes('/payments'))['/debts','/tax/obligations','/wealth/summary'].forEach(x=>affected.add(x));
 if(path.includes('/valuations'))['/wealth/assets','/wealth/investments','/wealth/liabilities','/wealth/summary'].forEach(x=>affected.add(x));
 if(path.includes('/decision'))['/spending/approvals','/capital/requests'].forEach(x=>affected.add(x));
 await qc.invalidateQueries({queryKey:['ws',workspaceId],refetchType:'none'});
 await Promise.all([...affected].map(tail=>qc.refetchQueries({queryKey:['ws',workspaceId,tail],exact:true,type:'active'})));
}
export function useWrite(){
 const {api,workspaceId,role}=useSession(),qc=useQueryClient();
 return useMutation({mutationFn:async(v:{path:string;body:unknown})=>{
  if(!api||!workspaceId)throw new Error('Sign in and select a workspace.');
  if(role==='VIEWER')throw new Error('This workspace role cannot make changes.');
  return api.workspacePost<unknown>(workspaceId,v.path,v.body);
 },onSuccess:async(_result,variables)=>{await refreshFinancialData(qc,workspaceId,variables.path);}});
}
export function useOwnerCheck(){
 const {api,workspaceId,role}=useSession();
 return useMutation({mutationFn:async()=>{
  if(!api||!workspaceId||role!=='OWNER')throw new Error('Owner approval required.');
  return api.workspace<Record<string,unknown>>(workspaceId,'/certification/financial-integrity');
 }});
}
export function monthSeries(items:Transaction[],months=6){
 const counts=new Map<string,{month:string;income:number;expense:number}>();
 for(let d=months-1;d>=0;d--){const date=new Date(Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth()-d,1));
 const key=date.toISOString().slice(0,7);counts.set(key,{month:key,income:0,expense:0});}
 for(const t of items){
  const key=t.occurredAt.slice(0,7),row=counts.get(key);if(!row)continue;
  if(t.kind==='INCOME')row.income+=t.amountMinor;
  if(t.kind==='EXPENSE')row.expense+=Math.abs(t.amountMinor);
  if(t.kind==='REVERSAL'){}
 }
 return [...counts.values()];
}
export const describeError=(error:unknown)=>error instanceof Error?error.message:'Request failed. Please retry.';
