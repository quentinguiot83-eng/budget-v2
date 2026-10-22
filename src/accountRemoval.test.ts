import test from "node:test";
import assert from "node:assert/strict";
import { emptyState, balance, validate, type Account } from "./engine";
import { accountLinks, canDeleteAccount, canArchiveAccount, accountRemovalBlockers, removeAccountSafely } from "./accountRemoval";

const account=(id:string,opening=0):Account=>({
  id,name:id,group:"current",opening,date:"2026-01-01",rate:0,
  cap:0,capType:"balance",contributed:0,relay:"",allocation:0,
});
test("a disposable account is permanently deleted, leaving another checking account untouched",()=>{
  const state=emptyState();
  state.accounts=[account("main",125_00),account("unused",45_00)];
  assert.equal(canDeleteAccount(accountLinks(state,"unused")),true);
  removeAccountSafely(state,"unused","delete");
  assert.deepEqual(state.accounts.map(a=>a.id),["main"]);
  assert.equal(balance(state,"main"),12_500);
  assert.doesNotThrow(()=>validate(state));
});
test("an account used by transactions cannot be permanently deleted",()=>{
  const state=emptyState();
  state.accounts=[account("main"),account("history",100_00)];
  state.transactions.push({
    id:"expense",date:"2026-04-01",type:"expense",
    account:"history",amount:100_00,description:"Old purchase",
  });
  assert.equal(accountLinks(state,"history").balance,0);
  assert.equal(canDeleteAccount(accountLinks(state,"history")),false);
  assert.throws(()=>removeAccountSafely(state,"history","delete"),/données liées/);
  assert.equal(state.accounts.length,2);
});
test("archiving a settled account retains its identity and transactions, and can be reversed",()=>{
  const state=emptyState();
  state.accounts=[account("main"),account("closed",100_00)];
  state.transactions.push({
    id:"expense",date:"2026-04-01",type:"expense",
    account:"closed",amount:100_00,description:"Old purchase",
  });
  assert.equal(canArchiveAccount(accountLinks(state,"closed")),true);
  removeAccountSafely(state,"closed","archive");
  assert.equal(state.accounts[1].archived,true);
  assert.equal(state.transactions.length,1);
  assert.equal(state.transactions[0].account,"closed");
  assert.doesNotThrow(()=>validate(state));
  removeAccountSafely(state,"closed","restore");
  assert.equal(state.accounts[1].archived,false);
});
test("archiving is blocked when balance is nonzero or scheduled commitments exist",()=>{
  const state=emptyState();
  state.accounts=[account("main"),account("closed",500_00)];
  state.transactions.push({id:"expense",date:"2026-04-01",type:"expense",account:"closed",amount:100_00,description:"Purchase"});
  assert.equal(canArchiveAccount(accountLinks(state,"closed")),false);
  assert.match(accountRemovalBlockers(accountLinks(state,"closed")).join(" "),/solde restant/);
  state.transactions.push({id:"expense2",date:"2026-04-02",type:"expense",account:"closed",amount:400_00,description:"Purchase"});
  state.rules.push({id:"rent",name:"Rent",category:"home",account:"closed",amount:500_00,
    start:"2026-04-05",interval:1,count:0,kind:"fixed"});
  assert.equal(accountLinks(state,"closed").balance,0);
  assert.equal(canArchiveAccount(accountLinks(state,"closed")),false);
  assert.throws(()=>removeAccountSafely(state,"closed","archive"),/engagements/);
});
test("links from transfers, favorites, loans and projects are protected",()=>{
  const state=emptyState();
  state.accounts=[account("main",200_00),account("linked")];
  state.transactions.push({id:"transfer",date:"2026-04-01",type:"transfer",account:"main",to:"linked",amount:100_00,description:"Transfer"});
  state.quickFavorites=[{id:"fav",type:"expense",description:"Purchase",account:"linked",amount:100_00}];
  state.projects.push({id:"project",name:"Goal",type:"other",date:"2026-06-01",amount:100_00,account:"linked",active:true,settled:false});
  state.loans.push({id:"loan",name:"Debt",date:"2026-04-01",amount:100_00,account:"linked"});
  const links=accountLinks(state,"linked");
  assert.equal(links.transactions,1);
  assert.equal(links.favorites,1);
  assert.equal(links.projects,1);
  assert.equal(links.loans,1);
  assert.equal(canDeleteAccount(links),false);
  assert.equal(canArchiveAccount(links),false);
});
