import { describe, expect, it } from "vitest";
import { assertOwned } from "../../src/lib/ownership.js";
import { AppError } from "../../src/lib/errors.js";

describe("assertOwned (BR-04)", () => {
  const record = { id: 7, userId: 1 };

  it("returns the record when it belongs to the user", () => {
    expect(assertOwned(record, 1)).toBe(record);
  });

  it.each([
    ["the record does not exist", null, 1],
    ["the record belongs to another user", record, 2],
  ])("throws 404 NOT_FOUND when %s", (_case, input, userId) => {
    try {
      assertOwned(input, userId);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(AppError);
      expect((err as AppError).status).toBe(400);
      expect((err as AppError).code).toBe("NOT_FOUND");
    }
  });
});
