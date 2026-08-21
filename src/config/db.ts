import { Pool, type PoolClient, types } from "pg";
import { env } from "./env.js";

// node-postgres returns BIGINT (oid 20) columns as strings by default —
// deliberately, since a bigint can exceed Number.MAX_SAFE_INTEGER and pg
// has no way to know whether a given column will ever get that large.
// This project's ids won't realistically hit that in the coming decades,
// and every repository/type in the codebase already treats `id` fields as
// `number`, so parsing them here once is safer than either (a) silently
// getting strings where `number` is expected, which would only surface as
// a bug the first time someone does arithmetic or a strict `===` compare
// on an id, or (b) hand-coercing `Number(row.id)` at every call site.
// NUMERIC/DECIMAL (oid 1700) is deliberately NOT touched here — those stay
// strings, since money/quantity values genuinely can lose precision as JS
// numbers and every call site already expects a string for those.
types.setTypeParser(20, (value: string) => parseInt(value, 10));

export const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 10,
  idleTimeoutMillis: 30_000,
});

pool.on("error", (err) => {
  // A crashed idle client shouldn't take the process down.
  console.error("Unexpected PG pool error", err);
});

export async function query<T = unknown>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T = unknown>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

// For compound writes that must succeed or fail together (e.g. a stock
// transfer touches two stock_levels rows and two movement rows). Row locks
// taken with `FOR UPDATE` inside `fn` are held for the transaction's
// lifetime, so concurrent transfers of the same product/branch serialize
// correctly instead of racing.
export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
