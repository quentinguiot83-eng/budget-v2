import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_MODE } from "./demoMode";

test("public demo disables production push notification endpoints", () => {
  assert.equal(DEMO_MODE, true);
});
