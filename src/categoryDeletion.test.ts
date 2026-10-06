import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyState, balance, type Account } from "./engine.ts";
import { categoryReplacements, deleteArchivedCategory } from "./categoryDeletion.ts";
function fixture() {
 const s=emptyState();s.categories=[{id:"old",name:"Loisirs Manue",icon:"",budgets:{"2020-01":10000},archived:"2025-01"},{id:"new",name:"Loisirs Manue",icon:"",budgets:{"2020-01":15000}}];
 s.accounts=[{id:"current",name:"Courant",opening:100000,date:"2020-01-01",group:"current",rate:0,cap:0,capType:"balance",contributed:0,relay:"",allocation:0} as Account];
 s.transactions=[{id:"expense",type:"expense",date:"2025-01-05",description:"Sortie",amount:2500,account:"current",category:"old",fixed:true,dueKey:"fixed:2025-01-05"}];
 s.rules=[{id:"fixed",name:"Échéance",category:"old",account:"current",amount:2500,start:"2025-01-05",interval:1,count:0,kind:"fixed"}];
 s.monthlyForecasts={"2024-12":{capturedAt:"2025-01-01",income:200000,fixed:2500,variable:25000,savings:172500,categories:[{id:"old",name:"Ancienne",planned:10000},{id:"new",name:"Nouvelle",planned:15000}]}};
 return s;
}
test("transfer keeps every transaction, due key, amount and account balance",()=>{
 const s=fixture();const before=balance(s,"current"), tx={...s.transactions[0]};
 deleteArchivedCategory(s,"old","new");
 assert.equal(s.categories.length,1);assert.deepEqual(s.transactions[0],{...tx,category:"new"});
 assert.equal(s.rules[0].category,"new");assert.equal(balance(s,"current"),before);
 assert.equal(s.categories[0].budgets["2020-01"],15000);
 const frozen=s.monthlyForecasts!["2024-12"];
 assert.equal(frozen.variable,25000);assert.deepEqual(frozen.categories,[{id:"new",name:"Nouvelle",planned:25000}]);
});
test("unused archived category is deletable but active or referenced categories need safeguards",()=>{
 const s=fixture();assert.throws(()=>deleteArchivedCategory(s,"new"));assert.throws(()=>deleteArchivedCategory(s,"old"));
 assert.equal(s.transactions[0].category,"old");
 s.transactions=[];s.rules=[];deleteArchivedCategory(s,"old");assert.equal(s.categories[0].id,"new");
});
test("linked personal account blocks deletion and personal transfers require the same owner",()=>{
 const s=fixture();s.categories[0].personalOwner="user";assert.throws(()=>deleteArchivedCategory(s,"old","new"));
 delete s.categories[0].personalOwner;
 s.transactions.push({id:"personal",type:"personal_transfer",date:"2025-01-05",description:"Budget perso",amount:3000,account:"current",category:"old",personalOwner:"user"});
 assert.equal(categoryReplacements(s,"old").length,0);assert.throws(()=>deleteArchivedCategory(s,"old","new"));
 s.categories[1].personalOwner="user";deleteArchivedCategory(s,"old","new");assert.equal(s.transactions[1].personalOwner,"user");
});
test("unavailable destinations cannot partially mutate the source",()=>{
 const s=fixture(),before=JSON.stringify(s);
 assert.throws(()=>deleteArchivedCategory(s,"old","missing"));assert.equal(JSON.stringify(s),before);
 s.categories[1].archived="2025-02";assert.throws(()=>deleteArchivedCategory(s,"old","new"));
});
