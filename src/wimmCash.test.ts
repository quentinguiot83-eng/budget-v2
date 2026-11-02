import test from "node:test";
import assert from "node:assert/strict";
import { balance, emptyState, today, validate, type Account } from "./engine";
import { emptyPersonalState, personalBalance, personalCashBalance, validatePersonal } from "./personal";

const current = (id:string, opening:number, isCash=false):Account=>({
  id, name:isCash?"Espèces":"Banque",opening,date:today(),group:"current",
  isCash,rate:0,cap:0,capType:"balance",contributed:0,relay:"",allocation:0,
});

test("household cash is another current account: bank-to-cash transfer is not double-counted",()=>{
  const state=emptyState();
  state.accounts=[current("bank",10000),current("cash",500,true)];
  state.transactions=[
    {id:"withdrawal",type:"transfer",account:"bank",to:"cash",amount:2000,date:today(),description:"Retrait"},
    {id:"purchase",type:"expense",account:"cash",amount:800,date:today(),description:"Achats en espèces"},
  ];
  assert.equal(balance(state,"bank"),8000);
  assert.equal(balance(state,"cash"),1700);
  assert.equal(state.accounts.reduce((n,a)=>n+balance(state,a.id),0),9700);
});

test("private bank-to-cash transfer does not change total cash plus bank balance",()=>{
  const p=emptyPersonalState(), shared=emptyState();
  p.account={id:"p",name:"Compte privé",opening:10000,date:today(),category:"my-budget"};
  p.transactions=[
    {id:"cash-withdrawal",type:"adjust",cashTransfer:true,paymentMethod:"cash",amount:3000,date:today(),description:"Retrait"},
    {id:"cash-spent",type:"expense",paymentMethod:"cash",amount:1200,date:today(),description:"Espèces"},
    {id:"card-spent",type:"expense",paymentMethod:"bank",amount:900,date:today(),description:"CB"},
  ];
  assert.equal(personalCashBalance(p),1800);
  assert.equal(personalBalance(p,shared,"user"),7900);
  assert.equal(personalBalance(p,shared,"user")-personalCashBalance(p),6100);
  assert.doesNotThrow(()=>validatePersonal(p));
});

test("a personal cash payment exceeding cash funds is rejected",()=>{
  const p=emptyPersonalState();
  p.account={id:"p",name:"Compte privé",opening:10000,date:today(),category:"my-budget"};
  p.transactions=[{id:"over",type:"expense",paymentMethod:"cash",amount:100,date:today(),description:"Too much"}];
  assert.throws(()=>validatePersonal(p),/espèces personnelles/i);
});

test("all cash expenses are blocked when their ledger would turn negative",()=>{
  const s=emptyState();
  s.accounts=[current("bank",10000),current("cash",300,true)];
  s.transactions=[{id:"too-much",type:"expense",account:"cash",amount:301,date:today(),description:"Espèces insuffisantes"}];
  assert.throws(()=>validate(s),/espèces insuffisantes/i);
});
