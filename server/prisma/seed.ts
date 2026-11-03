import { PrismaClient } from "@prisma/client";
import { seed } from "./seedData.js";

const prisma = new PrismaClient();

seed(prisma)
  .then(() => console.log("Seeded demo data."))
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
