import test from "node:test";
import assert from "node:assert/strict";
import { isLikelyBankTransfer, suggestedBulkMatches } from "./bankReview";
import { findBankDuplicateCandidates, reconcileBankRows, type BankRow, type BankDuplicateCandidate } from "./bankImport";
import type { Tx } from "./engine";

const bankRow = (index: number, date: string, description = "NETFLIX"): BankRow =>
  ({index, date, description, amount: 1399, type:"expense"});
const tx = (id: string, date: string, description = "NETFLIX"): Tx =>
  ({id, account:"a", date, description, type:"expense", amount:1399});
function calculate(rows: BankRow[], existing: Tx[]) {
  const result = reconcileBankRows(rows, existing, "a");
  const candidates = new Map<number, BankDuplicateCandidate[]>();
  for (const row of result) if (row.status === "possible")
    candidates.set(row.index, findBankDuplicateCandidates(row, existing, "a"));
  return {result,candidates};
}
test("transfer-related bank movements are excluded from one-click new-expense selection", () => {
  assert.equal(isLikelyBankTransfer("VIR SEPA Livret A"), true);
  assert.equal(isLikelyBankTransfer("Virement SALAIRE"), true);
  assert.equal(isLikelyBankTransfer("Versement sur mon compte"), true);
  assert.equal(isLikelyBankTransfer("CARREFOUR MARSEILLE"), false);
});
test("unique same-description candidate from previous day can be confirmed together", () => {
  const existing = [tx("one","2026-10-10")];
  const {result,candidates} = calculate([bankRow(0,"2026-10-11")],existing);
  assert.equal(result[0].status,"possible");
  assert.deepEqual(suggestedBulkMatches(result,candidates,existing,{}),
    [{rowIndex:0,transactionId:"one"}]);
});
test("different description remains a manual review", () => {
  const existing = [tx("one","2026-10-10","Abonnement vidéo")];
  const {result,candidates} = calculate([bankRow(0,"2026-10-11")],existing);
  assert.deepEqual(suggestedBulkMatches(result,candidates,existing,{}),[]);
});
test("two plausible bank rows cannot claim the same operation", () => {
  const existing = [tx("one","2026-10-10")];
  const {result,candidates} = calculate([bankRow(0,"2026-10-11"),bankRow(1,"2026-10-12")],existing);
  assert.deepEqual(suggestedBulkMatches(result,candidates,existing,{}),[]);
});
test("candidate already used by an exact bank line cannot be re-used", () => {
  const existing = [tx("one","2026-10-10")];
  const {result,candidates} = calculate([bankRow(0,"2026-10-10"), bankRow(1,"2026-10-11")],existing);
  assert.deepEqual(result.map(r=>r.status),["matched","possible"]);
  assert.deepEqual(suggestedBulkMatches(result,candidates,existing,{}),[]);
});
test("manual choices stay authoritative", () => {
  const existing = [tx("one","2026-10-10")];
  const {result,candidates} = calculate([bankRow(0,"2026-10-11")],existing);
  assert.deepEqual(suggestedBulkMatches(result,candidates,existing,{0:{action:"import"}}),[]);
});
