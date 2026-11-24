// F-11 Financial reports — docs/sprints/sprint-3/F-11-reports.md §2.1. Plain functions only (no Prisma, no Express),
// so the money and rounding rules can be unit-tested on their own. All amounts are integer satang (BR-03).

export type ReportLineType = "INCOME" | "EXPENSE";

export interface ReportLine {
  date: string; // YYYY-MM-DD, the transaction date
  type: ReportLineType;
  amount: number;
}

export interface MonthRow {
  month: string; // YYYY-MM
  income: number;
  expense: number;
  net: number;
}

// "2026-11" → "2026-12", "2026-12" → "2027-01".
function nextMonth(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

// Inclusive number of calendar months from `from` to `to` (both YYYY-MM).
export function monthCount(from: string, to: string): number {
  const [fy, fm] = from.split("-").map(Number);
  const [ty, tm] = to.split("-").map(Number);
  return (ty - fy) * 12 + (tm - fm) + 1;
}

// R7: one row per month from `from` to `to`, months without data are zero rows. Lines outside the range are ignored.
export function monthlyTotals(lines: ReportLine[], from: string, to: string) {
  const rows = new Map<string, MonthRow>();
  for (let m = from; m <= to; m = nextMonth(m)) rows.set(m, { month: m, income: 0, expense: 0, net: 0 });

  for (const line of lines) {
    const row = rows.get(line.date.slice(0, 7));
    if (!row) continue;
    if (line.type === "INCOME") row.income += line.amount;
    else row.expense += line.amount;
  }

  const months = [...rows.values()].map((r) => ({ ...r, net: r.income - r.expense }));
  const income = months.reduce((s, r) => s + r.income, 0);
  const expense = months.reduce((s, r) => s + r.expense, 0);
  return { months, totals: { income, expense, net: income - expense } };
}

// R5: each value's share of the total in basis points (10,000 = 100 %), integers that add up to exactly 10,000 when
// the total is above 0. Largest-remainder rounding; equal remainders go to the earlier value (the caller passes the
// values in output order). Integer arithmetic only.
export function shareBasisPoints(values: number[]): number[] {
  const total = values.reduce((s, v) => s + v, 0);
  if (total <= 0) return values.map(() => 0);

  const parts = values.map((v, index) => {
    const scaled = v * 10_000;
    return { index, floor: Math.floor(scaled / total), remainder: scaled % total };
  });
  let left = 10_000 - parts.reduce((s, p) => s + p.floor, 0);
  const byRemainder = [...parts].sort((a, b) => b.remainder - a.remainder || a.index - b.index);
  for (const p of byRemainder) {
    if (left === 0) break;
    p.floor += 1;
    left -= 1;
  }
  return parts.map((p) => p.floor);
}

// R6: total ÷ days, rounded half up to the nearest satang. Integer arithmetic: (2·total + days) ÷ (2·days).
export function averagePerDay(total: number, days: number): number {
  return Math.floor((2 * total + days) / (2 * days));
}

export interface CategoryTotal {
  accountId: number;
  name: string;
  total: number;
}

// Categories with a non-zero total, largest first, ties by name, each with its basis-point share (R5).
export function categoryBreakdown(categories: CategoryTotal[]) {
  const ordered = categories
    .filter((c) => c.total !== 0)
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
  const shares = shareBasisPoints(ordered.map((c) => c.total));
  return ordered.map((c, i) => ({ ...c, share: shares[i] }));
}
