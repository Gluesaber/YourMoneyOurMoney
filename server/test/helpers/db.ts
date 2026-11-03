import { getPrisma } from "../../src/prisma.js";
import { seed } from "../../prisma/seedData.js";

// Integration point 7. Empties every app table and re-seeds the demo data. Call it in beforeAll
// (or beforeEach) of any test file that touches the database.
// The migrations table and the session table are kept.
export async function resetDb(): Promise<void> {
  const prisma = getPrisma();
  const tables = await prisma.$queryRaw<{ tablename: string }[]>`
    SELECT tablename FROM pg_tables
    WHERE schemaname = 'public' AND tablename NOT IN ('_prisma_migrations', 'session')`;
  if (tables.length > 0) {
    const list = tables.map((t) => `"public"."${t.tablename}"`).join(", ");
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${list} RESTART IDENTITY CASCADE`);
  }
  await seed(prisma);
}
