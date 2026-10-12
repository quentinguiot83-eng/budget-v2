import { test } from "node:test";
import assert from "node:assert/strict";
import { createIntegrityExport, verifyIntegrityExport } from "./secureExport";

test("vérifie la copie privée sans écrire en base", async () => {
  const json = await createIntegrityExport({
    scope: "personal",
    householdId: "foyer-1",
    revision: 4,
    state: { schema: 1, account: null, transactions: [], rules: [] }
  });
  const result = await verifyIntegrityExport(json);
  assert.equal(result.scope, "personal");
  assert.equal(result.revision, 4);
  assert.equal(result.operationCount, 0);
  assert.equal(result.householdId, "foyer-1");
});

test("détecte une modification des valeurs financières", async () => {
  const json = await createIntegrityExport({
    scope: "household",
    householdId: "foyer-1",
    revision: 7,
    state: { schema: 1, transactions: [{ amount: 2500, date: "2026-10-12" }] }
  });
  const modified = json.replace("2500", "9999");
  await assert.rejects(verifyIntegrityExport(modified), /endommagée/);
});

test("rejette les autres formats et les fichiers dépourvus de transactions", async () => {
  await assert.rejects(verifyIntegrityExport("{}"), /pas une sauvegarde|inconnu/);
  const malformed = await createIntegrityExport({
    scope: "household", householdId: "foyer", revision: 1, state: {}
  });
  await assert.rejects(verifyIntegrityExport(malformed), /incomplètes/);
});

test("vérifie les données professionnelles sans transférer le fichier", async () => {
  const json = await createIntegrityExport({
    scope: "professional",
    businessId: "entreprise-1",
    data: { clients: [], invoices: [], transactions: [{ amount: 12000 }] }
  });
  const result = await verifyIntegrityExport(json);
  assert.equal(result.scope, "professional");
  assert.equal(result.operationCount, 1);
});
