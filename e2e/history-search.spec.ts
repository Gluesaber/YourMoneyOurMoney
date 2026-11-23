import { expect, test } from "@playwright/test";
import { loginAs, recordTransaction } from "./helpers.js";
import { resetE2eDatabase } from "./db.js";

// F-09 §7 T-HST-E2E-01 (docs/sprints/sprint-2/F-09-search-filter.md, AC-HST-05, AC-HST-08):
// alice records transactions from the demo journey, opens History, filters Account = Dining,
// confirms only the card purchase is listed, reloads to verify URL persistence, and clears.
test.describe("F-09 transaction search, filtering and sorting", () => {
  test.beforeAll(resetE2eDatabase);

  test("T-HST-E2E-01: alice after demo journey filters Account = Dining and sees only the card purchase", async ({
    page,
  }) => {
    await loginAs(page, "alice");

    // Record the three Sprint 1 demo transactions
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
      note: "Dinner and groceries",
      lines: [
        ["Dining", "900"],
        ["Groceries", "600"],
      ],
    });
    await recordTransaction(page, "PAYMENT", {
      source: "Bank",
      date: "2026-11-04",
      total: "1,500",
      lines: [["Credit Card", "1,500"]],
    });

    await page.goto("/transactions");
    const rows = page.getByRole("row").filter({ has: page.getByRole("link", { name: "Details" }) });
    await expect(rows).toHaveCount(3);

    // Filter Account = Dining -> only the card purchase appears and URL updates
    await page.getByLabel("Account").selectOption({ label: "Dining" });
    await expect(page).toHaveURL(/accountId=\d+/);
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0)).toContainText("2026-11-03");
    await expect(rows.nth(0)).toContainText("Dining, Groceries");

    // Reloading keeps URL filters active
    await page.reload();
    await expect(rows).toHaveCount(1);
    await expect(rows.nth(0)).toContainText("2026-11-03");

    // Clear restores all 3 rows and removes query params
    await page.getByRole("button", { name: "Clear" }).click();
    await expect(page).toHaveURL(/\/transactions$/);
    await expect(rows).toHaveCount(3);
  });
});
