import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createApp } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { SESSION_COOKIE_NAME } from "../../src/session.js";
import { DEMO_PASSWORD } from "../../prisma/seedData.js";
import { agentAs } from "../helpers/auth.js";
import { resetDb } from "../helpers/db.js";

// F-01 Authentication and session management — docs/sprints/sprint-1/F-01-auth.md §7.
const prisma = getPrisma();

beforeEach(async () => {
  await resetDb();
});

describe("POST /api/auth/login (T-AUTH-API-01)", () => {
  it("T-AUTH-API-01 (a, b): logs in seeded USER and ADMIN, sets ymom.sid cookie, and stores userId and loginAt in PostgreSQL", async () => {
    for (const [username, expectedRole] of [
      ["alice", "USER"],
      ["admin", "ADMIN"],
    ] as const) {
      const user = await prisma.user.findUniqueOrThrow({ where: { username } });
      const before = Date.now();

      const res = await request(createApp())
        .post("/api/auth/login")
        .send({ username, password: DEMO_PASSWORD });

      const after = Date.now();
      expect(res.status).toBe(200);
      expect(res.body).toEqual({
        id: user.id,
        username,
        role: expectedRole,
      });

      const cookies = res.headers["set-cookie"] as unknown as string[] | undefined;
      expect(cookies).toBeDefined();
      const sidCookie = cookies!.find((c) => c.startsWith(`${SESSION_COOKIE_NAME}=`));
      expect(sidCookie).toBeDefined();
      expect(sidCookie).toContain("HttpOnly");
      expect(sidCookie).toContain("SameSite=Lax");

      const sessions = await prisma.session.findMany();
      const matching = sessions
        .map((s) => s.sess as { userId?: number; loginAt?: number })
        .find((sess) => sess.userId === user.id && typeof sess.loginAt === "number");
      expect(matching).toBeDefined();
      expect(matching!.loginAt).toBeGreaterThanOrEqual(before);
      expect(matching!.loginAt).toBeLessThanOrEqual(after);
    }
  });

  it("T-AUTH-API-01 (c, d): returns identical 401 INVALID_CREDENTIALS message for wrong password and unknown username without setting a cookie", async () => {
    const wrongPassRes = await request(createApp())
      .post("/api/auth/login")
      .send({ username: "alice", password: "wrong-password" });

    const unknownUserRes = await request(createApp())
      .post("/api/auth/login")
      .send({ username: "nonexistent_user", password: "any-password" });

    expect(wrongPassRes.status).toBe(401);
    expect(unknownUserRes.status).toBe(401);
    expect(wrongPassRes.body).toEqual({
      error: {
        code: "INVALID_CREDENTIALS",
        message: "Invalid username or password.",
      },
    });
    expect(unknownUserRes.body).toEqual(wrongPassRes.body);
    expect(wrongPassRes.headers["set-cookie"]).toBeUndefined();
    expect(unknownUserRes.headers["set-cookie"]).toBeUndefined();
  });

  it("T-AUTH-API-01 (e, f): rejects disabled user with 403 ACCOUNT_DISABLED on valid password, but 401 INVALID_CREDENTIALS on wrong password (BR-06)", async () => {
    await prisma.user.update({
      where: { username: "alice" },
      data: { isEnabled: false },
    });

    const wrongPass = await request(createApp())
      .post("/api/auth/login")
      .send({ username: "alice", password: "wrong-password" });
    expect(wrongPass.status).toBe(401);
    expect(wrongPass.body.error.code).toBe("INVALID_CREDENTIALS");
    expect(wrongPass.headers["set-cookie"]).toBeUndefined();

    const validPass = await request(createApp())
      .post("/api/auth/login")
      .send({ username: "alice", password: DEMO_PASSWORD });
    expect(validPass.status).toBe(403);
    expect(validPass.body).toEqual({
      error: {
        code: "ACCOUNT_DISABLED",
        message: "This account has been disabled.",
      },
    });
    expect(validPass.headers["set-cookie"]).toBeUndefined();
  });

  it.each([
    ["empty object", {}],
    ["empty username", { username: "", password: DEMO_PASSWORD }],
    ["whitespace-only username", { username: "   ", password: DEMO_PASSWORD }],
    ["empty password", { username: "alice", password: "" }],
    ["missing password", { username: "alice" }],
    ["non-string username", { username: 123, password: DEMO_PASSWORD }],
    ["non-string password", { username: "alice", password: 123 }],
    ["username over 64 chars", { username: "a".repeat(65), password: DEMO_PASSWORD }],
    ["password over 128 chars", { username: "alice", password: "p".repeat(129) }],
  ])("T-AUTH-API-01 (g): rejects %s with 400 VALIDATION_ERROR", async (_label, body) => {
    const res = await request(createApp()).post("/api/auth/login").send(body);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.headers["set-cookie"]).toBeUndefined();
  });

  it("T-AUTH-API-01 (h): regenerates the session id on login to prevent session fixation", async () => {
    const agent = await agentAs("bob");
    const beforeSessions = await prisma.session.findMany();
    expect(beforeSessions).toHaveLength(1);
    const oldSid = beforeSessions[0].sid;

    const loginRes = await agent.post("/api/auth/login").send({ username: "alice", password: DEMO_PASSWORD });
    expect(loginRes.status).toBe(200);
    expect(loginRes.body.username).toBe("alice");

    const afterSessions = await prisma.session.findMany();
    const sids = afterSessions.map((s) => s.sid);
    expect(sids).not.toContain(oldSid);

    const meRes = await agent.get("/api/auth/me");
    expect(meRes.status).toBe(200);
    expect(meRes.body.username).toBe("alice");
  });
});

