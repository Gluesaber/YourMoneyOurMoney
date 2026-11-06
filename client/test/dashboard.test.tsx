import { screen, within } from "@testing-library/react";
import { afterEach } from "vitest";
import { mockApi, renderAt } from "./renderApp.js";

// F-05 §5 Dashboard — docs/sprints/sprint-1/F-05-summary-history.md.
afterEach(() => vi.unstubAllGlobals());

const DEMO_SUMMARY = {
  cash: [{ accountId: 1, name: "Bank", balance: 3_850_000 }],
  loansTaken: [{ accountId: 2, name: "Credit Card", outstanding: 0 }],
  loansGiven: [],
  totals: { income: 3_000_000, expense: 150_000 },
  income: [
    { accountId: 4, name: "Interest", total: 0 },
    { accountId: 3, name: "Salary", total: 3_000_000 },
  ],
  expense: [
    { accountId: 5, name: "Dining", total: 90_000 },
    { accountId: 7, name: "Electricity", total: 0 },
    { accountId: 6, name: "Groceries", total: 60_000 },
    { accountId: 8, name: "Telecom", total: 0 },
  ],
};

function row(name: string) {
  return screen.getByRole("row", { name: new RegExp(`^${name}\\b`) });
}

describe("DashboardPage", () => {
  it("T-SUM-UI-01: shows balances, debt, totals and every category formatted in baht", async () => {
    mockApi({ "GET /api/summary": { body: DEMO_SUMMARY } });
    renderAt("/dashboard");

    expect(await screen.findByRole("heading", { level: 1, name: "Dashboard" })).toBeInTheDocument();
    expect(await screen.findByRole("row", { name: /^Bank\b/ })).toHaveTextContent("38,500.00");
    expect(row("Credit Card")).toHaveTextContent("0.00");
    expect(row("Total income")).toHaveTextContent("30,000.00");
    expect(row("Total expense")).toHaveTextContent("1,500.00");
    expect(row("Salary")).toHaveTextContent("30,000.00");
    expect(row("Dining")).toHaveTextContent("900.00");
    expect(row("Groceries")).toHaveTextContent("600.00");
    expect(row("Telecom")).toHaveTextContent("0.00");
    // No Loan Given accounts → no Loan Given section.
    expect(screen.queryByText("Money owed to you")).not.toBeInTheDocument();
    expect(screen.getByText("Money you owe")).toBeInTheDocument();
  });

  it("T-SUM-UI-01: a negative balance is shown with a minus sign and highlighted", async () => {
    mockApi({
      "GET /api/summary": {
        body: { ...DEMO_SUMMARY, cash: [{ accountId: 1, name: "Bank", balance: -150_000 }] },
      },
    });
    renderAt("/dashboard");
    const amount = within(await screen.findByRole("row", { name: /^Bank\b/ })).getByText("-1,500.00");
    expect(amount).toHaveClass("text-danger");
  });

  it("links to the forms, history and each eligible opening balance", async () => {
    mockApi({ "GET /api/summary": { body: DEMO_SUMMARY } });
    renderAt("/dashboard");
    expect(await screen.findByRole("link", { name: "Record payment" })).toHaveAttribute(
      "href",
      "/transactions/new?kind=PAYMENT",
    );
    expect(screen.getByRole("link", { name: "Record money received" })).toHaveAttribute(
      "href",
      "/transactions/new?kind=RECEIVE",
    );
    expect(screen.getByRole("link", { name: "History" })).toHaveAttribute("href", "/transactions");
    expect(screen.getByRole("link", { name: "Set opening balance for Bank" })).toHaveAttribute(
      "href",
      "/accounts/1/opening-balance",
    );
    expect(screen.getByRole("link", { name: "Set opening balance for Credit Card" })).toBeInTheDocument();
    // Income and expense categories cannot have an opening balance (BR-12).
    expect(screen.queryByRole("link", { name: "Set opening balance for Salary" })).not.toBeInTheDocument();
  });

  it("shows a hint for a new user whose numbers are all zero", async () => {
    const zero = {
      ...DEMO_SUMMARY,
      cash: [{ accountId: 1, name: "Bank", balance: 0 }],
      totals: { income: 0, expense: 0 },
      income: DEMO_SUMMARY.income.map((e) => ({ ...e, total: 0 })),
      expense: DEMO_SUMMARY.expense.map((e) => ({ ...e, total: 0 })),
    };
    mockApi({ "GET /api/summary": { body: zero } });
    renderAt("/dashboard");
    expect(await screen.findByText(/set the opening balance/i)).toBeInTheDocument();
  });

  it("shows the server's message when the summary cannot be loaded", async () => {
    mockApi({
      "GET /api/summary": {
        status: 500,
        body: { error: { code: "INTERNAL_ERROR", message: "Something went wrong." } },
      },
    });
    renderAt("/dashboard");
    expect(await screen.findByRole("alert")).toHaveTextContent("Something went wrong.");
  });
});
