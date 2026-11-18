import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { DbError, friendlyDbMessage, isConflict } from "./dbMessages";

const sqlFiles = ["supabase", "supabase/migrations"].flatMap(dir =>
  readdirSync(dir).filter(f => f.endsWith(".sql")).map(f => dir + "/" + f));
const raised = [...new Set(sqlFiles.flatMap(f =>
  [...readFileSync(f, "utf8").matchAll(/raise exception '([^']*)'/g)].map(m => m[1])))];

test("aucun message de la base n'arrive au « vous » à l'écran", () => {
  const vous = /\b(vous|votre|vos)\b|\b[A-ZÉ][a-zéèêç]+ez\b/;
  const left = raised.filter(m => vous.test(m)).filter(m => vous.test(friendlyDbMessage(m)));
  assert.deepEqual(left, []);
});

test("un message inconnu reste tel quel", () => {
  assert.equal(friendlyDbMessage("Montant invalide"), "Montant invalide");
});

test("un conflit reste reconnu après reformulation", () => {
  const e = new DbError("CONFLICT: données modifiées par un autre appareil. Actualisez avant de réessayer.");
  assert.ok(isConflict(e));
  assert.ok(!e.message.includes("CONFLICT"));
  assert.match(e.message, /réessaie/);
  assert.ok(!isConflict(new DbError("Choisissez un client")));
  assert.ok(isConflict(new Error("CONFLICT: actualisez avant de réessayer")));
});
