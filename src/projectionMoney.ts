/** Format projection amounts (stored in cents) as whole euros for display only. */
const formatter = new Intl.NumberFormat("fr-FR", {
  style: "currency",
  currency: "EUR",
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export function projectionMoney(cents: number): string {
  const roundedEuros = Math.round(Math.abs(cents) / 100);
  return formatter.format(roundedEuros === 0 ? 0 : cents < 0 ? -roundedEuros : roundedEuros);
}
