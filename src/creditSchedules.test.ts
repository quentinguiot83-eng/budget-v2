import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyState, dues, type Rule } from "./engine";
import { revisePaymentPlan, removeCreditPlan } from "./creditSchedules";

function fixture() {
  const state = emptyState();
  const original: Rule = { id: "old", name: "OM", amount: 11500, account: "current",
    category: "other", start: "2026-10-12", interval: 1, count: 4, kind: "credit" };
  state.rules.push(original);
  return { state, original };
}

test("repeated updates without paid installments never duplicate a plan", () => {
  const { state, original } = fixture();
  for (let count = 2; count <= 5; count++) {
    assert.equal(revisePaymentPlan(state, "old", { ...original, count, amount: 12000 }, "new-"+count), "updated");
    assert.equal(state.rules.length, 1);
  }
  assert.equal(state.rules[0].count, 5);
  assert.equal(dues(state, "2026-11").length, 1);
});

test("confirmed installments remain after a split of the future plan", () => {
  const { state, original } = fixture();
  state.transactions.push({ id:"paid", type:"expense", amount:11500, date:"2026-10-15",
    description:"OM", account:"current", dueKey:"old:2026-10-12" });
  assert.equal(revisePaymentPlan(state, "old", { ...original,
    start:"2026-11-12", amount:12000, count:3 }, "new"), "split");
  assert.equal(original.end, "2026-11-11");
  assert.equal(state.transactions[0].dueKey, "old:2026-10-12");
  assert.equal(dues(state,"2026-11").length,1);
  assert.equal(dues(state,"2026-11")[0].rule.id,"new");
});

test("cannot overwrite an already confirmed payment's scheduled date", () => {
  const { state, original } = fixture();
  state.transactions.push({ id:"paid", type:"expense", amount:11500, date:"2026-10-18",
    description:"OM", account:"current", dueKey:"old:2026-10-12" });
  assert.throws(() => revisePaymentPlan(state,"old",{...original,count:2},"next"),/validées/);
  assert.equal(state.rules.length,1);
});

test("deleting one plan preserves other plans and confirmed transactions", () => {
  const { state, original } = fixture();
  state.rules.push({...original,id:"duplicate"});
  state.transactions.push({ id:"paid", type:"expense", amount:11500, date:"2026-10-12",
    description:"OM", account:"current", dueKey:"old:2026-10-12" });
  removeCreditPlan(state,"duplicate");
  assert.equal(state.rules.length,1);
  removeCreditPlan(state,"old");
  assert.equal(state.transactions.length,1);
  assert.equal(state.rules.length,0);
});
