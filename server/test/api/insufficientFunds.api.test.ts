import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { accountOf } from "../helpers/accounts.js";
import { agentAs, type SuperAgentTest } from "../helpers/auth.js";
import { resetDb } from "../helpers/db.js";

// Lab 7 L7-01, BR-14 — no Cash overdraft. F-04 v1.1 §7 (docs/sprints/sprint-1/F-04-transactions.md) and
// docs/labs/lab07/change-impact.md. Amounts in satang.
const prisma = getPrisma();

beforeEach(async () => {
  await resetDb();
});

async function counts() {
  return { transactions: await prisma.transaction.count(), lines: await prisma.transactionLine.count() };
}

async function balances(agent: SuperAgentTest): Promise<Record<string, number>> {
  const accounts = (await agent.get("/api/accounts").expect(200)).body.accounts as {
    name: string;
    balance: number;
  }[];
  return Object.fromEntries(accounts.map((a) => [a.name, a.balance]));
}

async function openingBalance(agent: SuperAgentTest, accountId: number, amount: number) {
  await agent
    .put(`/api/accounts/${accountId}/opening-balance`)
    .send({ openingBalance: amount, openingDate: "2026-11-01" })
    .expect(200);
}

function payment(sourceAccountId: number, lineAccountId: number, amount: number) {
  return {
    kind: "PAYMENT",
    sourceAccountId,
    date: "2026-11-24",
    totalAmount: amount,
    lines: [{ accountId: lineAccountId, amount }],
  };
}

async function createAccount(agent: SuperAgentTest, body: object): Promise<number> {
  return (await agent.post("/api/accounts").send(body).expect(201)).body.account.id;
}

