import { screen, within } from "@testing-library/react";
import { afterEach } from "vitest";
import { mockApi, renderAt } from "./renderApp.js";

// F-11 §5 Reports page — docs/sprints/sprint-3/F-11-reports.md. T-REP-UI-01.
afterEach(() => vi.unstubAllGlobals());

const PERIOD = "/reports?from=2026-11&to=2026-12&startDate=2026-11-01&endDate=2026-11-30";
const MONTHLY_URL = "GET /api/reports/monthly?from=2026-11&to=2026-12";
const BREAKDOWN_URL =
  "GET /api/reports/category-breakdown?startDate=2026-11-01&endDate=2026-11-30&type=EXPENSE";

// The §3 response bodies.
const MONTHLY = {
  months: [
    { month: "2026-11", income: 3_000_000, expense: 150_000, net: 2_850_000 },
    { month: "2026-12", income: 0, expense: 30_000, net: -30_000 },
  ],
  totals: { income: 3_000_000, expense: 180_000, net: 2_820_000 },
};
const BREAKDOWN = {
  type: "EXPENSE",
  total: 150_000,
  days: 30,
  averageDaily: 5_000,
  categories: [
    { accountId: 5, name: "Dining", total: 90_000, share: 6_000 },
    { accountId: 6, name: "Groceries", total: 60_000, share: 4_000 },
  ],
};

const rowOf = (table: HTMLElement, name: string) =>
  within(table).getByRole("row", { name: new RegExp(`^${name}\\b`) });

describe("ReportsPage", () => {
  it("T-REP-UI-01: shows the monthly table in baht with negative net in red, and the breakdown with shares", async () => {
    const calls = mockApi({
      [MONTHLY_URL]: { body: MONTHLY },
      [BREAKDOWN_URL]: { body: BREAKDOWN },
    });
    renderAt(PERIOD);

    expect(await screen.findByRole("heading", { level: 1, name: "Reports" })).toBeInTheDocument();

    const monthly = await screen.findByRole("table", { name: "Income and expense by month" });
    expect(rowOf(monthly, "2026-11")).toHaveTextContent(/30,000\.00.*1,500\.00.*28,500\.00/);
    const december = rowOf(monthly, "2026-12");
    expect(december).toHaveTextContent(/0\.00.*300\.00.*-300\.00/);
    expect(within(december).getByText("-300.00")).toHaveClass("text-danger");
    expect(rowOf(monthly, "Total")).toHaveTextContent(/30,000\.00.*1,800\.00.*28,200\.00/);

    const breakdown = await screen.findByRole("table", { name: "Expense by category" });
    expect(rowOf(breakdown, "Dining")).toHaveTextContent(/900\.00.*60\.00 %/);
    expect(rowOf(breakdown, "Groceries")).toHaveTextContent(/600\.00.*40\.00 %/);
    expect(screen.getByText(/Average per day/)).toHaveTextContent("50.00");

    // The period comes from the URL (F-11 §5) and is sent to the API as it is.
    expect(calls.map((c) => `${c.method} ${c.path}`)).toEqual(
      expect.arrayContaining([MONTHLY_URL, BREAKDOWN_URL]),
    );
  });

  it("T-REP-UI-01: an empty period shows a friendly message instead of empty tables", async () => {
    mockApi({
      [MONTHLY_URL]: {
        body: {
          months: [
            { month: "2026-11", income: 0, expense: 0, net: 0 },
            { month: "2026-12", income: 0, expense: 0, net: 0 },
          ],
          totals: { income: 0, expense: 0, net: 0 },
        },
      },
      [BREAKDOWN_URL]: { body: { type: "EXPENSE", total: 0, days: 30, averageDaily: 0, categories: [] } },
    });
    renderAt(PERIOD);

    expect(await screen.findAllByText("No income or expense in this period.")).not.toHaveLength(0);
    expect(screen.queryByRole("table", { name: "Expense by category" })).not.toBeInTheDocument();
  });

  it("T-REP-UI-01: a server 400 is shown in an alert and the period controls keep their values", async () => {
    mockApi({
      [MONTHLY_URL]: {
        status: 400,
        body: { error: { code: "VALIDATION_ERROR", message: "Use at most 24 months." } },
      },
      [BREAKDOWN_URL]: { body: BREAKDOWN },
    });
    renderAt(PERIOD);

    expect(await screen.findByRole("alert")).toHaveTextContent("Use at most 24 months.");
    expect(screen.getByLabelText("From month")).toHaveValue("2026-11");
    expect(screen.getByLabelText("To month")).toHaveValue("2026-12");
  });
});
