import { Router } from "express";
import { z } from "zod";
import { getPrisma } from "../prisma.js";
import { AppError, ErrorCode } from "../lib/errors.js";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireUser } from "../middleware/auth.js";

// Integration point 7. Test-only routes: app.ts mounts this router only when NODE_ENV=test,
// so B's tests can act as any seeded user without depending on the real login (S1-05).
export const testRouter = Router();

const loginAsBody = z.object({ username: z.string().min(1) });

testRouter.post(
  "/login-as",
  asyncHandler(async (req, res) => {
    const { username } = loginAsBody.parse(req.body);
    const user = await getPrisma().user.findUnique({ where: { username } });
    if (!user) {
      throw new AppError(404, ErrorCode.NOT_FOUND, `No user named "${username}".`);
    }
    await new Promise<void>((resolve, reject) =>
      req.session.regenerate((err) => (err ? reject(err) : resolve())),
    );
    req.session.userId = user.id;
    req.session.loginAt = Date.now();
    await new Promise<void>((resolve, reject) => req.session.save((err) => (err ? reject(err) : resolve())));
    res.status(204).end();
  }),
);

// Lets the harness tests confirm a session made by /login-as reaches requireUser.
testRouter.get("/whoami", requireUser, (req, res) => {
  res.json(req.user);
});
