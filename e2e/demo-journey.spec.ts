import { expect, request, test } from "@playwright/test";
import { DEMO_PASSWORD, dashboardRow, loginAs, recordTransaction } from "./helpers.js";
import { resetE2eDatabase } from "./db.js";

// S1-15 integration: the Sprint 1 demo journey through the real UI and API, plus one rejected case and
// one access case. F-03 §7 T-ACC-E2E-01, F-04 §7 T-TX-E2E-01, F-05 §7 T-SUM-E2E-01; numbers from
// docs/system-sds.md §4.3. The E2E database is reset and seeded before this file runs (e2e/db.ts).

test.describe("Sprint 1 demo journey (S1-15)", () => {
  // Fresh seeded data for this file; the tests inside depend on running in order.
  test.beforeAll(resetE2eDatabase);

  test("T-ACC-E2E-01 / T-TX-E2E-01 / T-SUM-E2E-01: alice records the demo journey and sees the documented numbers", async ({
    page,
  }) => {
    await loginAs(page, "alice");

    // A new user sees every amount at zero and the welcome hint.
    await expect(page.getByText(/set the opening balance/i)).toBeVisible();
    await expect(dashboardRow(page, "Bank")).toContainText("0.00");

    // 1. Opening balance on Bank (T-ACC-E2E-01).
    await page.getByRole("link", { name: "Set opening balance for Bank" }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Opening balance: Bank" })).toBeVisible();
    await page.getByLabel("Amount (THB)").fill("10,000.00");
    await page.getByLabel("Date").fill("2026-11-01");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(dashboardRow(page, "Bank")).toContainText("10,000.00");
    await expect(dashboardRow(page, "Total income")).toContainText("0.00"); // BR-08

    // 2. Salary into Bank.
    await recordTransaction(page, "RECEIVE", {
      source: "Bank",
      date: "2026-11-02",
      total: "30,000",
      lines: [["Salary", "30,000"]],
    });
    await expect(page.getByRole("heading", { level: 1, name: "Money received" })).toBeVisible();

    // 3. Card purchase split across Dining and Groceries (T-TX-E2E-01).
    await recordTransaction(page, "PAYMENT", {
      source: "Credit Card",
      date: "2026-11-03",
      total: "1,500.00",
      note: "Dinner and groceries",
      lines: [
        ["Dining", "900"],
        ["Groceries", "600"],
      ],
    });
    await expect(page.getByRole("heading", { level: 1, name: "Payment" })).toBeVisible();
    await expect(page.getByRole("row", { name: /^Dining\b/ })).toContainText("900.00");
    await expect(page.getByRole("row", { name: /^Groceries\b/ })).toContainText("600.00");
    await expect(page.getByText("Dinner and groceries")).toBeVisible();

    // Before the repayment the card owes 1,500.00.
    await page.goto("/dashboard");
    await expect(dashboardRow(page, "Credit Card")).toContainText("1,500.00");

    // 4. Repay the card from Bank (not an expense, BR-08).
    await recordTransaction(page, "PAYMENT", {
      source: "Bank",
      date: "2026-11-04",
      total: "1,500",
      lines: [["Credit Card", "1,500"]],
    });

    // Result (T-SUM-E2E-01, system-sds.md §4.3).
    await page.goto("/dashboard");
    await expect(dashboardRow(page, "Bank")).toContainText("38,500.00");
    await expect(dashboardRow(page, "Credit Card")).toContainText("0.00");
    await expect(dashboardRow(page, "Total income")).toContainText("30,000.00");
    await expect(dashboardRow(page, "Total expense")).toContainText("1,500.00");
    await expect(dashboardRow(page, "Salary")).toContainText("30,000.00");
    await expect(dashboardRow(page, "Dining")).toContainText("900.00");
    await expect(dashboardRow(page, "Groceries")).toContainText("600.00");
    await expect(page.getByText(/set the opening balance/i)).toHaveCount(0);

    // History lists the three transactions, newest first.
    await page.getByRole("link", { name: "History" }).click();
    const dates = page.getByRole("row").filter({ has: page.getByRole("link", { name: "Details" }) });
    await expect(dates).toHaveCount(3);
    await expect(dates.nth(0)).toContainText("2026-11-04");
    await expect(dates.nth(1)).toContainText("2026-11-03");
    await expect(dates.nth(1)).toContainText("Dining, Groceries");
    await expect(dates.nth(2)).toContainText("2026-11-02");
  });

  test("rejected case: lines that do not add up cannot be saved in the UI and are refused by the API (BR-01)", async ({
    page,
  }) => {
    await loginAs(page, "alice");
    const before = (await (await page.request.get("/api/transactions")).json()).transactions.length;

    // UI: Save stays disabled while 600.00 is unallocated.
    await page.getByRole("link", { name: "Record payment" }).click();
    await page.getByLabel("Paid from").selectOption({ label: "Credit Card" });
    await page.getByLabel("Total (THB)").fill("1,500");
    await page.getByLabel("Account for line 1").selectOption({ label: "Dining" });
    await page.getByLabel("Amount for line 1").fill("900");
    await expect(page.getByText("Remaining to allocate")).toContainText("600.00");
    await expect(page.getByRole("button", { name: "Save" })).toBeDisabled();

    // API: the same request sent directly is rejected with ALLOCATION_MISMATCH and nothing is stored.
    const accounts = (await (await page.request.get("/api/accounts")).json()).accounts as {
      id: number;
      name: string;
    }[];
    const id = (name: string) => accounts.find((a) => a.name === name)!.id;
    const res = await page.request.post("/api/transactions", {
      data: {
        kind: "PAYMENT",
        sourceAccountId: id("Credit Card"),
        date: "2026-11-05",
        totalAmount: 150_000,
        lines: [{ accountId: id("Dining"), amount: 90_000 }],
      },
    });
    expect(res.status()).toBe(400);
    expect((await res.json()).error).toMatchObject({
      code: "ALLOCATION_MISMATCH",
      details: { totalAmount: 150_000, linesTotal: 90_000, difference: -60_000 },
    });
    const after = (await (await page.request.get("/api/transactions")).json()).transactions.length;
    expect(after).toBe(before);
  });

  test("access case: alice cannot open bob's transaction, and an admin cannot reach financial pages (BR-04, BR-05)", async ({
    page,
    baseURL,
  }) => {
    // bob records a transaction through the API.
    const bob = await request.newContext({ baseURL });
    await bob.post("/api/auth/login", { data: { username: "bob", password: DEMO_PASSWORD } });
    const bobAccounts = (await (await bob.get("/api/accounts")).json()).accounts as {
      id: number;
      name: string;
    }[];
    const bobId = (name: string) => bobAccounts.find((a) => a.name === name)!.id;
    const created = await bob.post("/api/transactions", {
      data: {
        kind: "RECEIVE",
        sourceAccountId: bobId("Bank"),
        date: "2026-11-05",
        totalAmount: 500_000,
        note: "bob's private salary",
        lines: [{ accountId: bobId("Salary"), amount: 500_000 }],
      },
    });
    expect(created.status()).toBe(201);
    const bobTxId = (await created.json()).transaction.id as number;
    await bob.dispose();

    // alice opening bob's transaction gets the same page as a missing one, and never sees it in History.
    await loginAs(page, "alice");
    await page.goto(`/transactions/${bobTxId}`);
    await expect(page.getByRole("heading", { level: 1, name: "Transaction not found" })).toBeVisible();
    await expect(page.getByText("bob's private salary")).toHaveCount(0);
    await page.goto("/transactions");
    await expect(page.getByText("bob's private salary")).toHaveCount(0);
    expect((await page.request.get(`/api/transactions/${bobTxId}`)).status()).toBe(404);

    // An admin is sent away from the dashboard and refused by the financial API.
    await page.getByRole("button", { name: "Log out" }).click();
    await loginAs(page, "admin", "/admin/users");
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/admin\/users$/);
    expect((await page.request.get("/api/summary")).status()).toBe(403);
  });
});
