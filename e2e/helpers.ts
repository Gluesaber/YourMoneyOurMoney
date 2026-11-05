import { expect, type Page } from "@playwright/test";
import { DEMO_PASSWORD } from "../server/prisma/seedData.js";

export { DEMO_PASSWORD };

// Logs in through the real login page and waits for the role's home page.
export async function loginAs(page: Page, username: string, home = "/dashboard") {
  await page.goto("/login");
  await page.getByLabel("Username").fill(username);
  await page.getByLabel("Password").fill(DEMO_PASSWORD);
  await page.getByRole("button", { name: "Log in" }).click();
  await expect(page).toHaveURL(new RegExp(`${home}$`));
}

// The dashboard row for an account or a total, e.g. dashboardRow(page, "Bank").
export function dashboardRow(page: Page, name: string) {
  return page.getByRole("row", { name: new RegExp(`^${name}\\b`) });
}

// Fills and saves the Payment / Receive form; `lines` are [account name, amount in baht].
export async function recordTransaction(
  page: Page,
  kind: "PAYMENT" | "RECEIVE",
  tx: { source: string; date: string; total: string; lines: [string, string][]; note?: string },
) {
  await page.goto("/dashboard");
  await page
    .getByRole("link", { name: kind === "PAYMENT" ? "Record payment" : "Record money received" })
    .click();
  await page
    .getByLabel(kind === "PAYMENT" ? "Paid from" : "Received into")
    .selectOption({ label: tx.source });
  await page.getByLabel("Date").fill(tx.date);
  await page.getByLabel("Total (THB)").fill(tx.total);
  if (tx.note) await page.getByLabel("Note (optional)").fill(tx.note);
  for (const [i, [account, amount]] of tx.lines.entries()) {
    if (i > 0) await page.getByRole("button", { name: "Add line" }).click();
    await page.getByLabel(`Account for line ${i + 1}`).selectOption({ label: account });
    await page.getByLabel(`Amount for line ${i + 1}`).fill(amount);
  }
  await expect(page.getByText("Remaining to allocate")).toContainText("0.00");
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/transactions\/\d+$/);
}
