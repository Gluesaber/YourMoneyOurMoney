import { afterEach, describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import bcrypt from "bcryptjs";
import type { PrismaClient } from "@prisma/client";
import { getPrisma } from "../../src/prisma.js";
import { createApp } from "../../src/app.js";
import { requireUser } from "../../src/middleware/auth.js";
import { errorHandler } from "../../src/lib/errors.js";
import { createSessionMiddleware, SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS } from "../../src/session.js";
import { DUMMY_BCRYPT_HASH } from "../../src/routes/auth.routes.js";
import { DEMO_PASSWORD, seed } from "../../prisma/seedData.js";

// F-01 Authentication and session management — docs/sprints/sprint-1/F-01-auth.md §7.
describe("requireUser middleware (T-AUTH-UNIT-01)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function appWithMockSession(sessionData: { userId?: unknown; loginAt?: unknown }, onDestroy?: () => void) {
    const app = express();
    app.use((req, _res, next) => {
      Object.assign(req, {
        session: {
          ...sessionData,
          destroy(cb: (err?: unknown) => void) {
            onDestroy?.();
            cb();
          },
        },
      });
      next();
    });
    app.get("/protected", requireUser, (req, res) => {
      res.json({ user: req.user });
    });
    app.use(errorHandler);
    return app;
  }

  it("T-AUTH-UNIT-01 (a): rejects missing or invalid req.session.userId with 401 UNAUTHENTICATED without querying DB", async () => {
    const findUniqueSpy = vi.spyOn(getPrisma().user, "findUnique");

    for (const badUserId of [undefined, null, 0, -5, "1", NaN]) {
      const res = await request(appWithMockSession({ userId: badUserId, loginAt: Date.now() })).get(
        "/protected",
      );
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    }
    expect(findUniqueSpy).not.toHaveBeenCalled();
  });

  it("T-AUTH-UNIT-01 (b): rejects missing, non-finite, or >24h old loginAt with 401 UNAUTHENTICATED and destroys the session", async () => {
    const findUniqueSpy = vi.spyOn(getPrisma().user, "findUnique");

    for (const expiredOrBadLoginAt of [
      undefined,
      null,
      "not-a-number",
      NaN,
      Date.now() - SESSION_MAX_AGE_MS - 1_000,
      Date.now() - 25 * 60 * 60 * 1000,
    ]) {
      let destroyed = false;
      const res = await request(
        appWithMockSession({ userId: 1, loginAt: expiredOrBadLoginAt }, () => {
          destroyed = true;
        }),
      ).get("/protected");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
      expect(destroyed).toBe(true);
    }
    expect(findUniqueSpy).not.toHaveBeenCalled();
  });

  it("T-AUTH-UNIT-01 (c): rejects non-existent userId with 401 UNAUTHENTICATED and destroys the session", async () => {
    vi.spyOn(getPrisma().user, "findUnique").mockResolvedValueOnce(null);

    let destroyed = false;
    const res = await request(
      appWithMockSession({ userId: 999, loginAt: Date.now() }, () => {
        destroyed = true;
      }),
    ).get("/protected");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
    expect(destroyed).toBe(true);
  });

  it("T-AUTH-UNIT-01 (d): rejects disabled user (isEnabled: false) with 401 UNAUTHENTICATED and destroys the session (BR-06)", async () => {
    vi.spyOn(getPrisma().user, "findUnique").mockResolvedValueOnce({
      id: 1,
      username: "alice",
      passwordHash: "$2a$10$hash",
      role: "USER",
      isEnabled: false,
      createdAt: new Date(),
    });

    let destroyed = false;
    const res = await request(
      appWithMockSession({ userId: 1, loginAt: Date.now() }, () => {
        destroyed = true;
      }),
    ).get("/protected");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
    expect(destroyed).toBe(true);
  });

  it("T-AUTH-UNIT-01 (e): populates req.user = { id, username, role } and calls next() for an enabled user with a valid loginAt", async () => {
    vi.spyOn(getPrisma().user, "findUnique").mockResolvedValueOnce({
      id: 1,
      username: "alice",
      passwordHash: "$2a$10$hash",
      role: "USER",
      isEnabled: true,
      createdAt: new Date(),
    });

    const res = await request(
      appWithMockSession({ userId: 1, loginAt: Date.now() - SESSION_MAX_AGE_MS + 5_000 }),
    ).get("/protected");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      user: { id: 1, username: "alice", role: "USER" },
    });
  });
});

