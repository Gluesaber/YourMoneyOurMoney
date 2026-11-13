import bcrypt from "bcryptjs";
import type { AccountSubtype, AccountType, PrismaClient, Role } from "@prisma/client";

// Demo-only password shared by every seeded account in local development and tests. Never reuse it anywhere real.
export const DEMO_PASSWORD = "demo-password-123";

export const DEMO_USERS: { username: string; role: Role }[] = [
  { username: "alice", role: "USER" },
  { username: "bob", role: "USER" },
  { username: "admin", role: "ADMIN" },
];

// Every USER gets these accounts (docs/sprints/sprint-1/F-03-accounts.md §1.1). ADMIN gets none.
export const SEEDED_ACCOUNTS: { name: string; type: AccountType; subtype: AccountSubtype | null }[] = [
  { name: "Bank", type: "CASH", subtype: "BANK" },
  { name: "Credit Card", type: "LOAN_TAKEN", subtype: "CREDIT_CARD" },
  { name: "Salary", type: "INCOME", subtype: null },
  { name: "Interest", type: "INCOME", subtype: null },
  { name: "Dining", type: "EXPENSE", subtype: null },
  { name: "Groceries", type: "EXPENSE", subtype: null },
  { name: "Electricity", type: "EXPENSE", subtype: null },
  { name: "Telecom", type: "EXPENSE", subtype: null },
];

export interface SeedEnv {
  NODE_ENV?: string;
  ADMIN_PASSWORD?: string;
  SEED_DEMO_DATA?: string;
  DEMO_USER_PASSWORD?: string;
}

// Idempotent: safe to run on a database that already has the demo data. Existing users and accounts
// are left as they are, so re-seeding never resets an opening balance or overwrites a password.
// In production (NODE_ENV=production), ADMIN_PASSWORD must come from the environment, and demo users
// are seeded only when SEED_DEMO_DATA=true with DEMO_USER_PASSWORD set.
export async function seed(prisma: PrismaClient, env: SeedEnv = process.env): Promise<void> {
  const isProduction = env.NODE_ENV === "production";
  const adminPassword = env.ADMIN_PASSWORD?.trim() || (isProduction ? "" : DEMO_PASSWORD);
  if (!adminPassword) {
    throw new Error("ADMIN_PASSWORD is required when NODE_ENV=production.");
  }

  const seedDemoData = env.SEED_DEMO_DATA !== undefined ? env.SEED_DEMO_DATA === "true" : !isProduction;

  let demoPasswordHash: string | null = null;
  const demoPassword = env.DEMO_USER_PASSWORD?.trim() || (isProduction ? "" : DEMO_PASSWORD);
  if (seedDemoData) {
    if (!demoPassword) {
      throw new Error("DEMO_USER_PASSWORD is required when SEED_DEMO_DATA=true in production.");
    }
    demoPasswordHash = await bcrypt.hash(demoPassword, 10);
  }

  const adminPasswordHash =
    demoPasswordHash && adminPassword === demoPassword
      ? demoPasswordHash
      : await bcrypt.hash(adminPassword, 10);

  for (const { username, role } of DEMO_USERS) {
    if (role !== "ADMIN" && !seedDemoData) continue;

    const passwordHash = role === "ADMIN" ? adminPasswordHash : demoPasswordHash!;
    const user = await prisma.user.upsert({
      where: { username },
      update: {},
      create: { username, role, passwordHash },
    });
    if (user.role !== "USER") continue;

    for (const account of SEEDED_ACCOUNTS) {
      await prisma.account.upsert({
        where: { userId_name: { userId: user.id, name: account.name } },
        update: {},
        create: { userId: user.id, ...account },
      });
    }
  }
}
