
const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/app.js'),'utf8');
new Function(source);
class FakeForm {constructor(id,items){this.id=id;this.items=items;this.dataset={};}}
class FakeFormData {constructor(form){this.form=form;}entries(){return Object.entries(this.form.items)[Symbol.iterator]();}}
const storage=new Map(),events={},nodes={},windows={};
function el(name){return nodes[name]||(nodes[name]={innerHTML:'',value:'',hidden:true,style:{},classList:{toggle(){},remove(){},add(){}},addEventListener(){},focus(){},append(){},remove(){},querySelector(){return null}})}
const document={getElementById:el,addEventListener(name,fn){events[name]=fn},body:{classList:{toggle(){}},append(){}},createElement(){return el('created')}};
const localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
const location={hash:''},window={scrollTo(){},addEventListener(n,fn){windows[n]=fn}};
const sandbox={document,localStorage,location,window,FormData:FakeFormData,HTMLFormElement:FakeForm,Date,JSON,Math,Number,String,Object,Array,RegExp,setTimeout,clearTimeout,confirm:()=>true,Blob,classList:{},URL,console};
vm.runInNewContext(source,sandbox,{filename:'src/app.js',timeout:2000});
assert.equal((el('app').innerHTML.match(/class="navbtn/g)||[]).length,60,'all 60 screen links');
function goto(num){events.click({target:{closest(){return {dataset:{nav:String(num)}}}}});return el('app').innerHTML}
assert.match(goto(5),/Daily spending allowance/);
assert.match(goto(13),/id="importForm"/);
assert.match(goto(22),/id="budgetForm"/);
assert.match(goto(40),/id="purchaseForm"/);
assert.match(goto(41),/Funding requests/);
assert.match(goto(42),/id="scenarioForm"/);
assert.match(goto(57),/id="advisorForm"/);
assert.match(goto(59),/Verified live connections/);
assert.match(goto(60),/Data is stored in this browser localStorage/);
const parsed=()=>JSON.parse(storage.get('finance-os-v2-phase2-demo')||'{}');
async function submit(form){await events.submit({target:form,preventDefault(){}})}
(async()=>{
goto(22);
let form=new FakeForm('budgetForm',{'Housing':'45000','Food & Dining':'10000','Transport':'5000','Utilities':'4000','Shopping':'3000','Health':'2000','Subscriptions':'1000','Entertainment':'1500','Education':'2000','Other':'1000'});
await submit(form);assert.equal(parsed().budgets.Housing,45000);
goto(14);
let a=parsed().accounts.find(x=>x.id==='a1').balance,b=parsed().accounts.find(x=>x.id==='a2').balance;
await submit(new FakeForm('transferForm',{from:'a1',to:'a2',amount:'5000'}));
let accounts=parsed().accounts;assert.equal(accounts.find(x=>x.id==='a1').balance,a-5000);assert.equal(accounts.find(x=>x.id==='a2').balance,b+5000);
assert.equal(accounts.filter(x=>['a1','a2'].includes(x.id)).reduce((n,x)=>n+x.balance,0),a+b,'transfers conserve cash');
goto(13);
let file={size:100,text:async()=>'date,description,amount,category,account\n2026-10-01,Sample grocery,-1800,Food & Dining,a1'};
await events.submit({target:{id:'importForm',elements:{file:{files:[file]}}},preventDefault(){}});
assert.equal(parsed().transactions.filter(x=>x.name==='Sample grocery').length,1);

const routeContent = new Set();
for(let n=1;n<=60;n++){
 const html=goto(n);
 assert.match(html,new RegExp('SCREEN '+String(n).padStart(2,'0')+' / 60'));
 assert.match(html,/class="tabs"/,'Each screen should have contextual tabs');
 const core=html.split('<div class="grid">')[1]?.split('<p class="footnote">')[0];
 assert.ok(core&&core.length>450,'Screen '+n+' should render meaningful unique UI');
 routeContent.add(core);
 const subtab=(html.match(/data-tab="([^"]+)"/g)||[]).map(x=>x.slice(10,-1))[1];
 if(subtab){
  events.click({target:{closest(){return {dataset:{tab:subtab}}}}});
  assert.match(el('app').innerHTML,/class="grid"/,'Screen '+n+' subtab should render');
  goto(n);
 }
}
assert.equal(routeContent.size,60,'All 60 primary screen renderers should produce distinct content');
goto(12);
await submit(new FakeForm('inlineTxForm',{name:'Phase 2.1 sample',merchant:'Demo',amount:'1200',kind:'expense',category:'Transport',account:'a1',date:'2026-10-16'}));
assert.equal(parsed().transactions.filter(t=>t.name==='Phase 2.1 sample').length,1,'Inline transactions persist');

console.log('PASS: 60 individually rendered screens and contextual tabs; 9 core screen checks; persisted budgets; balanced transfers; local CSV import; JavaScript syntax');
})().catch(e=>{console.error(e);process.exitCode=1});
