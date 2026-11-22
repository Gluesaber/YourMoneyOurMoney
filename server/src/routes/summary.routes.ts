import { Router } from "express";
import { asyncHandler } from "../lib/asyncHandler.js";
import { requireRole, requireUser } from "../middleware/auth.js";
import { summarize } from "../services/ledger.js";
import { loadLedger } from "../services/userLedger.js";

// F-05 Balances and summary — docs/sprints/sprint-1/F-05-summary-history.md §3.
export const summaryRouter = Router();

summaryRouter.use(requireUser, requireRole("USER"));

summaryRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const { accounts, balances } = await loadLedger(req.user!.id);
    // F-06 §5: an archived account with nothing on it is left off the dashboard. Its value is 0, so no
    // total changes; an archived account that still has a value stays visible.
    const shown = accounts.filter((a) => a.archivedAt === null || balances.get(a.id) !== 0);
    res.json(summarize(shown, balances));
  }),
);
