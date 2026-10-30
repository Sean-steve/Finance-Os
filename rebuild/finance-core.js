
/* Finance OS shared accounting selectors.
   This is a local demo ledger: entries are not verified bank/provider data. */
(()=>{
'use strict';
const number=x=>Number.isFinite(Number(x))?Number(x):0;
function goalTransfers(model){
 const events=model?.capitalV2?.goalFunding||[];
 let total=0;
 for(const event of events){
  const amount=Math.max(0,number(event.amount));
  if(event.type==='Withdrawal')total-=amount;
  else if(event.type==='Contribution'||event.type==='Funding'||event.type==='fundGoal')total+=amount;
 }
 // The initial demo goal balances are earmarks already held in cash; only NEW
 // recorded cash-to-goal transfers have a separate asset under this demo model.
 return Math.max(0,Math.round(total*100)/100);
}
function personalCash(model){
 return (model?.accounts||[])
  .filter((account,i)=>i<=2||/cash wallet/i.test(String(account[0])))
  .reduce((total,account)=>total+number(account[1]),0);
}
function physicalAssets(model){
 return (model?.wealthV2?.assets||[]).reduce((sum,a)=>sum+number(a.value),0);
}
function investments(model){
 return (model?.wealthV2?.holdings||[]).reduce((sum,h)=>sum+number(h.shares)*number(h.price),0);
}
function liabilities(model){
 return (model?.protectionV2?.debts||[]).reduce((sum,d)=>sum+number(d.balance),0);
}
function monthlyIncome(model){return (model?.incomes||[]).reduce((sum,x)=>sum+number(x[1]),0)}
function monthlyExpenses(model){return (model?.expenses||[]).reduce((sum,x)=>sum+number(x[1]),0)}
function transactions(model){
 const x=model?.transactions||[];
 return x.reduce((memo,t)=>{
   const amount=number(t[4]);
   memo.count++;
   if(amount>0)memo.income+=amount;
   else memo.expenses+=Math.abs(amount);
   return memo;
 },{count:0,income:0,expenses:0});
}
function summary(model){
 const cash=personalCash(model),goals=goalTransfers(model),
       tangible=physicalAssets(model),portfolio=investments(model),debt=liabilities(model);
 const assets=cash+goals+tangible+portfolio;
 return {cash,goalTransfers:goals,physicalAssets:tangible,investments:portfolio,
         assets,debts:debt,netWorth:assets-debt,
         plannedMonthlyIncome:monthlyIncome(model),
         plannedMonthlyExpenses:monthlyExpenses(model),
         transactions:transactions(model)};
}
window.FinanceLedgerCore={number,goalTransfers,personalCash,physicalAssets,investments,
  liabilities,monthlyIncome,monthlyExpenses,transactions,summary};
})();
