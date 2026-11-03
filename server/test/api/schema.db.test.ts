import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import type { Account, Prisma } from "@prisma/client";
import { getPrisma } from "../../src/prisma.js";
import { resetDb } from "../helpers/db.js";

// S1-02: the rules the database enforces on its own (docs/system-sds.md §3.3). Services must still
// validate first so users get a clear 400; these constraints are the last line of defence.
const prisma = getPrisma();

let aliceId: number;
let bobId: number;
let aliceBank: Account;
let aliceDining: Account;
let bobDining: Account;

function aliceTransaction(overrides: Partial<Prisma.TransactionUncheckedCreateInput> = {}) {
  return prisma.transaction.create({
    data: {
      userId: aliceId,
      kind: "PAYMENT",
      sourceAccountId: aliceBank.id,
      date: new Date("2026-11-03"),
      totalAmount: 50_000,
      ...overrides,
    },
  });
}

beforeAll(async () => {
  await resetDb();
  aliceId = (await prisma.user.findUniqueOrThrow({ where: { username: "alice" } })).id;
  bobId = (await prisma.user.findUniqueOrThrow({ where: { username: "bob" } })).id;
});

beforeEach(async () => {
  await prisma.transaction.deleteMany();
  await prisma.account.deleteMany();
  aliceBank = await prisma.account.create({
    data: { userId: aliceId, name: "Bank", type: "CASH", subtype: "BANK", openingBalance: 1_000_000 },
  });
  aliceDining = await prisma.account.create({ data: { userId: aliceId, name: "Dining", type: "EXPENSE" } });
  bobDining = await prisma.account.create({ data: { userId: bobId, name: "Dining", type: "EXPENSE" } });
});

describe("S1-02 schema: valid data", () => {
  it("stores a transaction with its allocation line", async () => {
    const tx = await aliceTransaction();
    await prisma.transactionLine.create({
      data: { transactionId: tx.id, userId: aliceId, accountId: aliceDining.id, amount: 50_000 },
    });
    const saved = await prisma.transaction.findUniqueOrThrow({
      where: { id: tx.id },
      include: { lines: true },
    });
    expect(saved.lines).toHaveLength(1);
    expect(saved.totalAmount).toBe(50_000);
  });

  it("allows two users to have accounts with the same name", async () => {
    expect(aliceDining.name).toBe(bobDining.name);
  });

  it("deletes a transaction's lines with it", async () => {
    const tx = await aliceTransaction();
    await prisma.transactionLine.create({
      data: { transactionId: tx.id, userId: aliceId, accountId: aliceDining.id, amount: 50_000 },
    });
    await prisma.transaction.delete({ where: { id: tx.id } });
    expect(await prisma.transactionLine.count()).toBe(0);
  });
});

describe("S1-02 schema: ownership (BR-04)", () => {
  it("rejects a line that points at another user's account", async () => {
    const tx = await aliceTransaction();
    await expect(
      prisma.transactionLine.create({
        data: { transactionId: tx.id, userId: aliceId, accountId: bobDining.id, amount: 50_000 },
      }),
    ).rejects.toThrow(/TransactionLine_accountId_userId_fkey/);
  });

  it("rejects a line whose userId differs from its transaction's owner", async () => {
    const tx = await aliceTransaction();
    await expect(
      prisma.transactionLine.create({
        data: { transactionId: tx.id, userId: bobId, accountId: bobDining.id, amount: 50_000 },
      }),
    ).rejects.toThrow(/TransactionLine_transactionId_userId_fkey/);
  });

  it("rejects a transaction whose source account belongs to another user", async () => {
    const bobBank = await prisma.account.create({
      data: { userId: bobId, name: "Bank", type: "CASH", subtype: "BANK" },
    });
    await expect(aliceTransaction({ sourceAccountId: bobBank.id })).rejects.toThrow(
      /Transaction_sourceAccountId_userId_fkey/,
    );
  });

  it("rejects a second account with the same name for the same user", async () => {
    await expect(
      prisma.account.create({ data: { userId: aliceId, name: "Dining", type: "EXPENSE" } }),
    ).rejects.toThrow(/Unique constraint/);
  });

  it("refuses to delete an account that a transaction still uses", async () => {
    await aliceTransaction();
    await expect(prisma.account.delete({ where: { id: aliceBank.id } })).rejects.toThrow(
      /Transaction_sourceAccountId_userId_fkey/,
    );
  });
});

describe("S1-02 schema: amounts (BR-02)", () => {
  it.each([0, -100])("rejects a transaction total of %i", async (totalAmount) => {
    await expect(aliceTransaction({ totalAmount })).rejects.toThrow(/Transaction_totalAmount_positive/);
  });

  it.each([0, -100])("rejects a line amount of %i", async (amount) => {
    const tx = await aliceTransaction();
    await expect(
      prisma.transactionLine.create({
        data: { transactionId: tx.id, userId: aliceId, accountId: aliceDining.id, amount },
      }),
    ).rejects.toThrow(/TransactionLine_amount_positive/);
  });
});

describe("S1-02 schema: accounts (BR-12)", () => {
  it.each(["CASH", "LOAN_TAKEN", "LOAN_GIVEN"] as const)("allows an opening balance on %s", async (type) => {
    const acc = await prisma.account.create({
      data: { userId: aliceId, name: `Opening ${type}`, type, openingBalance: 100 },
    });
    expect(acc.openingBalance).toBe(100);
  });

  it.each(["INCOME", "EXPENSE"] as const)("rejects an opening balance on %s", async (type) => {
    await expect(
      prisma.account.create({
        data: { userId: aliceId, name: `Opening ${type}`, type, openingBalance: 100 },
      }),
    ).rejects.toThrow(/Account_openingBalance_allowed_type/);
  });

  it("rejects a negative opening balance", async () => {
    await expect(
      prisma.account.create({
        data: { userId: aliceId, name: "Wallet", type: "CASH", subtype: "WALLET", openingBalance: -1 },
      }),
    ).rejects.toThrow(/Account_openingBalance_nonnegative/);
  });

  it.each([
    ["CREDIT_CARD", "CASH"],
    ["BANK", "LOAN_TAKEN"],
    ["WALLET", "EXPENSE"],
  ] as const)("rejects subtype %s on a %s account", async (subtype, type) => {
    await expect(
      prisma.account.create({ data: { userId: aliceId, name: `Bad ${subtype}`, type, subtype } }),
    ).rejects.toThrow(/Account_subtype_matches_type/);
  });

  it("allows CREDIT_CARD on a LOAN_TAKEN account", async () => {
    const card = await prisma.account.create({
      data: { userId: aliceId, name: "Credit Card", type: "LOAN_TAKEN", subtype: "CREDIT_CARD" },
    });
    expect(card.subtype).toBe("CREDIT_CARD");
  });
});
