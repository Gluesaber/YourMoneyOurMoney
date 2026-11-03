import { defineConfig } from "@playwright/test";

// E2E specs live in e2e/ (first ones arrive in S1-08 and S1-14).
// Prerequisite: the dev database is running, migrated and seeded (README §3–4).
// Both dev servers are started automatically unless they are already running.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // journeys share one seeded database, so run them in order
  retries: 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    viewport: { width: 1280, height: 800 },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run dev",
      cwd: "./server",
      url: "http://localhost:3000/api/health",
      reuseExistingServer: true,
      timeout: 30_000,
    },
    {
      command: "npm run dev",
      cwd: "./client",
      url: "http://localhost:5173",
      reuseExistingServer: true,
      timeout: 30_000,
    },
  ],
});
