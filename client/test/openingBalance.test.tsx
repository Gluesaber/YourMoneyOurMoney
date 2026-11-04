import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach } from "vitest";
import { SEEDED_ACCOUNTS, mockApi, renderAt } from "./renderApp.js";

// F-03 §5 Opening balance form — docs/sprints/sprint-1/F-03-accounts.md.
afterEach(() => vi.unstubAllGlobals());

const EMPTY_SUMMARY = {
  cash: [],
  loansTaken: [],
  loansGiven: [],
  totals: { income: 0, expense: 0 },
  income: [],
  expense: [],
};

describe("OpeningBalancePage", () => {
  it("T-ACC-UI-01: typing 1,500.50 sends 150050 satang and returns to the dashboard", async () => {
    const calls = mockApi({
      "GET /api/accounts": { body: { accounts: SEEDED_ACCOUNTS } },
      "PUT /api/accounts/1/opening-balance": (body) => ({
        body: { account: { ...SEEDED_ACCOUNTS[0], ...(body as object), balance: 150_050 } },
      }),
      "GET /api/summary": { body: EMPTY_SUMMARY },
    });
    const user = userEvent.setup();
    renderAt("/accounts/1/opening-balance");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Opening balance: Bank" }),
    ).toBeInTheDocument();
    await user.clear(screen.getByLabelText("Amount (THB)"));
    await user.type(screen.getByLabelText("Amount (THB)"), "1,500.50");
    await user.clear(screen.getByLabelText("Date"));
    await user.type(screen.getByLabelText("Date"), "2026-11-01");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(calls.find((c) => c.method === "PUT")?.body).toEqual({
      openingBalance: 150_050,
      openingDate: "2026-11-01",
    });
  });

  it.each(["-5", "1.234", "abc"])("T-ACC-UI-02: %j shows an inline error and sends nothing", async (text) => {
    const calls = mockApi({ "GET /api/accounts": { body: { accounts: SEEDED_ACCOUNTS } } });
    const user = userEvent.setup();
    renderAt("/accounts/1/opening-balance");

    const amount = await screen.findByLabelText("Amount (THB)");
    await user.clear(amount);
    await user.type(amount, text);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(screen.getByText(/enter an amount like 1,500\.00/i)).toBeInTheDocument();
    expect(amount).toHaveAttribute("aria-invalid", "true");
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(0);
  });

  it("pre-fills the current opening balance and date", async () => {
    mockApi({
      "GET /api/accounts": {
        body: { accounts: [{ ...SEEDED_ACCOUNTS[0], openingBalance: 1_000_000, openingDate: "2026-11-01" }] },
      },
    });
    renderAt("/accounts/1/opening-balance");
    expect(await screen.findByLabelText("Amount (THB)")).toHaveValue("10,000.00");
    expect(screen.getByLabelText("Date")).toHaveValue("2026-11-01");
  });

  it("shows the server's message and keeps the input when saving fails", async () => {
    mockApi({
      "GET /api/accounts": { body: { accounts: SEEDED_ACCOUNTS } },
      "PUT /api/accounts/1/opening-balance": {
        status: 400,
        body: { error: { code: "VALIDATION_ERROR", message: "Invalid request." } },
      },
    });
    const user = userEvent.setup();
    renderAt("/accounts/1/opening-balance");
    const amount = await screen.findByLabelText("Amount (THB)");
    await user.clear(amount);
    await user.type(amount, "100");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid request.");
    expect(amount).toHaveValue("100");
  });

  it("refuses accounts that cannot have an opening balance, or are not the user's", async () => {
    mockApi({ "GET /api/accounts": { body: { accounts: SEEDED_ACCOUNTS } } });
    renderAt("/accounts/5/opening-balance"); // Dining (EXPENSE)
    expect(await screen.findByText(/this account cannot have an opening balance/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Save" })).not.toBeInTheDocument();
  });
});
