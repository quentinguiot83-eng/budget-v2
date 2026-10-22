/** Projection totals used by the wealth chart, excluding travel-dedicated accounts.
 * Values are in cents, as in the projection engine. Travel remains a separate series.
 * The net line applies only the tax assumptions configured on wealth accounts.
 */
export function projectionChartSeries<T extends {
  current: number;
  wealth: number;
  wealthNet: number;
  travel: number;
}>(points: readonly T[]) {
  return points.map(point => ({
    ...point,
    patrimonyExcludingTravel: point.current + point.wealth,
    patrimonyAfterTaxExcludingTravel: point.current + point.wealthNet,
  }));
}
