import { drizzle } from 'drizzle-orm/libsql';
import { sql } from 'drizzle-orm';

const db = drizzle("file:database.db");

async function main() {
  console.log("Cleaning database...");

  // Delete all data from tables in correct order (respecting foreign keys)
  await db.run(sql`DELETE FROM audit_logs`);
  await db.run(sql`DELETE FROM port_mappings`);
  await db.run(sql`DELETE FROM containers`);
  await db.run(sql`DELETE FROM user_volumes`);
  await db.run(sql`DELETE FROM session`);
  await db.run(sql`DELETE FROM account`);
  await db.run(sql`DELETE FROM verification`);
  await db.run(sql`DELETE FROM user`);

  console.log("Database cleaned successfully!");
}

main().catch(console.error);
