import test from "node:test";
import assert from "node:assert/strict";
import { validateAccountName } from "./accountNames";

const accounts=[{id:"current-1",name:"Compte commun"},{id:"current-2",name:"Compte perso"},{id:"saving",name:"Livret A"}];

test("new current accounts can have distinct bank-specific names",()=>{
  assert.equal(validateAccountName("  Banque Populaire  ",accounts),"Banque Populaire");
  assert.equal(validateAccountName("Compte secondaire",accounts),"Compte secondaire");
});
test("renaming is allowed for an existing account but rejects duplicate labels",()=>{
  assert.equal(validateAccountName("Compte commun",accounts,"current-1"),"Compte commun");
  assert.equal(validateAccountName("  compte commun  ",accounts,"current-1"),"compte commun");
  assert.throws(()=>validateAccountName("  COMPTE   COMMUN ",accounts,"current-2"),/déjà ce nom/);
});
test("account names cannot be empty or unreasonably long",()=>{
  assert.throws(()=>validateAccountName("   ",accounts),/nom/);
  assert.throws(()=>validateAccountName("A".repeat(61),accounts),/60 caractères/);
});
