import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Account, Summary } from "../src/api/finance.js";
import { SEEDED_ACCOUNTS, mockApi, renderAt } from "./renderApp.js";

// F-08 §5 & §7 T-DEBT-UI-01, T-DEBT-UI-02 — docs/sprints/sprint-2/F-08-loans.md.
afterEach(() => vi.unstubAllGlobals());

const BANK = { ...(SEEDED_ACCOUNTS[0] as Account), balance: 3_850_000, archived: false };
const CREDIT_CARD = { ...(SEEDED_ACCOUNTS[1] as Account), balance: 150_000, archived: false };
const BEN: Account = {
  id: 10,
  name: "Ben",
  type: "LOAN_GIVEN",
  subtype: null,
  openingBalance: 0,
  openingDate: null,
  balance: 300_000,
  archived: false,
};
const MOM: Account = {
  id: 11,
  name: "Mom",
  type: "LOAN_TAKEN",
  subtype: null,
  openingBalance: 0,
  openingDate: null,
  balance: 0,
  archived: false,
};

const SUMMARY_WITH_LOANS: Summary = {
  cash: [{ accountId: 1, name: "Bank", balance: 3_850_000 }],
  loansTaken: [
    { accountId: 2, name: "Credit Card", outstanding: 150_000 },
    { accountId: 11, name: "Mom", outstanding: 0 },
  ],
  loansGiven: [{ accountId: 10, name: "Ben", outstanding: 300_000 }],
  totals: { income: 3_000_000, expense: 150_000 },
  income: [],
  expense: [],
};

describe("LoansPage (T-DEBT-UI-01)", () => {
  it("T-DEBT-UI-01: renders Money you lent & Money you owe tables, formatted balances, and labels only Credit Card as a card", async () => {
    mockApi({
      "GET /api/summary": { body: SUMMARY_WITH_LOANS },
      "GET /api/accounts": { body: { accounts: [BANK, CREDIT_CARD, BEN, MOM] } },
    });
    renderAt("/loans");

    expect(await screen.findByRole("heading", { level: 1, name: "Loans" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Money you lent" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Money you owe" })).toBeInTheDocument();

    const benRow = screen.getByRole("row", { name: /^Ben\b/ });
    expect(benRow).toHaveTextContent("3,000.00");
    expect(within(benRow).queryByText(/Credit card/i)).not.toBeInTheDocument();
    expect(within(benRow).getByRole("link", { name: "Lend more" })).toHaveAttribute("href", "/loans/10/lend");
    expect(within(benRow).getByRole("link", { name: "Get repaid" })).toHaveAttribute(
      "href",
      "/loans/10/repaid",
    );

    const cardRow = screen.getByRole("row", { name: /^Credit Card\b/ });
    expect(cardRow).toHaveTextContent("1,500.00");
    expect(within(cardRow).getByText("Credit card")).toBeInTheDocument();
    expect(within(cardRow).getByRole("link", { name: "Borrow more" })).toHaveAttribute(
      "href",
      "/loans/2/borrow",
    );
    expect(within(cardRow).getByRole("link", { name: "Repay" })).toHaveAttribute("href", "/loans/2/repay");

    const momRow = screen.getByRole("row", { name: /^Mom\b/ });
    expect(momRow).toHaveTextContent("0.00");
    expect(within(momRow).queryByText(/Credit card/i)).not.toBeInTheDocument();
    expect(within(momRow).getByRole("link", { name: "Borrow more" })).toHaveAttribute(
      "href",
      "/loans/11/borrow",
    );
    expect(within(momRow).getByRole("link", { name: "Repay" })).toHaveAttribute("href", "/loans/11/repay");
  });

  it("shows overpayment labels on negative outstanding, archived badge without actions, and empty state link", async () => {
    mockApi({
      "GET /api/summary": {
        body: {
          ...SUMMARY_WITH_LOANS,
          loansGiven: [],
          loansTaken: [
            { accountId: 2, name: "Credit Card", outstanding: -50_000 },
            { accountId: 11, name: "Mom", outstanding: 100_000 },
          ],
        },
      },
      "GET /api/accounts": {
        body: { accounts: [BANK, CREDIT_CARD, { ...MOM, archived: true }] },
      },
    });
    renderAt("/loans");

    expect(await screen.findByRole("heading", { level: 1, name: "Loans" })).toBeInTheDocument();

    // Empty LOAN_GIVEN state links to /accounts/new?type=LOAN_GIVEN
    const addLinks = screen.getAllByRole("link", { name: "Add a loan account" });
    expect(addLinks.some((link) => link.getAttribute("href") === "/accounts/new?type=LOAN_GIVEN")).toBe(true);

    // Negative outstanding shows overpayment indicator
    const cardRow = screen.getByRole("row", { name: /^Credit Card\b/ });
    expect(cardRow).toHaveTextContent("-500.00");
    expect(cardRow).toHaveTextContent(/you overpaid/i);

    // Archived loan shows Archived badge and omits action links
    const momRow = screen.getByRole("row", { name: /^Mom\b/ });
    expect(within(momRow).getByText("Archived")).toBeInTheDocument();
    expect(within(momRow).queryByRole("link", { name: "Repay" })).not.toBeInTheDocument();
  });

  it("shows 'overpaid you · you owe them' when a Money you lent account has negative outstanding", async () => {
    mockApi({
      "GET /api/summary": {
        body: {
          ...SUMMARY_WITH_LOANS,
          loansGiven: [{ accountId: 10, name: "Ben", outstanding: -50_000 }],
          loansTaken: [],
        },
      },
      "GET /api/accounts": { body: { accounts: [BANK, BEN] } },
    });
    renderAt("/loans");

    const benRow = await screen.findByRole("row", { name: /^Ben\b/ });
    expect(benRow).toHaveTextContent("-500.00");
    expect(benRow).toHaveTextContent("overpaid you · you owe them");
    expect(benRow).not.toHaveTextContent("you overpaid");
  });
});

