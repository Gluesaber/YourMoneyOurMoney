// F-09 §2.1 & §5 Quick date range helpers using the browser's local calendar date (YYYY-MM-DD).
export interface DateRange {
  startDate: string;
  endDate: string;
}

function formatLocalDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function monthRange(year: number, monthIndex: number): DateRange {
  const start = new Date(year, monthIndex, 1);
  const end = new Date(year, monthIndex + 1, 0);
  return { startDate: formatLocalDate(start), endDate: formatLocalDate(end) };
}

export function thisMonthRange(today: Date = new Date()): DateRange {
  return monthRange(today.getFullYear(), today.getMonth());
}

export function lastMonthRange(today: Date = new Date()): DateRange {
  const prev = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  return monthRange(prev.getFullYear(), prev.getMonth());
}

export function thisYearRange(today: Date = new Date()): DateRange {
  const year = today.getFullYear();
  return { startDate: `${year}-01-01`, endDate: `${year}-12-31` };
}
