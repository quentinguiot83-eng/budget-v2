import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyState, type Account } from "./engine.ts";
import { spendingAnalysis } from "./spendingAnalysis.ts";
function fixture() {
  const s = emptyState();
  const account: Account = {id:"current",name:"Courant",opening:0,date:"2010-01-01",group:"current",rate:0,cap:0,capType:"balance",contributed:0,relay:"",allocation:0};
  s.accounts=[account,{...account,id:"private",group:"personal"}];
  s.categories=[{id:"food",name:"Courses",icon:"",budgets:{},archived:"2025-01"}];
  s.transactions=[
    {id:"old",type:"expense",date:"2020-01-15",amount:1000,description:"Ancienne",account:"current",category:"food"},
    {id:"before",type:"expense",date:"2025-06-30",amount:2000,description:"Avant",account:"current",category:"food"},
    {id:"first",type:"expense",date:"2025-07-01",amount:3000,description:"Début",account:"current",category:"food"},
    {id:"last",type:"expense",date:"2025-12-31",amount:4000,description:"Fin",account:"current",category:"food"},
    {id:"travel",type:"expense",date:"2025-12-10",amount:5000,description:"Voyage",account:"current",trip:"trip"},
    {id:"private",type:"expense",date:"2025-12-10",amount:6000,description:"Privé",account:"private",category:"food"},
    {id:"transfer",type:"transfer",date:"2025-12-10",amount:7000,description:"Virement",account:"current",to:"private"},
    {id:"future",type:"expense",date:"2099-12-10",amount:8000,description:"Futur",account:"current",category:"food"},
  ]; return s;
}
test("six and twelve months include full boundary months and empty months",()=>{
 const s=fixture(), six=spendingAnalysis(s,"2025-12","6",false), year=spendingAnalysis(s,"2025-12","12",false);
 assert.equal(six.start,"2025-07");assert.equal(six.data.length,6);assert.equal(six.total,7000);
 assert.equal(six.data[1].food,0);assert.equal(year.start,"2025-01");assert.equal(year.total,9000);
});
test("five years means 60 months and all time begins at the first eligible expense",()=>{
 const s=fixture();const five=spendingAnalysis(s,"2025-12","60",false),all=spendingAnalysis(s,"2025-12","all",false);
 assert.equal(five.start,"2021-01");assert.equal(five.data.length,60);assert.equal(five.total,9000);
 assert.equal(all.start,"2020-01");assert.equal(all.data.length,72);assert.equal(all.total,10000);
});
test("charts and category totals reconcile; travel is optional and private purchases excluded",()=>{
 const s=fixture(),result=spendingAnalysis(s,"2025-12","1",true);
 assert.equal(result.total,9000);assert.equal(result.categories.find(c=>c.id==="__travel")?.value,5000);
 assert.equal(result.categories.find(c=>c.id==="food")?.value,4000);
 const sum=result.data.reduce((n,p)=>n+result.categories.reduce((x,c)=>x+Number(p[c.id]),0),0);
 assert.equal(sum,result.total);assert.equal(s.transactions[0].id,"old");
});
test("empty history and uncategorized expenses still produce usable periods",()=>{
 const s=emptyState();assert.equal(spendingAnalysis(s,"2025-12","all",false).data.length,1);
 s.transactions.push({id:"missing",type:"expense",date:"2025-12-01",amount:1234,description:"Sans catégorie",account:"current"});
 const result=spendingAnalysis(s,"2025-12","all",false);assert.equal(result.categories[0].name,"Sans catégorie");assert.equal(result.total,1234);
});
