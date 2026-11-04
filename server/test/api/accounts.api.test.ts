import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { seed } from "../../prisma/seedData.js";
import { accountOf } from "../helpers/accounts.js";
import { agentAs } from "../helpers/auth.js";
import { resetDb } from "../helpers/db.js";

// F-03 Accounts and opening balances — docs/sprints/sprint-1/F-03-accounts.md §7.
const prisma = getPrisma();

// Contract §3: by type (CASH, LOAN_TAKEN, LOAN_GIVEN, INCOME, EXPENSE), then name A→Z.
const SEEDED_IN_ORDER = [
  { name: "Bank", type: "CASH", subtype: "BANK" },
  { name: "Credit Card", type: "LOAN_TAKEN", subtype: "CREDIT_CARD" },
  { name: "Interest", type: "INCOME", subtype: null },
  { name: "Salary", type: "INCOME", subtype: null },
  { name: "Dining", type: "EXPENSE", subtype: null },
  { name: "Electricity", type: "EXPENSE", subtype: null },
  { name: "Groceries", type: "EXPENSE", subtype: null },
  { name: "Telecom", type: "EXPENSE", subtype: null },
];

beforeEach(async () => {
  await resetDb();
});

describe("GET /api/accounts", () => {
  it("T-ACC-API-01: returns the user's 8 seeded accounts in contract order, all with balance 0", async () => {
    const res = await (await agentAs("alice")).get("/api/accounts");
    expect(res.status).toBe(200);
    expect(res.body.accounts).toMatchObject(SEEDED_IN_ORDER);
    for (const a of res.body.accounts) {
      expect(a).toEqual({
        id: expect.any(Number),
        name: a.name,
        type: a.type,
        subtype: a.subtype,
        openingBalance: 0,
        openingDate: null,
        balance: 0,
      });
    }
  });

  it("T-ACC-API-02: never includes another user's accounts", async () => {
    const bob = await prisma.user.findUniqueOrThrow({ where: { username: "bob" } });
    const bobIds = (await prisma.account.findMany({ where: { userId: bob.id } })).map((a) => a.id);
    const res = await (await agentAs("alice")).get("/api/accounts");
    const aliceIds = res.body.accounts.map((a: { id: number }) => a.id);
    expect(bobIds).toHaveLength(8);
    expect(aliceIds.filter((id: number) => bobIds.includes(id))).toEqual([]);
  });

  it("computes balances from transactions (system-sds.md §4.1)", async () => {
    const alice = await prisma.user.findUniqueOrThrow({ where: { username: "alice" } });
    const bank = await accountOf("alice", "Bank");
    const salary = await accountOf("alice", "Salary");
    await prisma.account.update({ where: { id: bank.id }, data: { openingBalance: 1_000_000 } });
    // Line created separately: with the composite (id, userId) foreign keys Prisma does not accept
    // `userId` inside a nested `lines: { create }`.
    const receive = await prisma.transaction.create({
      data: {
        userId: alice.id,
        kind: "RECEIVE",
        sourceAccountId: bank.id,
        date: new Date("2026-11-03"),
        totalAmount: 3_000_000,
      },
    });
    await prisma.transactionLine.create({
      data: { transactionId: receive.id, userId: alice.id, accountId: salary.id, amount: 3_000_000 },
    });

    const res = await (await agentAs("alice")).get("/api/accounts");
    const byName = Object.fromEntries(res.body.accounts.map((a: { name: string }) => [a.name, a]));
    expect(byName.Bank.balance).toBe(4_000_000);
    expect(byName.Salary.balance).toBe(3_000_000);
    expect(byName.Dining.balance).toBe(0);
  });
});

