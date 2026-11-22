import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { fromDateOnly } from "../../src/lib/validation.js";
import { getPrisma } from "../../src/prisma.js";
import { accountOf } from "../helpers/accounts.js";
import { agentAs, type SuperAgentTest } from "../helpers/auth.js";
import { resetDb } from "../helpers/db.js";
import { runDemoJourney } from "../helpers/demo.js";

// F-09 Transaction search, filtering and sorting — docs/sprints/sprint-2/F-09-search-filter.md §7.
const prisma = getPrisma();

beforeEach(async () => {
  await resetDb();
});

async function postTx(
  agent: SuperAgentTest,
  body: {
    kind: "PAYMENT" | "RECEIVE";
    sourceAccountId: number;
    date: string;
    totalAmount: number;
    note?: string | null;
    lines: { accountId: number; amount: number }[];
  },
) {
  const res = await agent.post("/api/transactions").send(body);
  expect(res.status).toBe(201);
  return res.body.transaction as { id: number; date: string; totalAmount: number; note: string | null };
}

describe("GET /api/transactions search, filter and sort (F-09)", () => {
  it("T-HST-API-04: filters by inclusive date range and rejects reversed dates with 400", async () => {
    const alice = await agentAs("alice");
    const bank = (await accountOf("alice", "Bank")).id;
    const salary = (await accountOf("alice", "Salary")).id;

    for (const date of ["2026-10-31", "2026-11-01", "2026-11-15", "2026-11-30", "2026-12-01"]) {
      await postTx(alice, {
        kind: "RECEIVE",
        sourceAccountId: bank,
        date,
        totalAmount: 10_000,
        lines: [{ accountId: salary, amount: 10_000 }],
      });
    }

    const res = await alice.get("/api/transactions?startDate=2026-11-01&endDate=2026-11-30");
    expect(res.status).toBe(200);
    expect(res.body.truncated).toBe(false);
    expect(res.body.transactions.map((t: { date: string }) => t.date)).toEqual([
      "2026-11-30",
      "2026-11-15",
      "2026-11-01",
    ]);

    const reversed = await alice.get("/api/transactions?startDate=2026-11-30&endDate=2026-11-01");
    expect(reversed.status).toBe(400);
    expect(reversed.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("T-HST-API-05: filters by accountId (source or line), kind, literal case-insensitive q, and combined AND", async () => {
    const alice = await agentAs("alice");
    const [bank, card, salary, dining, groceries] = await Promise.all(
      ["Bank", "Credit Card", "Salary", "Dining", "Groceries"].map(
        async (n) => (await accountOf("alice", n)).id,
      ),
    );

    // Demo #1–#3 with note on demo #2
    await postTx(alice, {
      kind: "RECEIVE",
      sourceAccountId: bank,
      date: "2026-11-02",
      totalAmount: 3_000_000,
      lines: [{ accountId: salary, amount: 3_000_000 }],
    });
    const cardPurchase = await postTx(alice, {
      kind: "PAYMENT",
      sourceAccountId: card,
      date: "2026-11-03",
      totalAmount: 150_000,
      note: "Dinner and groceries",
      lines: [
        { accountId: dining, amount: 90_000 },
        { accountId: groceries, amount: 60_000 },
      ],
    });
    await postTx(alice, {
      kind: "PAYMENT",
      sourceAccountId: bank,
      date: "2026-11-04",
      totalAmount: 150_000,
      lines: [{ accountId: card, amount: 150_000 }],
    });

    // Credit Card is source in #2 and line in #3
    const byCard = await alice.get(`/api/transactions?accountId=${card}`);
    expect(byCard.status).toBe(200);
    expect(byCard.body.transactions).toHaveLength(2);

    const byKind = await alice.get("/api/transactions?kind=RECEIVE");
    expect(byKind.status).toBe(200);
    expect(byKind.body.transactions).toHaveLength(1);

    // Case-insensitive note search
    const byQ = await alice.get("/api/transactions?q=DINNER");
    expect(byQ.status).toBe(200);
    expect(byQ.body.transactions.map((t: { id: number }) => t.id)).toEqual([cardPurchase.id]);

    // % and _ are escaped and treated as literal characters, not SQL wildcards
    const byPercentNone = await alice.get("/api/transactions?q=%25");
    expect(byPercentNone.status).toBe(200);
    expect(byPercentNone.body.transactions).toHaveLength(0);

    const byUnderscoreNone = await alice.get("/api/transactions?q=_");
    expect(byUnderscoreNone.status).toBe(200);
    expect(byUnderscoreNone.body.transactions).toHaveLength(0);

    // Combined AND filters
    const combined = await alice.get(`/api/transactions?accountId=${card}&kind=PAYMENT&q=dinner`);
    expect(combined.status).toBe(200);
    expect(combined.body.transactions.map((t: { id: number }) => t.id)).toEqual([cardPurchase.id]);

    // Literal % and _ still match when the note actually contains them
    const promo = await postTx(alice, {
      kind: "PAYMENT",
      sourceAccountId: bank,
      date: "2026-11-05",
      totalAmount: 5_000,
      note: "50% off_sale",
      lines: [{ accountId: dining, amount: 5_000 }],
    });
    const byPercentHit = await alice.get("/api/transactions?q=%25");
    expect(byPercentHit.body.transactions.map((t: { id: number }) => t.id)).toEqual([promo.id]);
    const byUnderscoreHit = await alice.get("/api/transactions?q=_");
    expect(byUnderscoreHit.body.transactions.map((t: { id: number }) => t.id)).toEqual([promo.id]);
  });

  it("T-HST-API-06: foreign or missing accountId returns empty 200; bob rows never leak; ADMIN 403; anon 401", async () => {
    const alice = await agentAs("alice");
    const bob = await agentAs("bob");
    const bobBank = (await accountOf("bob", "Bank")).id;
    const bobSalary = (await accountOf("bob", "Salary")).id;
    await postTx(bob, {
      kind: "RECEIVE",
      sourceAccountId: bobBank,
      date: "2026-11-02",
      totalAmount: 50_000,
      note: "Dinner secret",
      lines: [{ accountId: bobSalary, amount: 50_000 }],
    });

    const foreign = await alice.get(`/api/transactions?accountId=${bobBank}`);
    expect(foreign.status).toBe(200);
    expect(foreign.body).toEqual({ transactions: [], truncated: false });

    const missing = await alice.get("/api/transactions?accountId=999999");
    expect(missing.status).toBe(200);
    expect(missing.body).toEqual({ transactions: [], truncated: false });

    const searchBob = await alice.get("/api/transactions?q=Dinner");
    expect(searchBob.status).toBe(200);
    expect(searchBob.body).toEqual({ transactions: [], truncated: false });

    const admin = await agentAs("admin");
    expect((await admin.get("/api/transactions?kind=PAYMENT")).status).toBe(403);
    expect((await request(createApp()).get("/api/transactions?kind=PAYMENT")).status).toBe(401);
  });

  it("T-HST-API-07: sorts by date or totalAmount with same-direction id ties, and rejects invalid query params", async () => {
    const alice = await agentAs("alice");
    const bank = (await accountOf("alice", "Bank")).id;
    const salary = (await accountOf("alice", "Salary")).id;

    const a = await postTx(alice, {
      kind: "RECEIVE",
      sourceAccountId: bank,
      date: "2026-11-05",
      totalAmount: 20_000,
      lines: [{ accountId: salary, amount: 20_000 }],
    });
    const b = await postTx(alice, {
      kind: "RECEIVE",
      sourceAccountId: bank,
      date: "2026-11-05",
      totalAmount: 50_000,
      lines: [{ accountId: salary, amount: 50_000 }],
    });
    const c = await postTx(alice, {
      kind: "RECEIVE",
      sourceAccountId: bank,
      date: "2026-11-01",
      totalAmount: 20_000,
      lines: [{ accountId: salary, amount: 20_000 }],
    });

    const cases: [string, number[]][] = [
      ["date_desc", [b.id, a.id, c.id]],
      ["date_asc", [c.id, a.id, b.id]],
      ["amount_desc", [b.id, c.id, a.id]],
      ["amount_asc", [a.id, c.id, b.id]],
    ];
    for (const [sort, expectedIds] of cases) {
      const res = await alice.get(`/api/transactions?sort=${sort}`);
      expect(res.status, sort).toBe(200);
      expect(
        res.body.transactions.map((t: { id: number }) => t.id),
        sort,
      ).toEqual(expectedIds);
    }

    const badQueries = [
      "sort=foo",
      "kind=X",
      "startDate=2026-02-30",
      "endDate=1999-12-31",
      "accountId=0",
      "accountId=abc",
      `q=${"a".repeat(101)}`,
    ];
    for (const qs of badQueries) {
      const res = await alice.get(`/api/transactions?${qs}`);
      expect(res.status, qs).toBe(400);
      expect(res.body.error.code, qs).toBe("VALIDATION_ERROR");
    }
  });

  it("T-HST-API-08: with no query params, returns Sprint 1 order plus truncated: false", async () => {
    const alice = await agentAs("alice");
    await runDemoJourney(alice);
    const res = await alice.get("/api/transactions");
    expect(res.status).toBe(200);
    expect(res.body.truncated).toBe(false);
    expect(res.body.transactions.map((t: { date: string }) => t.date)).toEqual([
      "2026-11-04",
      "2026-11-03",
      "2026-11-02",
    ]);
  });

  it("T-HST-API-09: caps output at 500 rows with truncated: true on 501 rows and truncated: false on 500 rows", async () => {
    const alice = await agentAs("alice");
    const aliceAccount = await accountOf("alice", "Bank");
    const aliceUser = await prisma.user.findUniqueOrThrow({ where: { username: "alice" } });

    const base = fromDateOnly("2026-01-01").getTime();
    await prisma.transaction.createMany({
      data: Array.from({ length: 501 }, (_, i) => {
        const d = new Date(base + i * 86_400_000).toISOString().slice(0, 10);
        return {
          userId: aliceUser.id,
          kind: "RECEIVE" as const,
          sourceAccountId: aliceAccount.id,
          date: fromDateOnly(d),
          totalAmount: 100 + i,
          note: `tx-${i}`,
        };
      }),
    });

    const over = await alice.get("/api/transactions");
    expect(over.status).toBe(200);
    expect(over.body.transactions).toHaveLength(500);
    expect(over.body.truncated).toBe(true);
    expect(over.body.transactions.some((t: { date: string }) => t.date === "2026-01-01")).toBe(false);

    // Delete the oldest transaction so exactly 500 remain
    await prisma.transaction.deleteMany({ where: { userId: aliceUser.id, note: "tx-0" } });

    const exact = await alice.get("/api/transactions");
    expect(exact.status).toBe(200);
    expect(exact.body.transactions).toHaveLength(500);
    expect(exact.body.truncated).toBe(false);
  });
});
