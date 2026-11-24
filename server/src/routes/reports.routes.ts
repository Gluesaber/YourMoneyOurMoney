import { Router } from "express";
import { z } from "zod";
import { getPrisma } from "../prisma.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { calendarDate, fromDateOnly, toDateOnly } from "../lib/validation.js";
import { requireRole, requireUser } from "../middleware/auth.js";
import {
  averagePerDay,
  categoryBreakdown,
  monthCount,
  monthlyTotals,
  type ReportLineType,
} from "../services/reports.js";

// F-11 Financial reports — docs/sprints/sprint-3/F-11-reports.md §2–§3. Income and expense come only from INCOME /
// EXPENSE lines by transaction date, so transfers, loans, repayments and opening balances never count (BR-08).
export const reportsRouter = Router();

reportsRouter.use(requireUser, requireRole("USER"));

const MAX_MONTHS = 24;
const MAX_DAYS = 366;
const DAY_MS = 24 * 60 * 60 * 1000;
const REPORT_TYPES: ReportLineType[] = ["INCOME", "EXPENSE"];

// R1: a real month from 2000-01 to 2099-12. Same-length YYYY-MM strings compare correctly as text.
const yearMonth = z
  .string()
  .regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Use the format YYYY-MM.")
  .refine((s) => s >= "2000-01" && s <= "2099-12", "Use a month from 2000 to 2099.");

const monthlyQuery = z
  .object({ from: yearMonth, to: yearMonth })
  .refine((q) => q.from <= q.to, { message: "The first month must not be after the last.", path: ["from"] })
  .refine((q) => q.from > q.to || monthCount(q.from, q.to) <= MAX_MONTHS, {
    message: `Use at most ${MAX_MONTHS} months.`,
    path: ["to"],
  });

// R2: inclusive day count of a valid date range.
const daysBetween = (start: string, end: string) =>
  Math.round((fromDateOnly(end).getTime() - fromDateOnly(start).getTime()) / DAY_MS) + 1;

const breakdownQuery = z
  .object({
    startDate: calendarDate,
    endDate: calendarDate,
    type: z.enum(["EXPENSE", "INCOME"]).default("EXPENSE"),
  })
  .refine((q) => q.startDate <= q.endDate, {
    message: "The start date must not be after the end date.",
    path: ["startDate"],
  })
  .refine((q) => q.startDate > q.endDate || daysBetween(q.startDate, q.endDate) <= MAX_DAYS, {
    message: `Use at most ${MAX_DAYS} days.`,
    path: ["endDate"],
  });

// "2026-12" → the first day of the next month, as the exclusive end of the range.
function monthEndExclusive(month: string): Date {
  const [y, m] = month.split("-").map(Number);
  return new Date(Date.UTC(y, m, 1));
}

// The user's INCOME / EXPENSE lines whose transaction date is in [gte, lt). Only the user's own rows (BR-04).
function reportLines(userId: number, types: ReportLineType[], gte: Date, lt: Date) {
  return getPrisma().transactionLine.findMany({
    where: { userId, account: { type: { in: types } }, transaction: { date: { gte, lt } } },
    select: {
      accountId: true,
      amount: true,
      account: { select: { name: true, type: true } },
      transaction: { select: { date: true } },
    },
  });
}

reportsRouter.get(
  "/monthly",
  asyncHandler(async (req, res) => {
    const { from, to } = monthlyQuery.parse(req.query);
    const rows = await reportLines(
      req.user!.id,
      REPORT_TYPES,
      fromDateOnly(`${from}-01`),
      monthEndExclusive(to),
    );
    const lines = rows.map((r) => ({
      date: toDateOnly(r.transaction.date),
      type: r.account.type as ReportLineType,
      amount: r.amount,
    }));
    res.json(monthlyTotals(lines, from, to));
  }),
);

reportsRouter.get(
  "/category-breakdown",
  asyncHandler(async (req, res) => {
    const { startDate, endDate, type } = breakdownQuery.parse(req.query);
    const rows = await reportLines(
      req.user!.id,
      [type],
      fromDateOnly(startDate),
      new Date(fromDateOnly(endDate).getTime() + DAY_MS),
    );

    const byAccount = new Map<number, { accountId: number; name: string; total: number }>();
    for (const r of rows) {
      const entry = byAccount.get(r.accountId) ?? { accountId: r.accountId, name: r.account.name, total: 0 };
      entry.total += r.amount;
      byAccount.set(r.accountId, entry);
    }
    const categories = categoryBreakdown([...byAccount.values()]);
    const total = categories.reduce((s, c) => s + c.total, 0);
    const days = daysBetween(startDate, endDate);
    res.json({ type, total, days, averageDaily: averagePerDay(total, days), categories });
  }),
);
