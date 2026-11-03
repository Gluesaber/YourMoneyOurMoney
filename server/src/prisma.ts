import { PrismaClient } from "@prisma/client";

// Lazy singleton: created on first use, so modules that never touch the database have no side effects.
let client: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!client) client = new PrismaClient();
  return client;
}