describe("LoanActionPage (T-DEBT-UI-02)", () => {
  it("T-DEBT-UI-02: Get repaid exceeding outstanding warns before sending and submits only after confirmation", async () => {
    const calls = mockApi({
      "GET /api/accounts": { body: { accounts: [BANK, CREDIT_CARD, BEN, MOM] } },
      "GET /api/summary": { body: SUMMARY_WITH_LOANS },
      "POST /api/transactions": {
        status: 201,
        body: {
          transaction: {
            id: 42,
            kind: "RECEIVE",
            date: "2026-11-22",
            totalAmount: 350_000,
            note: "Extra",
            isFavorite: false,
            source: { id: 1, name: "Bank" },
            lines: [{ accountId: 10, name: "Ben", amount: 350_000 }],
          },
        },
      },
    });
    const user = userEvent.setup();
    renderAt("/loans/10/repaid");

    expect(await screen.findByRole("heading", { level: 1, name: "Get repaid by Ben" })).toBeInTheDocument();
    await user.selectOptions(screen.getByLabelText("Cash account"), "1");
    await user.type(screen.getByLabelText("Amount (THB)"), "3,500.00");
    const dateInput = screen.getByLabelText("Date");
    await user.clear(dateInput);
    await user.type(dateInput, "2026-11-22");
    await user.type(screen.getByLabelText("Note (optional)"), "Extra");

    await user.click(screen.getByRole("button", { name: "Save" }));

    // Warning shown, nothing sent to POST /api/transactions yet
    expect(await screen.findByRole("alert")).toHaveTextContent("This is more than the 3,000.00 outstanding.");
    expect(calls.filter((c) => c.method === "POST")).toHaveLength(0);

    // Explicit confirmation sends the transaction and returns to /loans
    await user.click(screen.getByRole("button", { name: "Confirm and save" }));

    expect(await screen.findByRole("heading", { level: 1, name: "Loans" })).toBeInTheDocument();
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({
      kind: "RECEIVE",
      sourceAccountId: 1,
      date: "2026-11-22",
      totalAmount: 350_000,
      note: "Extra",
      lines: [{ accountId: 10, amount: 350_000 }],
    });
  });

  it("resets over-repayment confirmation if amount changes and preserves form values on server error", async () => {
    mockApi({
      "GET /api/accounts": { body: { accounts: [BANK, CREDIT_CARD, BEN, MOM] } },
      "GET /api/summary": { body: SUMMARY_WITH_LOANS },
      "POST /api/transactions": {
        status: 400,
        body: { error: { code: "ACCOUNT_ARCHIVED", message: "Ben is archived." } },
      },
    });
    const user = userEvent.setup();
    renderAt("/loans/10/repaid");

    await screen.findByRole("heading", { level: 1, name: "Get repaid by Ben" });
    await user.selectOptions(screen.getByLabelText("Cash account"), "1");
    const amountInput = screen.getByLabelText("Amount (THB)");
    await user.type(amountInput, "3,500");
    await user.type(screen.getByLabelText("Note (optional)"), "Partial");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("This is more than the 3,000.00 outstanding.");

    // Edit amount down to valid <= outstanding → warning disappears, Save submits normally and server error keeps values
    await user.clear(amountInput);
    await user.type(amountInput, "2,000");
    expect(screen.queryByRole("button", { name: "Confirm and save" })).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Ben is archived.");
    expect(screen.getByLabelText("Cash account")).toHaveValue("1");
    expect(amountInput).toHaveValue("2,000");
    expect(screen.getByLabelText("Note (optional)")).toHaveValue("Partial");
  });

  it("rejects mismatched action/account type or archived loan account with a clear message", async () => {
    mockApi({
      "GET /api/accounts": { body: { accounts: [BANK, CREDIT_CARD, BEN, { ...MOM, archived: true }] } },
      "GET /api/summary": { body: SUMMARY_WITH_LOANS },
    });

    // Credit Card is LOAN_TAKEN, so /loans/2/lend is invalid
    renderAt("/loans/2/lend");
    expect(await screen.findByText(/cannot be used for this loan action/i)).toBeInTheDocument();
  });

  it("preselects the loan type when navigating to /accounts/new?type=LOAN_GIVEN", async () => {
    mockApi({});
    renderAt("/accounts/new?type=LOAN_GIVEN");
    expect(await screen.findByLabelText("Type")).toHaveValue("LOAN_GIVEN");
  });

  it("highlights the Date field when the server returns a date validation error (#60)", async () => {
    mockApi({
      "GET /api/accounts": { body: { accounts: [BANK, BEN] } },
      "GET /api/summary": { body: SUMMARY_WITH_LOANS },
      "POST /api/transactions": {
        status: 400,
        body: {
          error: {
            code: "VALIDATION_ERROR",
            message: "Invalid input.",
            details: { fieldErrors: { date: ["Use a date from 2000 to 2099."] } },
          },
        },
      },
    });
    const user = userEvent.setup();
    renderAt("/loans/10/lend");

    await screen.findByRole("heading", { level: 1, name: "Lend to Ben" });
    await user.selectOptions(screen.getByLabelText("Cash account"), "1");
    await user.type(screen.getByLabelText("Amount (THB)"), "500");
    await user.click(screen.getByRole("button", { name: "Save" }));

    const dateInput = screen.getByLabelText("Date");
    expect(await screen.findByRole("alert")).toBeInTheDocument();
    expect(dateInput).toHaveAttribute("aria-invalid", "true");
    expect(dateInput).toHaveClass("is-invalid");
    expect(screen.getByText("Use a date from 2000 to 2099.")).toBeInTheDocument();
  });
});
