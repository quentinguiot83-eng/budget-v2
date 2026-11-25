import { test } from "node:test";
import assert from "node:assert/strict";
import { proSetupNeeded, proSetupProfile, type ProSetupActivity } from "./proSetup";

const base: ProSetupActivity = {
  businessName: "  Quentin Photo ", legalStatus: "micro", activityType: "service",
  liberatoire: false, frequency: "monthly", contributionRate: 0, taxRate: 0,
};

test("démarrage Pro : affiché seulement pour une entreprise vierge", () => {
  const fresh = { profile: { contributionRate: 0, taxRate: 0 }, transactions: [], invoices: [] };
  assert.equal(proSetupNeeded(fresh), true);
  assert.equal(proSetupNeeded({ ...fresh, profile: { contributionRate: 21.2, taxRate: 0 } }), false);
  assert.equal(proSetupNeeded({ ...fresh, profile: { contributionRate: 0, taxRate: 2 } }), false);
  // Un compte déjà utilisé n'est jamais interrompu, même sans taux.
  assert.equal(proSetupNeeded({ ...fresh, transactions: [{}] }), false);
  assert.equal(proSetupNeeded({ ...fresh, invoices: [{}] }), false);
});

test("démarrage Pro : micro-entreprise avec taux indicatifs", () => {
  const r = proSetupProfile(base);
  assert.deepEqual(r.profile, {
    businessName: "Quentin Photo", legalStatus: "micro", activityType: "service", contributionRate: 21.2, taxRate: 0,
  });
  assert.equal(r.taxMode, "none");
  assert.equal(r.frequency, "monthly");

  const lib = proSetupProfile({ ...base, activityType: "commerce", liberatoire: true, frequency: "quarterly" });
  assert.equal(lib.profile.contributionRate, 12.3);
  assert.equal(lib.profile.taxRate, 1);
  assert.equal(lib.taxMode, "liberatoire");
  assert.equal(lib.frequency, "quarterly");
  assert.equal(proSetupProfile({ ...base, activityType: "liberal" }).profile.contributionRate, 25.6);
});

test("démarrage Pro : autre statut avec taux saisis", () => {
  const r = proSetupProfile({ ...base, legalStatus: "other", contributionRate: 45, taxRate: 15 });
  assert.equal(r.profile.legalStatus, "other");
  assert.equal(r.profile.contributionRate, 45);
  assert.equal(r.profile.taxRate, 15);
  assert.equal(r.taxMode, "estimate");
  assert.throws(() => proSetupProfile({ ...base, legalStatus: "other" }), /au moins un taux/);
  assert.throws(() => proSetupProfile({ ...base, legalStatus: "other", contributionRate: 120 }), /entre 0 et 100/);
  assert.throws(() => proSetupProfile({ ...base, legalStatus: "other", contributionRate: Number.NaN }), /entre 0 et 100/);
});

test("démarrage Pro : nom obligatoire", () => {
  assert.throws(() => proSetupProfile({ ...base, businessName: "   " }), /nom/);
  assert.throws(() => proSetupProfile({ ...base, businessName: "x".repeat(161) }), /trop long/);
});