describe("POST /api/auth/logout (T-AUTH-API-02)", () => {
  it("T-AUTH-API-02: destroys the PostgreSQL session row, clears cookie, and rejects subsequent /me or /logout with 401", async () => {
    const agent = request.agent(createApp());
    await agent.post("/api/auth/login").send({ username: "alice", password: DEMO_PASSWORD }).expect(200);
    expect(await prisma.session.count()).toBe(1);

    const logoutRes = await agent.post("/api/auth/logout");
    expect(logoutRes.status).toBe(204);
    expect(await prisma.session.count()).toBe(0);

    const meAfter = await agent.get("/api/auth/me");
    expect(meAfter.status).toBe(401);
    expect(meAfter.body.error.code).toBe("UNAUTHENTICATED");

    const secondLogout = await agent.post("/api/auth/logout");
    expect(secondLogout.status).toBe(401);
    expect(secondLogout.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("T-AUTH-API-02: rejects anonymous POST /api/auth/logout with 401 UNAUTHENTICATED", async () => {
    const res = await request(createApp()).post("/api/auth/logout");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("GET /api/auth/me (T-AUTH-API-03)", () => {
  it("T-AUTH-API-03: returns { id, username, role } for an active session and 401 for anonymous or forged cookie", async () => {
    const alice = await prisma.user.findUniqueOrThrow({ where: { username: "alice" } });
    const agent = request.agent(createApp());
    await agent.post("/api/auth/login").send({ username: "alice", password: DEMO_PASSWORD }).expect(200);

    const meRes = await agent.get("/api/auth/me");
    expect(meRes.status).toBe(200);
    expect(meRes.body).toEqual({
      id: alice.id,
      username: "alice",
      role: "USER",
    });

    const anonRes = await request(createApp()).get("/api/auth/me");
    expect(anonRes.status).toBe(401);
    expect(anonRes.body.error.code).toBe("UNAUTHENTICATED");

    const forgedRes = await request(createApp())
      .get("/api/auth/me")
      .set("Cookie", [`${SESSION_COOKIE_NAME}=s%3Ainvalid-sid.bad-signature`]);
    expect(forgedRes.status).toBe(401);
    expect(forgedRes.body.error.code).toBe("UNAUTHENTICATED");
  });

  // Server-side 24h loginAt check in requireUser (S1-06).
  it("T-AUTH-API-03: rejects a session whose loginAt is more than 24 hours old (AC-AUTH-07)", async () => {
    const agent = request.agent(createApp());
    await agent.post("/api/auth/login").send({ username: "alice", password: DEMO_PASSWORD }).expect(200);

    const sessionRow = await prisma.session.findFirstOrThrow();
    const sess = sessionRow.sess as Record<string, unknown>;
    await prisma.session.update({
      where: { sid: sessionRow.sid },
      data: {
        sess: {
          ...sess,
          loginAt: Date.now() - 25 * 60 * 60 * 1000,
        },
      },
    });

    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});

describe("disabled-user session invalidation (T-AUTH-API-04)", () => {
  // Per-request isEnabled check in requireUser (S1-06).
  it("T-AUTH-API-04: rejects an active session on its very next request after user is disabled (BR-06)", async () => {
    const agent = request.agent(createApp());
    await agent.post("/api/auth/login").send({ username: "alice", password: DEMO_PASSWORD }).expect(200);
    await agent.get("/api/auth/me").expect(200);

    await prisma.user.update({
      where: { username: "alice" },
      data: { isEnabled: false },
    });

    const meRes = await agent.get("/api/auth/me");
    expect(meRes.status).toBe(401);
    expect(meRes.body.error.code).toBe("UNAUTHENTICATED");

    const whoamiRes = await agent.get("/api/test/whoami");
    expect(whoamiRes.status).toBe(401);
  });
});

describe("credential and response field protection (T-AUTH-SEC-01)", () => {
  it("T-AUTH-SEC-01: stores only cost-10 bcrypt hashes in DB that verify DEMO_PASSWORD and never leaks passwordHash or extra fields in /api/auth/* responses", async () => {
    const users = await prisma.user.findMany();
    expect(users.length).toBeGreaterThanOrEqual(3);
    for (const u of users) {
      expect(u.passwordHash).toMatch(/^\$2[aby]\$10\$.{53}$/);
      expect(u.passwordHash).not.toBe(DEMO_PASSWORD);
      expect(bcrypt.getRounds(u.passwordHash)).toBeGreaterThanOrEqual(10);
      await expect(bcrypt.compare(DEMO_PASSWORD, u.passwordHash)).resolves.toBe(true);
      await expect(bcrypt.compare("wrong-password", u.passwordHash)).resolves.toBe(false);
    }

    const agent = request.agent(createApp());
    const loginRes = await agent.post("/api/auth/login").send({ username: "alice", password: DEMO_PASSWORD });
    expect(loginRes.status).toBe(200);
    expect(Object.keys(loginRes.body).sort()).toEqual(["id", "role", "username"]);
    expect(loginRes.body).not.toHaveProperty("password");
    expect(loginRes.body).not.toHaveProperty("passwordHash");
    expect(loginRes.body).not.toHaveProperty("isEnabled");

    const meRes = await agent.get("/api/auth/me");
    expect(meRes.status).toBe(200);
    expect(Object.keys(meRes.body).sort()).toEqual(["id", "role", "username"]);
    expect(meRes.body).not.toHaveProperty("password");
    expect(meRes.body).not.toHaveProperty("passwordHash");
    expect(meRes.body).not.toHaveProperty("isEnabled");
  });
});
