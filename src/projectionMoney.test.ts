import assert from "node:assert/strict";
import test from "node:test";
import { projectionMoney } from "./projectionMoney";

const spaces = (value: string) => value.replace(/\s/g, " ");

test("projection amounts are rounded to the nearest whole euro", () => {
  assert.equal(spaces(projectionMoney(123456)), "1 235 €");
  assert.equal(spaces(projectionMoney(123449)), "1 234 €");
  assert.equal(spaces(projectionMoney(123450)), "1 235 €");
  assert.equal(spaces(projectionMoney(99)), "1 €");
  assert.equal(spaces(projectionMoney(49)), "0 €");
  assert.equal(spaces(projectionMoney(-149)), "-1 €");
  assert.equal(spaces(projectionMoney(-150)), "-2 €");
  assert.equal(spaces(projectionMoney(-49)), "0 €");
});

test("formatting does not change the underlying amount in cents", () => {
  const cents = 123456;
  projectionMoney(cents);
  assert.equal(cents, 123456);
});
