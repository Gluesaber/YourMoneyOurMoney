import { describe, expect, it } from "vitest";
import { AppError, ErrorCode } from "../../src/lib/errors.js";
import { assertCanChangeEnabled } from "../../src/routes/admin.routes.js";

// F-02 Administrator user management — docs/sprints/sprint-1/F-02-admin.md §7 (T-ADM-UNIT-01).
describe("assertCanChangeEnabled (T-ADM-UNIT-01, BR-07)", () => {
  it("T-ADM-UNIT-01: throws 400 SELF_DISABLE_NOT_ALLOWED when an admin attempts to disable their own account", () => {
    expect(() => assertCanChangeEnabled(3, 3, false)).toThrowError(AppError);
    try {
      assertCanChangeEnabled(3, 3, false);
    } catch (err) {
      const appErr = err as AppError;
      expect(appErr.status).toBe(400);
      expect(appErr.code).toBe(ErrorCode.SELF_DISABLE_NOT_ALLOWED);
      expect(appErr.message).toBe("You cannot disable your own account.");
    }
  });

  it("T-ADM-UNIT-01: allows disabling or enabling another user and allows enabling self", () => {
    expect(() => assertCanChangeEnabled(3, 1, false)).not.toThrow();
    expect(() => assertCanChangeEnabled(3, 1, true)).not.toThrow();
    expect(() => assertCanChangeEnabled(3, 3, true)).not.toThrow();
  });
});
