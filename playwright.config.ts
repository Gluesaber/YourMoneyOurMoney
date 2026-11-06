import { defineConfig } from "@playwright/test";
import { E2E_API_PORT, E2E_CLIENT_PORT, E2E_DATABASE_URL } from "./e2e/env.js";

// E2E specs live in e2e/. Prerequisite: the Docker database is running (`docker compose up -d`).
// The run uses its own database (ymom_e2e, created and migrated by e2e/globalSetup.ts, reset and seeded
// before each spec file by e2e/db.ts) and starts its own
// API and client on ports 3100 / 5174, so it never reuses the dev servers or touches dev data.
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/globalSetup.ts",
  // All specs share one seeded database (e.g. one disables alice while another logs in as her), so
  // files and tests run one at a time, in file-name order.
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${E2E_CLIENT_PORT}`,
    viewport: { width: 1280, height: 800 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run dev",
      cwd: "./server",
      // Environment variables win over server/.env (Node's --env-file never overrides them).
      env: { DATABASE_URL: E2E_DATABASE_URL, PORT: String(E2E_API_PORT), NODE_ENV: "development" },
      url: `http://localhost:${E2E_API_PORT}/api/health`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
    {
      command: `npm run dev -- --port ${E2E_CLIENT_PORT} --strictPort`,
      cwd: "./client",
      env: { API_PROXY_TARGET: `http://localhost:${E2E_API_PORT}` },
      url: `http://localhost:${E2E_CLIENT_PORT}`,
      reuseExistingServer: false,
      timeout: 30_000,
    },
  ],
});
