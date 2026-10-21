export type ProExpenseFrequency = "monthly" | "quarterly" | "yearly";

/** Calcule une échéance sans décalage de fuseau horaire ni dérive en février. */
export function recurringExpenseDueDate(
  startDate: string,
  frequency: ProExpenseFrequency,
  month: string,
  endDate?: string | null,
): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}$/.test(month)) return null;
  const [startYear, startMonth, startDay] = startDate.split("-").map(Number);
  const [year, targetMonth] = month.split("-").map(Number);
  if (startMonth < 1 || startMonth > 12 || targetMonth < 1 || targetMonth > 12 || startDay < 1 || startDay > 31) return null;
  const months = (year - startYear) * 12 + targetMonth - startMonth;
  const interval = frequency === "yearly" ? 12 : frequency === "quarterly" ? 3 : 1;
  if (months < 0 || months % interval !== 0) return null;
  const lastDay = new Date(Date.UTC(year, targetMonth, 0)).getUTCDate();
  const dueDate = `${month}-${String(Math.min(lastDay, startDay)).padStart(2, "0")}`;
  if (dueDate < startDate || (endDate && dueDate > endDate)) return null;
  return dueDate;
}
