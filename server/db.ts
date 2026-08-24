import { drizzle } from "drizzle-orm/mysql2";

let database: ReturnType<typeof drizzle> | null = null;

/** Lazily initializes the SentinelForge persistence connection. */
export async function getDb() {
  if (!database && process.env.DATABASE_URL) database = drizzle(process.env.DATABASE_URL);
  return database;
}
