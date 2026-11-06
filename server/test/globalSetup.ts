import { execSync } from "node:child_process";

// Runs once in the main Vitest process before any test file: brings the test database up to the
// latest migration. The migrations also create the session table, so test files never race to create it.
export default async function setup() {
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });
}
