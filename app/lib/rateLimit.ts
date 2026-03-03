import { hasDb, getPool } from "@/app/lib/db";

const WINDOW_MS = 60_000;

let tableReady = false;

async function ensureTable() {
  if (tableReady || !hasDb()) return;
  const p = getPool();
  await p.query(`
    CREATE TABLE IF NOT EXISTS rate_limits (
      ip text NOT NULL,
      route text NOT NULL,
      count int NOT NULL DEFAULT 0,
      window_start timestamptz NOT NULL DEFAULT now(),
      PRIMARY KEY (ip, route)
    )
  `);
  tableReady = true;
}

export function getClientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  const real = req.headers.get("x-real-ip");
  if (real) return real.trim();
  return "unknown";
}

export async function checkRateLimit(
  ip: string,
  route: string,
  limit: number
): Promise<{ allowed: boolean }> {
  if (!hasDb()) return { allowed: true };
  await ensureTable();
  const p = getPool();
  const client = await p.connect();
  try {
    const windowSec = Math.floor(WINDOW_MS / 1000);
    const { rows } = await client.query<{ count: number }>(
      `INSERT INTO rate_limits (ip, route, count, window_start)
       VALUES ($1, $2, 1, now())
       ON CONFLICT (ip, route) DO UPDATE SET
         count = CASE
           WHEN rate_limits.window_start < now() - make_interval(secs => $3)
           THEN 1
           ELSE rate_limits.count + 1
         END,
         window_start = CASE
           WHEN rate_limits.window_start < now() - make_interval(secs => $3)
           THEN now()
           ELSE rate_limits.window_start
         END
       RETURNING count`,
      [ip, route, windowSec]
    );
    const count = rows[0]?.count ?? 0;
    return { allowed: count <= limit };
  } finally {
    client.release();
  }
}

export const RATE_LIMITS = {
  votes: 60,
  report: 10,
  sites: 5,
  random: 30,
} as const;
