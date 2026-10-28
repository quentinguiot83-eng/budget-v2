import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyState, balance, budgetOverruns, consecutiveBudgetOverruns,
  estimatedAnnualInterest, expenseBudgetMonth, isPersonalBudgetExpense,
  month, shiftMonth, stats, today, type Account } from "./engine";
import { filterTransactions, type TransactionFilters } from "./transactionSearch";

const current: Account = {
  id: "current", name: "Courant", opening: 100000, date: "2025-01-01",
  group: "current", rate: 0, cap: 0, capType: "balance",
  contributed: 0, relay: "", allocation: 0,
};
const filters: TransactionFilters = {
  query: "", type: "expense", category: "", account: "", period: "month",
  month: "2026-11", from: "", to: "", min: "", max: "",
};
test("un virement bancaire d'octobre alimente les dépenses du budget de novembre et reste annulable", () => {
  const s = emptyState();
  s.accounts = [current];
  s.categories = [{id:"perso",name:"Personnel",icon:"",budgets:{"2026-01":20000},personalOwner:"owner",personalSince:"2026-01"}];
  s.transactions = [{id:"transfer",type:"personal_transfer",personalKind:"budget",
    personalOwner:"owner",account:"current",category:"perso",amount:12000,
    date:"2026-10-25",personalStartMonth:"2026-11",description:"Budget perso"}];
  assert.equal(isPersonalBudgetExpense(s.transactions[0]), true);
  assert.equal(expenseBudgetMonth(s.transactions[0]), "2026-11");
  assert.equal(stats(s, "2026-10").spending, 0);
  assert.equal(stats(s, "2026-11").spending, 12000);
  assert.deepEqual(filterTransactions(s, filters).map(t=>t.id), ["transfer"]);
  assert.deepEqual(filterTransactions(s, {...filters, month:"2026-10"}).map(t=>t.id), []);
  s.transactions = [];
  assert.equal(stats(s, "2026-11").spending, 0);
});
test("les avances réparties sur plusieurs mois ne sont pas ajoutées une deuxième fois aux dépenses", () => {
  const s=emptyState();s.accounts=[current];
  s.transactions=[{id:"advance",type:"personal_transfer",personalKind:"advance",
    account:"current",amount:120000,date:"2026-10-20",personalMonths:12,
    personalStartMonth:"2026-11",description:"Avance compte perso"}];
  assert.equal(stats(s,"2026-11").spending,0);
  assert.deepEqual(filterTransactions(s,filters),[]);
});
test("le rendement annuel est proratisé et le montant reçu ne gonfle pas les revenus du foyer", () => {
  const s=emptyState();
  const savings:Account={...current,id:"savings",group:"wealth",opening:100000,rate:10,
    taxMode:"yield",taxRate:20};
  s.accounts=[current,savings];
  assert.equal(estimatedAnnualInterest(s,savings,2025),8000);
  s.transactions.push({id:"interest",type:"interest",amount:8000,account:"savings",
    date:today(),description:"Intérêts 2025"});
  assert.equal(balance(s,"savings"),108000);
  assert.equal(stats(s,month()).income,0);
});
test("proposer l'augmentation seulement après deux mois clos dépassés, puis mémoriser le refus", () => {
  const s=emptyState();s.accounts=[current];
  const m=month(),p1=shiftMonth(m,-1),p2=shiftMonth(m,-2);
  s.categories=[{id:"food",name:"Courses",icon:"",budgets:{[p2]:10000,[p1]:10000}}];
  for(const [index,p] of [p2,p1].entries()) s.transactions.push({
    id:String(index),type:"expense",amount:14000,account:"current",category:"food",
    date:p+"-10",description:"Courses"});
  assert.equal(budgetOverruns(s,p1).length,1);
  const suggestions=consecutiveBudgetOverruns(s,m);
  assert.equal(suggestions.length,1);
  assert.equal(suggestions[0].suggested,14000);
  s.budgetIncreaseDecisions={[m+":food"]:"declined"};
  assert.equal(consecutiveBudgetOverruns(s,m).length,0);
});
