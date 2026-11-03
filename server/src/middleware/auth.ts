import type { NextFunction, Request, Response } from "express";
import type { Role } from "@prisma/client";
import { getPrisma } from "../prisma.js";
import { AppError, ErrorCode } from "../lib/errors.js";
import { asyncHandler } from "../lib/asyncHandler.js";

// Integration point 2. Placeholder from S1-01: loads the session's user into req.user, 401 otherwise.
// S1-06 (Track A) adds the per-request isEnabled check (BR-06) and the full access-control tests.
// The signature and the req.user shape must not change.
export const requireUser = asyncHandler(async (req: Request, _res: Response, next: NextFunction) => {
  const userId = req.session.userId;
  if (!userId) {
    throw new AppError(401, ErrorCode.UNAUTHENTICATED, "Please log in.");
  }
  const user = await getPrisma().user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError(401, ErrorCode.UNAUTHENTICATED, "Please log in.");
  }
  req.user = { id: user.id, username: user.username, role: user.role };
  next();
});

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
