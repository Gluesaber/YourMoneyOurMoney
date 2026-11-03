import { describe, expect, it, vi } from "vitest";
import express from "express";
import request from "supertest";
import { z } from "zod";
import { AppError, ErrorCode, errorHandler } from "../../src/lib/errors.js";
import { asyncHandler } from "../../src/lib/asyncHandler.js";

function appThatThrows(err: unknown) {
  const app = express();
  app.use(express.json());
  app.post(
    "/boom",
    asyncHandler(async () => {
      throw err;
    }),
  );
  app.use(errorHandler);
  return app;
}

describe("errorHandler", () => {
  it("turns an AppError into its status and the shared error shape", async () => {
    const res = await request(
      appThatThrows(new AppError(403, ErrorCode.FORBIDDEN, "No.", { why: "role" })),
    ).post("/boom");
    expect(res.status).toBe(403);
    expect(res.body).toEqual({ error: { code: "FORBIDDEN", message: "No.", details: { why: "role" } } });
  });

  it("omits details when the AppError has none", async () => {
    const res = await request(appThatThrows(new AppError(404, ErrorCode.NOT_FOUND, "Not found."))).post(
      "/boom",
    );
    expect(res.body).toEqual({ error: { code: "NOT_FOUND", message: "Not found." } });
  });

  it("turns a ZodError into 400 VALIDATION_ERROR with field details", async () => {
    const result = z.object({ amount: z.number() }).safeParse({ amount: "x" });
    const res = await request(appThatThrows(result.error)).post("/boom");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
    expect(res.body.error.details.fieldErrors).toHaveProperty("amount");
  });

  it("turns malformed JSON into 400 VALIDATION_ERROR", async () => {
    const res = await request(appThatThrows(new Error("unreachable")))
      .post("/boom")
      .set("Content-Type", "application/json")
      .send("{not json");
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  it("hides unexpected errors behind 500 INTERNAL_ERROR", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    const res = await request(appThatThrows(new Error("database password is hunter2"))).post("/boom");
    spy.mockRestore();
    expect(res.status).toBe(500);
    expect(res.body.error.code).toBe("INTERNAL_ERROR");
    expect(JSON.stringify(res.body)).not.toContain("hunter2");
  });
});
