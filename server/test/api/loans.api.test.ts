import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { accountOf } from "../helpers/accounts.js";
import { agentAs, type SuperAgentTest } from "../helpers/auth.js";
import { resetDb } from "../helpers/db.js";
import { runDemoJourney } from "../helpers/demo.js";

// F-08 Debt & Receivable Lifecycle — docs/sprints/sprint-2/F-08-loans.md §7.
// T-DEBT-API-01, T-DEBT-API-02, T-DEBT-API-04 (T-DEBT-API-03 overdraft moved to L7-01 per contract v0.3).
const prisma = getPrisma();

beforeEach(async () => {
  await resetDb();
});

async function counts() {
  return { transactions: await prisma.transaction.count(), lines: await prisma.transactionLine.count() };
}

async function createLoanAccount(
  agent: SuperAgentTest,
  name: string,
  type: "LOAN_GIVEN" | "LOAN_TAKEN",
): Promise<number> {
  const res = await agent.post("/api/accounts").send({ name, type, subtype: null });
  expect(res.status).toBe(201);
  return res.body.account.id;
}

const balanceOf = (accounts: { id: number; balance: number }[], id: number) =>
  accounts.find((a) => a.id === id)?.balance;

describe("F-08 Lending and borrowing (API)", () => {
  it("T-DEBT-API-01: lend 5,000.00 to Ben and Ben repays 2,000.00; Bank 35,500.00, Ben 3,000.00, income/expense unchanged", async () => {
    const agent = await agentAs("alice");
    await runDemoJourney(agent);
    const bank = (await accountOf("alice", "Bank")).id;
    const ben = await createLoanAccount(agent, "Ben", "LOAN_GIVEN");
    const beforeSummary = (await agent.get("/api/summary")).body;

    // 1. Lend Ben 5,000.00 (500,000 satang)
    const lendRes = await agent.post("/api/transactions").send({
      kind: "PAYMENT",
      sourceAccountId: bank,
      date: "2026-11-22",
      totalAmount: 500_000,
      note: "Lend to Ben",
      lines: [{ accountId: ben, amount: 500_000 }],
    });
    expect(lendRes.status).toBe(201);

    // 2. Ben repays 2,000.00 (200,000 satang)
    const repaidRes = await agent.post("/api/transactions").send({
      kind: "RECEIVE",
      sourceAccountId: bank,
      date: "2026-11-23",
      totalAmount: 200_000,
      note: "Ben partial repayment",
      lines: [{ accountId: ben, amount: 200_000 }],
    });
    expect(repaidRes.status).toBe(201);

    const accounts = (await agent.get("/api/accounts")).body.accounts;
    expect(balanceOf(accounts, bank)).toBe(3_550_000);
    expect(balanceOf(accounts, ben)).toBe(300_000);

    const afterSummary = (await agent.get("/api/summary")).body;
    expect(afterSummary.loansGiven).toEqual([{ accountId: ben, name: "Ben", outstanding: 300_000 }]);
    expect(afterSummary.totals).toEqual(beforeSummary.totals);
    expect(afterSummary.totals).toEqual({ income: 3_000_000, expense: 150_000 });
    expect(afterSummary.income).toEqual(beforeSummary.income);
    expect(afterSummary.expense).toEqual(beforeSummary.expense);
  });

  it("T-DEBT-API-02: borrow 10,000.00 from Mom and repay 10,000.00; Mom 1,000,000 then 0, income/expense unchanged", async () => {
    const agent = await agentAs("alice");
    await runDemoJourney(agent);
    const bank = (await accountOf("alice", "Bank")).id;
    const mom = await createLoanAccount(agent, "Mom", "LOAN_TAKEN");
    const beforeSummary = (await agent.get("/api/summary")).body;

    // 1. Borrow 10,000.00 from Mom (RECEIVE into Bank, line LOAN_TAKEN)
    await agent
      .post("/api/transactions")
      .send({
        kind: "RECEIVE",
        sourceAccountId: bank,
        date: "2026-11-22",
        totalAmount: 1_000_000,
        note: "Borrow from Mom",
        lines: [{ accountId: mom, amount: 1_000_000 }],
      })
      .expect(201);

    const midAccounts = (await agent.get("/api/accounts")).body.accounts;
    expect(balanceOf(midAccounts, bank)).toBe(4_850_000);
    expect(balanceOf(midAccounts, mom)).toBe(1_000_000);

    const midSummary = (await agent.get("/api/summary")).body;
    expect(midSummary.loansTaken).toEqual(
      expect.arrayContaining([{ accountId: mom, name: "Mom", outstanding: 1_000_000 }]),
    );

    // 2. Repay Mom 10,000.00 (PAYMENT from Bank, line LOAN_TAKEN)
    await agent
      .post("/api/transactions")
      .send({
        kind: "PAYMENT",
        sourceAccountId: bank,
        date: "2026-11-24",
        totalAmount: 1_000_000,
        note: "Repay Mom in full",
        lines: [{ accountId: mom, amount: 1_000_000 }],
      })
      .expect(201);

    const afterAccounts = (await agent.get("/api/accounts")).body.accounts;
    expect(balanceOf(afterAccounts, bank)).toBe(3_850_000);
    expect(balanceOf(afterAccounts, mom)).toBe(0);

    const afterSummary = (await agent.get("/api/summary")).body;
    expect(afterSummary.loansTaken).toEqual(
      expect.arrayContaining([{ accountId: mom, name: "Mom", outstanding: 0 }]),
    );
    expect(afterSummary.totals).toEqual(beforeSummary.totals);
    expect(afterSummary.income).toEqual(beforeSummary.income);
    expect(afterSummary.expense).toEqual(beforeSummary.expense);
  });

  it("T-DEBT-API-04: bob's loan account, Dining line on Get repaid, ADMIN, and anonymous are rejected and save nothing", async () => {
    const alice = await agentAs("alice");
    const bob = await agentAs("bob");
    const bank = (await accountOf("alice", "Bank")).id;
    const dining = (await accountOf("alice", "Dining")).id;
    const aliceBen = await createLoanAccount(alice, "Ben", "LOAN_GIVEN");
    const bobBen = await createLoanAccount(bob, "Ben", "LOAN_GIVEN");
    const before = await counts();

    // 1. bob's Ben as line → 404 NOT_FOUND (BR-04)
    const bobRes = await alice.post("/api/transactions").send({
      kind: "PAYMENT",
      sourceAccountId: bank,
      date: "2026-11-22",
      totalAmount: 100_000,
      lines: [{ accountId: bobBen, amount: 100_000 }],
    });
    expect(bobRes.status).toBe(404);
    expect(bobRes.body.error.code).toBe("NOT_FOUND");

    // 2. "Get repaid" (RECEIVE) with EXPENSE account Dining → 400 INVALID_ACCOUNT_TYPE (BR-10)
    const wrongLine = await alice.post("/api/transactions").send({
      kind: "RECEIVE",
      sourceAccountId: bank,
      date: "2026-11-22",
      totalAmount: 100_000,
      lines: [{ accountId: dining, amount: 100_000 }],
    });
    expect(wrongLine.status).toBe(400);
    expect(wrongLine.body.error.code).toBe("INVALID_ACCOUNT_TYPE");

    // 3. ADMIN → 403 FORBIDDEN (BR-05)
    const adminRes = await (await agentAs("admin")).post("/api/transactions").send({
      kind: "PAYMENT",
      sourceAccountId: bank,
      date: "2026-11-22",
      totalAmount: 100_000,
      lines: [{ accountId: aliceBen, amount: 100_000 }],
    });
    expect(adminRes.status).toBe(403);
    expect(adminRes.body.error.code).toBe("FORBIDDEN");

    // 4. Anonymous → 401 UNAUTHENTICATED
    const anonRes = await request(createApp())
      .post("/api/transactions")
      .send({
        kind: "PAYMENT",
        sourceAccountId: bank,
        date: "2026-11-22",
        totalAmount: 100_000,
        lines: [{ accountId: aliceBen, amount: 100_000 }],
      });
    expect(anonRes.status).toBe(401);
    expect(anonRes.body.error.code).toBe("UNAUTHENTICATED");

    expect(await counts()).toEqual(before);
  });
});
