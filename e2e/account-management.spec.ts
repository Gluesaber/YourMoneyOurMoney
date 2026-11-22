import { expect, test } from "@playwright/test";
import { dashboardRow, loginAs, recordTransaction } from "./helpers.js";
import { resetE2eDatabase } from "./db.js";

// F-06 §7 T-ACC-E2E-02 (docs/sprints/sprint-2/F-06-account-management.md): a user creates a second cash
// account through the UI and uses it. The E2E database is reset and seeded before this file runs.

test.describe("F-06 account management", () => {
  test.beforeAll(resetE2eDatabase);

  test("T-ACC-E2E-02: alice creates Wallet, funds it, pays from it and sees its balance", async ({
    page,
  }) => {
    await loginAs(page, "alice");

    await page.getByRole("link", { name: "Accounts" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Accounts" })).toBeVisible();
    await page.getByRole("link", { name: "New account" }).click();
    await page.getByLabel("Name").fill("Wallet");
    await page.getByLabel("Type").selectOption("CASH");
    await page.getByLabel("Subtype").selectOption("WALLET");
    await page.getByRole("button", { name: "Save" }).click();

    await expect(page).toHaveURL(/\/accounts$/);
    await expect(page.getByRole("row", { name: /^Wallet\b/ })).toContainText("0.00");

    await recordTransaction(page, "RECEIVE", {
      source: "Wallet",
      date: "2026-11-22",
      total: "500",
      lines: [["Salary", "500"]],
    });
    await recordTransaction(page, "PAYMENT", {
      source: "Wallet",
      date: "2026-11-22",
      total: "200",
      lines: [["Dining", "200"]],
    });

    await page.goto("/dashboard");
    await expect(dashboardRow(page, "Wallet")).toContainText("300.00");
    await expect(dashboardRow(page, "Total income")).toContainText("500.00");
    await expect(dashboardRow(page, "Total expense")).toContainText("200.00");
  });
});
