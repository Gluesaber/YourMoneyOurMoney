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
    res.json(summarize(accounts, balances));
  }),
);
