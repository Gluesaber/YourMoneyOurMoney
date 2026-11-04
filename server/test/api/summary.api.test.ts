import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { accountOf } from "../helpers/accounts.js";
import { agentAs } from "../helpers/auth.js";
import { resetDb } from "../helpers/db.js";
import { runDemoJourney } from "../helpers/demo.js";

// F-05 Balances and summary — docs/sprints/sprint-1/F-05-summary-history.md §7.
beforeEach(async () => {
  await resetDb();
});

type Entry = { accountId: number; name: string; balance?: number; outstanding?: number; total?: number };
const byName = (list: Entry[]) => Object.fromEntries(list.map((e) => [e.name, e]));

describe("GET /api/summary", () => {
  it("T-SUM-API-01: a new user sees every account at 0 and totals of 0", async () => {
    const res = await (await agentAs("alice")).get("/api/summary");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      cash: [{ accountId: (await accountOf("alice", "Bank")).id, name: "Bank", balance: 0 }],
      loansTaken: [
        { accountId: (await accountOf("alice", "Credit Card")).id, name: "Credit Card", outstanding: 0 },
      ],
      loansGiven: [],
      totals: { income: 0, expense: 0 },
      income: ["Interest", "Salary"].map((name) => ({ accountId: expect.any(Number), name, total: 0 })),
      expense: ["Dining", "Electricity", "Groceries", "Telecom"].map((name) => ({
        accountId: expect.any(Number),
        name,
        total: 0,
      })),
    });
  });

  it("T-SUM-API-02: after the demo journey the summary shows the documented numbers", async () => {
    const agent = await agentAs("alice");
    await runDemoJourney(agent);
    const { body } = await agent.get("/api/summary").expect(200);

    expect(byName(body.cash).Bank.balance).toBe(3_850_000);
    expect(byName(body.loansTaken)["Credit Card"].outstanding).toBe(0);
    expect(body.totals).toEqual({ income: 3_000_000, expense: 150_000 });
    expect(body.income.map((e: Entry) => [e.name, e.total])).toEqual([
      ["Interest", 0],
      ["Salary", 3_000_000],
    ]);
    expect(body.expense.map((e: Entry) => [e.name, e.total])).toEqual([
      ["Dining", 90_000],
      ["Electricity", 0],
      ["Groceries", 60_000],
      ["Telecom", 0],
    ]);
  });

  it("T-SUM-API-03: before the repayment the credit card owes 150000", async () => {
    const agent = await agentAs("alice");
    await runDemoJourney(agent, "alice", 3);
    const { body } = await agent.get("/api/summary").expect(200);
    expect(byName(body.loansTaken)["Credit Card"].outstanding).toBe(150_000);
    expect(byName(body.cash).Bank.balance).toBe(4_000_000);
  });

  it("T-SUM-API-04: GET /api/accounts balances equal the summary values", async () => {
    const agent = await agentAs("alice");
    await runDemoJourney(agent);
    const summary = (await agent.get("/api/summary")).body;
    const accounts = (await agent.get("/api/accounts")).body.accounts as { id: number; balance: number }[];

    const fromSummary = new Map<number, number>();
    for (const e of [
      ...summary.cash,
      ...summary.loansTaken,
      ...summary.loansGiven,
      ...summary.income,
      ...summary.expense,
    ])
      fromSummary.set(e.accountId, e.balance ?? e.outstanding ?? e.total);
    expect(fromSummary.size).toBe(accounts.length);
    for (const a of accounts) expect(fromSummary.get(a.id), `account ${a.id}`).toBe(a.balance);
  });

  it("T-SUM-API-05: another user's transactions never change alice's summary", async () => {
    const alice = await agentAs("alice");
    const before = (await alice.get("/api/summary")).body;
    await runDemoJourney(await agentAs("bob"), "bob");
    const after = (await alice.get("/api/summary")).body;
    expect(after).toEqual(before);
  });

  it("anonymous → 401, ADMIN → 403", async () => {
    expect((await request(createApp()).get("/api/summary")).status).toBe(401);
    const admin = await (await agentAs("admin")).get("/api/summary");
    expect(admin.status).toBe(403);
    expect(admin.body.error.code).toBe("FORBIDDEN");
  });
});
