/** Keep past months focused on their recorded balance sheet, not live to-dos. */
export function getHomeMonthSections(selectedMonth: string, currentMonth: string) {
  const isPastMonth = selectedMonth < currentMonth;
  return {
    showAccountBalances: true,
    showPersonalAccount: true,
    showMonthlyReview: isPastMonth,
    showInteractiveDashboard: !isPastMonth,
  };
}
