import test from "node:test";
import assert from "node:assert/strict";
import { emptyState } from "./engine";
import { cashLedgerBalance, validateCashLedger } from "./cash";

test("cash is a current account; withdrawals are transfers, never expenses", () => {
 const s=emptyState();
 s.accounts.push({id:"bank",name:"Banque",group:"current",opening:10000,date:"2026-11-01",rate:0,cap:0,capType:"balance",contributed:0,relay:"",allocation:0},
  {id:"cash",name:"Espèces",group:"current",cash:true,opening:0,date:"2026-11-01",rate:0,cap:0,capType:"balance",contributed:0,relay:"",allocation:0});
 s.transactions.push({id:"take",type:"transfer",account:"bank",to:"cash",amount:3000,date:"2026-11-02",description:"Retrait"},
 {id:"buy",type:"expense",account:"cash",amount:1100,date:"2026-11-02",description:"Achat"});
 assert.equal(cashLedgerBalance(s,"cash","2026-11-03"),1900);
 assert.doesNotThrow(()=>validateCashLedger(s));
 s.transactions.push({id:"too-much",type:"expense",account:"cash",amount:2000,date:"2026-11-02",description:"Trop"});
 assert.throws(()=>validateCashLedger(s),/insuffisantes/);
});
