import { defineConfig } from "vitest/config";

// Tests always run against the separate test database (created by docker/postgres/init-test-db.sql),
// never the dev database. Override with TEST_DATABASE_URL if your test database lives elsewhere.
const testEnv = {
  NODE_ENV: "test",
  DATABASE_URL:
    process.env.TEST_DATABASE_URL ?? "postgresql://ymom:ymom@localhost:5434/ymom_test?schema=public",
  SESSION_SECRET: "test-only-session-secret",
};

// `test.env` only reaches the test workers. globalSetup runs in this main process, so set it here too;
// otherwise its `prisma migrate deploy` would read server/.env and migrate the dev database.
Object.assign(process.env, testEnv);

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    env: testEnv,
    // Applies migrations and creates the session table once, before any test file starts.
    globalSetup: ["./test/globalSetup.ts"],
    // All test files share one database and resetDb() truncates it, so files must not run at the same time.
    fileParallelism: false,
  },
});
