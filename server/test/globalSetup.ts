import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { PrismaClient } from "@prisma/client";

// Runs once in the main Vitest process before any test file. It brings the test database up to the
// latest migration, then creates connect-pg-simple's "session" table. Creating that table here, not lazily
// on the first login, avoids test files racing to create it on a fresh database. The table is not in
// schema.prisma because it belongs to connect-pg-simple, so its SQL comes from the library itself.
export default async function setup() {
  execSync("npx prisma migrate deploy", { stdio: "inherit", env: process.env });

  const prisma = new PrismaClient();
  try {
    const [{ exists }] = await prisma.$queryRaw<
      { exists: boolean }[]
    >`SELECT to_regclass('public.session') IS NOT NULL AS exists`;
    if (exists) return;

    const require = createRequire(import.meta.url);
    const statements = readFileSync(require.resolve("connect-pg-simple/table.sql"), "utf8")
      .split(";")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) await prisma.$executeRawUnsafe(statement);
  } finally {
    await prisma.$disconnect();
  }
}