describe("BR-14: a new transaction cannot overdraw a Cash account", () => {
  it("T-FUND-API-01: paying exactly the Bank balance is allowed and leaves Bank at 0", async () => {
    const agent = await agentAs("alice");
    const [bank, dining] = await Promise.all([accountOf("alice", "Bank"), accountOf("alice", "Dining")]);
    await openingBalance(agent, bank.id, 150_000);

    const res = await agent.post("/api/transactions").send(payment(bank.id, dining.id, 150_000));
    expect(res.status).toBe(201);
    expect((await balances(agent)).Bank).toBe(0);
  });

  it("T-FUND-API-02: 1 satang more than the balance → 400 INSUFFICIENT_FUNDS; nothing saved, no balance changes", async () => {
    const agent = await agentAs("alice");
    const [bank, dining] = await Promise.all([accountOf("alice", "Bank"), accountOf("alice", "Dining")]);
    await openingBalance(agent, bank.id, 150_000);
    const before = { counts: await counts(), balances: await balances(agent) };

    const res = await agent.post("/api/transactions").send(payment(bank.id, dining.id, 150_001));
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: "INSUFFICIENT_FUNDS",
      message: "This would overdraw Bank.",
      details: { accountId: bank.id, balance: 150_000, required: 150_001, shortfall: 1 },
    });
    expect({ counts: await counts(), balances: await balances(agent) }).toEqual(before);
  });

  it("T-FUND-API-03: an empty Bank cannot pay even 1 satang", async () => {
    const agent = await agentAs("alice");
    const [bank, dining] = await Promise.all([accountOf("alice", "Bank"), accountOf("alice", "Dining")]);
    const before = await counts();

    const res = await agent.post("/api/transactions").send(payment(bank.id, dining.id, 1));
    expect(res.status).toBe(400);
    expect(res.body.error).toMatchObject({
      code: "INSUFFICIENT_FUNDS",
      details: { balance: 0, shortfall: 1 },
    });
    expect(await counts()).toEqual(before);
  });

  it("T-FUND-API-04: card payments have no limit, and a Cash account that is already negative still receives", async () => {
    const agent = await agentAs("alice");
    const [alice, bank, card, dining, salary] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { username: "alice" } }),
      accountOf("alice", "Bank"),
      accountOf("alice", "Credit Card"),
      accountOf("alice", "Dining"),
      accountOf("alice", "Salary"),
    ]);

    expect(
      (await agent.post("/api/transactions").send(payment(card.id, dining.id, 2_147_483_647))).status,
    ).toBe(201);

    // A Bank at −10,000 written directly, as data recorded before L7-01 could be.
    const old = await prisma.transaction.create({
      data: {
        userId: alice.id,
        kind: "PAYMENT",
        sourceAccountId: bank.id,
        date: new Date("2026-11-02T00:00:00.000Z"),
        totalAmount: 10_000,
      },
    });
    await prisma.transactionLine.create({
      data: { transactionId: old.id, userId: alice.id, accountId: dining.id, amount: 10_000 },
    });
    expect((await balances(agent)).Bank).toBe(-10_000);

    const receive = await agent.post("/api/transactions").send({
      kind: "RECEIVE",
      sourceAccountId: bank.id,
      date: "2026-11-24",
      totalAmount: 1,
      lines: [{ accountId: salary.id, amount: 1 }],
    });
    expect(receive.status).toBe(201);
    expect((await balances(agent)).Bank).toBe(-9_999);
  });

  it("T-FUND-API-05: the existing rules and the archived check come first, never INSUFFICIENT_FUNDS", async () => {
    const agent = await agentAs("alice");
    const [bank, dining, salary, telecom] = await Promise.all(
      ["Bank", "Dining", "Salary", "Telecom"].map((n) => accountOf("alice", n)),
    );
    await agent.patch(`/api/accounts/${telecom.id}/archive`).send({ archived: true }).expect(200);

    const mismatch = await agent
      .post("/api/transactions")
      .send({ ...payment(bank.id, dining.id, 100), totalAmount: 200 });
    expect(mismatch.body.error.code).toBe("ALLOCATION_MISMATCH");
    const wrongType = await agent.post("/api/transactions").send(payment(bank.id, salary.id, 100));
    expect(wrongType.body.error.code).toBe("INVALID_ACCOUNT_TYPE");
    const archived = await agent.post("/api/transactions").send(payment(bank.id, telecom.id, 100));
    expect(archived.body.error.code).toBe("ACCOUNT_ARCHIVED");
  });

  it("T-FUND-API-06: another user's Bank → 404 with no balance revealed; ADMIN → 403; anonymous → 401", async () => {
    const bob = await agentAs("bob");
    const bobBank = await accountOf("bob", "Bank");
    await openingBalance(bob, bobBank.id, 1_000_000);
    const aliceDining = await accountOf("alice", "Dining");
    const aliceBank = await accountOf("alice", "Bank");
    const before = await counts();

    const alice = await agentAs("alice");
    const cross = await alice.post("/api/transactions").send(payment(bobBank.id, aliceDining.id, 1));
    expect(cross.status).toBe(404);
    expect(cross.body.error.code).toBe("NOT_FOUND");
    expect(JSON.stringify(cross.body)).not.toContain("1000000");

    const admin = await (
      await agentAs("admin")
    )
      .post("/api/transactions")
      .send(payment(aliceBank.id, aliceDining.id, 1));
    expect(admin.status).toBe(403);
    const anon = await request(createApp())
      .post("/api/transactions")
      .send(payment(aliceBank.id, aliceDining.id, 1));
    expect(anon.status).toBe(401);
    expect(await counts()).toEqual(before);
  });

  it("T-FUND-API-07: a transfer cannot overdraw its From account (F-07 AC-TX-15)", async () => {
    const agent = await agentAs("alice");
    const bank = await accountOf("alice", "Bank");
    const wallet = await createAccount(agent, { name: "Wallet", type: "CASH", subtype: "WALLET" });
    await openingBalance(agent, wallet, 200_000);
    const before = await counts();

    const over = await agent.post("/api/transactions").send(payment(wallet, bank.id, 200_001));
    expect(over.status).toBe(400);
    expect(over.body.error).toMatchObject({
      code: "INSUFFICIENT_FUNDS",
      details: { accountId: wallet, balance: 200_000, required: 200_001, shortfall: 1 },
    });
    expect(await counts()).toEqual(before);

    expect((await agent.post("/api/transactions").send(payment(wallet, bank.id, 200_000))).status).toBe(201);
    const after = await balances(agent);
    expect(after.Wallet).toBe(0);
    expect(after.Bank).toBe(200_000);
  });

  it("T-FUND-API-08: lending cannot overdraw the Cash account (F-08 AC-DEBT-03)", async () => {
    const agent = await agentAs("alice");
    const bank = await accountOf("alice", "Bank");
    const ben = await createAccount(agent, { name: "Ben", type: "LOAN_GIVEN" });
    const before = await counts();

    const lend = await agent.post("/api/transactions").send(payment(bank.id, ben, 1));
    expect(lend.status).toBe(400);
    expect(lend.body.error.code).toBe("INSUFFICIENT_FUNDS");
    expect(await counts()).toEqual(before);
  });

  it("T-FUND-API-09: CASH lines of a RECEIVE are summed per account and cannot overdraw it", async () => {
    const agent = await agentAs("alice");
    const bank = await accountOf("alice", "Bank");
    const wallet = await createAccount(agent, { name: "Wallet", type: "CASH", subtype: "WALLET" });
    await openingBalance(agent, wallet, 50_000);
    const before = await counts();

    const res = await agent.post("/api/transactions").send({
      kind: "RECEIVE",
      sourceAccountId: bank.id,
      date: "2026-11-24",
      totalAmount: 60_000,
      lines: [
        { accountId: wallet, amount: 30_000 },
        { accountId: wallet, amount: 30_000 },
      ],
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toEqual({
      code: "INSUFFICIENT_FUNDS",
      message: "This would overdraw Wallet.",
      details: { accountId: wallet, balance: 50_000, required: 60_000, shortfall: 10_000 },
    });
    expect(await counts()).toEqual(before);
  });
});
