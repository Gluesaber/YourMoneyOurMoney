import bcrypt from "bcryptjs";
import type { AccountSubtype, AccountType, PrismaClient, Role } from "@prisma/client";

// Demo-only password shared by every seeded account. Never reuse it anywhere real.
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

// Idempotent: safe to run on a database that already has the demo data. Existing users and accounts
// are left as they are, so re-seeding never resets an opening balance.
export async function seed(prisma: PrismaClient): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const { username, role } of DEMO_USERS) {
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
