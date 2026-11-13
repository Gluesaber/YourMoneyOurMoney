import fs from "node:fs";
import path from "node:path";
import express from "express";
import { getPrisma } from "./prisma.js";
import { createSessionMiddleware } from "./session.js";
import { errorHandler, notFoundHandler } from "./lib/errors.js";
import { testRouter } from "./routes/test.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { adminRouter } from "./routes/admin.routes.js";
import { accountsRouter } from "./routes/accounts.routes.js";
import { transactionsRouter } from "./routes/transactions.routes.js";
import { summaryRouter } from "./routes/summary.routes.js";

function resolveClientDistDir(): string | null {
  const candidates = [
    process.env.CLIENT_DIST_DIR,
    path.resolve(import.meta.dirname, "../../client/dist"),
    path.resolve(import.meta.dirname, "../../../client/dist"),
  ];
  for (const dir of candidates) {
    if (dir && fs.existsSync(path.join(dir, "index.html"))) {
      return dir;
    }
  }
  return null;
}

// Shared file: keep it to middleware and route mounting. Each track adds its routers below.
// The app is built here and started in index.ts, so Supertest can use it without opening a port.
// `nodeEnv` is a parameter so a test can prove the test-only routes are absent outside NODE_ENV=test.
export function createApp(nodeEnv: string | undefined = process.env.NODE_ENV) {
  const app = express();

  if (nodeEnv === "production") {
    // Cloud Run terminates HTTPS at its load balancer and forwards X-Forwarded-Proto: https.
    app.set("trust proxy", 1);
  }

  app.use(express.json());
  app.use(createSessionMiddleware());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  app.get("/api/ready", async (_req, res) => {
    try {
      await getPrisma().$queryRaw`SELECT 1`;
      res.json({ status: "ready", db: "connected" });
    } catch {
      res.status(503).json({ status: "not_ready" });
    }
  });

  // Track A:
  app.use("/api/auth", authRouter);
  app.use("/api/admin", adminRouter);
  // Track B:
  app.use("/api/accounts", accountsRouter);
  app.use("/api/transactions", transactionsRouter);
  app.use("/api/summary", summaryRouter);

  if (nodeEnv === "test") {
    app.use("/api/test", testRouter);
  }

  app.use("/api", notFoundHandler);

  if (nodeEnv !== "test") {
    const clientDistDir = resolveClientDistDir();
    if (clientDistDir) {
      app.use(express.static(clientDistDir));
      app.get("*", (_req, res) => {
        res.sendFile(path.join(clientDistDir, "index.html"));
      });
    }
  }

  app.use(errorHandler);

  return app;
}
