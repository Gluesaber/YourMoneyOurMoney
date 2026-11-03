import bcrypt from "bcryptjs";
import type { PrismaClient, Role } from "@prisma/client";

// Demo-only password shared by every seeded account. Never reuse it anywhere real.
export const DEMO_PASSWORD = "demo-password-123";

export const DEMO_USERS: { username: string; role: Role }[] = [
  { username: "alice", role: "USER" },
  { username: "bob", role: "USER" },
  { username: "admin", role: "ADMIN" },
];

// Idempotent: safe to run on a database that already has the demo users.
// S1-11 adds each USER's seeded accounts here.
export async function seed(prisma: PrismaClient): Promise<void> {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  for (const { username, role } of DEMO_USERS) {
    await prisma.user.upsert({
      where: { username },
      update: {},
      create: { username, role, passwordHash },
    });
  }
}
