import { getPrisma } from "../../src/prisma.js";

// A seeded account of a seeded user, e.g. accountOf("alice", "Bank").
export async function accountOf(username: string, name: string) {
  const prisma = getPrisma();
  const user = await prisma.user.findUniqueOrThrow({ where: { username } });
  return prisma.account.findUniqueOrThrow({ where: { userId_name: { userId: user.id, name } } });
}
