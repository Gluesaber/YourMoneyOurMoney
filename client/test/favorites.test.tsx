import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AppRoutes } from "../src/App.js";
import type { Transaction } from "../src/api/finance.js";
import { AuthContext, type AuthState } from "../src/auth/AuthContext.js";
import { FavoriteToggle } from "../src/components/FavoriteToggle.js";
import { toDuplicateDraft } from "../src/lib/duplicate.js";
import { SEEDED_ACCOUNTS, alice, mockApi, renderAt, type ApiRoutes } from "./renderApp.js";

// F-10 §5 & §7 T-FAV-UI-01, T-FAV-UI-02, T-FAV-UI-03 — docs/sprints/sprint-2/F-10-favorites-duplicate.md.
afterEach(() => vi.unstubAllGlobals());

const CARD_TX: Transaction = {
  id: 13,
  kind: "PAYMENT",
  date: "2026-11-03",
  totalAmount: 150_000,
  note: "Dinner and groceries",
  isFavorite: true,
  source: { id: 2, name: "Credit Card" },
  lines: [
    { accountId: 5, name: "Dining", amount: 90_000 },
    { accountId: 6, name: "Groceries", amount: 60_000 },
  ],
};

function renderWithRouterState(
  initialEntry: { pathname: string; search?: string; state?: unknown },
  routes: ApiRoutes,
) {
  const calls = mockApi(routes);
  const auth: AuthState = { user: alice, loading: false, login: vi.fn(), logout: vi.fn() };
  render(
    <AuthContext.Provider value={auth}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <AppRoutes />
      </MemoryRouter>
    </AuthContext.Provider>,
  );
  return calls;
}

