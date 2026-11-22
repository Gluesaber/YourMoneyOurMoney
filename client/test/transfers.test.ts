import type { Account, Transaction } from "../src/api/finance.js";
import { isTransfer, transferLabel } from "../src/lib/transactions.js";

// F-07 §2 "Transfer, as displayed" — docs/sprints/sprint-2/F-07-transfers.md. T-TRF-UNIT-01.
const TYPES: [number, Account["type"]][] = [
  [1, "CASH"], // Bank
  [2, "LOAN_TAKEN"], // Credit Card
  [3, "INCOME"], // Salary
  [5, "EXPENSE"], // Dining
  [9, "CASH"], // Wallet
];
const accountsById = new Map(TYPES.map(([id, type]) => [id, { type }]));

function tx(
  kind: Transaction["kind"],
  source: [number, string],
  lines: [number, string, number][],
): Transaction {
  const total = lines.reduce((s, [, , amount]) => s + amount, 0);
  return {
    id: 1,
    kind,
    date: "2026-11-22",
    totalAmount: total,
    note: null,
    isFavorite: false,
    source: { id: source[0], name: source[1] },
    lines: lines.map(([accountId, name, amount]) => ({ accountId, name, amount })),
  };
}

describe("isTransfer / transferLabel (T-TRF-UNIT-01)", () => {
  it.each([
    [
      "PAYMENT Bank → Wallet",
      tx("PAYMENT", [1, "Bank"], [[9, "Wallet", 200_000]]),
      "Transfer: Bank → Wallet",
    ],
    [
      "RECEIVE into Bank with a Wallet line (money moved Wallet → Bank)",
      tx("RECEIVE", [1, "Bank"], [[9, "Wallet", 200_000]]),
      "Transfer: Wallet → Bank",
    ],
    ["PAYMENT Bank → Dining", tx("PAYMENT", [1, "Bank"], [[5, "Dining", 100]]), null],
    ["PAYMENT Credit Card → Bank", tx("PAYMENT", [2, "Credit Card"], [[1, "Bank", 100]]), null],
    [
      "PAYMENT Bank → Wallet + Dining",
      tx(
        "PAYMENT",
        [1, "Bank"],
        [
          [9, "Wallet", 100],
          [5, "Dining", 100],
        ],
      ),
      null,
    ],
  ])("%s", (_label, transaction, expected) => {
    expect(transferLabel(transaction, accountsById)).toBe(expected);
    expect(isTransfer(transaction, accountsById)).toBe(expected !== null);
  });

  it("is not a transfer when an account's type is unknown (accounts not loaded)", () => {
    const t = tx("PAYMENT", [1, "Bank"], [[9, "Wallet", 100]]);
    expect(transferLabel(t, new Map())).toBeNull();
    expect(isTransfer(t, new Map())).toBe(false);
  });
});
