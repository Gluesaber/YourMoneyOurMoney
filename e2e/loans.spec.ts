import { expect, test } from "@playwright/test";
import { dashboardRow, loginAs, recordTransaction } from "./helpers.js";
import { resetE2eDatabase } from "./db.js";

// F-08 §7 T-DEBT-E2E-01 (docs/sprints/sprint-2/F-08-loans.md, AC-DEBT-07):
// alice runs the Sprint 1 base journey, creates "Ben" (LOAN_GIVEN), lends 5,000.00,
// records 2,000.00 repaid, and sees Ben 3,000.00 on /loans and Bank 35,500.00 on /dashboard.
test.describe("F-08 lending and borrowing", () => {
  test.beforeAll(resetE2eDatabase);

  test("T-DEBT-E2E-01: alice creates Ben, lends 5,000.00, records 2,000.00 repaid; Loans shows Ben 3,000.00 and Dashboard shows Bank 35,500.00", async ({
    page,
  }) => {
    await loginAs(page, "alice");

    // Set Bank opening balance 10,000.00
    await page.getByRole("link", { name: "Set opening balance for Bank" }).click();
    await page.getByLabel("Amount (THB)").fill("10,000.00");
    await page.getByLabel("Date").fill("2026-11-01");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Salary 30,000.00 -> Bank 40,000.00
    await recordTransaction(page, "RECEIVE", {
      source: "Bank",
      date: "2026-11-02",
      total: "30,000",
      lines: [["Salary", "30,000"]],
    });

    // Credit Card 1,500.00 + repay from Bank -> Bank 38,500.00, income 30,000.00, expense 1,500.00
    await recordTransaction(page, "PAYMENT", {
      source: "Credit Card",
      date: "2026-11-03",
      total: "1,500",
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

    // Navigate from Dashboard to Loans, create "Ben" (LOAN_GIVEN)
    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Loans" }).click();
    await expect(page).toHaveURL(/\/loans$/);
    await expect(page.getByRole("heading", { level: 1, name: "Loans" })).toBeVisible();

    await page.getByRole("link", { name: "Add a loan account" }).first().click();
    await expect(page).toHaveURL(/\/accounts\/new\?type=LOAN_GIVEN$/);
    await expect(page.getByLabel("Type")).toHaveValue("LOAN_GIVEN");
    await page.getByLabel("Name").fill("Ben");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/accounts$/);

    // Return to /loans and Lend 5,000.00 to Ben
    await page.goto("/loans");
    const benRow = page.getByRole("row", { name: /^Ben\b/ });
    await expect(benRow).toBeVisible();
    await benRow.getByRole("link", { name: "Lend more" }).click();

    await expect(page.getByRole("heading", { level: 1, name: "Lend to Ben" })).toBeVisible();
    const cashSelect = page.getByLabel("Cash account");
    const bankValue = await cashSelect.locator("option", { hasText: /^Bank\b/ }).getAttribute("value");
    await cashSelect.selectOption(bankValue!);
    await page.getByLabel("Amount (THB)").fill("5,000.00");
    await page.getByLabel("Date").fill("2026-11-22");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(/\/loans$/);
    await expect(page.getByRole("row", { name: /^Ben\b/ })).toContainText("5,000.00");

    // Ben repays 2,000.00
    await page
      .getByRole("row", { name: /^Ben\b/ })
      .getByRole("link", { name: "Get repaid" })
      .click();
    await expect(page.getByRole("heading", { level: 1, name: "Get repaid by Ben" })).toBeVisible();
    const cashSelect2 = page.getByLabel("Cash account");
    const bankValue2 = await cashSelect2.locator("option", { hasText: /^Bank\b/ }).getAttribute("value");
    await cashSelect2.selectOption(bankValue2!);
    await page.getByLabel("Amount (THB)").fill("2,000.00");
    await page.getByLabel("Date").fill("2026-11-23");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(/\/loans$/);
    await expect(page.getByRole("row", { name: /^Ben\b/ })).toContainText("3,000.00");

    // Verify Dashboard totals: Bank 35,500.00, Ben 3,000.00, income 30,000.00, expense 1,500.00
    await page.goto("/dashboard");
    await expect(dashboardRow(page, "Bank")).toContainText("35,500.00");
    await expect(dashboardRow(page, "Ben")).toContainText("3,000.00");
    await expect(dashboardRow(page, "Total income")).toContainText("30,000.00");
    await expect(dashboardRow(page, "Total expense")).toContainText("1,500.00");
  });
});
