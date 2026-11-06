import { describe, expect, it } from "vitest";
import express from "express";
import request from "supertest";
import type { CurrentUser } from "../../src/types/currentUser.js";
import { requireRole } from "../../src/middleware/auth.js";
import { errorHandler } from "../../src/lib/errors.js";

// requireRole only reads req.user, so these tests set it directly instead of going through a session.
function appAs(user: CurrentUser | undefined) {
  const app = express();
  app.use((req, _res, next) => {
    req.user = user;
    next();
  });
  app.get("/user-only", requireRole("USER"), (_req, res) => {
    res.json({ ok: true });
  });
  app.use(errorHandler);
  return app;
}

describe("requireRole", () => {
  it("lets the matching role through", async () => {
    const res = await request(appAs({ id: 1, username: "alice", role: "USER" })).get("/user-only");
    expect(res.status).toBe(200);
  });

  it("returns 403 FORBIDDEN for a different role", async () => {
    const res = await request(appAs({ id: 3, username: "admin", role: "ADMIN" })).get("/user-only");
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  it("returns 401 UNAUTHENTICATED when requireUser has not set req.user", async () => {
    const res = await request(appAs(undefined)).get("/user-only");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });
});
