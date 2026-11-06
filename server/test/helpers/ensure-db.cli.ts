// Creates the database named in DATABASE_URL if it does not exist yet (used by e2e/globalSetup.ts before
// `prisma migrate deploy`). Connects to the server's built-in `postgres` database to do it, so it works on a
// Docker volume created before ymom_e2e was added to docker/postgres/init-test-db.sql.
import pg from "pg";

const target = new URL(process.env.DATABASE_URL ?? "");
const dbName = decodeURIComponent(target.pathname.slice(1));
if (!/^[A-Za-z0-9_]+$/.test(dbName)) {
  throw new Error(`Refusing to create database with unexpected name "${dbName}".`);
}

const admin = new URL(target);
admin.pathname = "/postgres";
admin.search = "";
const client = new pg.Client({ connectionString: admin.toString() });
await client.connect();
try {
  const { rowCount } = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [dbName]);
  if (rowCount === 0) {
    await client.query(`CREATE DATABASE "${dbName}"`);
    console.log(`Created database ${dbName}.`);
  }
} finally {
  await client.end();
}
