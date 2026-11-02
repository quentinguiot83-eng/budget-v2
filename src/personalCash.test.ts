import test from "node:test";
import assert from "node:assert/strict";
import { emptyState } from "./engine";
import { emptyPersonalState, personalBalance, personalCashBalance, validatePersonal } from "./personal";

test("personal bank and cash sum without double counting withdrawals", () => {
 const p=emptyPersonalState();
 p.account={id:"p",name:"Compte perso",opening:10000,date:"2026-11-01",category:"loisirs"};
 p.transactions=[
   {id:"inventory",type:"cash_adjust",amount:4500,date:"2026-11-01",description:"Liquidités"},
   {id:"withdraw",type:"cash_transfer",amount:2000,date:"2026-11-02",description:"Retrait"},
   {id:"purchase",type:"expense",paymentMethod:"cash",amount:1500,date:"2026-11-02",description:"Sortie"},
 ];
 const s=emptyState();
 assert.equal(personalCashBalance(p,"2026-11-03"),5000);
 assert.equal(personalBalance(p,s,"owner","2026-11-03"),13000);
 assert.equal(personalBalance(p,s,"owner","2026-11-03")-personalCashBalance(p,"2026-11-03"),8000);
 assert.doesNotThrow(()=>validatePersonal(p));
 p.transactions.push({id:"overspend",type:"expense",paymentMethod:"cash",amount:5001,date:"2026-11-02",description:"Trop"});
 assert.throws(()=>validatePersonal(p),/espèces personnelles insuffisant/i);
});

test("historical bank-only expenses remain bank-only", () => {
 const p=emptyPersonalState();
 p.account={id:"p",name:"Compte perso",opening:10000,date:"2026-11-01",category:"loisirs"};
 p.transactions.push({id:"legacy",type:"expense",amount:1500,date:"2026-11-02",description:"Carte"});
 assert.equal(personalCashBalance(p,"2026-11-03"),0);
 assert.equal(personalBalance(p,emptyState(),"owner","2026-11-03"),8500);
 assert.doesNotThrow(()=>validatePersonal(p));
});
