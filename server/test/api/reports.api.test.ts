import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { accountOf } from "../helpers/accounts.js";
import { agentAs, type SuperAgentTest } from "../helpers/auth.js";
import { resetDb } from "../helpers/db.js";
import { runDemoJourney } from "../helpers/demo.js";

// F-11 reports — docs/sprints/sprint-3/F-11-reports.md §7.
beforeEach(async () => {
  await resetDb();
});

const MONTHLY = "/api/reports/monthly?from=2026-11&to=2026-12";
const BREAKDOWN_NOV = "/api/reports/category-breakdown?startDate=2026-11-01&endDate=2026-11-30";

// §1.1: the Sprint 1 demo journey (opening balance 11-01, salary 11-02, card purchase 11-03, repayment 11-04) plus a
// Telecom bill on 12-05.
async function reportData(agent: SuperAgentTest) {
  await runDemoJourney(agent);
  const [card, telecom] = await Promise.all([
    accountOf("alice", "Credit Card"),
    accountOf("alice", "Telecom"),
  ]);
  await agent
    .post("/api/transactions")
    .send({
      kind: "PAYMENT",
      sourceAccountId: card.id,
      date: "2026-12-05",
      totalAmount: 30_000,
      lines: [{ accountId: telecom.id, amount: 30_000 }],
    })
    .expect(201);
}

describe("GET /api/reports/monthly", () => {
  it("T-REP-API-01: the §1.1 data gives exactly the §3 body", async () => {
    const agent = await agentAs("alice");
    await reportData(agent);

    const res = await agent.get(MONTHLY);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      months: [
        { month: "2026-11", income: 3_000_000, expense: 150_000, net: 2_850_000 },
        { month: "2026-12", income: 0, expense: 30_000, net: -30_000 },
      ],
      totals: { income: 3_000_000, expense: 180_000, net: 2_820_000 },
    });
  });
});

describe("GET /api/reports/category-breakdown", () => {
  it("T-REP-API-03: November expense and income breakdowns with basis-point shares and average per day", async () => {
    const agent = await agentAs("alice");
    await reportData(agent);
    const [dining, groceries, salary] = await Promise.all(
      ["Dining", "Groceries", "Salary"].map((name) => accountOf("alice", name)),
    );

    const expense = await agent.get(`${BREAKDOWN_NOV}&type=EXPENSE`);
    expect(expense.status).toBe(200);
    expect(expense.body).toEqual({
      type: "EXPENSE",
      total: 150_000,
      days: 30,
      averageDaily: 5_000,
      categories: [
        { accountId: dining.id, name: "Dining", total: 90_000, share: 6_000 },
        { accountId: groceries.id, name: "Groceries", total: 60_000, share: 4_000 },
      ],
    });

    // EXPENSE is the default type.
    expect((await agent.get(BREAKDOWN_NOV)).body).toEqual(expense.body);

    const income = await agent.get(`${BREAKDOWN_NOV}&type=INCOME`);
    expect(income.status).toBe(200);
    expect(income.body).toEqual({
      type: "INCOME",
      total: 3_000_000,
      days: 30,
      averageDaily: 100_000,
      categories: [{ accountId: salary.id, name: "Salary", total: 3_000_000, share: 10_000 }],
    });
  });

  it("T-REP-API-03: a period with no income or expense gives an empty list and zeros", async () => {
    const agent = await agentAs("alice");
    await reportData(agent);
    const res = await agent.get("/api/reports/category-breakdown?startDate=2026-10-01&endDate=2026-10-31");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ type: "EXPENSE", total: 0, days: 31, averageDaily: 0, categories: [] });
  });
});