describe("Duplicate transaction form (T-FAV-UI-01, T-FAV-UI-02)", () => {
  it("T-FAV-UI-01: pre-fills fields from draft with heading 'Duplicate of #13' and saves via new POST", async () => {
    const draft = toDuplicateDraft(CARD_TX, "2026-11-22");
    const created: Transaction = { ...CARD_TX, id: 25, date: "2026-11-22", isFavorite: false };
    const calls = renderWithRouterState(
      { pathname: "/transactions/new", search: "?kind=PAYMENT", state: { draft } },
      {
        "GET /api/accounts": { body: { accounts: SEEDED_ACCOUNTS } },
        "POST /api/transactions": { status: 201, body: { transaction: created } },
        "GET /api/transactions/25": { body: { transaction: created } },
      },
    );
    const user = userEvent.setup();

    expect(await screen.findByRole("heading", { level: 1, name: "Duplicate of #13" })).toBeInTheDocument();
    expect(screen.getByLabelText("Paid from")).toHaveValue("2");
    expect(screen.getByLabelText("Date")).toHaveValue("2026-11-22");
    expect(screen.getByLabelText("Total (THB)")).toHaveValue("1,500.00");
    expect(screen.getByLabelText("Note (optional)")).toHaveValue("Dinner and groceries");
    expect(screen.getByLabelText("Account for line 1")).toHaveValue("5");
    expect(screen.getByLabelText("Amount for line 1")).toHaveValue("900.00");
    expect(screen.getByLabelText("Account for line 2")).toHaveValue("6");
    expect(screen.getByLabelText("Amount for line 2")).toHaveValue("600.00");

    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeEnabled();
    await user.click(save);

    expect(await screen.findByText("2026-11-22")).toBeInTheDocument();
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({
      kind: "PAYMENT",
      sourceAccountId: 2,
      date: "2026-11-22",
      totalAmount: 150_000,
      note: "Dinner and groceries",
      lines: [
        { accountId: 5, amount: 90_000 },
        { accountId: 6, amount: 60_000 },
      ],
    });
  });

  it("T-FAV-UI-02: leaves archived source blank with notice and shows INSUFFICIENT_FUNDS alert without leaving form", async () => {
    const bankPayment: Transaction = {
      id: 14,
      kind: "PAYMENT",
      date: "2026-11-04",
      totalAmount: 50_000,
      note: "Lunch",
      isFavorite: true,
      source: { id: 1, name: "Bank" },
      lines: [{ accountId: 5, name: "Dining", amount: 50_000 }],
    };
    const draft = toDuplicateDraft(bankPayment, "2026-11-22");
    const accountsWithArchivedBank = SEEDED_ACCOUNTS.map((a) => (a.id === 1 ? { ...a, archived: true } : a));
    renderWithRouterState(
      { pathname: "/transactions/new", search: "?kind=PAYMENT", state: { draft } },
      {
        "GET /api/accounts": { body: { accounts: accountsWithArchivedBank } },
        "POST /api/transactions": {
          status: 400,
          body: { error: { code: "INSUFFICIENT_FUNDS", message: "Not enough funds in Credit Card." } },
        },
      },
    );
    const user = userEvent.setup();

    expect(await screen.findByRole("heading", { level: 1, name: "Duplicate of #14" })).toBeInTheDocument();
    expect(screen.getByLabelText("Paid from")).toHaveValue("");
    expect(screen.getByText(/Bank is archived — choose another account/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    // Pick another active source -> server rejects INSUFFICIENT_FUNDS -> stays on form with values
    await user.selectOptions(screen.getByLabelText("Paid from"), "2");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Not enough funds in Credit Card.");
    expect(screen.getByRole("heading", { level: 1, name: "Duplicate of #14" })).toBeInTheDocument();
    expect(screen.getByLabelText("Note (optional)")).toHaveValue("Lunch");
  });
});

describe("FavoriteToggle, FavoritesCard, and History favorite filter (T-FAV-UI-03)", () => {
  it("T-FAV-UI-03: toggles aria-pressed optimistically and rolls back with an alert on 404 error", async () => {
    const calls = mockApi({
      "PATCH /api/transactions/13/favorite": {
        status: 404,
        body: { error: { code: "NOT_FOUND", message: "Transaction not found." } },
      },
    });
    const user = userEvent.setup();
    render(<FavoriteToggle transactionId={13} isFavorite={false} />);

    const btn = screen.getByRole("button", { name: "Add to favorites" });
    expect(btn).toHaveAttribute("aria-pressed", "false");

    await user.click(btn);

    expect(calls.find((c) => c.method === "PATCH")?.body).toEqual({ isFavorite: true });
    expect(await screen.findByRole("alert")).toHaveTextContent("Transaction not found.");
    expect(screen.getByRole("button", { name: "Add to favorites" })).toHaveAttribute("aria-pressed", "false");
  });

  it("shows up to 5 favorites on the Dashboard Favorites card and Duplicate opens the prefilled form", async () => {
    const sixFavs = Array.from({ length: 6 }, (_, i) => ({
      ...CARD_TX,
      id: 30 + i,
      note: `Fav #${i + 1}`,
    }));
    mockApi({
      "GET /api/summary": {
        body: {
          cash: [{ accountId: 1, name: "Bank", balance: 3_850_000 }],
          loansTaken: [],
          loansGiven: [],
          totals: { income: 0, expense: 0 },
          income: [],
          expense: [],
        },
      },
      "GET /api/transactions?favorite=true": { body: { transactions: sixFavs, truncated: false } },
      "GET /api/accounts": { body: { accounts: SEEDED_ACCOUNTS } },
    });
    const user = userEvent.setup();
    renderAt("/dashboard");

    const card = await screen.findByRole("region", { name: "Favorites" });
    expect(within(card).getAllByRole("button", { name: "Duplicate" })).toHaveLength(5);
    expect(within(card).queryByText("Fav #6")).not.toBeInTheDocument();

    await user.click(within(card).getAllByRole("button", { name: "Duplicate" })[0]);
    expect(await screen.findByRole("heading", { level: 1, name: "Duplicate of #30" })).toBeInTheDocument();
  });

  it("History 'Favorites only' checkbox sets ?favorite=true in URL and request", async () => {
    function LocationProbe() {
      return <div data-testid="url-search">{useLocation().search}</div>;
    }
    mockApi({
      "GET /api/accounts": { body: { accounts: SEEDED_ACCOUNTS } },
      "GET /api/transactions": { body: { transactions: [CARD_TX], truncated: false } },
      "GET /api/transactions?favorite=true": { body: { transactions: [CARD_TX], truncated: false } },
    });
    const user = userEvent.setup();
    const auth: AuthState = { user: alice, loading: false, login: vi.fn(), logout: vi.fn() };
    render(
      <AuthContext.Provider value={auth}>
        <MemoryRouter initialEntries={["/transactions"]}>
          <LocationProbe />
          <AppRoutes />
        </MemoryRouter>
      </AuthContext.Provider>,
    );

    const toggle = await screen.findByLabelText("Favorites only");
    await user.click(toggle);
    expect(await screen.findByTestId("url-search")).toHaveTextContent("favorite=true");
  });
});
