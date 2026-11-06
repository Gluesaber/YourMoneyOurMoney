import { expect, test } from "@playwright/test";
import { resetE2eDatabase } from "./db.js";

// F-01 §7 (T-AUTH-E2E-01, T-AUTH-E2E-02) & F-02 §7 (T-ADM-E2E-01, T-ADM-E2E-02)
const DEMO_PASSWORD = "demo-password-123";

test.describe("Auth and Admin E2E journeys (S1-08)", () => {
  // Fresh seeded data for this file; the tests inside depend on running in order.
  test.beforeAll(resetE2eDatabase);

  test("T-AUTH-E2E-01: invalid password shows alert; valid login as alice lands on /dashboard with username in navbar", async ({
    page,
  }) => {
    await page.goto("/login");
    await expect(page.getByRole("heading", { level: 1, name: "Log in" })).toBeVisible();

    // 1. Invalid password shows error alert and keeps username
    await page.getByLabel("Username").fill("alice");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByRole("alert")).toContainText("Invalid username or password.");
    await expect(page.getByLabel("Username")).toHaveValue("alice");
    await expect(page).toHaveURL(/\/login$/);

    // 2. Valid credentials redirect to /dashboard and show "alice" in navbar
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
    await expect(page.locator("nav")).toContainText("alice");
  });

  test("T-AUTH-E2E-02: clicking Log out returns to /login and blocks /dashboard", async ({ page }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill("alice");
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/dashboard$/);

    // Click Log out in navbar
    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { level: 1, name: "Log in" })).toBeVisible();

    // Visiting /dashboard after logout redirects to /login
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole("heading", { level: 1, name: "Log in" })).toBeVisible();
  });

  test("T-ADM-E2E-01: admin logs in to /admin/users, sees user list, and is redirected away from /dashboard", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByLabel("Username").fill("admin");
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(page.getByRole("heading", { level: 1, name: "Users" })).toBeVisible();

    const adminRow = page.getByRole("row", { name: /admin/i });
    const aliceRow = page.getByRole("row", { name: /alice/i });
    const bobRow = page.getByRole("row", { name: /bob/i });

    await expect(adminRow).toBeVisible();
    await expect(aliceRow).toBeVisible();
    await expect(bobRow).toBeVisible();
    // Self-disable guard (BR-07)
    await expect(adminRow.getByRole("button", { name: "Disable" })).toBeDisabled();

    // Navigating to /dashboard as ADMIN redirects back to /admin/users (BR-05)
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/admin\/users$/);
    await expect(page.getByRole("heading", { level: 1, name: "Users" })).toBeVisible();
  });

  test("T-ADM-E2E-02: admin disables alice -> alice login shows alert -> admin re-enables alice -> alice logs in to /dashboard", async ({
    page,
  }) => {
    // 1. Admin logs in and disables alice
    await page.goto("/login");
    await page.getByLabel("Username").fill("admin");
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/admin\/users$/);

    const aliceRow = page.getByRole("row", { name: /alice/i });
    await aliceRow.getByRole("button", { name: "Disable" }).click();
    await expect(aliceRow).toContainText("Disabled");
    await expect(aliceRow.getByRole("button", { name: "Enable" })).toBeVisible();

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    // 2. Disabled alice attempts to log in -> sees error alert
    await page.getByLabel("Username").fill("alice");
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByRole("alert")).toContainText("This account has been disabled.");
    await expect(page).toHaveURL(/\/login$/);

    // 3. Admin logs back in and re-enables alice
    await page.getByLabel("Username").fill("admin");
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();
    await expect(page).toHaveURL(/\/admin\/users$/);

    await aliceRow.getByRole("button", { name: "Enable" }).click();
    await expect(aliceRow).toContainText("Enabled");
    await expect(aliceRow.getByRole("button", { name: "Disable" })).toBeVisible();

    await page.getByRole("button", { name: "Log out" }).click();
    await expect(page).toHaveURL(/\/login$/);

    // 4. Re-enabled alice logs in and lands on /dashboard
    await page.getByLabel("Username").fill("alice");
    await page.getByLabel("Password").fill(DEMO_PASSWORD);
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole("heading", { level: 1, name: "Dashboard" })).toBeVisible();
  });
});