describe("session middleware config (T-AUTH-UNIT-02)", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("T-AUTH-UNIT-02: throws a clear error when SESSION_SECRET or DATABASE_URL is missing", () => {
    delete process.env.SESSION_SECRET;
    expect(() => createSessionMiddleware()).toThrow(/SESSION_SECRET/);

    process.env.SESSION_SECRET = "test-secret";
    delete process.env.DATABASE_URL;
    expect(() => createSessionMiddleware()).toThrow(/DATABASE_URL/);
  });

  it.each([
    ["development", false],
    ["test", false],
    ["production", true],
  ])(
    "T-AUTH-UNIT-02: in %s configures ymom.sid with HttpOnly, SameSite=Lax, 24h maxAge, saveUninitialized=false, and secure=%s",
    async (nodeEnv, expectedSecure) => {
      process.env.NODE_ENV = nodeEnv;
      process.env.SESSION_SECRET = "test-secret";
      process.env.DATABASE_URL = "postgresql://ymom:ymom@localhost:5434/ymom_test?schema=public";

      expect(SESSION_COOKIE_NAME).toBe("ymom.sid");
      expect(SESSION_MAX_AGE_MS).toBe(86_400_000);

      const app = express();
      app.set("trust proxy", 1);
      app.use(createSessionMiddleware());
      app.get("/inspect-cookie", (req, res) => {
        res.json({
          httpOnly: req.session.cookie.httpOnly,
          sameSite: req.session.cookie.sameSite,
          maxAge: req.session.cookie.originalMaxAge,
          secure: req.session.cookie.secure,
        });
      });

      const res = await request(app).get("/inspect-cookie").set("X-Forwarded-Proto", "https");
      expect(res.status).toBe(200);
      expect(res.body.httpOnly).toBe(true);
      expect(res.body.sameSite).toBe("lax");
      expect(res.body.secure).toBe(expectedSecure);
      expect(res.body.maxAge).toBeGreaterThan(86_399_000);
      expect(res.body.maxAge).toBeLessThanOrEqual(86_400_000);
      // saveUninitialized: false means an unauthenticated request does not send Set-Cookie.
      expect(res.headers["set-cookie"]).toBeUndefined();
    },
  );
});

describe("bcrypt dummy hash (T-AUTH-UNIT-03)", () => {
  it("T-AUTH-UNIT-03: DUMMY_BCRYPT_HASH uses cost factor >= 10 and rejects DEMO_PASSWORD (seeded DB hashes are checked in T-AUTH-SEC-01)", async () => {
    expect(DUMMY_BCRYPT_HASH).toMatch(/^\$2[aby]\$10\$.{53}$/);
    expect(bcrypt.getRounds(DUMMY_BCRYPT_HASH)).toBeGreaterThanOrEqual(10);
    await expect(bcrypt.compare(DEMO_PASSWORD, DUMMY_BCRYPT_HASH)).resolves.toBe(false);
  });
});

describe("cloud-readiness: /api/ready, trust proxy, and production seed", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it("enables trust proxy in production so Secure cookies work behind Cloud Run TLS termination", () => {
    process.env.SESSION_SECRET = "test-secret";
    process.env.DATABASE_URL = "postgresql://ymom:ymom@localhost:5434/ymom_test?schema=public";

    const prodApp = createApp("production");
    expect(prodApp.get("trust proxy")).toBe(1);

    const testApp = createApp("test");
    expect(testApp.get("trust proxy")).toBeFalsy();
  });

  it("GET /api/ready returns 200 { status: 'ready', db: 'connected' } when DB query succeeds and 503 when it fails", async () => {
    process.env.SESSION_SECRET = "test-secret";
    process.env.DATABASE_URL = "postgresql://ymom:ymom@localhost:5434/ymom_test?schema=public";

    vi.spyOn(getPrisma(), "$queryRaw").mockResolvedValueOnce([{ "?column?": 1 }]);
    const okRes = await request(createApp("test")).get("/api/ready");
    expect(okRes.status).toBe(200);
    expect(okRes.body).toEqual({ status: "ready", db: "connected" });

    vi.spyOn(getPrisma(), "$queryRaw").mockRejectedValueOnce(new Error("DB down"));
    const failRes = await request(createApp("test")).get("/api/ready");
    expect(failRes.status).toBe(503);
    expect(failRes.body).toEqual({ status: "not_ready" });
  });

  it("seed() in production requires ADMIN_PASSWORD and skips demo users unless SEED_DEMO_DATA=true", async () => {
    const upsertedUsers: string[] = [];
    const upsertedAccounts: string[] = [];
    const mockPrisma = {
      user: {
        upsert: vi.fn(
          async ({ where, create }: { where: { username: string }; create: { role: string } }) => {
            upsertedUsers.push(where.username);
            return { id: upsertedUsers.length, username: where.username, role: create.role };
          },
        ),
      },
      account: {
        upsert: vi.fn(async ({ where }: { where: { userId_name: { userId: number; name: string } } }) => {
          upsertedAccounts.push(`${where.userId_name.userId}:${where.userId_name.name}`);
          return { id: upsertedAccounts.length };
        }),
      },
    } as unknown as PrismaClient;

    await expect(seed(mockPrisma, { NODE_ENV: "production" })).rejects.toThrow(/ADMIN_PASSWORD/);

    await seed(mockPrisma, { NODE_ENV: "production", ADMIN_PASSWORD: "prod-admin-secret-password" });
    expect(upsertedUsers).toEqual(["admin"]);
    expect(upsertedAccounts).toEqual([]);

    await expect(
      seed(mockPrisma, {
        NODE_ENV: "production",
        ADMIN_PASSWORD: "prod-admin-secret-password",
        SEED_DEMO_DATA: "true",
      }),
    ).rejects.toThrow(/DEMO_USER_PASSWORD/);

    upsertedUsers.length = 0;
    upsertedAccounts.length = 0;
    await seed(mockPrisma, {
      NODE_ENV: "production",
      ADMIN_PASSWORD: "prod-admin-secret-password",
      SEED_DEMO_DATA: "true",
      DEMO_USER_PASSWORD: "prod-demo-secret-password",
    });
    expect(upsertedUsers).toEqual(["alice", "bob", "admin"]);
    expect(upsertedAccounts).toHaveLength(16);
  });
});
