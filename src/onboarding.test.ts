import test from "node:test";
import assert from "node:assert/strict";
import { emptyState } from "./engine";
import { applyInitialSetup, type InitialSetupDraft } from "./SetupWizard";
import { today, month } from "./engine";

const fixture=():InitialSetupDraft=>({
 professional:false, accountName:"Compte courant", opening:"1500", asOf:today(),
 salaryReceived:false,savingDone:false,extras:[],income:"0",salaryDay:"27",
 salaryBudget:"next",salaryReminder:true,fixed:[],
 incomeSources:[
  {id:"r1",name:"Salaire 1",amount:"1600",day:"27",frequency:"monthly",received:true},
  {id:"r2",name:"Salaire 2",amount:"2400",day:"29",frequency:"monthly",received:false}
 ],
 categories:[
  {id:"c1",name:"Logement",icon:"home",amount:"700"},
  {id:"c2",name:"Courses",icon:"food",amount:"400"},
 ]
});
test("multiple source setup preserves each source and monthly total",()=>{
 const s=emptyState(); applyInitialSetup(s,fixture());
 assert.equal(s.income,400000);
 assert.deepEqual(s.incomeSources?.map(x=>x.name),["Salaire 1","Salaire 2"]);
 assert.deepEqual(s.incomeSources?.map(x=>x.receivedMonths.includes(month())),[true,false]);
 assert.deepEqual(s.categories.map(x=>x.name),["Logement","Courses"]);
 assert.deepEqual(s.categories.map(x=>x.budgets[month()]),[70000,40000]);
 assert.equal(s.transactions.length,0);
});
test("quarterly income is averaged for legacy projections without phantom transactions",()=>{
 const draft=fixture(); draft.incomeSources=[{id:"q",name:"Prime",amount:"900",day:"15",frequency:"quarterly",received:false}];
 const s=emptyState();applyInitialSetup(s,draft);
 assert.equal(s.income,30000);assert.equal(s.transactions.length,0);
});
test("deleting all starter categories does not recreate legacy categories",()=>{
 const draft=fixture();draft.categories=[];
 const s=emptyState();applyInitialSetup(s,draft);
 assert.equal(s.categories.length,0);
});
test("duplicate account names are rejected",()=>{
 const draft=fixture(); draft.extras=[{id:"x",name:"compte COURANT",group:"wealth",opening:"100",allocation:"0"}];
 assert.throws(()=>applyInitialSetup(emptyState(),draft),/déjà utilisé/);
});
