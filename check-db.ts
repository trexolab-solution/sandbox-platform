import { drizzle } from 'drizzle-orm/libsql';
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

const session = sqliteTable("session", {
  id: text("id").primaryKey(),
  token: text("token").notNull(),
  userId: text("user_id").notNull(),
  expiresAt: integer("expires_at", { mode: "timestamp_ms" }).notNull(),
});

const db = drizzle("file:database.db");

async function main() {
  const sessions = await db.select().from(session).limit(5);
  console.log("Sessions found:", sessions.length);
  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i];
    console.log("Session " + (i + 1) + ":");
    console.log("  Token (first 40 chars):", s.token.substring(0, 40));
    console.log("  User ID:", s.userId);
    console.log("  Expires:", new Date(s.expiresAt).toISOString());
  }
}

main().catch(console.error);
