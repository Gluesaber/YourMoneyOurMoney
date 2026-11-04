import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { DEMO_PASSWORD } from "../../prisma/seedData.js";
import { agentAs } from "../helpers/auth.js";
import { resetDb } from "../helpers/db.js";

// F-02 Administrator user management — docs/sprints/sprint-1/F-02-admin.md §7 (T-ADM-API-01..03).
const prisma = getPrisma();

beforeEach(async () => {
  await resetDb();
});

describe("GET /api/admin/users (T-ADM-API-01)", () => {
  it("T-ADM-API-01: returns all seeded users ordered by username A→Z with strictly id, username, role, and isEnabled (no passwordHash or financial fields, BR-05)", async () => {
    // Give alice an opening balance and a transaction first to prove admin responses never include financial data.
    const aliceAgent = await agentAs("alice");
    const alice = await prisma.user.findUniqueOrThrow({ where: { username: "alice" } });
    const aliceBank = await prisma.account.findUniqueOrThrow({
      where: { userId_name: { userId: alice.id, name: "Bank" } },
    });
    const aliceSalary = await prisma.account.findUniqueOrThrow({
      where: { userId_name: { userId: alice.id, name: "Salary" } },
    });
    await aliceAgent
      .put(`/api/accounts/${aliceBank.id}/opening-balance`)
      .send({ openingBalance: 1_000_000, openingDate: "2026-11-01" })
      .expect(200);
    await aliceAgent
      .post("/api/transactions")
      .send({
        kind: "RECEIVE",
        sourceAccountId: aliceBank.id,
        date: "2026-11-03",
        totalAmount: 500_000,
        lines: [{ accountId: aliceSalary.id, amount: 500_000 }],
      })
      .expect(201);

    const adminAgent = await agentAs("admin");
    const res = await adminAgent.get("/api/admin/users");

    expect(res.status).toBe(200);
    expect(res.body.users).toEqual([
      { id: expect.any(Number), username: "admin", role: "ADMIN", isEnabled: true },
      { id: alice.id, username: "alice", role: "USER", isEnabled: true },
      { id: expect.any(Number), username: "bob", role: "USER", isEnabled: true },
    ]);

    for (const u of res.body.users) {
      expect(Object.keys(u).sort()).toEqual(["id", "isEnabled", "role", "username"]);
      expect(u).not.toHaveProperty("passwordHash");
      expect(u).not.toHaveProperty("createdAt");
      expect(u).not.toHaveProperty("accounts");
      expect(u).not.toHaveProperty("transactions");
      expect(u).not.toHaveProperty("balance");
    }
  });
});

