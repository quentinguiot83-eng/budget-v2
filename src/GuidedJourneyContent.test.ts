import test from "node:test";
import assert from "node:assert/strict";
import { JOURNEY_BRIEF, JOURNEY_STEPS, journeySteps } from "./GuidedJourneyContent";

test("la visite est courte : cinq étapes, toutes sur l'accueil", () => {
  assert.equal(JOURNEY_STEPS.length, 5);
  assert.equal(new Set(JOURNEY_STEPS.map(x => x.id)).size, 5);
  for (const x of JOURNEY_STEPS) {
    assert.equal(x.route, "home");
    assert.ok(x.title && x.description.length > 40 && x.action.length > 10 && x.target);
    assert.ok(/^[a-z-]+$/.test(x.id));
  }
  assert.deepEqual(journeySteps(true), journeySteps(false));
});

test("ordre : solde, onglets, bouton +, premiers pas, aide", () => {
  assert.deepEqual(JOURNEY_STEPS.map(x => x.id), ["home-balance", "menu", "add-button", "first-steps", "help"]);
});

test("chaque étape a un résumé bref", () => {
  for (const step of JOURNEY_STEPS) {
    const copy = JOURNEY_BRIEF[step.id];
    assert.ok(copy, step.id);
    assert.ok(copy.length <= 160 && copy.length >= 30, step.id);
  }
});
