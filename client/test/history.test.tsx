import { screen, within } from "@testing-library/react";
import { afterEach } from "vitest";
import { mockApi, renderAt } from "./renderApp.js";

// F-05 §5 History and detail — docs/sprints/sprint-1/F-05-summary-history.md.
afterEach(() => vi.unstubAllGlobals());

const REPAY = {
  id: 14,
  kind: "PAYMENT",
  date: "2026-11-04",
  totalAmount: 150_000,
  note: null,
  isFavorite: false,
  source: { id: 1, name: "Bank" },
  lines: [{ accountId: 2, name: "Credit Card", amount: 150_000 }],
};
const CARD = {
  id: 13,
  kind: "PAYMENT",
  date: "2026-11-03",
  totalAmount: 150_000,
  note: "Dinner and groceries",
  isFavorite: false,
  source: { id: 2, name: "Credit Card" },
  lines: [
    { accountId: 5, name: "Dining", amount: 90_000 },
    { accountId: 6, name: "Groceries", amount: 60_000 },
  ],
};
const SALARY = {
  id: 12,
  kind: "RECEIVE",
  date: "2026-11-02",
  totalAmount: 3_000_000,
  note: null,
  isFavorite: false,
  source: { id: 1, name: "Bank" },
  lines: [{ accountId: 3, name: "Salary", amount: 3_000_000 }],
};

describe("TransactionsPage", () => {
  it("T-HST-UI-01: an empty history shows a friendly message", async () => {
    mockApi({ "GET /api/transactions": { body: { transactions: [] } } });
    renderAt("/transactions");
    expect(await screen.findByRole("heading", { level: 1, name: "History" })).toBeInTheDocument();
    expect(await screen.findByText("No transactions yet.")).toBeInTheDocument();
  });

  it("T-HST-UI-01: lists transactions in the order the server returns them, with a link to each", async () => {
    mockApi({ "GET /api/transactions": { body: { transactions: [REPAY, CARD, SALARY] } } });
    renderAt("/transactions");

    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row").slice(1); // skip the header row
    expect(rows.map((r) => within(r).getAllByRole("cell")[0].textContent)).toEqual([
      "2026-11-04",
      "2026-11-03",
      "2026-11-02",
    ]);
    expect(rows[1]).toHaveTextContent("Payment");
    expect(rows[1]).toHaveTextContent("Credit Card");
    expect(rows[1]).toHaveTextContent("Dining, Groceries");
    expect(rows[1]).toHaveTextContent("1,500.00");
    expect(rows[2]).toHaveTextContent("Money received");
    expect(within(rows[1]).getByRole("link", { name: "Details" })).toHaveAttribute(
      "href",
      "/transactions/13",
    );
  });
});

describe("TransactionDetailPage", () => {
  it("shows the kind, date, source, note, total and every line", async () => {
    mockApi({ "GET /api/transactions/13": { body: { transaction: CARD } } });
    renderAt("/transactions/13");

    expect(await screen.findByRole("heading", { level: 1, name: "Payment" })).toBeInTheDocument();
    expect(screen.getByText("2026-11-03")).toBeInTheDocument();
    expect(screen.getByText("Dinner and groceries")).toBeInTheDocument();
    expect(screen.getByRole("row", { name: /^Dining\b/ })).toHaveTextContent("900.00");
    expect(screen.getByRole("row", { name: /^Groceries\b/ })).toHaveTextContent("600.00");
    expect(screen.getByRole("row", { name: /^Total\b/ })).toHaveTextContent("1,500.00");
  });

  // Issue #59 — F-04 §8 (note ≤ 200 chars), F-05 §5 (detail view), NFR-COMP-02 (no horizontal overflow ≥ 360px).
  it("T-HST-UI-03 (#59): wraps a 200-character unbroken note inside the detail container", async () => {
    const longNote = `UAT-ADD-02-${"n".repeat(189)}`;
    mockApi({ "GET /api/transactions/18": { body: { transaction: { ...CARD, id: 18, note: longNote } } } });
    renderAt("/transactions/18");

    const noteEl = await screen.findByText(longNote);
    expect(noteEl).toHaveClass("text-break");
  });

  it("a missing or someone else's transaction shows 'Transaction not found' with a way back", async () => {
    mockApi({
      "GET /api/transactions/99": {
        status: 404,
        body: { error: { code: "NOT_FOUND", message: "Transaction not found." } },
      },
    });
    renderAt("/transactions/99");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Transaction not found" }),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to history" })).toHaveAttribute("href", "/transactions");
  });
});

// F-07 §5 — docs/sprints/sprint-2/F-07-transfers.md. Transfers are labelled from the account types in
// GET /api/accounts; without them (e.g. the request fails) the page still shows every transaction.
describe("Transfer labels (F-07)", () => {
  const TRANSFER = {
    id: 20,
    kind: "PAYMENT",
    date: "2026-11-22",
    totalAmount: 200_000,
    note: "ATM",
    isFavorite: false,
    source: { id: 1, name: "Bank" },
    lines: [{ accountId: 9, name: "Wallet", amount: 200_000 }],
  };
  const ACCOUNTS = [
    { id: 1, name: "Bank", type: "CASH", subtype: "BANK", openingBalance: 0, openingDate: null, balance: 0 },
    {
      id: 2,
      name: "Credit Card",
      type: "LOAN_TAKEN",
      subtype: "CREDIT_CARD",
      openingBalance: 0,
      openingDate: null,
      balance: 0,
    },
    {
      id: 5,
      name: "Dining",
      type: "EXPENSE",
      subtype: null,
      openingBalance: 0,
      openingDate: null,
      balance: 0,
    },
    {
      id: 6,
      name: "Groceries",
      type: "EXPENSE",
      subtype: null,
      openingBalance: 0,
      openingDate: null,
      balance: 0,
    },
    {
      id: 9,
      name: "Wallet",
      type: "CASH",
      subtype: "WALLET",
      openingBalance: 0,
      openingDate: null,
      balance: 0,
    },
  ];

  it('T-HST-UI-04: only the transfer row is labelled "Transfer: Bank → Wallet"', async () => {
    mockApi({
      "GET /api/transactions": { body: { transactions: [TRANSFER, CARD] } },
      "GET /api/accounts": { body: { accounts: ACCOUNTS } },
    });
    renderAt("/transactions");

    const table = await screen.findByRole("table");
    const rows = within(table).getAllByRole("row").slice(1);
    expect(await within(rows[0]).findByText("Transfer: Bank → Wallet")).toBeInTheDocument();
    expect(rows[1]).toHaveTextContent("Payment");
    expect(rows[1]).not.toHaveTextContent("Transfer");
  });

  it('T-HST-UI-04: the detail page of a transfer is headed "Transfer: Bank → Wallet"', async () => {
    mockApi({
      "GET /api/transactions/20": { body: { transaction: TRANSFER } },
      "GET /api/accounts": { body: { accounts: ACCOUNTS } },
    });
    renderAt("/transactions/20");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Transfer: Bank → Wallet" }),
    ).toBeInTheDocument();
  });
});
