import { test } from "node:test";
import assert from "node:assert/strict";
import { QUICK_TOUR_STEPS, TUTORIAL_CHAPTERS } from "./TutorialContent";

test("the tutorial covers eight core chapters and optional Pro", () => {
  assert.deepEqual(TUTORIAL_CHAPTERS.map(c => c.id),
    ["intro","home","budget","operations","wealth","trips","projection","settings","pro"]);
  assert.equal(QUICK_TOUR_STEPS.length,6);
  assert.ok(TUTORIAL_CHAPTERS.every(c => c.steps.length > 0));
});
test("guided steps target real UI elements and have short helpful copy", () => {
  for (const chapter of TUTORIAL_CHAPTERS)
    for (const st of chapter.steps) {
      assert.ok(st.route && st.target && st.title && st.text, chapter.id);
      assert.ok(st.text.length < 180, chapter.id+" has overly long text");
      assert.ok(st.target.startsWith(".") || st.target.startsWith("["), chapter.id);
      assert.ok(!st.demo || st.tap, chapter.id+" must require deliberate demonstration");
    }
});
test("tutorial demonstrates important actions without registering transactions", () => {
  const demos = TUTORIAL_CHAPTERS.flatMap(c => c.steps).filter(st => st.demo).map(st => st.demo);
  for (const id of ["category","expense","income","transfer","account","saving","trip","tripFunding","projectionProject"])
    assert.ok(demos.includes(id as typeof demos[number]), id);
});
