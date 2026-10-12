import { test } from "node:test";
import assert from "node:assert/strict";
import { createIntegrityExport } from "./secureExport";
import { inspectRestoreCandidate, restorePreviewCounts } from "./backupRestore";

const context = { householdId: "foyer-1", isOwner: true, personalRevision: 3 };
const home = {
  schema: 1, accounts: [], categories: [], rules: [], transactions: [{ id: "a" }],
  trips: [], projects: [], loans: [], hidden: [], cancelled: [],
};
const privateState = { schema: 1, account: null, rules: [], transactions: [] };

test("preview household JSON is read-only and counts modifications", async () => {
  const file = await createIntegrityExport({
    scope:"household", householdId:"foyer-1", revision:2, state:home,
  });
  const candidate = await inspectRestoreCandidate(file, context);
  assert.equal(candidate.scope, "household");
  assert.deepEqual(restorePreviewCounts(candidate, 4), {
    current:4,file:1,difference:-3,
  });
  assert.equal(candidate.backup.scope,"household");
});
test("reject other household and non-owner before enabling restore", async () => {
  const file = await createIntegrityExport({
    scope:"household",householdId:"foyer-1",revision:2,state:home,
  });
  await assert.rejects(inspectRestoreCandidate(file, {...context,householdId:"foyer-2"}),/autre foyer/);
  await assert.rejects(inspectRestoreCandidate(file, {...context,isOwner:false}),/propriétaire/);
});
test("private backup needs loaded personal account", async () => {
  const file = await createIntegrityExport({
    scope:"personal", householdId:"foyer-1",revision:2,state:privateState,
  });
  await assert.rejects(inspectRestoreCandidate(file,{...context,personalRevision:null}),/chargé/);
  assert.equal((await inspectRestoreCandidate(file,{...context,isOwner:false})).scope,"personal");
});
test("professional data may be exported but not imported", async () => {
  const file = await createIntegrityExport({
    scope:"professional",data:{transactions:[],businesses:[],invoices:[]},
  });
  await assert.rejects(inspectRestoreCandidate(file,context),/pas encore disponible/);
});
test("invalid checksum cannot prepare an import", async () => {
  const file = await createIntegrityExport({
    scope:"household",householdId:"foyer-1",revision:2,state:home,
  });
  await assert.rejects(inspectRestoreCandidate(file.replace('"revision": 2','"revision": 4'),context),/endommagée/);
});
