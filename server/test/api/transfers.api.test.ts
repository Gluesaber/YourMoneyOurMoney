import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { accountOf } from "../helpers/accounts.js";
import { agentAs, type SuperAgentTest } from "../helpers/auth.js";
import { resetDb } from "../helpers/db.js";
import { runDemoJourney } from "../helpers/demo.js";

// F-07 Internal account transfers — docs/sprints/sprint-2/F-07-transfers.md §7. The API has accepted CASH
// lines since Sprint 1, so these confirm and guard that behaviour (contract §7 note); F-07 itself is UI work.
const prisma = getPrisma();

beforeEach(async () => {
  await resetDb();
});

async function counts() {
  return { transactions: await prisma.transaction.count(), lines: await prisma.transactionLine.count() };
}

async function createWallet(agent: SuperAgentTest): Promise<number> {
  const res = await agent.post("/api/accounts").send({ name: "Wallet", type: "CASH", subtype: "WALLET" });
  expect(res.status).toBe(201);
  return res.body.account.id;
}

// The body the Transfer form sends (contract §3).
function transfer(from: number, to: number, amount: number) {
  return {
    kind: "PAYMENT",
    sourceAccountId: from,
    date: "2026-11-22",
    totalAmount: amount,
    note: "ATM",
    lines: [{ accountId: to, amount }],
  };
}

const balanceOf = (accounts: { id: number; balance: number }[], id: number) =>
  accounts.find((a) => a.id === id)?.balance;

describe("Transfers between Cash accounts", () => {
  it("T-TX-API-11: 2,000.00 Bank → Wallet moves both balances", async () => {
    const agent = await agentAs("alice");
    await runDemoJourney(agent);
    const bank = (await accountOf("alice", "Bank")).id;
    const wallet = await createWallet(agent);

    const res = await agent.post("/api/transactions").send(transfer(bank, wallet, 200_000));
    expect(res.status).toBe(201);
    expect(res.body.transaction).toMatchObject({
      kind: "PAYMENT",
      source: { id: bank, name: "Bank" },
      lines: [{ accountId: wallet, name: "Wallet", amount: 200_000 }],
    });

    const accounts = (await agent.get("/api/accounts")).body.accounts;
    expect(balanceOf(accounts, bank)).toBe(3_650_000);
    expect(balanceOf(accounts, wallet)).toBe(200_000);
  });

  it("T-TX-API-12: a transfer changes no income, expense or category total (BR-08)", async () => {
    const agent = await agentAs("alice");
    await runDemoJourney(agent);
    const bank = (await accountOf("alice", "Bank")).id;
    const wallet = await createWallet(agent);
    const before = (await agent.get("/api/summary")).body;

    await agent
      .post("/api/transactions")
      .send(transfer(bank, wallet, 200_000))
      .expect(201);
    const after = (await agent.get("/api/summary")).body;

    expect(after.totals).toEqual(before.totals);
    expect(after.totals).toEqual({ income: 3_000_000, expense: 150_000 });
    expect(after.income).toEqual(before.income);
    expect(after.expense).toEqual(before.expense);
  });

  it("T-TX-API-14: same account, bob's account, ADMIN and anonymous are refused and nothing is saved", async () => {
    const agent = await agentAs("alice");
    const bank = (await accountOf("alice", "Bank")).id;
    const wallet = await createWallet(agent);
    const bobBank = (await accountOf("bob", "Bank")).id;
    const before = await counts();

    const same = await agent.post("/api/transactions").send(transfer(bank, bank, 100));
    expect(same.status).toBe(400);
    expect(same.body.error).toMatchObject({
      code: "VALIDATION_ERROR",
      details: { field: "lines", lineIndex: 0 },
    });

    const toBob = await agent.post("/api/transactions").send(transfer(bank, bobBank, 100));
    expect(toBob.status).toBe(404);
    expect(toBob.body.error.code).toBe("NOT_FOUND");

    const admin = await (await agentAs("admin")).post("/api/transactions").send(transfer(bank, wallet, 100));
    expect(admin.status).toBe(403);
    expect(admin.body.error.code).toBe("FORBIDDEN");

    const anon = await request(createApp())
      .post("/api/transactions")
      .send(transfer(bank, wallet, 100));
    expect(anon.status).toBe(401);
    expect(anon.body.error.code).toBe("UNAUTHENTICATED");

    expect(await counts()).toEqual(before);
  });
});
