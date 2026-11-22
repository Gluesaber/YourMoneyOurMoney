import { describe, expect, it } from "vitest";
import { lastMonthRange, thisMonthRange, thisYearRange } from "../src/lib/dateRanges.js";

// F-09 §2.1 & §7 T-HST-UNIT-02 — docs/sprints/sprint-2/F-09-search-filter.md.
describe("dateRanges (T-HST-UNIT-02)", () => {
  it("computes local ranges on 2026-01-15 including year rollover on lastMonthRange", () => {
    const jan15 = new Date(2026, 0, 15, 12, 0, 0);
    expect(thisMonthRange(jan15)).toEqual({ startDate: "2026-01-01", endDate: "2026-01-31" });
    expect(lastMonthRange(jan15)).toEqual({ startDate: "2025-12-01", endDate: "2025-12-31" });
    expect(thisYearRange(jan15)).toEqual({ startDate: "2026-01-01", endDate: "2026-12-31" });
  });

  it("computes local ranges on 2026-12-31", () => {
    const dec31 = new Date(2026, 11, 31, 23, 59, 0);
    expect(thisMonthRange(dec31)).toEqual({ startDate: "2026-12-01", endDate: "2026-12-31" });
    expect(lastMonthRange(dec31)).toEqual({ startDate: "2026-11-01", endDate: "2026-11-30" });
    expect(thisYearRange(dec31)).toEqual({ startDate: "2026-01-01", endDate: "2026-12-31" });
  });

  it("handles February in leap and non-leap years", () => {
    expect(lastMonthRange(new Date(2024, 2, 10))).toEqual({ startDate: "2024-02-01", endDate: "2024-02-29" });
    expect(lastMonthRange(new Date(2026, 2, 10))).toEqual({ startDate: "2026-02-01", endDate: "2026-02-28" });
  });
});
