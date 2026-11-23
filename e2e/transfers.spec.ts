import { expect, test, type Locator } from "@playwright/test";
import { dashboardRow, loginAs, recordTransaction } from "./helpers.js";
import { resetE2eDatabase } from "./db.js";

// F-07 §7 T-TX-E2E-02 (docs/sprints/sprint-2/F-07-transfers.md): after receiving a salary, alice adds a Wallet
// (F-06) and moves 2,000.00 into it with the Transfer form. The E2E database is reset before this file.

// Transfer options read "<name> · <balance>", so pick the option by the account name it starts with.
async function selectAccount(select: Locator, name: string) {
  const value = await select.locator("option", { hasText: new RegExp(`^${name}\\b`) }).getAttribute("value");
  await select.selectOption(value!);
}

test.describe("F-07 transfers", () => {
  test.beforeAll(resetE2eDatabase);

  test("T-TX-E2E-02: alice transfers 2,000.00 Bank → Wallet; balances move, income and expense do not", async ({
    page,
  }) => {
    await loginAs(page, "alice");
    await recordTransaction(page, "RECEIVE", {
      source: "Bank",
      date: "2026-11-02",
      total: "30,000",
      lines: [["Salary", "30,000"]],
    });

    // With one cash account there is nothing to transfer between.
    await page.goto("/dashboard");
    await expect(page.getByRole("link", { name: "Transfer" })).toHaveCount(0);
    await expect(page.getByText("Add a second cash account to transfer")).toBeVisible();

    await page.goto("/accounts/new");
    await page.getByLabel("Name").fill("Wallet");
    await page.getByLabel("Type").selectOption("CASH");
    await page.getByLabel("Subtype").selectOption("WALLET");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/accounts$/);

    await page.goto("/dashboard");
    await page.getByRole("link", { name: "Transfer" }).click();
    await expect(
      page.getByRole("heading", { level: 1, name: "Transfer between cash accounts" }),
    ).toBeVisible();
    await selectAccount(page.getByLabel("From"), "Bank");
    await selectAccount(page.getByLabel("To"), "Wallet");
    await page.getByLabel("Amount (THB)").fill("2,000");
    await page.getByLabel("Date").fill("2026-11-22");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(/\/transactions\/\d+$/);
    await expect(page.getByRole("heading", { level: 1, name: "Transfer: Bank → Wallet" })).toBeVisible();

    await page.goto("/dashboard");
    await expect(dashboardRow(page, "Bank")).toContainText("28,000.00");
    await expect(dashboardRow(page, "Wallet")).toContainText("2,000.00");
    await expect(dashboardRow(page, "Total income")).toContainText("30,000.00");
    await expect(dashboardRow(page, "Total expense")).toContainText("0.00");
  });
});
