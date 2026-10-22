import test from "node:test";
import assert from "node:assert/strict";
import { projectionChartSeries } from "./projectionSeries";

test("patrimony green line excludes travel and dotted line uses tax on the same non-travel base", () => {
  const [point] = projectionChartSeries([{
    date: "2026-10",
    current: 500_000,
    wealth: 2_000_000,
    wealthNet: 1_940_000,
    travel: 800_000,
  }]);
  assert.equal(point.patrimonyExcludingTravel, 2_500_000);
  assert.equal(point.patrimonyAfterTaxExcludingTravel, 2_440_000);
  assert.equal(point.patrimonyExcludingTravel - point.patrimonyAfterTaxExcludingTravel, 60_000);
});

test("travel funding never shifts the patrimony series", () => {
  const base = { current: 300_000, wealth: 1_000_000, wealthNet: 970_000 };
  const [first, second] = projectionChartSeries([{ ...base, travel: 0 }, { ...base, travel: 5_000_000 }]);
  assert.equal(first.patrimonyExcludingTravel, second.patrimonyExcludingTravel);
  assert.equal(first.patrimonyAfterTaxExcludingTravel, second.patrimonyAfterTaxExcludingTravel);
});

test("negative current account balances remain visible in projected patrimony", () => {
  const [point] = projectionChartSeries([{ current: -20_000, wealth: 100_000, wealthNet: 95_000, travel: 1_000_000 }]);
  assert.equal(point.patrimonyExcludingTravel, 80_000);
  assert.equal(point.patrimonyAfterTaxExcludingTravel, 75_000);
});
