import { test } from "node:test";
import assert from "node:assert/strict";
import { tutorialSelectorPriority } from "./tutorialTargeting";
import { JOURNEY_STEPS } from "./GuidedJourneyContent";

test("tour selectors are evaluated in explicit priority, not DOM order", () => {
  assert.deepEqual(
    tutorialSelectorPriority(".specific-action, .entire-card"),
    [".specific-action", ".entire-card"]
  );
});

test("chaque étape de la visite vise un bloc précis", () => {
  for (const step of JOURNEY_STEPS) {
    for (const selector of tutorialSelectorPriority(step.target))
      assert.ok(selector.startsWith(".") || selector.startsWith("["), step.id + " -> " + selector);
  }
});
