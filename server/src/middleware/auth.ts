import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { AppError, ErrorCode } from "../lib/errors.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { SESSION_MAX_AGE_MS } from "../session.js";

// Integration point 2. Verifies the session has a userId, has not exceeded its 24-hour absolute
// lifetime from loginAt (FR-AUTH-05, NFR-SEC-02), and that the user still exists with
// isEnabled === true on every request (FR-AUTH-04, BR-06).
export const requireUser = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const userId = req.session?.userId;
  if (typeof userId !== "number" || !Number.isInteger(userId) || userId < 1) {
    throw new AppError(401, ErrorCode.UNAUTHENTICATED, "Please log in.");
  }

  const loginAt = req.session.loginAt;
  if (typeof loginAt !== "number" || !Number.isFinite(loginAt) || Date.now() - loginAt > SESSION_MAX_AGE_MS) {
    await destroySession(req);
    throw new AppError(401, ErrorCode.UNAUTHENTICATED, "Please log in.");
  }

  const user = await getPrisma().user.findUnique({ where: { id: userId } });
  if (!user || !user.isEnabled) {
    // Destroyed, not just rejected: re-enabling the user must not bring this old cookie back.
    await destroySession(req);
    throw new AppError(401, ErrorCode.UNAUTHENTICATED, "Please log in.");
  }

  req.user = { id: user.id, username: user.username, role: user.role };
  next();
});

async function destroySession(req: Request): Promise<void> {
  if (typeof req.session.destroy === "function") {
    await new Promise<void>((resolve) => req.session.destroy(() => resolve()));
  }
}

// Integration point 3. Use after requireUser: `router.get("/", requireUser, requireRole("USER"), ...)`.
export function requireRole(role: Role) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(new AppError(401, ErrorCode.UNAUTHENTICATED, "Please log in."));
      return;
    }
    if (req.user.role !== role) {
      next(new AppError(403, ErrorCode.FORBIDDEN, "You do not have permission to do this."));
      return;
    }
    next();
  };
}