describe("Reports never count transfers, loans or opening balances (BR-08)", () => {
  it("T-REP-API-02: a transfer, a lend and an opening-balance change in November change no report value", async () => {
    const agent = await agentAs("alice");
    await reportData(agent);
    const urls = [MONTHLY, `${BREAKDOWN_NOV}&type=EXPENSE`, `${BREAKDOWN_NOV}&type=INCOME`];
    // Each report must really answer (200) — two identical error bodies would also "match".
    const report = async (u: string) => (await agent.get(u).expect(200)).body;
    const before = await Promise.all(urls.map(report));
    expect(before[0].totals).toEqual({ income: 3_000_000, expense: 180_000, net: 2_820_000 });

    const bank = await accountOf("alice", "Bank");
    const wallet = (
      await agent.post("/api/accounts").send({ name: "Wallet", type: "CASH", subtype: "WALLET" }).expect(201)
    ).body.account.id;
    const ben = (await agent.post("/api/accounts").send({ name: "Ben", type: "LOAN_GIVEN" }).expect(201)).body
      .account.id;
    for (const [to, amount, date] of [
      [wallet, 100_000, "2026-11-10"],
      [ben, 50_000, "2026-11-12"],
    ] as const) {
      await agent
        .post("/api/transactions")
        .send({
          kind: "PAYMENT",
          sourceAccountId: bank.id,
          date,
          totalAmount: amount,
          lines: [{ accountId: to, amount }],
        })
        .expect(201);
    }
    await agent
      .put(`/api/accounts/${bank.id}/opening-balance`)
      .send({ openingBalance: 2_000_000, openingDate: "2026-11-01" })
      .expect(200);

    const after = await Promise.all(urls.map(report));
    expect(after).toEqual(before);
  });
});

describe("F-11 validation and access", () => {
  it.each([
    ["from after to", "/api/reports/monthly?from=2026-12&to=2026-11"],
    ["25 months", "/api/reports/monthly?from=2025-01&to=2027-01"],
    ["month 13", "/api/reports/monthly?from=2026-13&to=2026-13"],
    ["missing from", "/api/reports/monthly?to=2026-12"],
    ["year before 2000", "/api/reports/monthly?from=1999-12&to=2000-01"],
    ["type CASH", `${BREAKDOWN_NOV}&type=CASH`],
    ["reversed dates", "/api/reports/category-breakdown?startDate=2026-11-30&endDate=2026-11-01"],
    ["367 days", "/api/reports/category-breakdown?startDate=2026-01-01&endDate=2027-01-02"],
    ["missing endDate", "/api/reports/category-breakdown?startDate=2026-11-01"],
    ["not a real date", "/api/reports/category-breakdown?startDate=2026-02-30&endDate=2026-03-01"],
  ])("T-REP-API-04: %s → 400 VALIDATION_ERROR", async (_label, url) => {
    const res = await (await agentAs("alice")).get(url);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("T-REP-API-04: 24 months and 366 days are the largest ranges accepted", async () => {
    const agent = await agentAs("alice");
    expect((await agent.get("/api/reports/monthly?from=2025-01&to=2026-12")).status).toBe(200);
    expect(
      (await agent.get("/api/reports/category-breakdown?startDate=2028-01-01&endDate=2028-12-31")).body.days,
    ).toBe(366);
  });

  it("T-REP-API-04: bob's data never appears in alice's reports; ADMIN → 403; anonymous → 401", async () => {
    const alice = await agentAs("alice");
    await reportData(alice);
    const before = (await alice.get(MONTHLY)).body;

    const bob = await agentAs("bob");
    const [bobBank, bobDining] = await Promise.all([accountOf("bob", "Bank"), accountOf("bob", "Dining")]);
    // L7-01 (BR-14): bob's Bank must hold the money first; an opening balance is never income or expense (BR-08).
    await bob
      .put(`/api/accounts/${bobBank.id}/opening-balance`)
      .send({ openingBalance: 1_000_000, openingDate: "2026-11-01" })
      .expect(200);
    await bob
      .post("/api/transactions")
      .send({
        kind: "PAYMENT",
        sourceAccountId: bobBank.id,
        date: "2026-11-15",
        totalAmount: 777_700,
        lines: [{ accountId: bobDining.id, amount: 777_700 }],
      })
      .expect(201);
    expect((await alice.get(MONTHLY)).body).toEqual(before);
    expect((await bob.get(MONTHLY)).body.totals).toEqual({ income: 0, expense: 777_700, net: -777_700 });

    const admin = await agentAs("admin");
    const anon = request.agent(createApp());
    for (const url of [MONTHLY, BREAKDOWN_NOV]) {
      const a = await admin.get(url);
      expect(a.status).toBe(403);
      expect(a.body.error.code).toBe("FORBIDDEN");
      const n = await anon.get(url);
      expect(n.status).toBe(401);
      expect(n.body.error.code).toBe("UNAUTHENTICATED");
    }
  });
});
