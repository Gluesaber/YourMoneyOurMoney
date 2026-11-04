import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { agentAs } from "../helpers/auth.js";
import { resetDb } from "../helpers/db.js";

// S1-06 Server-side authorization and access-control tests — docs/sprints/sprint-1/F-02-admin.md §1.2, §7 (T-ADM-API-04).
const prisma = getPrisma();

async function accountOf(username: string, name: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { username } });
  return prisma.account.findUniqueOrThrow({ where: { userId_name: { userId: user.id, name } } });
}

beforeEach(async () => {
  await resetDb();
});

describe("T-ADM-API-04 (a): unauthenticated requests to protected routes return 401 UNAUTHENTICATED", () => {
  it("rejects anonymous requests to all 6 financial routes and protected auth routes with 401 UNAUTHENTICATED", async () => {
    const aliceBank = await accountOf("alice", "Bank");
    const aliceDining = await accountOf("alice", "Dining");
    const anon = request(createApp());

    const checks = [
      await anon.post("/api/auth/logout"),
      await anon.get("/api/auth/me"),
      await anon.get("/api/accounts"),
      await anon
        .put(`/api/accounts/${aliceBank.id}/opening-balance`)
        .send({ openingBalance: 100_000, openingDate: "2026-11-01" }),
      await anon.post("/api/transactions").send({
        kind: "PAYMENT",
        sourceAccountId: aliceBank.id,
        date: "2026-11-03",
        totalAmount: 10_000,
        lines: [{ accountId: aliceDining.id, amount: 10_000 }],
      }),
      await anon.get("/api/transactions"),
      await anon.get("/api/transactions/1"),
      await anon.get("/api/summary"),
    ];

    for (const res of checks) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    }
  });

  // /api/admin/* lands in S1-07. Marked it.fails until S1-07 mounts adminRouter.
  it.fails("rejects anonymous requests to /api/admin/* with 401 UNAUTHENTICATED", async () => {
    const anon = request(createApp());
    const listRes = await anon.get("/api/admin/users");
    expect(listRes.status).toBe(401);
    expect(listRes.body.error.code).toBe("UNAUTHENTICATED");

    const patchRes = await anon.patch("/api/admin/users/1").send({ isEnabled: false });
    expect(patchRes.status).toBe(401);
    expect(patchRes.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("T-ADM-API-04 (b): USER calling /api/admin/* returns 403 FORBIDDEN", () => {
  // /api/admin/* lands in S1-07. Marked it.fails until S1-07 mounts adminRouter.
  it.fails(
    "rejects USER (alice) on GET /api/admin/users and PATCH /api/admin/users/:id with 403 FORBIDDEN",
    async () => {
      const aliceAgent = await agentAs("alice");
      const bob = await prisma.user.findUniqueOrThrow({ where: { username: "bob" } });

      const listRes = await aliceAgent.get("/api/admin/users");
      expect(listRes.status).toBe(403);
      expect(listRes.body.error.code).toBe("FORBIDDEN");

      const patchRes = await aliceAgent.patch(`/api/admin/users/${bob.id}`).send({ isEnabled: false });
      expect(patchRes.status).toBe(403);
      expect(patchRes.body.error.code).toBe("FORBIDDEN");
    },
  );
});

describe("T-ADM-API-04 (c): ADMIN calling any financial route returns 403 FORBIDDEN (BR-05)", () => {
  it("rejects ADMIN on all 6 financial endpoints with 403 FORBIDDEN", async () => {
    const aliceBank = await accountOf("alice", "Bank");
    const aliceDining = await accountOf("alice", "Dining");
    const adminAgent = await agentAs("admin");

    const checks = [
      await adminAgent.get("/api/accounts"),
      await adminAgent
        .put(`/api/accounts/${aliceBank.id}/opening-balance`)
        .send({ openingBalance: 100_000, openingDate: "2026-11-01" }),
      await adminAgent.post("/api/transactions").send({
        kind: "PAYMENT",
        sourceAccountId: aliceBank.id,
        date: "2026-11-03",
        totalAmount: 10_000,
        lines: [{ accountId: aliceDining.id, amount: 10_000 }],
      }),
      await adminAgent.get("/api/transactions"),
      await adminAgent.get("/api/transactions/1"),
      await adminAgent.get("/api/summary"),
    ];

    for (const res of checks) {
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("FORBIDDEN");
    }
  });
});

describe("T-ADM-API-04 (d): cross-user financial isolation returns 404 NOT_FOUND or filters to own records (BR-04, NFR-SEC-03)", () => {
  it("prevents alice from reading or modifying bob's accounts, opening balances, transactions, or summary", async () => {
    const bobAgent = await agentAs("bob");
    const aliceAgent = await agentAs("alice");

    const bobBank = await accountOf("bob", "Bank");
    const bobSalary = await accountOf("bob", "Salary");
    const bobDining = await accountOf("bob", "Dining");
    const aliceBank = await accountOf("alice", "Bank");
    const aliceDining = await accountOf("alice", "Dining");

    // Bob sets an opening balance and records a transaction.
    await bobAgent
      .put(`/api/accounts/${bobBank.id}/opening-balance`)
      .send({ openingBalance: 2_000_000, openingDate: "2026-11-01" })
      .expect(200);

    const bobTxRes = await bobAgent
      .post("/api/transactions")
      .send({
        kind: "RECEIVE",
        sourceAccountId: bobBank.id,
        date: "2026-11-03",
        totalAmount: 500_000,
        note: "Bob private income",
        lines: [{ accountId: bobSalary.id, amount: 500_000 }],
      })
      .expect(201);
    const bobTxId: number = bobTxRes.body.transaction.id;

    // 1. Alice listing accounts never sees Bob's accounts or balances.
    const aliceAccountsRes = await aliceAgent.get("/api/accounts").expect(200);
    const aliceAccountIds = aliceAccountsRes.body.accounts.map((a: { id: number }) => a.id);
    expect(aliceAccountIds).not.toContain(bobBank.id);
    for (const acc of aliceAccountsRes.body.accounts) {
      expect(acc.balance).toBe(0);
    }

    // 2. Alice setting opening balance on Bob's account gets 404 NOT_FOUND (indistinguishable from non-existent id).
    const putBobAccount = await aliceAgent
      .put(`/api/accounts/${bobBank.id}/opening-balance`)
      .send({ openingBalance: 1, openingDate: "2026-11-01" });
    const putMissingAccount = await aliceAgent
      .put("/api/accounts/999999/opening-balance")
      .send({ openingBalance: 1, openingDate: "2026-11-01" });
    expect(putBobAccount.status).toBe(404);
    expect(putBobAccount.body).toEqual(putMissingAccount.body);
    expect((await prisma.account.findUniqueOrThrow({ where: { id: bobBank.id } })).openingBalance).toBe(
      2_000_000,
    );

    // 3. Alice creating a transaction using Bob's source account or Bob's line account gets 404 NOT_FOUND.
    const txWithBobSource = await aliceAgent.post("/api/transactions").send({
      kind: "PAYMENT",
      sourceAccountId: bobBank.id,
      date: "2026-11-03",
      totalAmount: 10_000,
      lines: [{ accountId: aliceDining.id, amount: 10_000 }],
    });
    expect(txWithBobSource.status).toBe(404);
    expect(txWithBobSource.body.error.code).toBe("NOT_FOUND");

    const txWithBobLine = await aliceAgent.post("/api/transactions").send({
      kind: "PAYMENT",
      sourceAccountId: aliceBank.id,
      date: "2026-11-03",
      totalAmount: 10_000,
      lines: [{ accountId: bobDining.id, amount: 10_000 }],
    });
    expect(txWithBobLine.status).toBe(404);
    expect(txWithBobLine.body.error.code).toBe("NOT_FOUND");

    // 4. Alice listing transactions sees none of Bob's transactions.
    const aliceTxList = await aliceAgent.get("/api/transactions").expect(200);
    expect(aliceTxList.body.transactions).toEqual([]);

    // 5. Alice reading Bob's transaction by id gets 404 NOT_FOUND (same as missing id).
    const getBobTx = await aliceAgent.get(`/api/transactions/${bobTxId}`);
    const getMissingTx = await aliceAgent.get("/api/transactions/999999");
    expect(getBobTx.status).toBe(404);
    expect(getBobTx.body).toEqual(getMissingTx.body);

    // 6. Alice's summary is all zeros, unaffected by Bob's data.
    const aliceSummary = await aliceAgent.get("/api/summary").expect(200);
    expect(aliceSummary.body.totals).toEqual({ income: 0, expense: 0 });
    for (const c of aliceSummary.body.cash) {
      expect(c.balance).toBe(0);
    }
  });
});

describe("disabled-user and deleted-user session enforcement across routes (BR-06, FR-AUTH-04)", () => {
  it("immediately rejects a disabled user's active session on all financial and auth routes with 401 UNAUTHENTICATED", async () => {
    const aliceBank = await accountOf("alice", "Bank");
    const aliceDining = await accountOf("alice", "Dining");
    const aliceAgent = await agentAs("alice");

    // Confirm session works while enabled.
    await aliceAgent.get("/api/accounts").expect(200);

    // Disable alice while her session is active.
    await prisma.user.update({
      where: { username: "alice" },
      data: { isEnabled: false },
    });

    const checks = [
      await aliceAgent.get("/api/auth/me"),
      await aliceAgent.get("/api/accounts"),
      await aliceAgent
        .put(`/api/accounts/${aliceBank.id}/opening-balance`)
        .send({ openingBalance: 100_000, openingDate: "2026-11-01" }),
      await aliceAgent.post("/api/transactions").send({
        kind: "PAYMENT",
        sourceAccountId: aliceBank.id,
        date: "2026-11-03",
        totalAmount: 10_000,
        lines: [{ accountId: aliceDining.id, amount: 10_000 }],
      }),
      await aliceAgent.get("/api/transactions"),
      await aliceAgent.get("/api/transactions/1"),
      await aliceAgent.get("/api/summary"),
      await aliceAgent.post("/api/auth/logout"),
    ];

    for (const res of checks) {
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    }
  });
});