describe("PATCH /api/admin/users/:id (T-ADM-API-02, T-ADM-API-03)", () => {
  it("T-ADM-API-02: disables alice (blocking login with 403 and active session with 401), then re-enables alice so she can log in again (BR-06)", async () => {
    const adminAgent = await agentAs("admin");
    const alice = await prisma.user.findUniqueOrThrow({ where: { username: "alice" } });

    // Alice starts with a working logged-in session.
    const aliceAgent = request.agent(createApp());
    await aliceAgent.post("/api/auth/login").send({ username: "alice", password: DEMO_PASSWORD }).expect(200);
    await aliceAgent.get("/api/auth/me").expect(200);

    // Admin disables alice.
    const disableRes = await adminAgent.patch(`/api/admin/users/${alice.id}`).send({ isEnabled: false });
    expect(disableRes.status).toBe(200);
    expect(disableRes.body).toEqual({
      user: {
        id: alice.id,
        username: "alice",
        role: "USER",
        isEnabled: false,
      },
    });
    expect(Object.keys(disableRes.body.user).sort()).toEqual(["id", "isEnabled", "role", "username"]);

    // Admin user list reflects isEnabled: false.
    const listAfterDisable = await adminAgent.get("/api/admin/users").expect(200);
    expect(listAfterDisable.body.users.find((u: { id: number }) => u.id === alice.id).isEnabled).toBe(false);

    // Alice's existing session is rejected on its very next request (401 UNAUTHENTICATED).
    const meWhileDisabled = await aliceAgent.get("/api/auth/me");
    expect(meWhileDisabled.status).toBe(401);
    expect(meWhileDisabled.body.error.code).toBe("UNAUTHENTICATED");

    // Alice cannot log in while disabled (403 ACCOUNT_DISABLED).
    const loginWhileDisabled = await request(createApp())
      .post("/api/auth/login")
      .send({ username: "alice", password: DEMO_PASSWORD });
    expect(loginWhileDisabled.status).toBe(403);
    expect(loginWhileDisabled.body.error.code).toBe("ACCOUNT_DISABLED");

    // Admin re-enables alice.
    const enableRes = await adminAgent.patch(`/api/admin/users/${alice.id}`).send({ isEnabled: true });
    expect(enableRes.status).toBe(200);
    expect(enableRes.body).toEqual({
      user: {
        id: alice.id,
        username: "alice",
        role: "USER",
        isEnabled: true,
      },
    });

    // Alice can log in again.
    const loginAfterEnable = await request(createApp())
      .post("/api/auth/login")
      .send({ username: "alice", password: DEMO_PASSWORD });
    expect(loginAfterEnable.status).toBe(200);
    expect(loginAfterEnable.body.username).toBe("alice");
  });

  it("T-ADM-API-02: returns 404 NOT_FOUND for non-existent or invalid :id and 400 VALIDATION_ERROR for invalid body in contract order", async () => {
    const adminAgent = await agentAs("admin");
    const alice = await prisma.user.findUniqueOrThrow({ where: { username: "alice" } });

    // Non-existent or invalid path ids -> 404 NOT_FOUND (including when body is also invalid for non-numeric id, step 2 before step 3).
    for (const badId of ["999999", "abc", "0", "-1", "1.5", "2147483648"]) {
      const res = await adminAgent.patch(`/api/admin/users/${badId}`).send({ isEnabled: false });
      expect(res.status, `id=${badId}`).toBe(404);
      expect(res.body.error.code).toBe("NOT_FOUND");
    }

    const nonNumericWithEmptyBody = await adminAgent.patch("/api/admin/users/abc").send({});
    expect(nonNumericWithEmptyBody.status).toBe(404);
    expect(nonNumericWithEmptyBody.body.error.code).toBe("NOT_FOUND");

    // Invalid body on a syntactically valid id -> 400 VALIDATION_ERROR (step 3 before step 4).
    for (const badBody of [
      {},
      { isEnabled: "no" },
      { isEnabled: "false" },
      { isEnabled: 0 },
      { isEnabled: 1 },
      { isEnabled: null },
    ]) {
      const res = await adminAgent.patch(`/api/admin/users/${alice.id}`).send(badBody);
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    }

    const missingUserWithBadBody = await adminAgent.patch("/api/admin/users/999999").send({});
    expect(missingUserWithBadBody.status).toBe(400);
    expect(missingUserWithBadBody.body.error.code).toBe("VALIDATION_ERROR");

    // Alice remains enabled in DB after all rejected requests.
    expect((await prisma.user.findUniqueOrThrow({ where: { id: alice.id } })).isEnabled).toBe(true);
  });

  it("T-ADM-API-03: rejects admin disabling their own account with 400 SELF_DISABLE_NOT_ALLOWED (BR-07), while allowing isEnabled: true", async () => {
    const adminAgent = await agentAs("admin");
    const admin = await prisma.user.findUniqueOrThrow({ where: { username: "admin" } });

    const selfDisable = await adminAgent.patch(`/api/admin/users/${admin.id}`).send({ isEnabled: false });
    expect(selfDisable.status).toBe(400);
    expect(selfDisable.body).toEqual({
      error: {
        code: "SELF_DISABLE_NOT_ALLOWED",
        message: "You cannot disable your own account.",
      },
    });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: admin.id } })).isEnabled).toBe(true);

    // Admin's session still works and setting isEnabled: true on self succeeds.
    const selfEnable = await adminAgent.patch(`/api/admin/users/${admin.id}`).send({ isEnabled: true });
    expect(selfEnable.status).toBe(200);
    expect(selfEnable.body.user.isEnabled).toBe(true);
  });
});
