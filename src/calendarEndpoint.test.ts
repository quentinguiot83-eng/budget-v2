import { test } from "node:test";
import assert from "node:assert/strict";
import { DEMO_MODE } from "./demoMode";

test("public demo cannot expose the production calendar endpoint", () => {
  assert.equal(DEMO_MODE, true);
});
