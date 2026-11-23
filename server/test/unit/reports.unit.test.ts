import { describe, expect, it } from "vitest";
import { averagePerDay, monthlyTotals, shareBasisPoints } from "../../src/services/reports.js";

// F-11 reports — pure functions of docs/sprints/sprint-3/F-11-reports.md §2.1 (R5, R6, R7).

describe("monthlyTotals (T-REP-UNIT-01)", () => {
  // §1.1: salary in Nov, the card purchase split over Dining + Groceries, a Telecom bill in Jan.
  const LINES = [
    { date: "2026-11-02", type: "INCOME" as const, amount: 3_000_000 },
    { date: "2026-11-03", type: "EXPENSE" as const, amount: 90_000 },
    { date: "2026-11-03", type: "EXPENSE" as const, amount: 60_000 },
    { date: "2027-01-05", type: "EXPENSE" as const, amount: 30_000 },
  ];

  it("T-REP-UNIT-01: totals per month, an empty month in the middle is a zero row, and overall totals", () => {
    expect(monthlyTotals(LINES, "2026-11", "2027-01")).toEqual({
      months: [
        { month: "2026-11", income: 3_000_000, expense: 150_000, net: 2_850_000 },
        { month: "2026-12", income: 0, expense: 0, net: 0 },
        { month: "2027-01", income: 0, expense: 30_000, net: -30_000 },
      ],
      totals: { income: 3_000_000, expense: 180_000, net: 2_820_000 },
    });
  });

  it("T-REP-UNIT-01: lines outside the range are ignored; one month with no data is all zeros", () => {
    expect(monthlyTotals(LINES, "2026-12", "2026-12")).toEqual({
      months: [{ month: "2026-12", income: 0, expense: 0, net: 0 }],
      totals: { income: 0, expense: 0, net: 0 },
    });
  });
});

describe("shareBasisPoints (T-REP-UNIT-02)", () => {
  it.each([
    [
      [1, 1, 1],
      [3_334, 3_333, 3_333],
    ],
    [
      [90_000, 60_000],
      [6_000, 4_000],
    ],
    [[0], [0]],
    [[1], [10_000]],
    [
      [2, 1],
      [6_667, 3_333],
    ],
  ])("T-REP-UNIT-02: %j → %j", (values, expected) => {
    expect(shareBasisPoints(values)).toEqual(expected);
  });

  it("T-REP-UNIT-02: shares always add up to exactly 10,000 when the total is above 0", () => {
    for (const values of [
      [7, 7, 7, 7, 7, 7],
      [1, 2, 3, 4, 5, 6, 7],
      [999_999, 1, 1],
      [33, 33, 34],
    ]) {
      expect(shareBasisPoints(values).reduce((s, v) => s + v, 0)).toBe(10_000);
    }
  });
});

describe("averagePerDay (T-REP-UNIT-03)", () => {
  it.each([
    [150_000, 30, 5_000],
    [100, 3, 33],
    [5, 2, 3],
    [3_000_000, 30, 100_000],
    [0, 30, 0],
  ])("T-REP-UNIT-03: averagePerDay(%d, %d) = %d (half up, satang)", (total, days, expected) => {
    expect(averagePerDay(total, days)).toBe(expected);
  });
});
