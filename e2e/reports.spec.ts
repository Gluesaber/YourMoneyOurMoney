import { expect, test } from "@playwright/test";
import { loginAs, recordTransaction } from "./helpers.js";
import { resetE2eDatabase } from "./db.js";

// F-11 §7 T-REP-E2E-01 (docs/sprints/sprint-3/F-11-reports.md, AC-REP-05): after the Sprint 1 money journey
// alice opens Reports for November 2026. The E2E database is reset before this file runs.

test.describe("F-11 reports", () => {
  test.beforeAll(resetE2eDatabase);

  test("T-REP-E2E-01: alice sees November income 30,000.00, expense 1,500.00 and Dining 60.00 %", async ({
    page,
  }) => {
    await loginAs(page, "alice");
    await recordTransaction(page, "RECEIVE", {
      source: "Bank",
      date: "2026-11-02",
      total: "30,000",
      lines: [["Salary", "30,000"]],
    });
    await recordTransaction(page, "PAYMENT", {
      source: "Credit Card",
      date: "2026-11-03",
      total: "1,500",
      lines: [
        ["Dining", "900"],
        ["Groceries", "600"],
      ],
    });
    // The card repayment is a transfer of debt, never an expense (BR-08).
    await recordTransaction(page, "PAYMENT", {
      source: "Bank",
      date: "2026-11-04",
      total: "1,500",
      lines: [["Credit Card", "1,500"]],
    });

    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Reports" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Reports" })).toBeVisible();

    await page.goto("/reports?from=2026-11&to=2026-11&startDate=2026-11-01&endDate=2026-11-30");
    const monthly = page.getByRole("table", { name: "Income and expense by month" });
    await expect(monthly.getByRole("row", { name: /^2026-11\b/ })).toContainText("30,000.00");
    await expect(monthly.getByRole("row", { name: /^2026-11\b/ })).toContainText("1,500.00");
    const breakdown = page.getByRole("table", { name: "Expense by category" });
    await expect(breakdown.getByRole("row", { name: /^Dining\b/ })).toContainText("60.00 %");
    await expect(breakdown.getByRole("row", { name: /^Groceries\b/ })).toContainText("40.00 %");
  });
});
