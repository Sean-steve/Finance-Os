import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
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
export function useWrite(){
 const {api,workspaceId,role}=useSession(),qc=useQueryClient();
 return useMutation({mutationFn:async(v:{path:string;body:unknown})=>{
  if(!api||!workspaceId)throw new Error('Sign in and select a workspace.');
  if(role==='VIEWER')throw new Error('This workspace role cannot make changes.');
  return api.workspacePost<unknown>(workspaceId,v.path,v.body);
 },onSuccess:async()=>{await qc.invalidateQueries({queryKey:['ws',workspaceId]});}});
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
