import express from "express";
import { createSessionMiddleware } from "./session.js";
import { errorHandler, notFoundHandler } from "./lib/errors.js";
import { testRouter } from "./routes/test.routes.js";
import { authRouter } from "./routes/auth.routes.js";
import { accountsRouter } from "./routes/accounts.routes.js";

// Shared file: keep it to middleware and route mounting. Each track adds its routers below.
// The app is built here and started in index.ts, so Supertest can use it without opening a port.
// `nodeEnv` is a parameter so a test can prove the test-only routes are absent outside NODE_ENV=test.
export function createApp(nodeEnv: string | undefined = process.env.NODE_ENV) {
  const app = express();

  app.use(express.json());
  app.use(createSessionMiddleware());

  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok" });
  });

  // Track A:
  app.use("/api/auth", authRouter);
  //          app.use("/api/admin", adminRouter);
  // Track B:
  app.use("/api/accounts", accountsRouter);
  //          app.use("/api/transactions", transactionsRouter); app.use("/api/summary", summaryRouter);

  if (nodeEnv === "test") {
    app.use("/api/test", testRouter);
  }

  app.use("/api", notFoundHandler);
  app.use(errorHandler);

  return app;
}
