import type { Role } from "@prisma/client";

// Integration point 2: what requireUser attaches to req.user. Never includes passwordHash.
export interface CurrentUser {
  id: number;
  username: string;
  role: Role;
}
