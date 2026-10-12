import { test } from "node:test";
import assert from "node:assert/strict";
import { createIntegrityExport, verifyIntegrityExport, MAX_BACKUP_SIZE } from "./secureExport";

const householdState = () => ({
  schema: 1, accounts: [{ id: "a" }], categories: [], rules: [],
  transactions: [{ amount: 2500, date: "2026-10-12" }],
  trips: [], projects: [], loans: [], hidden: [], cancelled: [], income: 0,
});
const personalState = () => ({
  schema: 1, account: null, transactions: [], rules: [], budgets: [],
});

test("la sauvegarde v2 vérifie données et métadonnées sans écrire en base", async () => {
  const json = await createIntegrityExport({
    scope: "personal", householdId: "foyer-1", revision: 4, state: personalState(),
  });
  const result = await verifyIntegrityExport(json);
  assert.equal(result.scope, "personal");
  assert.equal(result.revision, 4);
  assert.equal(result.operationCount, 0);
  assert.equal(result.householdId, "foyer-1");
  assert.equal(result.formatVersion, 2);
  assert.equal(result.metadataProtected, true);
  assert.equal(result.accountCount, 0);
});

test("v2 détecte la modification d'une valeur financière", async () => {
  const json = await createIntegrityExport({
    scope: "household", householdId: "foyer-1", revision: 7, state: householdState(),
  });
  await assert.rejects(verifyIntegrityExport(json.replace("2500", "9999")), /endommagée/);
});

test("v2 détecte la modification de la date, révision et origine", async () => {
  const json = await createIntegrityExport({
    scope: "household", householdId: "foyer-1", revision: 7, state: householdState(),
  });
  const original = JSON.parse(json) as Record<string, unknown>;
  for (const [key, value] of [
    ["createdAt", "2020-01-01T00:00:00.000Z"],
    ["revision", 8],
    ["householdId", "foyer-2"],
  ] as const) {
    await assert.rejects(verifyIntegrityExport(JSON.stringify({ ...original, [key]: value })), /endommagée/);
  }
});

test("reste compatible avec les anciennes sauvegardes v1", async () => {
  const payload = {
    scope: "household", householdId: "foyer-1", revision: 3, state: householdState(),
  };
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const contentHash = Array.from(new Uint8Array(digest), x => x.toString(16).padStart(2, "0")).join("");
  const legacy = JSON.stringify({
    format: "wimm-manual-backup", version: 1, createdAt: "2026-10-12T11:00:00.000Z",
    integrity: { algorithm: "SHA-256", contentHash }, ...payload,
  });
  const result = await verifyIntegrityExport(legacy);
  assert.equal(result.formatVersion, 1);
  assert.equal(result.metadataProtected, false);
  assert.equal(result.operationCount, 1);
});

test("rejette les formats invalides, structures incomplètes et champs réservés", async () => {
  await assert.rejects(verifyIntegrityExport("{}"), /pas une sauvegarde|inconnu/);
  await assert.rejects(createIntegrityExport({ format: "autre" }), /réservé/);
  const malformed = await createIntegrityExport({
    scope: "household", householdId: "foyer", revision: 1, state: { schema: 1, transactions: [], rules: [] },
  });
  await assert.rejects(verifyIntegrityExport(malformed), /incomplète/);
  const brokenPersonal = await createIntegrityExport({
    scope: "personal", householdId: "foyer", revision: 1,
    state: { ...personalState(), account: "not-an-account" },
  });
  await assert.rejects(verifyIntegrityExport(brokenPersonal), /Compte personnel invalide/);
});

test("bloque les fichiers trop volumineux", async () => {
  await assert.rejects(verifyIntegrityExport(" ".repeat(MAX_BACKUP_SIZE + 1)), /20 Mo/);
});

test("vérifie aussi un export professionnel sans import automatique", async () => {
  const json = await createIntegrityExport({
    scope: "professional", businessId: "entreprise-1",
    data: { clients: [], invoices: [], transactions: [{ amount: 12000 }] },
  });
  const result = await verifyIntegrityExport(json);
  assert.equal(result.scope, "professional");
  assert.equal(result.operationCount, 1);
});
