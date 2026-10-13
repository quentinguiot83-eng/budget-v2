import { test } from "node:test";
import assert from "node:assert/strict";
import { tutorialSelectorPriority } from "./tutorialTargeting";
import { TUTORIAL_CHAPTERS } from "./TutorialContent";

test("tour selectors are evaluated in explicit priority, not DOM order", () => {
  assert.deepEqual(
    tutorialSelectorPriority(".specific-action, .entire-card"),
    [".specific-action", ".entire-card"]
  );
});

test("tour steps never fall back to an unrelated screen while explaining actions", () => {
  const forbidden = [".projects-type-switch, .trips-top-actions", ".home-budget-top-list",
    ".home-budget-summary", ".prosuite-metrics, .prosuite-main"];
  for (const chapter of TUTORIAL_CHAPTERS) {
    for (const step of chapter.steps) {
      assert.ok(step.title && step.text && step.target, chapter.id);
      for (const selector of forbidden) assert.ok(
        !step.target.includes(selector), chapter.id + ": " + step.title);
    }
  }
});

test("every interactive tutorial step uses a specific CSS target", () => {
  for (const chapter of TUTORIAL_CHAPTERS) {
    for (const step of chapter.steps.filter(s => s.tap)) {
      assert.ok(step.target.startsWith(".") || step.target.startsWith("["),
        chapter.id + " -> " + step.title);
      assert.ok(step.title.length > 4);
    }
  }
});
