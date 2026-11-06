import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach } from "vitest";
import { SEEDED_ACCOUNTS, mockApi, renderAt } from "./renderApp.js";

// F-04 §5 Payment / Receive form — docs/sprints/sprint-1/F-04-transactions.md.
afterEach(() => vi.unstubAllGlobals());

const CREATED = {
  id: 12,
  kind: "PAYMENT",
  date: "2026-11-03",
  totalAmount: 150_000,
  note: null,
  isFavorite: false,
  source: { id: 2, name: "Credit Card" },
  lines: [
    { accountId: 5, name: "Dining", amount: 90_000 },
    { accountId: 6, name: "Groceries", amount: 60_000 },
  ],
};

function optionNames(select: HTMLElement) {
  return within(select)
    .getAllByRole("option")
    .map((o) => o.textContent)
    .filter((t) => t && !t.startsWith("Choose"));
}

const remaining = () => screen.getByText(/remaining to allocate/i);

describe("TransactionFormPage", () => {
  it("offers only the source and line accounts each form allows (BR-09, BR-10, BR-11)", async () => {
    mockApi({ "GET /api/accounts": { body: { accounts: SEEDED_ACCOUNTS } } });
    const user = userEvent.setup();
    const { unmount } = renderAt("/transactions/new?kind=PAYMENT");

    expect(await screen.findByRole("heading", { level: 1, name: "Record payment" })).toBeInTheDocument();
    expect(optionNames(screen.getByLabelText("Paid from"))).toEqual(["Bank", "Credit Card"]);
    await user.selectOptions(screen.getByLabelText("Paid from"), "Bank");
    // Source never appears as a line; INCOME is not allowed in a payment.
    expect(optionNames(screen.getByLabelText("Account for line 1"))).toEqual([
      "Credit Card",
      "Dining",
      "Electricity",
      "Groceries",
      "Telecom",
    ]);
    unmount();

    renderAt("/transactions/new?kind=RECEIVE");
    expect(
      await screen.findByRole("heading", { level: 1, name: "Record money received" }),
    ).toBeInTheDocument();
    expect(optionNames(screen.getByLabelText("Received into"))).toEqual(["Bank"]);
    // Before a source is chosen, Bank is still a possible transfer line; once it is the source it is not.
    expect(optionNames(screen.getByLabelText("Account for line 1"))).toContain("Bank");
    await user.selectOptions(screen.getByLabelText("Received into"), "Bank");
    expect(optionNames(screen.getByLabelText("Account for line 1"))).toEqual([
      "Credit Card",
      "Interest",
      "Salary",
    ]);
  });

  it("T-TX-UI-01: Save stays disabled until the lines add up, and the split purchase is sent in satang", async () => {
    const calls = mockApi({
      "GET /api/accounts": { body: { accounts: SEEDED_ACCOUNTS } },
      "POST /api/transactions": { status: 201, body: { transaction: CREATED } },
      "GET /api/transactions/12": { body: { transaction: CREATED } },
    });
    const user = userEvent.setup();
    renderAt("/transactions/new?kind=PAYMENT");

    await user.selectOptions(await screen.findByLabelText("Paid from"), "Credit Card");
    const date = screen.getByLabelText("Date");
    await user.clear(date);
    await user.type(date, "2026-11-03");
    await user.type(screen.getByLabelText("Total (THB)"), "1,500.00");
    await user.selectOptions(screen.getByLabelText("Account for line 1"), "Dining");
    await user.type(screen.getByLabelText("Amount for line 1"), "900");

    expect(remaining()).toHaveTextContent("600.00");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Add line" }));
    await user.selectOptions(screen.getByLabelText("Account for line 2"), "Groceries");
    await user.type(screen.getByLabelText("Amount for line 2"), "600");

    expect(remaining()).toHaveTextContent("0.00");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: "Save" }));

    // Lands on the new transaction's page.
    expect(await screen.findByRole("heading", { level: 1, name: "Payment" })).toBeInTheDocument();
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({
      kind: "PAYMENT",
      sourceAccountId: 2,
      date: "2026-11-03",
      totalAmount: 150_000,
      note: null,
      lines: [
        { accountId: 5, amount: 90_000 },
        { accountId: 6, amount: 60_000 },
      ],
    });
  });

  it("T-TX-UI-01: removing a line updates the remaining amount, and the last line cannot be removed", async () => {
    mockApi({ "GET /api/accounts": { body: { accounts: SEEDED_ACCOUNTS } } });
    const user = userEvent.setup();
    renderAt("/transactions/new?kind=PAYMENT");

    await user.type(await screen.findByLabelText("Total (THB)"), "100");
    await user.type(screen.getByLabelText("Amount for line 1"), "60");
    await user.click(screen.getByRole("button", { name: "Add line" }));
    await user.type(screen.getByLabelText("Amount for line 2"), "40");
    expect(remaining()).toHaveTextContent("0.00");

    await user.click(screen.getByRole("button", { name: "Remove line 2" }));
    expect(remaining()).toHaveTextContent("40.00");
    expect(screen.queryByRole("button", { name: "Remove line 1" })).not.toBeInTheDocument();
  });

  it("T-TX-UI-02: a server error is shown and the form keeps its values", async () => {
    mockApi({
      "GET /api/accounts": { body: { accounts: SEEDED_ACCOUNTS } },
      "POST /api/transactions": {
        status: 400,
        body: {
          error: { code: "ALLOCATION_MISMATCH", message: "The allocation lines must add up to the total." },
        },
      },
    });
    const user = userEvent.setup();
    renderAt("/transactions/new?kind=RECEIVE");

    await user.selectOptions(await screen.findByLabelText("Received into"), "Bank");
    await user.type(screen.getByLabelText("Total (THB)"), "30,000");
    await user.selectOptions(screen.getByLabelText("Account for line 1"), "Salary");
    await user.type(screen.getByLabelText("Amount for line 1"), "30,000");
    await user.type(screen.getByLabelText("Note (optional)"), "November salary");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The allocation lines must add up to the total.",
    );
    expect(screen.getByLabelText("Total (THB)")).toHaveValue("30,000");
    expect(screen.getByLabelText("Note (optional)")).toHaveValue("November salary");
    expect(screen.getByRole("button", { name: "Save" })).toBeEnabled();
  });

  it("shows an inline error for an amount that is not valid baht", async () => {
    mockApi({ "GET /api/accounts": { body: { accounts: SEEDED_ACCOUNTS } } });
    const user = userEvent.setup();
    renderAt("/transactions/new?kind=PAYMENT");
    await user.type(await screen.findByLabelText("Total (THB)"), "12.345");
    expect(screen.getByLabelText("Total (THB)")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });
});