describe("PUT /api/accounts/:id/opening-balance", () => {
  it("T-ACC-API-03: sets Bank's opening balance and date; the list shows them", async () => {
    const agent = await agentAs("alice");
    const bank = await accountOf("alice", "Bank");

    const put = await agent
      .put(`/api/accounts/${bank.id}/opening-balance`)
      .send({ openingBalance: 1_000_000, openingDate: "2026-11-01" });
    expect(put.status).toBe(200);
    expect(put.body.account).toEqual({
      id: bank.id,
      name: "Bank",
      type: "CASH",
      subtype: "BANK",
      openingBalance: 1_000_000,
      openingDate: "2026-11-01",
      balance: 1_000_000,
    });

    const list = await agent.get("/api/accounts");
    expect(list.body.accounts.find((a: { id: number }) => a.id === bank.id)).toEqual(put.body.account);
  });

  it("T-ACC-API-04: setting it again replaces the previous value", async () => {
    const agent = await agentAs("alice");
    const bank = await accountOf("alice", "Bank");
    const url = `/api/accounts/${bank.id}/opening-balance`;
    await agent.put(url).send({ openingBalance: 1_000_000, openingDate: "2026-11-01" }).expect(200);
    const res = await agent.put(url).send({ openingBalance: 500_000, openingDate: "2026-11-02" });
    expect(res.body.account).toMatchObject({
      openingBalance: 500_000,
      openingDate: "2026-11-02",
      balance: 500_000,
    });
  });

  it("T-ACC-API-05: accepts an opening balance on the credit card (LOAN_TAKEN) as debt", async () => {
    const card = await accountOf("alice", "Credit Card");
    const res = await (
      await agentAs("alice")
    )
      .put(`/api/accounts/${card.id}/opening-balance`)
      .send({ openingBalance: 250_000, openingDate: "2026-11-01" });
    expect(res.status).toBe(200);
    expect(res.body.account.balance).toBe(250_000);
  });

  it.each(["Dining", "Salary"])(
    "T-ACC-API-06: rejects an opening balance on %s with INVALID_ACCOUNT_TYPE (BR-12)",
    async (name) => {
      const account = await accountOf("alice", name);
      const res = await (
        await agentAs("alice")
      )
        .put(`/api/accounts/${account.id}/opening-balance`)
        .send({ openingBalance: 100, openingDate: "2026-11-01" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("INVALID_ACCOUNT_TYPE");
      expect((await prisma.account.findUniqueOrThrow({ where: { id: account.id } })).openingBalance).toBe(0);
    },
  );

  it.each([
    ["a negative amount", { openingBalance: -1, openingDate: "2026-11-01" }],
    ["a decimal amount", { openingBalance: 1.5, openingDate: "2026-11-01" }],
    ["a string amount", { openingBalance: "100", openingDate: "2026-11-01" }],
    ["an amount above the Int limit", { openingBalance: 2_147_483_648, openingDate: "2026-11-01" }],
    ["a missing amount", { openingDate: "2026-11-01" }],
    ["a date that does not exist", { openingBalance: 100, openingDate: "2026-02-30" }],
    ["a date in another format", { openingBalance: 100, openingDate: "03/11/2026" }],
    ["a missing date", { openingBalance: 100 }],
    ["a date before 2000", { openingBalance: 100, openingDate: "1999-12-31" }],
    ["a date after 2099", { openingBalance: 100, openingDate: "2100-01-01" }],
    ["a typo year", { openingBalance: 100, openingDate: "0026-11-01" }],
  ])("T-ACC-API-07: rejects %s with VALIDATION_ERROR", async (_case, body) => {
    const bank = await accountOf("alice", "Bank");
    const res = await (await agentAs("alice")).put(`/api/accounts/${bank.id}/opening-balance`).send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    const after = await prisma.account.findUniqueOrThrow({ where: { id: bank.id } });
    expect(after.openingBalance).toBe(0);
    expect(after.openingDate).toBeNull();
  });

  it("T-ACC-API-08: another user's account, a missing id and a non-numeric id are all 404", async () => {
    const agent = await agentAs("alice");
    const bobBank = await accountOf("bob", "Bank");
    const body = { openingBalance: 100, openingDate: "2026-11-01" };

    for (const id of [String(bobBank.id), "999999", "abc"]) {
      const res = await agent.put(`/api/accounts/${id}/opening-balance`).send(body);
      expect(res.status, `id ${id}`).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    }
    expect((await prisma.account.findUniqueOrThrow({ where: { id: bobBank.id } })).openingBalance).toBe(0);
  });
});

describe("access (BR-04, BR-05)", () => {
  it("T-ACC-API-09: anonymous gets 401 and ADMIN gets 403 on both routes", async () => {
    const bank = await accountOf("alice", "Bank");
    const body = { openingBalance: 100, openingDate: "2026-11-01" };
    const anon = request(createApp());
    const admin = await agentAs("admin");

    expect((await anon.get("/api/accounts")).status).toBe(401);
    expect((await anon.put(`/api/accounts/${bank.id}/opening-balance`).send(body)).status).toBe(401);

    const adminList = await admin.get("/api/accounts");
    expect(adminList.status).toBe(403);
    expect(adminList.body.error.code).toBe("FORBIDDEN");
    expect((await admin.put(`/api/accounts/${bank.id}/opening-balance`).send(body)).status).toBe(403);
  });
});

describe("summary after an opening balance (BR-08)", () => {
  // T-ACC-API-10 needs GET /api/summary from S1-13. Until then this test fails, so it is marked
  // `it.fails` (the run passes while the inner test fails). Remove `.fails` in S1-13.
  it.fails("T-ACC-API-10: an opening balance is not counted as income or expense", async () => {
    const agent = await agentAs("alice");
    const bank = await accountOf("alice", "Bank");
    await agent
      .put(`/api/accounts/${bank.id}/opening-balance`)
      .send({ openingBalance: 1_000_000, openingDate: "2026-11-01" })
      .expect(200);
    const summary = await agent.get("/api/summary");
    expect(summary.status).toBe(200);
    expect(summary.body.totals).toEqual({ income: 0, expense: 0 });
  });
});

describe("seed (F-03 §1.1)", () => {
  it("T-ACC-SEED-01: is idempotent, gives each USER 8 accounts and ADMIN none, and keeps opening balances", async () => {
    const bank = await accountOf("alice", "Bank");
    await prisma.account.update({ where: { id: bank.id }, data: { openingBalance: 777 } });

    await seed(prisma);
    await seed(prisma);

    for (const username of ["alice", "bob"]) {
      const user = await prisma.user.findUniqueOrThrow({ where: { username } });
      expect(await prisma.account.count({ where: { userId: user.id } })).toBe(8);
    }
    const admin = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });
    expect(await prisma.account.count({ where: { userId: admin.id } })).toBe(0);
    expect((await prisma.account.findUniqueOrThrow({ where: { id: bank.id } })).openingBalance).toBe(777);
  });
});
