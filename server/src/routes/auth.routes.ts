import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { getPrisma } from "../prisma.js";
import { AppError, ErrorCode } from "../lib/errors.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireUser } from "../middleware/auth.js";
import { SESSION_COOKIE_NAME, sessionCookieOptions } from "../session.js";

// F-01 Authentication and session management — docs/sprints/sprint-1/F-01-auth.md.
export const authRouter = Router();

// Real cost-10 bcrypt hash used when the username does not exist so unknown-user and wrong-password
// checks both run 10 rounds of bcrypt key stretching (F-01 §1.3).
export const DUMMY_BCRYPT_HASH = bcrypt.hashSync("dummy-password-for-timing", 10);

const INVALID_CREDENTIALS_MESSAGE = "Invalid username or password.";

const loginBody = z.object({
  username: z.string().trim().min(1).max(64),
  password: z.string().min(1).max(128),
});

authRouter.post(
  "/login",
  asyncHandler(async (req, res) => {
    const { username, password } = loginBody.parse(req.body);
    const user = await getPrisma().user.findUnique({ where: { username } });

    if (!user) {
      await bcrypt.compare(password, DUMMY_BCRYPT_HASH);
      throw new AppError(401, ErrorCode.INVALID_CREDENTIALS, INVALID_CREDENTIALS_MESSAGE);
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatches) {
      throw new AppError(401, ErrorCode.INVALID_CREDENTIALS, INVALID_CREDENTIALS_MESSAGE);
    }

    if (!user.isEnabled) {
      throw new AppError(403, ErrorCode.ACCOUNT_DISABLED, "This account has been disabled.");
    }

    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((err) => (err ? reject(err) : resolve())),
    );
    req.session.userId = user.id;
    req.session.loginAt = Date.now();
    await new Promise<void>((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));

    res.json({
      id: user.id,
      username: user.username,
      role: user.role,
    });
  }),
);

authRouter.post(
  "/logout",
  requireUser,
  asyncHandler(async (req, res) => {
    await new Promise<void>((resolve, reject) =>
      req.session.destroy((err) => (err ? reject(err) : resolve())),
    );
    res.clearCookie(SESSION_COOKIE_NAME, sessionCookieOptions());
    res.status(204).end();
  }),
);

authRouter.get("/me", requireUser, (req, res) => {
  res.json(req.user);
});
