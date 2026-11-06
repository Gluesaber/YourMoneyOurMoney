import { describe, expect, it } from "vitest";
import type { AccountType } from "@prisma/client";
import { AppError } from "../../src/lib/errors.js";
import { validateTransaction, type TransactionInput } from "../../src/services/ledger.js";

// validateTransaction — steps 3–6 of docs/sprints/sprint-1/F-04-transactions.md §2.
// Accounts 1–8 mirror one user's seeded set; 9 and 10 are a Wallet and a loan given for the other line types.
const ACCOUNTS = new Map<number, { id: number; type: AccountType }>(
  (
    [
      [1, "CASH"], // Bank
      [2, "LOAN_TAKEN"], // Credit Card
      [3, "INCOME"], // Salary
      [4, "INCOME"], // Interest
      [5, "EXPENSE"], // Dining
      [6, "EXPENSE"], // Groceries
      [7, "EXPENSE"], // Electricity
      [8, "EXPENSE"], // Telecom
      [9, "CASH"], // Wallet
      [10, "LOAN_GIVEN"], // Loan to a friend
    ] as const
  ).map(([id, type]) => [id, { id, type }]),
);

function input(
  kind: TransactionInput["kind"],
  sourceAccountId: number,
  lines: [number, number][],
  totalAmount = lines.reduce((s, [, a]) => s + a, 0),
): TransactionInput {
  return {
    kind,
    sourceAccountId,
    totalAmount,
    lines: lines.map(([accountId, amount]) => ({ accountId, amount })),
  };
}

function errorOf(fn: () => void): AppError {
  try {
    fn();
  } catch (err) {
    expect(err).toBeInstanceOf(AppError);
    return err as AppError;
  }
  throw new Error("expected validateTransaction to throw");
}

describe("validateTransaction", () => {
  it.each([
    ["demo #1: RECEIVE into Bank from Salary", input("RECEIVE", 1, [[3, 3_000_000]])],
    [
      "demo #2: PAYMENT from Credit Card to Dining + Groceries",
      input("PAYMENT", 2, [
        [5, 90_000],
        [6, 60_000],
      ]),
    ],
    ["demo #3: PAYMENT from Bank to Credit Card (repayment)", input("PAYMENT", 1, [[2, 150_000]])],
    ["PAYMENT from Bank to Wallet (transfer)", input("PAYMENT", 1, [[9, 100]])],
    ["PAYMENT from Bank to a loan given (lend)", input("PAYMENT", 1, [[10, 100]])],
    ["RECEIVE into Bank from a loan given (repaid)", input("RECEIVE", 1, [[10, 100]])],
    ["RECEIVE into Bank from Credit Card (borrow)", input("RECEIVE", 1, [[2, 100]])],
    ["RECEIVE into Bank from Wallet (transfer)", input("RECEIVE", 1, [[9, 100]])],
    [
      "the same account on two lines",
      input("PAYMENT", 2, [
        [5, 40_000],
        [5, 30_000],
      ]),
    ],
  ])("T-TX-UNIT-01: accepts %s", (_case, tx) => {
    expect(() => validateTransaction(tx, ACCOUNTS)).not.toThrow();
  });

  it.each([
    [149_999, -1],
    [150_001, 1],
  ])(
    "T-TX-UNIT-02: lines totalling %i against a total of 150000 → ALLOCATION_MISMATCH",
    (linesTotal, difference) => {
      const tx = input(
        "PAYMENT",
        2,
        [
          [5, 90_000],
          [6, linesTotal - 90_000],
        ],
        150_000,
      );
      const err = errorOf(() => validateTransaction(tx, ACCOUNTS));
      expect(err.status).toBe(400);
      expect(err.code).toBe("ALLOCATION_MISMATCH");
      expect(err.details).toEqual({ totalAmount: 150_000, linesTotal, difference });
    },
  );

  it.each([
    ["PAYMENT", 3, "INCOME"],
    ["PAYMENT", 5, "EXPENSE"],
    ["PAYMENT", 10, "LOAN_GIVEN"],
    ["RECEIVE", 2, "LOAN_TAKEN"],
    ["RECEIVE", 3, "INCOME"],
    ["RECEIVE", 5, "EXPENSE"],
    ["RECEIVE", 10, "LOAN_GIVEN"],
  ] as const)("T-TX-UNIT-03: %s from account %i (%s) → INVALID_ACCOUNT_TYPE", (kind, sourceId, type) => {
    const line = kind === "PAYMENT" ? 6 : 4; // any allowed line that is not the source
    const err = errorOf(() => validateTransaction(input(kind, sourceId, [[line, 100]]), ACCOUNTS));
    expect(err.code).toBe("INVALID_ACCOUNT_TYPE");
    expect(err.details).toEqual({ field: "sourceAccountId", type });
  });

  it.each([
    ["PAYMENT", 3, "INCOME"],
    ["RECEIVE", 5, "EXPENSE"],
  ] as const)(
    "T-TX-UNIT-04: %s with a line on account %i (%s) → INVALID_ACCOUNT_TYPE naming the line",
    (kind, lineId, type) => {
      const tx = input(kind, 1, [
        [kind === "PAYMENT" ? 5 : 3, 100],
        [lineId, 100],
      ]);
      const err = errorOf(() => validateTransaction(tx, ACCOUNTS));
      expect(err.code).toBe("INVALID_ACCOUNT_TYPE");
      expect(err.details).toEqual({ field: "lines", lineIndex: 1, type });
    },
  );

  it("T-TX-UNIT-05: the source account used as a line → VALIDATION_ERROR naming the line", () => {
    const tx = input("PAYMENT", 1, [
      [5, 100],
      [1, 100],
    ]);
    const err = errorOf(() => validateTransaction(tx, ACCOUNTS));
    expect(err.code).toBe("VALIDATION_ERROR");
    expect(err.details).toEqual({ field: "lines", lineIndex: 1 });
  });

  it("T-TX-UNIT-06: checks run in contract order — a wrong source type wins over a wrong sum", () => {
    const tx = input("RECEIVE", 2, [[3, 100]], 999);
    expect(errorOf(() => validateTransaction(tx, ACCOUNTS)).code).toBe("INVALID_ACCOUNT_TYPE");
  });

  it("T-TX-UNIT-06: source-as-line (step 4) wins over a wrong line type (step 5)", () => {
    const tx = input("PAYMENT", 1, [
      [1, 100],
      [3, 100],
    ]);
    expect(errorOf(() => validateTransaction(tx, ACCOUNTS)).code).toBe("VALIDATION_ERROR");
  });
});
