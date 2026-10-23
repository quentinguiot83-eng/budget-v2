import { test } from "node:test";
import assert from "node:assert/strict";
import { createDemoHousehold } from "./demoFixture";
import { demoRpc, resetDemoRpc } from "./demoRpc";
import { validate, month, stats } from "./engine";

test("demo includes 12 fictional months, usable budgets and balanced accounts", () => {
  const state=createDemoHousehold();
  assert.doesNotThrow(()=>validate(state));
  assert.equal(state.accounts.filter(a=>a.group==="current").length,2);
  assert.ok(state.transactions.length>130);
  assert.equal(state.categories.length,8);
  assert.equal(state.transactions.every(t=>t.date<=new Date().toISOString().slice(0,10)),true);
  assert.ok(stats(state,month()).income>0);
});
test("demo professional writes only to memory and reset restores examples", async()=>{
  resetDemoRpc();
  const first=await demoRpc("budget_pro_suite_load");
  assert.ok(first.invoices.length>=3);
  assert.ok(first.transactions.length>=12);
  await demoRpc("budget_pro_client_save",{p_client:{name:"Client fictif test",email:"test@exemple.invalid"}});
  const changed=await demoRpc("budget_pro_suite_load");
  assert.equal(changed.clients.length,first.clients.length+1);
  resetDemoRpc();
  const reset=await demoRpc("budget_pro_suite_load");
  assert.equal(reset.clients.length,first.clients.length);
});
