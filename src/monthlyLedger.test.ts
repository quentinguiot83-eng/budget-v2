import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyState, type Account, type Tx } from "./engine";
import { monthlyLedger } from "./monthlyLedger";
import { filterTransactions, type TransactionFilters } from "./transactionSearch";
const base: Account = {id:"bank",name:"Compte du foyer",group:"current",opening:0,date:"2026-01-01",rate:0,cap:0,capType:"balance",contributed:0,relay:"",allocation:0};
function fixture() {
  const s=emptyState();
  s.accounts=[base,{...base,id:"cash",name:"Espèces",isCash:true},{...base,id:"wealth",group:"wealth",name:"Livret"}];
  s.categories=[{id:"food",name:"Alimentation",icon:"",budgets:{}}];
  s.trips=[{
    id:"greece",name:"Grèce",start:"2026-10-24",end:"2026-10-30",budget:110000,
    categories:[{id:"hotel",name:"Hébergement",budget:50000}],
    closedAt:"2026-10-31",
  }];
  s.transactions=[
    {id:"sept-oct-salary",type:"income",incomeType:"Salaire",budgetMonth:"2026-10",amount:160000,date:"2026-09-28",account:"bank",description:"Salaire octobre"},
    {id:"oct-nov-salary",type:"income",incomeType:"Salaire",budgetMonth:"2026-11",amount:170000,date:"2026-10-28",account:"bank",description:"Salaire novembre"},
    {id:"oct-income",type:"income",amount:20000,date:"2026-10-12",account:"bank",description:"Prime"},
    {id:"cash-spend",type:"expense",amount:3000,date:"2026-10-13",account:"cash",category:"food",description:"Marché"},
    {id:"trip-spend",type:"expense",amount:10000,date:"2026-10-20",account:"bank",trip:"greece",description:"Hôtel"},
    {id:"internal",type:"transfer",amount:4000,date:"2026-10-10",account:"bank",to:"cash",description:"Retrait"},
    {id:"savings",type:"transfer",amount:5000,date:"2026-10-14",account:"bank",to:"wealth",description:"Virement épargne"},
    {id:"personal-budget",type:"personal_transfer",amount:3000,date:"2026-10-15",account:"bank",personalOwner:"owner",category:"food",description:"Budget perso"},
    {id:"next-month-spend",type:"expense",amount:6000,date:"2026-11-01",account:"bank",description:"Novembre"},
  ] as Tx[];
  return s;
}
test("bilan cohérent avec les lignes de revenus et dépenses de Transactions",()=>{
 const s=fixture(), ledger=monthlyLedger(s,"2026-10","2026-11-02");
 const filters:TransactionFilters={query:"",type:"income",category:"",account:"",period:"month",month:"2026-10",from:"",to:"",min:"",max:""};
 assert.deepEqual(ledger.revenues.map(t=>t.id).sort(),filterTransactions(s,filters).map(t=>t.id).sort());
 assert.deepEqual(ledger.expenses.map(t=>t.id).sort(),filterTransactions(s,{...filters,type:"expense"}).filter(t=>t.type==="expense").map(t=>t.id).sort());
 assert.equal(ledger.income,180000);
 assert.equal(ledger.spending,13000);
 assert.equal(ledger.balance,167000);
 assert.equal(ledger.travelSpending,10000);
 assert.equal(ledger.ordinarySpending,3000);
 assert.equal(ledger.savings,5000);
 assert.equal(ledger.categories.reduce((n,c)=>n+c.amount,0),ledger.spending);
 assert.equal(ledger.categories.find(c=>c.id==="trip:greece")?.name,"Grèce");
 assert.equal(ledger.categories.find(c=>c.id==="trip:greece")?.tripId,"greece");
 assert.equal(ledger.categories.find(c=>c.id==="trip:greece")?.amount,10000);
 assert.equal(ledger.categories.find(c=>c.id==="category:food")?.amount,3000);
 assert.equal(ledger.categories.find(c=>c.id==="category:")?.amount,undefined);
});
test("correction rétroactive et paiement en espèces réactualisent les chiffres",()=>{
 const s=fixture();
 s.transactions.find(t=>t.id==="cash-spend")!.amount=8000;
 const l=monthlyLedger(s,"2026-10","2026-11-02");
 assert.equal(l.spending,18000);
 assert.equal(l.balance,162000);
 assert.equal(l.categories.reduce((n,c)=>n+c.amount,0),18000);
});

test("deux voyages distincts conservent leurs noms dans la répartition, même clôturés",()=>{
 const s=fixture();
 s.trips.push({id:"italy",name:"Italie",start:"2026-10-01",end:"2026-10-12",budget:20000,categories:[],closedAt:"2026-10-13"});
 s.transactions.push(
   {id:"italian-dinner",type:"expense",amount:1700,date:"2026-10-09",account:"bank",trip:"italy",description:"Restaurant"},
   {id:"greece-taxi",type:"expense",amount:1250,date:"2026-10-25",account:"bank",trip:"greece",tripCategory:"taxi",category:"food",description:"Taxi"},
   {id:"uncategorized",type:"expense",amount:600,date:"2026-10-11",account:"bank",description:"Sans catégorie foyer"},
 );
 const l=monthlyLedger(s,"2026-10","2026-11-02");
 assert.equal(l.categories.find(c=>c.id==="trip:greece")?.name,"Grèce");
 assert.equal(l.categories.find(c=>c.id==="trip:greece")?.amount,11250);
 assert.equal(l.categories.find(c=>c.id==="trip:italy")?.name,"Italie");
 assert.equal(l.categories.find(c=>c.id==="trip:italy")?.amount,1700);
 // Une dépense de voyage portant aussi une catégorie du foyer ne doit pas
 // être comptée une deuxième fois dans la catégorie Alimentation.
 assert.equal(l.categories.find(c=>c.id==="category:food")?.amount,3000);
 assert.equal(l.categories.find(c=>c.id==="category:")?.name,"Sans catégorie");
 assert.equal(l.categories.find(c=>c.id==="category:")?.amount,600);
 assert.equal(l.spending,16550);
 assert.equal(l.travelSpending,12950);
 assert.equal(l.categories.reduce((total,c)=>total+c.amount,0),l.spending);
 assert.equal(new Set(l.categories.map(c=>c.id)).size,l.categories.length);
});

test("le nom affiché suit le voyage renommé sans modifier les opérations",()=>{
 const s=fixture();
 const before=monthlyLedger(s,"2026-10","2026-11-02");
 s.trips[0].name="Cyclades";
 const after=monthlyLedger(s,"2026-10","2026-11-02");
 assert.equal(after.categories.find(c=>c.id==="trip:greece")?.name,"Cyclades");
 assert.equal(after.spending,before.spending);
 assert.equal(after.travelSpending,before.travelSpending);
});

test("une transaction liée à un voyage supprimé reste visible avec un libellé explicite",()=>{
 const s=fixture();
 s.trips=[];
 const l=monthlyLedger(s,"2026-10","2026-11-02");
 assert.equal(l.categories.find(c=>c.id==="trip:greece")?.name,"Voyage supprimé");
 assert.equal(l.categories.find(c=>c.id==="trip:greece")?.amount,10000);
 assert.equal(l.categories.reduce((total,c)=>total+c.amount,0),l.spending);
});
