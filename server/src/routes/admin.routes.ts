import { Router } from "express";
import { z } from "zod";
import { getPrisma } from "../prisma.js";
import { AppError, ErrorCode } from "../lib/errors.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { parseId } from "../lib/validation.js";
import { requireRole, requireUser } from "../middleware/auth.js";

// F-02 Administrator user management and access control — docs/sprints/sprint-1/F-02-admin.md.
export const adminRouter = Router();

adminRouter.use(requireUser, requireRole("ADMIN"));

// Explicit projection (F-02 §3, §4, BR-05): never select passwordHash, createdAt, or financial relations.
const USER_SELECT = {
  id: true,
  username: true,
  role: true,
  isEnabled: true,
} as const;

const patchUserBody = z.object({
  isEnabled: z.boolean(),
});

// BR-07 (F-02 §2 R6, §7 T-ADM-UNIT-01): an administrator cannot disable their own account.
export function assertCanChangeEnabled(actorId: number, targetId: number, isEnabled: boolean): void {
  if (targetId === actorId && !isEnabled) {
    throw new AppError(400, ErrorCode.SELF_DISABLE_NOT_ALLOWED, "You cannot disable your own account.");
  }
}

adminRouter.get(
  "/users",
  asyncHandler(async (_req, res) => {
    const users = await getPrisma().user.findMany({
      orderBy: { username: "asc" },
      select: USER_SELECT,
    });
    res.json({ users });
  }),
);

adminRouter.patch(
  "/users/:id",
  asyncHandler(async (req, res) => {
    // Validation order from F-02 §2:
    // 1. requireUser, requireRole("ADMIN") (router middleware)
    // 2. Path parameter :id is a positive integer -> otherwise 404 NOT_FOUND
    const id = parseId(req.params.id);
    if (id === null) {
      throw new AppError(404, ErrorCode.NOT_FOUND, "User not found.");
    }

    // 3. Request body shape { isEnabled: boolean } -> otherwise 400 VALIDATION_ERROR
    const body = patchUserBody.parse(req.body);

    // 4. Target user exists in User table -> otherwise 404 NOT_FOUND
    const prisma = getPrisma();
    const targetUser = await prisma.user.findUnique({
      where: { id },
      select: USER_SELECT,
    });
    if (!targetUser) {
      throw new AppError(404, ErrorCode.NOT_FOUND, "User not found.");
    }

    // 5. Self-disable check -> otherwise 400 SELF_DISABLE_NOT_ALLOWED (BR-07)
    assertCanChangeEnabled(req.user!.id, targetUser.id, body.isEnabled);

    // 6. Update isEnabled and return { user }
    const user = await prisma.user.update({
      where: { id: targetUser.id },
      data: { isEnabled: body.isEnabled },
      select: USER_SELECT,
    });

    res.json({ user });
  }),
);
