import { describe, expect, it } from "vitest";
import type { AccountType } from "@prisma/client";
import { AppError } from "../../src/lib/errors.js";
import { checkCashFunds, type TransactionInput } from "../../src/services/ledger.js";

// BR-14 / F-04 v1.1 §2 step 7 (docs/sprints/sprint-1/F-04-transactions.md, docs/labs/lab07/change-impact.md):
// a new transaction must not leave any CASH account it decreases below 0.
const ACCOUNTS = new Map<number, { id: number; type: AccountType; name: string }>(
  (
    [
      [1, "CASH", "Bank"],
      [2, "LOAN_TAKEN", "Credit Card"],
      [3, "INCOME", "Salary"],
      [5, "EXPENSE", "Dining"],
      [9, "CASH", "Wallet"],
    ] as const
  ).map(([id, type, name]) => [id, { id, type, name }]),
);

function input(
  kind: TransactionInput["kind"],
  sourceAccountId: number,
  lines: [number, number][],
): TransactionInput {
  return {
    kind,
    sourceAccountId,
    totalAmount: lines.reduce((s, [, amount]) => s + amount, 0),
    lines: lines.map(([accountId, amount]) => ({ accountId, amount })),
  };
}

function errorOf(fn: () => void): AppError {
  try {
    fn();
  } catch (err) {
    return err as AppError;
  }
  throw new Error("expected an error");
}

describe("checkCashFunds (BR-14)", () => {
  it("T-FUND-UNIT-01: paying exactly the balance is allowed; 1 satang more is refused with the shortfall", () => {
    const balances = new Map([[1, 150_000]]);
    expect(() => checkCashFunds(input("PAYMENT", 1, [[5, 150_000]]), ACCOUNTS, balances)).not.toThrow();

    const err = errorOf(() => checkCashFunds(input("PAYMENT", 1, [[5, 150_001]]), ACCOUNTS, balances));
    expect(err).toBeInstanceOf(AppError);
    expect(err).toMatchObject({
      status: 400,
      code: "INSUFFICIENT_FUNDS",
      message: "This would overdraw Bank.",
      details: { accountId: 1, balance: 150_000, required: 150_001, shortfall: 1 },
    });
  });

  it("T-FUND-UNIT-01: from an account that is already negative, shortfall = required − balance", () => {
    const err = errorOf(() =>
      checkCashFunds(input("PAYMENT", 1, [[5, 5_000]]), ACCOUNTS, new Map([[1, -10_000]])),
    );
    expect(err).toMatchObject({
      code: "INSUFFICIENT_FUNDS",
      details: { accountId: 1, balance: -10_000, required: 5_000, shortfall: 15_000 },
    });
  });

  it("T-FUND-UNIT-02: CASH lines of a RECEIVE decrease that account and are summed per account", () => {
    const balances = new Map([
      [1, 0],
      [9, 50_000],
    ]);
    const err = errorOf(() =>
      checkCashFunds(
        input("RECEIVE", 1, [
          [9, 30_000],
          [9, 30_000],
        ]),
        ACCOUNTS,
        balances,
      ),
    );
    expect(err).toMatchObject({
      code: "INSUFFICIENT_FUNDS",
      message: "This would overdraw Wallet.",
      details: { accountId: 9, balance: 50_000, required: 60_000, shortfall: 10_000 },
    });
    expect(() =>
      checkCashFunds(
        input("RECEIVE", 1, [
          [9, 25_000],
          [9, 25_000],
        ]),
        ACCOUNTS,
        balances,
      ),
    ).not.toThrow();
  });

  it("T-FUND-UNIT-03: card payments, receives into a negative account and money into a CASH line are never refused", () => {
    const balances = new Map([
      [1, -10_000],
      [2, 0],
      [9, 0],
    ]);
    // A card (LOAN_TAKEN) source has no limit.
    expect(() => checkCashFunds(input("PAYMENT", 2, [[5, 2_147_483_647]]), ACCOUNTS, balances)).not.toThrow();
    // A RECEIVE only increases its CASH source, even one that is already negative.
    expect(() => checkCashFunds(input("RECEIVE", 1, [[3, 1]]), ACCOUNTS, balances)).not.toThrow();
    // A PAYMENT line to a CASH account increases it (money into Wallet from the card).
    expect(() => checkCashFunds(input("PAYMENT", 2, [[9, 100]]), ACCOUNTS, balances)).not.toThrow();
  });
});
