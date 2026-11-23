import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { accountOf } from "../helpers/accounts.js";
import { agentAs, type SuperAgentTest } from "../helpers/auth.js";
import { resetDb } from "../helpers/db.js";
import { runDemoJourney } from "../helpers/demo.js";

// F-06 Custom account & category management — docs/sprints/sprint-2/F-06-account-management.md §7.
const prisma = getPrisma();

beforeEach(async () => {
  await resetDb();
});

async function accountCount(username = "alice") {
  const user = await prisma.user.findUniqueOrThrow({ where: { username } });
  return prisma.account.count({ where: { userId: user.id } });
}

async function createAccount(agent: SuperAgentTest, body: object) {
  return agent.post("/api/accounts").send(body);
}

async function wallet(agent: SuperAgentTest): Promise<number> {
  const res = await createAccount(agent, { name: "Wallet", type: "CASH", subtype: "WALLET" });
  expect(res.status).toBe(201);
  return res.body.account.id;
}

describe("POST /api/accounts", () => {
  it("T-ACC-API-11: creates a CASH/WALLET account listed with balance 0 and archived false", async () => {
    const agent = await agentAs("alice");
    const res = await createAccount(agent, { name: "Wallet", type: "CASH", subtype: "WALLET" });

    expect(res.status).toBe(201);
    expect(res.body.account).toEqual({
      id: expect.any(Number),
      name: "Wallet",
      type: "CASH",
      subtype: "WALLET",
      openingBalance: 0,
      openingDate: null,
      balance: 0,
      archived: false,
      inUse: false,
    });
    const list = (await agent.get("/api/accounts")).body.accounts;
    expect(list.map((a: { name: string }) => a.name).slice(0, 2)).toEqual(["Bank", "Wallet"]);
    expect(list.find((a: { name: string }) => a.name === "Wallet")).toEqual(res.body.account);
  });

  it("T-ACC-API-12: a new EXPENSE category can be paid to and appears in the summary", async () => {
    const agent = await agentAs("alice");
    const created = await createAccount(agent, { name: "Transport", type: "EXPENSE" });
    expect(created.status).toBe(201);
    expect(created.body.account).toMatchObject({ name: "Transport", type: "EXPENSE", subtype: null });

    const card = await accountOf("alice", "Credit Card");
    const payment = await agent.post("/api/transactions").send({
      kind: "PAYMENT",
      sourceAccountId: card.id,
      date: "2026-11-22",
      totalAmount: 10_000,
      lines: [{ accountId: created.body.account.id, amount: 10_000 }],
    });
    expect(payment.status).toBe(201);

    const summary = (await agent.get("/api/summary")).body;
    expect(summary.expense).toContainEqual({
      accountId: created.body.account.id,
      name: "Transport",
      total: 10_000,
    });
    expect(summary.totals.expense).toBe(10_000);
  });

  it.each([
    ["an empty name", { name: "", type: "EXPENSE" }],
    ["a name of only spaces", { name: "   ", type: "EXPENSE" }],
    ["a 51-character name", { name: "x".repeat(51), type: "EXPENSE" }],
    ["EXPENSE with subtype BANK", { name: "Transport", type: "EXPENSE", subtype: "BANK" }],
    ["CASH with subtype CREDIT_CARD", { name: "Wallet", type: "CASH", subtype: "CREDIT_CARD" }],
    ["an unknown type", { name: "Savings", type: "SAVINGS" }],
    ["a missing type", { name: "Savings" }],
  ])("T-ACC-API-13: %s → 400 VALIDATION_ERROR and nothing is created", async (_label, body) => {
    const before = await accountCount();
    const res = await createAccount(await agentAs("alice"), body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(await accountCount()).toBe(before);
  });

  it("T-ACC-API-13: the 101st account (archived included) → 400 VALIDATION_ERROR", async () => {
    const alice = await prisma.user.findUniqueOrThrow({ where: { username: "alice" } });
    await prisma.account.createMany({
      data: Array.from({ length: 92 }, (_, i) => ({
        userId: alice.id,
        name: `Category ${i}`,
        type: "EXPENSE" as const,
      })),
    });
    expect(await accountCount()).toBe(100);

    const res = await createAccount(await agentAs("alice"), { name: "One too many", type: "EXPENSE" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(await accountCount()).toBe(100);
  });

  it("T-ACC-API-14: names are unique per user ignoring case and spaces; other users are separate", async () => {
    const aliceAgent = await agentAs("alice");
    const clash = await createAccount(aliceAgent, { name: " bank ", type: "CASH", subtype: "BANK" });
    expect(clash.status).toBe(409);
    expect(clash.body.error.code).toBe("ACCOUNT_NAME_TAKEN");

    const dining = await accountOf("alice", "Dining");
    const rename = await aliceAgent.patch(`/api/accounts/${dining.id}`).send({ name: "BANK" });
    expect(rename.status).toBe(409);
    expect(rename.body.error.code).toBe("ACCOUNT_NAME_TAKEN");
    expect((await prisma.account.findUniqueOrThrow({ where: { id: dining.id } })).name).toBe("Dining");

    await wallet(aliceAgent);
    const bobWallet = await createAccount(await agentAs("bob"), {
      name: "Wallet",
      type: "CASH",
      subtype: "WALLET",
    });
    expect(bobWallet.status).toBe(201);
  });
});

describe("PATCH /api/accounts/:id", () => {
  it("T-ACC-API-13: a type change without subtype resets it to null; a subtype that does not fit → 400", async () => {
    const agent = await agentAs("alice");
    const id = await wallet(agent);

    const toLoan = await agent.patch(`/api/accounts/${id}`).send({ type: "LOAN_TAKEN" });
    expect(toLoan.status).toBe(200);
    expect(toLoan.body.account).toMatchObject({ id, type: "LOAN_TAKEN", subtype: null });

    const badSubtype = await agent
      .patch(`/api/accounts/${id}`)
      .send({ type: "CASH", subtype: "CREDIT_CARD" });
    expect(badSubtype.status).toBe(400);
    expect(badSubtype.body.error.code).toBe("VALIDATION_ERROR");

    const empty = await agent.patch(`/api/accounts/${id}`).send({});
    expect(empty.status).toBe(400);
    expect(empty.body.error.code).toBe("VALIDATION_ERROR");
    expect(await prisma.account.findUniqueOrThrow({ where: { id } })).toMatchObject({
      type: "LOAN_TAKEN",
      subtype: null,
    });
  });

  it("T-ACC-API-15: renaming an account used by transactions shows the new name in history", async () => {
    const agent = await agentAs("alice");
    await runDemoJourney(agent);
    const dining = await accountOf("alice", "Dining");

    const res = await agent.patch(`/api/accounts/${dining.id}`).send({ name: "Eating out" });
    expect(res.status).toBe(200);
    expect(res.body.account).toMatchObject({ id: dining.id, name: "Eating out", type: "EXPENSE" });

    const list = (await agent.get("/api/transactions")).body.transactions;
    const lineNames = list.flatMap((t: { lines: { name: string }[] }) => t.lines.map((l) => l.name));
    expect(lineNames).toContain("Eating out");
    expect(lineNames).not.toContain("Dining");
  });

  it("T-ACC-API-16: type changes only while unused, and never to INCOME/EXPENSE with an opening balance", async () => {
    const agent = await agentAs("alice");
    await runDemoJourney(agent);

    const interest = await accountOf("alice", "Interest");
    const unused = await agent.patch(`/api/accounts/${interest.id}`).send({ type: "EXPENSE" });
    expect(unused.status).toBe(200);
    expect(unused.body.account).toMatchObject({ type: "EXPENSE", subtype: null });

    const dining = await accountOf("alice", "Dining");
    const used = await agent.patch(`/api/accounts/${dining.id}`).send({ type: "INCOME" });
    expect(used.status).toBe(400);
    expect(used.body.error.code).toBe("CANNOT_CHANGE_ACCOUNT_TYPE_WITH_TRANSACTIONS");
    expect((await prisma.account.findUniqueOrThrow({ where: { id: dining.id } })).type).toBe("EXPENSE");

    const id = await wallet(agent);
    await agent
      .put(`/api/accounts/${id}/opening-balance`)
      .send({ openingBalance: 100, openingDate: "2026-11-01" })
      .expect(200);
    const withOpening = await agent.patch(`/api/accounts/${id}`).send({ type: "EXPENSE" });
    expect(withOpening.status).toBe(400);
    expect(withOpening.body.error.code).toBe("INVALID_ACCOUNT_TYPE");
    expect((await prisma.account.findUniqueOrThrow({ where: { id } })).type).toBe("CASH");
  });
});

describe("PATCH /api/accounts/:id/archive", () => {
  it("T-ACC-API-17: EXPENSE accounts and empty CASH accounts archive; a CASH account with money does not", async () => {
    const agent = await agentAs("alice");
    await runDemoJourney(agent);

    const telecom = await accountOf("alice", "Telecom");
    const archivedTelecom = await agent.patch(`/api/accounts/${telecom.id}/archive`).send({ archived: true });
    expect(archivedTelecom.status).toBe(200);
    expect(archivedTelecom.body.account).toMatchObject({ id: telecom.id, archived: true });

    const id = await wallet(agent);
    const archivedWallet = await agent.patch(`/api/accounts/${id}/archive`).send({ archived: true });
    expect(archivedWallet.status).toBe(200);
    expect(archivedWallet.body.account).toMatchObject({ id, archived: true, balance: 0 });

    const bank = await accountOf("alice", "Bank");
    const notEmpty = await agent.patch(`/api/accounts/${bank.id}/archive`).send({ archived: true });
    expect(notEmpty.status).toBe(400);
    expect(notEmpty.body.error).toMatchObject({ code: "ACCOUNT_NOT_EMPTY", details: { balance: 3_850_000 } });

    const list = (await agent.get("/api/accounts")).body.accounts;
    expect(list.find((a: { id: number }) => a.id === bank.id)).toMatchObject({ archived: false });
  });

  it("T-ACC-API-18: an archived account cannot be used in a transaction or get an opening balance until unarchived", async () => {
    const agent = await agentAs("alice");
    const telecom = await accountOf("alice", "Telecom");
    const card = await accountOf("alice", "Credit Card");
    const salary = await accountOf("alice", "Salary");
    const id = await wallet(agent);
    await agent.patch(`/api/accounts/${telecom.id}/archive`).send({ archived: true }).expect(200);
    await agent.patch(`/api/accounts/${id}/archive`).send({ archived: true }).expect(200);

    const payToArchived = {
      kind: "PAYMENT",
      sourceAccountId: card.id,
      date: "2026-11-22",
      totalAmount: 50_000,
      lines: [{ accountId: telecom.id, amount: 50_000 }],
    };
    const receiveIntoArchived = {
      kind: "RECEIVE",
      sourceAccountId: id,
      date: "2026-11-22",
      totalAmount: 20_000,
      lines: [{ accountId: salary.id, amount: 20_000 }],
    };
    const openingBalance = { openingBalance: 100_000, openingDate: "2026-11-01" };
    const transactionsBefore = await prisma.transaction.count();

    const line = await agent.post("/api/transactions").send(payToArchived);
    expect(line.status).toBe(400);
    expect(line.body.error).toMatchObject({
      code: "ACCOUNT_ARCHIVED",
      details: { field: "lines", lineIndex: 0, accountId: telecom.id },
    });
    const source = await agent.post("/api/transactions").send(receiveIntoArchived);
    expect(source.status).toBe(400);
    expect(source.body.error).toMatchObject({
      code: "ACCOUNT_ARCHIVED",
      details: { field: "sourceAccountId", accountId: id },
    });
    const opening = await agent.put(`/api/accounts/${id}/opening-balance`).send(openingBalance);
    expect(opening.status).toBe(400);
    expect(opening.body.error.code).toBe("ACCOUNT_ARCHIVED");
    expect(await prisma.transaction.count()).toBe(transactionsBefore);
    expect((await prisma.account.findUniqueOrThrow({ where: { id } })).openingBalance).toBe(0);

    await agent.patch(`/api/accounts/${telecom.id}/archive`).send({ archived: false }).expect(200);
    await agent.patch(`/api/accounts/${id}/archive`).send({ archived: false }).expect(200);
    expect((await agent.post("/api/transactions").send(payToArchived)).status).toBe(201);
    expect((await agent.post("/api/transactions").send(receiveIntoArchived)).status).toBe(201);
    expect((await agent.put(`/api/accounts/${id}/opening-balance`).send(openingBalance)).status).toBe(200);
  });
});

describe("DELETE /api/accounts/:id", () => {
  it("T-ACC-API-19: deletes an account never used; a used account → 409 ACCOUNT_IN_USE and stays", async () => {
    const agent = await agentAs("alice");
    await runDemoJourney(agent);
    const id = await wallet(agent);

    const deleted = await agent.delete(`/api/accounts/${id}`);
    expect(deleted.status).toBe(204);
    expect(await prisma.account.findUnique({ where: { id } })).toBeNull();

    const dining = await accountOf("alice", "Dining");
    const used = await agent.delete(`/api/accounts/${dining.id}`);
    expect(used.status).toBe(409);
    expect(used.body.error.code).toBe("ACCOUNT_IN_USE");
    expect(await prisma.account.findUnique({ where: { id: dining.id } })).not.toBeNull();
  });
});

describe("F-06 access control", () => {
  it("T-ACC-API-20: another user's or a missing account → 404; anonymous → 401; ADMIN → 403", async () => {
    const aliceAgent = await agentAs("alice");
    const bobBank = await accountOf("bob", "Bank");
    const before = await prisma.account.findUniqueOrThrow({ where: { id: bobBank.id } });

    for (const target of [String(bobBank.id), "999999", "abc"]) {
      const results = [
        await aliceAgent.patch(`/api/accounts/${target}`).send({ name: "Mine now" }),
        await aliceAgent.patch(`/api/accounts/${target}/archive`).send({ archived: true }),
        await aliceAgent.delete(`/api/accounts/${target}`),
      ];
      for (const res of results) {
        expect(res.status).toBe(404);
        expect(res.body.error.code).toBe("NOT_FOUND");
      }
    }
    expect(await prisma.account.findUniqueOrThrow({ where: { id: bobBank.id } })).toEqual(before);

    const aliceBank = await accountOf("alice", "Bank");
    const sendAll = (agent: SuperAgentTest) =>
      Promise.all([
        agent.post("/api/accounts").send({ name: "Wallet", type: "CASH", subtype: "WALLET" }),
        agent.patch(`/api/accounts/${aliceBank.id}`).send({ name: "Renamed" }),
        agent.patch(`/api/accounts/${aliceBank.id}/archive`).send({ archived: true }),
        agent.delete(`/api/accounts/${aliceBank.id}`),
      ]);

    for (const res of await sendAll(request.agent(createApp()))) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    }
    for (const res of await sendAll(await agentAs("admin"))) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    }
    expect(await prisma.account.findUniqueOrThrow({ where: { id: aliceBank.id } })).toMatchObject({
      name: "Bank",
    });
    expect(await accountCount()).toBe(8);
  });
});

describe("F-06 database backstop", () => {
  it("T-ACC-DB-01: the database rejects a name that differs from an existing one only by case", async () => {
    const alice = await prisma.user.findUniqueOrThrow({ where: { username: "alice" } });
    await expect(
      prisma.account.create({ data: { userId: alice.id, name: "bank", type: "CASH", subtype: "BANK" } }),
    ).rejects.toThrow();
  });
});

describe("inUse (F-06 v0.4)", () => {
  it("T-ACC-API-21: every account reports inUse, which turns true once it is a source or a line", async () => {
    const agent = await agentAs("alice");
    const walletId = await wallet(agent);
    const card = await accountOf("alice", "Credit Card");
    const dining = await accountOf("alice", "Dining");
    const inUseOf = async () =>
      new Map(
        ((await agent.get("/api/accounts")).body.accounts as { id: number; inUse: unknown }[]).map((a) => [
          a.id,
          a.inUse,
        ]),
      );

    const before = await inUseOf();
    expect([...before.values()].every((v) => v === false)).toBe(true);
    expect(before.size).toBe(9);

    await agent
      .post("/api/transactions")
      .send({
        kind: "PAYMENT",
        sourceAccountId: card.id,
        date: "2026-11-22",
        totalAmount: 10_000,
        lines: [{ accountId: dining.id, amount: 10_000 }],
      })
      .expect(201);

    const after = await inUseOf();
    expect(after.get(card.id)).toBe(true); // source
    expect(after.get(dining.id)).toBe(true); // line
    expect(after.get(walletId)).toBe(false);
  });
});
