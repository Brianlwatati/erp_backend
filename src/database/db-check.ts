import { pool } from "../config/db.js";

async function checkDatabase(): Promise<void> {
  try {
    const result = await pool.query<{ version: string }>("SELECT version() AS version");
    console.log("PostgreSQL connection successful.");
    console.log(result.rows[0]?.version ?? "Unknown PostgreSQL version");
  } catch (error) {
    console.error("PostgreSQL connection failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}

void checkDatabase();
