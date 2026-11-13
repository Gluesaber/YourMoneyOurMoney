import { beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../../src/app.js";
import { agentAs } from "../helpers/auth.js";
import { resetDb } from "../helpers/db.js";

// S1-01: the scaffold and test harness that both tracks build on.
describe("S1-01 harness", () => {
  beforeAll(async () => {
    await resetDb();
  });

  it("GET /api/health responds without a session", async () => {
    const res = await request(createApp()).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });

  it("GET /api/ready responds 200 with db connected without a session", async () => {
    const res = await request(createApp()).get("/api/ready");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ready", db: "connected" });
  });

  it("unknown /api routes return the shared 404 error shape", async () => {
    const res = await request(createApp()).get("/api/does-not-exist");
    expect(res.status).toBe(404);
    expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: "Not found." } });
  });

  it("agentAs gives a session that requireUser accepts", async () => {
    const agent = await agentAs("alice");
    const res = await agent.get("/api/test/whoami");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ id: expect.any(Number), username: "alice", role: "USER" });
    expect(res.body).not.toHaveProperty("passwordHash");
  });

  it("requireUser rejects a request with no session", async () => {
    const res = await request(createApp()).get("/api/test/whoami");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  it("login-as with an unknown username returns 404", async () => {
    const res = await request(createApp()).post("/api/test/login-as").send({ username: "nobody" });
    expect(res.status).toBe(404);
  });

  it("login-as with a missing username returns 400 VALIDATION_ERROR", async () => {
    const res = await request(createApp()).post("/api/test/login-as").send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  // createApp(undefined) would fall back to process.env.NODE_ENV ("test" here), so "" stands for "unset".
  it.each(["development", "production", ""])(
    "test-only routes do not exist when NODE_ENV is '%s'",
    async (nodeEnv) => {
      const app = createApp(nodeEnv);
      const res = await request(app).post("/api/test/login-as").send({ username: "alice" });
      expect(res.status).toBe(404);
      expect(res.headers["set-cookie"]).toBeUndefined();
    },
  );

  it("resetDb seeds the demo users with hashed passwords", async () => {
    const { getPrisma } = await import("../../src/prisma.js");
    const users = await getPrisma().user.findMany({ orderBy: { username: "asc" } });
    expect(users.map((u) => [u.username, u.role])).toEqual([
      ["admin", "ADMIN"],
      ["alice", "USER"],
      ["bob", "USER"],
    ]);
    for (const u of users) expect(u.passwordHash).toMatch(/^\$2[aby]\$/);
  });
});
