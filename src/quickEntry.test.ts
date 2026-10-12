import { test } from "node:test";
import assert from "node:assert/strict";
import { quickSuggestions, favoriteFromTransaction, checkFavorite } from "./quickEntry";
import { emptyState, today, validate } from "./engine";
test("suggests repeated merchants from actual history and excludes fixed/travel/other accounts",()=>{
  const s=emptyState();
  s.accounts=[{id:"current",name:"Common",opening:0,date:"2020-01-01",group:"current",rate:0,cap:0,capType:"balance",contributed:0,relay:"",allocation:0}];
  s.categories=[{id:"food",name:"Courses",icon:"shopping-cart",budgets:{}}];
  s.transactions=[
    {id:"1",type:"expense",date:today(),account:"current",category:"food",amount:4000,description:"Carrefour"},
    {id:"2",type:"expense",date:today(),account:"current",category:"food",amount:4200,description:"CARREFOUR"},
    {id:"3",type:"expense",date:today(),account:"current",category:"food",amount:1000,description:"Pharmacie"},
    {id:"4",type:"expense",date:today(),account:"current",category:"food",amount:3000,description:"Carrefour",fixed:true},
  ];
  assert.equal(quickSuggestions(s,"expense","carr")[0].count,2);
  assert.equal(quickSuggestions(s,"expense","carr")[0].category,"food");
  const f=favoriteFromTransaction(s.transactions[0]);checkFavorite(f,s.accounts,s.categories);
  s.quickFavorites=[f];assert.doesNotThrow(()=>validate(s));
  s.quickFavorites=[f,{...f}];assert.throws(()=>validate(s),/Favori en double/);
  s.quickFavorites=[f];s.transactions[0].bankImportKey="key";s.transactions[1].bankImportKey="key";
  assert.throws(()=>validate(s),/bancaire importée en double/);
});
test("favorites reject invalid linked account or recurring transaction",()=>{
 const s=emptyState();
 const tx={id:"x",type:"expense" as const,date:today(),account:"unknown",amount:1200,description:"Test",fixed:true};
 assert.throws(()=>favoriteFromTransaction(tx),/ponctuels/);
 assert.throws(()=>checkFavorite({...tx,fixed:undefined},s.accounts,s.categories),/compte/);
});
