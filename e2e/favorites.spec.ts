import { expect, test } from "@playwright/test";
import { loginAs, recordTransaction } from "./helpers.js";
import { resetE2eDatabase } from "./db.js";

// F-10 §7 T-FAV-E2E-01 (docs/sprints/sprint-2/F-10-favorites-duplicate.md, AC-FAV-06):
// alice stars the card purchase, duplicates it from the dashboard Favorites card and saves;
// history shows two card purchases, the new one dated today and the original still favorite.
test.describe("F-10 favorite and duplicate transactions", () => {
  test.beforeAll(resetE2eDatabase);

  test("T-FAV-E2E-01: alice stars the card purchase, duplicates it from Dashboard Favorites card, and saves dated today", async ({
    page,
  }) => {
    await loginAs(page, "alice");

    // Record the Sprint 1 demo transactions needed for the card purchase
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

    // 1. Open History and star the card purchase
    await page.goto("/transactions");
    const cardRow = page.getByRole("row", { name: /2026-11-03/ });
    const starBtn = cardRow.getByRole("button", { name: "Add to favorites" });
    await starBtn.click();
    await expect(cardRow.getByRole("button", { name: "Remove from favorites" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    // 2. Open Dashboard, find Favorites card, and click Duplicate
    await page.goto("/dashboard");
    const favoritesCard = page.getByRole("region", { name: "Favorites" });
    await expect(favoritesCard).toBeVisible();
    await expect(favoritesCard).toContainText("Credit Card");
    await favoritesCard.getByRole("button", { name: "Duplicate" }).click();

    // 3. Duplicate form opens pre-filled and dated today -> Save
    await expect(page.getByRole("heading", { level: 1, name: /Duplicate of #\d+/ })).toBeVisible();
    const todayValue = await page.getByLabel("Date").inputValue();
    expect(todayValue).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    await expect(page.getByLabel("Total (THB)")).toHaveValue("1,500.00");
    await expect(page.getByLabel("Note (optional)")).toHaveValue("Dinner and groceries");

    await page.getByRole("button", { name: "Save" }).click();
    await expect(page).toHaveURL(/\/transactions\/\d+$/);

    // 4. History shows 2 card purchases: new one dated today (not favorite), original still favorite
    await page.goto("/transactions");
    const cardRows = page.getByRole("row", { name: /Dining, Groceries/ });
    await expect(cardRows).toHaveCount(2);

    const originalRow = page.getByRole("row", { name: /2026-11-03/ });
    await expect(originalRow.getByRole("button", { name: "Remove from favorites" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );

    const duplicatedRow = cardRows.filter({ hasNotText: "2026-11-03" });
    await expect(duplicatedRow).toContainText(todayValue);
    await expect(duplicatedRow.getByRole("button", { name: "Add to favorites" })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
