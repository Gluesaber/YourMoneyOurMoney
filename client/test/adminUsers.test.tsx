import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { CurrentUser } from "../src/auth/AuthContext.js";
import { mockApi, renderAt } from "./renderApp.js";

// F-02 §5 & §7 (T-ADM-UI-01) — Admin user management table, self-disable guard, and enable/disable toggle.
afterEach(() => vi.unstubAllGlobals());

const adminUser: CurrentUser = { id: 3, username: "admin", role: "ADMIN" };

const SEEDED_USERS = [
  { id: 3, username: "admin", role: "ADMIN" as const, isEnabled: true },
  { id: 1, username: "alice", role: "USER" as const, isEnabled: true },
  { id: 2, username: "bob", role: "USER" as const, isEnabled: true },
];

describe("T-ADM-UI-01: AdminUsersPage", () => {
  it("renders seeded users, disables admin's own Disable button (BR-07), and toggles alice between Enabled and Disabled (AC-ADM-01, AC-ADM-03, AC-ADM-04)", async () => {
    const calls = mockApi({
      "GET /api/admin/users": { body: { users: SEEDED_USERS } },
      "PATCH /api/admin/users/1": (body) => {
        const { isEnabled } = body as { isEnabled: boolean };
        return {
          body: {
            user: { id: 1, username: "alice", role: "USER", isEnabled },
          },
        };
      },
    });
    const user = userEvent.setup();
    renderAt("/admin/users", adminUser);

    expect(screen.getByRole("heading", { level: 1, name: "Users" })).toBeInTheDocument();
    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row");
    // Header row + 3 user rows
    expect(rows).toHaveLength(4);

    const adminRow = screen.getByRole("row", { name: /admin/i });
    const aliceRow = screen.getByRole("row", { name: /alice/i });
    const bobRow = screen.getByRole("row", { name: /bob/i });

    expect(within(adminRow).getByText("ADMIN")).toBeInTheDocument();
    expect(within(adminRow).getByText("Enabled")).toBeInTheDocument();
    // Admin's own Disable button must be disabled (BR-07)
    expect(within(adminRow).getByRole("button", { name: "Disable" })).toBeDisabled();

    expect(within(aliceRow).getByText("USER")).toBeInTheDocument();
    expect(within(aliceRow).getByText("Enabled")).toBeInTheDocument();
    expect(within(bobRow).getByText("Enabled")).toBeInTheDocument();

    // Disable alice
    const aliceDisableBtn = within(aliceRow).getByRole("button", { name: "Disable" });
    expect(aliceDisableBtn).toBeEnabled();
    await user.click(aliceDisableBtn);

    expect(await within(aliceRow).findByText("Disabled")).toBeInTheDocument();
    const aliceEnableBtn = within(aliceRow).getByRole("button", { name: "Enable" });
    expect(aliceEnableBtn).toBeEnabled();
    expect(calls.find((c) => c.method === "PATCH" && c.path === "/api/admin/users/1")?.body).toEqual({
      isEnabled: false,
    });

    // Re-enable alice
    await user.click(aliceEnableBtn);
    expect(await within(aliceRow).findByText("Enabled")).toBeInTheDocument();
    expect(within(aliceRow).getByRole("button", { name: "Disable" })).toBeEnabled();
    expect(
      calls.filter((c) => c.method === "PATCH" && c.path === "/api/admin/users/1").map((c) => c.body),
    ).toEqual([{ isEnabled: false }, { isEnabled: true }]);
  });

  it("displays an error alert when PATCH /api/admin/users/:id fails and preserves row state", async () => {
    mockApi({
      "GET /api/admin/users": { body: { users: SEEDED_USERS } },
      "PATCH /api/admin/users/1": {
        status: 400,
        body: {
          error: {
            code: "SELF_DISABLE_NOT_ALLOWED",
            message: "You cannot disable your own account.",
          },
        },
      },
    });
    const user = userEvent.setup();
    renderAt("/admin/users", adminUser);

    await screen.findByRole("table");
    const aliceRow = screen.getByRole("row", { name: /alice/i });
    await user.click(within(aliceRow).getByRole("button", { name: "Disable" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("You cannot disable your own account.");
    expect(within(aliceRow).getByText("Enabled")).toBeInTheDocument();
  });

  it("displays an error alert when initial GET /api/admin/users fails", async () => {
    mockApi({
      "GET /api/admin/users": {
        status: 500,
        body: {
          error: {
            code: "INTERNAL_ERROR",
            message: "Database unavailable.",
          },
        },
      },
    });
    renderAt("/admin/users", adminUser);

    expect(await screen.findByRole("alert")).toHaveTextContent("Database unavailable.");
  });
});
