import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { accountOf } from "../helpers/accounts.js";
import { agentAs } from "../helpers/auth.js";
import { resetDb } from "../helpers/db.js";
import { runDemoJourney } from "../helpers/demo.js";

// F-05 Transaction history and detail — docs/sprints/sprint-1/F-05-summary-history.md §7.
beforeEach(async () => {
  await resetDb();
});

async function salaryOn(
  agent: Awaited<ReturnType<typeof agentAs>>,
  username: string,
  date: string,
  amount: number,
) {
  const res = await agent.post("/api/transactions").send({
    kind: "RECEIVE",
    sourceAccountId: (await accountOf(username, "Bank")).id,
    date,
    totalAmount: amount,
    lines: [{ accountId: (await accountOf(username, "Salary")).id, amount }],
  });
  expect(res.status).toBe(201);
  return res.body.transaction as { id: number };
}

describe("GET /api/transactions", () => {
  it("T-HST-API-01: returns only the user's transactions, newest date first and highest id first on the same date", async () => {
    const alice = await agentAs("alice");
    const older = await salaryOn(alice, "alice", "2026-11-01", 100);
    const sameDayFirst = await salaryOn(alice, "alice", "2026-11-05", 200);
    const sameDaySecond = await salaryOn(alice, "alice", "2026-11-05", 300);
    await salaryOn(await agentAs("bob"), "bob", "2026-11-06", 999);

    const res = await alice.get("/api/transactions");
    expect(res.status).toBe(200);
    expect(res.body.transactions.map((t: { id: number }) => t.id)).toEqual([
      sameDaySecond.id,
      sameDayFirst.id,
      older.id,
    ]);
  });

  it("returns an empty list for a new user", async () => {
    const res = await (await agentAs("alice")).get("/api/transactions");
    expect(res.body).toEqual({ transactions: [] });
  });

  it("returns each item in the same shape as POST /api/transactions", async () => {
    const agent = await agentAs("alice");
    await runDemoJourney(agent);
    const list = (await agent.get("/api/transactions")).body.transactions;
    expect(list).toHaveLength(3);
    const cardPurchase = list.find(
      (t: { kind: string; source: { name: string } }) => t.source.name === "Credit Card",
    );
    expect(cardPurchase).toEqual({
      id: expect.any(Number),
      kind: "PAYMENT",
      date: "2026-11-03",
      totalAmount: 150_000,
      note: null,
      isFavorite: false,
      source: { id: (await accountOf("alice", "Credit Card")).id, name: "Credit Card" },
      lines: [
        { accountId: (await accountOf("alice", "Dining")).id, name: "Dining", amount: 90_000 },
        { accountId: (await accountOf("alice", "Groceries")).id, name: "Groceries", amount: 60_000 },
      ],
    });
  });
});

describe("GET /api/transactions/:id", () => {
  it("T-HST-API-02: own transaction → 200 with lines; another user's, missing or non-numeric id → 404", async () => {
    const alice = await agentAs("alice");
    const own = await salaryOn(alice, "alice", "2026-11-01", 100);
    const bobs = await salaryOn(await agentAs("bob"), "bob", "2026-11-01", 100);

    const res = await alice.get(`/api/transactions/${own.id}`);
    expect(res.status).toBe(200);
    expect(res.body.transaction).toMatchObject({
      id: own.id,
      kind: "RECEIVE",
      lines: [{ name: "Salary", amount: 100 }],
    });

    for (const id of [String(bobs.id), "999999", "abc"]) {
      const miss = await alice.get(`/api/transactions/${id}`);
      expect(miss.status, `id ${id}`).toBe(404);
      expect(miss.body.error.code).toBe("NOT_FOUND");
    }
  });
});

describe("access", () => {
  it("T-HST-API-03: anonymous → 401 and ADMIN → 403 on the list and the detail", async () => {
    const alice = await agentAs("alice");
    const own = await salaryOn(alice, "alice", "2026-11-01", 100);
    const anon = request(createApp());
    const admin = await agentAs("admin");

    expect((await anon.get("/api/transactions")).status).toBe(401);
    expect((await anon.get(`/api/transactions/${own.id}`)).status).toBe(401);
    expect((await admin.get("/api/transactions")).status).toBe(403);
    expect((await admin.get(`/api/transactions/${own.id}`)).status).toBe(403);
  });
});
