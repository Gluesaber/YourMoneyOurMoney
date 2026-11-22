import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach } from "vitest";
import { SEEDED_ACCOUNTS, mockApi, renderAt } from "./renderApp.js";

// F-07 §5 Transfer form — docs/sprints/sprint-2/F-07-transfers.md. T-TRF-UI-01, T-TRF-UI-02.
afterEach(() => vi.unstubAllGlobals());

const BANK = { ...SEEDED_ACCOUNTS[0], balance: 3_850_000 };
const WALLET = {
  id: 9,
  name: "Wallet",
  type: "CASH",
  subtype: "WALLET",
  openingBalance: 0,
  openingDate: null,
  balance: 0,
  archived: false,
};
const OLD_WALLET = { ...WALLET, id: 10, name: "Old wallet", archived: true };
const ACCOUNTS = [BANK, WALLET, OLD_WALLET, ...SEEDED_ACCOUNTS.slice(1)];

const CREATED = {
  id: 20,
  kind: "PAYMENT",
  date: "2026-11-22",
  totalAmount: 200_000,
  note: "ATM",
  isFavorite: false,
  source: { id: 1, name: "Bank" },
  lines: [{ accountId: 9, name: "Wallet", amount: 200_000 }],
};

function optionNames(select: HTMLElement) {
  return within(select)
    .getAllByRole("option")
    .map((o) => o.textContent ?? "")
    .filter((t) => !t.startsWith("Choose"));
}

async function fillTransfer(user: ReturnType<typeof userEvent.setup>) {
  await user.selectOptions(await screen.findByLabelText("From"), "1");
  await user.selectOptions(screen.getByLabelText("To"), "9");
  await user.type(screen.getByLabelText("Amount (THB)"), "2,000");
  const date = screen.getByLabelText("Date");
  await user.clear(date);
  await user.type(date, "2026-11-22");
  await user.type(screen.getByLabelText("Note (optional)"), "ATM");
}

describe("TransferFormPage", () => {
  it("T-TRF-UI-01: offers only active cash accounts, never From as To, and sends the contract body", async () => {
    const calls = mockApi({
      "GET /api/accounts": { body: { accounts: ACCOUNTS } },
      "POST /api/transactions": { status: 201, body: { transaction: CREATED } },
      "GET /api/transactions/20": { body: { transaction: CREATED } },
    });
    const user = userEvent.setup();
    renderAt("/transfers/new");

    expect(
      await screen.findByRole("heading", { level: 1, name: "Transfer between cash accounts" }),
    ).toBeInTheDocument();
    const from = screen.getByLabelText("From");
    expect(optionNames(from)).toEqual([
      expect.stringMatching(/^Bank\b.*38,500\.00/),
      expect.stringMatching(/^Wallet\b/),
    ]);
    const save = screen.getByRole("button", { name: "Save" });
    expect(save).toBeDisabled();

    await user.selectOptions(from, "1");
    expect(optionNames(screen.getByLabelText("To"))).toEqual([expect.stringMatching(/^Wallet\b/)]);
    expect(save).toBeDisabled();

    await fillTransfer(user);
    expect(save).toBeEnabled();
    await user.click(save);

    expect(await screen.findByText("Transfer: Bank → Wallet")).toBeInTheDocument();
    expect(calls.find((c) => c.method === "POST")?.body).toEqual({
      kind: "PAYMENT",
      sourceAccountId: 1,
      date: "2026-11-22",
      totalAmount: 200_000,
      note: "ATM",
      lines: [{ accountId: 9, amount: 200_000 }],
    });
  });

  it("T-TRF-UI-02: a server rule error is shown and the entered values are kept", async () => {
    mockApi({
      "GET /api/accounts": { body: { accounts: ACCOUNTS } },
      "POST /api/transactions": {
        status: 400,
        body: {
          error: {
            code: "ACCOUNT_ARCHIVED",
            message: "Wallet is archived. Unarchive it or choose another account.",
            details: { field: "lines", lineIndex: 0, accountId: 9 },
          },
        },
      },
    });
    const user = userEvent.setup();
    renderAt("/transfers/new");

    await fillTransfer(user);
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Wallet is archived.");
    expect(screen.getByLabelText("From")).toHaveValue("1");
    expect(screen.getByLabelText("To")).toHaveValue("9");
    expect(screen.getByLabelText("Amount (THB)")).toHaveValue("2,000");
    expect(screen.getByLabelText("Note (optional)")).toHaveValue("ATM");
  });
});
