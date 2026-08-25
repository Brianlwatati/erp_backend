import { readFile, readdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { pool } from "../config/db.js";

async function migrate(): Promise<void> {
  const currentDir = path.dirname(fileURLToPath(import.meta.url));
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
      version VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    const files = (await readdir(currentDir))
      .filter((f) => /^\d+_.*\.sql$/.test(f))
      .sort();
    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      const existing = await pool.query(
        "SELECT 1 FROM schema_migrations WHERE version=$1",
        [version],
      );
      if (existing.rowCount) {
        console.log(`Migration ${version} already applied.`);
        continue;
      }
      const sql = await readFile(path.join(currentDir, file), "utf8");
      await pool.query("BEGIN");
      try {
        await pool.query(sql);
        await pool.query("INSERT INTO schema_migrations(version) VALUES($1)", [
          version,
        ]);
        await pool.query("COMMIT");
        console.log(`Migration ${version} applied successfully.`);
      } catch (error) {
        await pool.query("ROLLBACK");
        throw error;
      }
    }
    console.log("All migrations are up to date.");
  } catch (error) {
    console.error("Migration failed:", error);
    process.exitCode = 1;
  } finally {
    await pool.end();
  }
}
void migrate();
