import { Pool } from "pg"

// ─── Connection pool ──────────────────────────────────────────────────────────
// A single Pool is shared across all API route invocations in the same
// Node.js process. Next.js runs API routes in a persistent server process,
// so pooling is both safe and necessary (avoids a new TCP handshake per request).
//
// Required env vars (set in .env.local):
//   DATABASE_URL  — full Postgres connection string
//     e.g.  postgresql://user:password@localhost:5432/boty
//   or the individual vars:
//   PGHOST, PGPORT, PGDATABASE, PGUSER, PGPASSWORD
//
// The module is only imported inside Server Components / Route Handlers,
// so it never ships to the browser bundle.

declare global {
  // Prevents re-creating the pool on hot reloads in development.
  // eslint-disable-next-line no-var
  var _pgPool: Pool | undefined
}

function createPool(): Pool {
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL environment variable is not set. " +
        "Add it to .env.local — see .env.example for the required format."
    )
  }

  return new Pool({
    connectionString: process.env.DATABASE_URL,
    // Keep at most 10 idle connections alive — tune for your hosting plan.
    max: 10,
    // Kill idle connections after 30 s to avoid exhausting a serverless DB quota.
    idleTimeoutMillis: 30_000,
    // Fail fast rather than queuing indefinitely if all connections are busy.
    connectionTimeoutMillis: 5_000,
    // Enforce TLS for any non-localhost host (required by hosted Postgres like Neon).
    ssl:
      process.env.DATABASE_URL.includes("localhost") ||
      process.env.DATABASE_URL.includes("127.0.0.1")
        ? false
        : { rejectUnauthorized: false },
  })
}

// In development Next.js hot-reloads modules frequently; reuse the existing
// pool so we don't exhaust the connection limit during development.
const pool: Pool =
  process.env.NODE_ENV === "production"
    ? createPool()
    : (global._pgPool ??= createPool())

export default pool

/**
 * Run a parameterized query against the pool.
 *
 * Usage:
 *   const { rows } = await query("SELECT * FROM products WHERE id = $1", [id])
 *
 * All values must be passed as `params` — never interpolate user input into
 * the SQL string directly (SQL injection prevention).
 */
export async function query<T = Record<string, unknown>>(
  sql: string,
  params: unknown[] = []
): Promise<{ rows: T[]; rowCount: number }> {
  const result = await pool.query(sql, params)
  return { rows: result.rows as T[], rowCount: result.rowCount ?? 0 }
}
