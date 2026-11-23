import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach } from "vitest";
import { renderAt } from "./renderApp.js";

// F-06 v0.4 §5 Accounts page — docs/sprints/sprint-2/F-06-account-management.md. T-ACC-UI-05.
afterEach(() => vi.unstubAllGlobals());

const BANK = {
  id: 1,
  name: "Bank",
  type: "CASH",
  subtype: "BANK",
  openingBalance: 0,
  openingDate: null,
  balance: 3_850_000,
  archived: false,
  inUse: true,
};
const WALLET = { ...BANK, id: 9, name: "Wallet", subtype: "WALLET", balance: 0, inUse: false };

// A fake API whose archive request stays open until the test calls `finish()`, so the page can be
// checked while the action is saving.
function slowArchiveApi() {
  let finish = () => {};
  const json = (body: unknown) =>
    new Response(JSON.stringify(body), { status: 200, headers: { "Content-Type": "application/json" } });
  vi.stubGlobal(
    "fetch",
    vi.fn(async (path: string, init: RequestInit = {}) => {
      const method = (init.method ?? "GET").toUpperCase();
      if (method === "GET" && path === "/api/accounts") return json({ accounts: [BANK, WALLET] });
      if (method === "PATCH" && path === "/api/accounts/9/archive") {
        await new Promise<void>((resolve) => (finish = resolve));
        return json({ account: { ...WALLET, archived: true } });
      }
      throw new Error(`no reply for ${method} ${path}`);
    }),
  );
  return { finish: () => finish() };
}

const row = (name: string) => screen.getByRole("row", { name: new RegExp(`^${name}\\b`) });

describe("AccountsPage", () => {
  it("T-ACC-UI-05: a used account offers no Delete or type change, and a row's buttons are disabled while saving", async () => {
    const api = slowArchiveApi();
    const user = userEvent.setup();
    renderAt("/accounts");

    expect(await screen.findByRole("heading", { level: 1, name: "Accounts" })).toBeInTheDocument();
    expect(within(row("Bank")).queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
    expect(within(row("Wallet")).getByRole("button", { name: "Delete" })).toBeInTheDocument();

    await user.click(within(row("Bank")).getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Name")).toHaveValue("Bank");
    expect(screen.queryByLabelText("Type")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(within(row("Wallet")).getByRole("button", { name: "Edit" }));
    expect(screen.getByLabelText("Type")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    await user.click(within(row("Wallet")).getByRole("button", { name: "Archive" }));
    for (const name of ["Edit", "Archive", "Delete"]) {
      expect(within(row("Wallet")).getByRole("button", { name })).toBeDisabled();
    }
    api.finish();
    expect(await within(row("Wallet")).findByRole("button", { name: "Edit" })).toBeEnabled();
  });
});
