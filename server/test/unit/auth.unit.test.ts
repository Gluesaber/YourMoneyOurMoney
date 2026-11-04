import { afterEach, describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import bcrypt from "bcryptjs";
import { createSessionMiddleware, SESSION_COOKIE_NAME, SESSION_MAX_AGE_MS } from "../../src/session.js";
import { DUMMY_BCRYPT_HASH } from "../../src/routes/auth.routes.js";
import { DEMO_PASSWORD } from "../../prisma/seedData.js";

// F-01 Authentication and session management — docs/sprints/sprint-1/F-01-auth.md §7.
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
      expect(res.body).toEqual({
        httpOnly: true,
        sameSite: "lax",
        maxAge: 86_400_000,
        secure: expectedSecure,
      });
      // saveUninitialized: false means an unauthenticated request does not send Set-Cookie.
      expect(res.headers["set-cookie"]).toBeUndefined();
    },
  );
});

describe("bcrypt password and dummy hashes (T-AUTH-UNIT-03)", () => {
  it("T-AUTH-UNIT-03: seeded hash and DUMMY_BCRYPT_HASH use cost factor >= 10 and verify DEMO_PASSWORD", async () => {
    const seededHash = await bcrypt.hash(DEMO_PASSWORD, 10);

    expect(seededHash).toMatch(/^\$2[aby]\$10\$.{53}$/);
    expect(DUMMY_BCRYPT_HASH).toMatch(/^\$2[aby]\$10\$.{53}$/);
    expect(bcrypt.getRounds(seededHash)).toBeGreaterThanOrEqual(10);
    expect(bcrypt.getRounds(DUMMY_BCRYPT_HASH)).toBeGreaterThanOrEqual(10);

    await expect(bcrypt.compare(DEMO_PASSWORD, seededHash)).resolves.toBe(true);
    await expect(bcrypt.compare("wrong-password", seededHash)).resolves.toBe(false);
    await expect(bcrypt.compare(DEMO_PASSWORD, DUMMY_BCRYPT_HASH)).resolves.toBe(false);
  });
});
