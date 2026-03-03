import { Pool, type PoolClient } from "pg";

const connectionString = process.env.DATABASE_URL ?? process.env.POSTGRES_URL;

let pool: Pool | null = null;

export function getPool(): Pool {
  if (!connectionString) {
    throw new Error("DATABASE_URL or POSTGRES_URL must be set");
  }
  if (!pool) {
    pool = new Pool({
      connectionString,
      max: 16,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
    });
  }
  return pool;
}

export function hasDb(): boolean {
  return Boolean(connectionString);
}

export async function query<T extends Record<string, unknown>>(
  text: string,
  values?: unknown[]
): Promise<{ rows: T[] }> {
  const p = getPool();
  const client = await p.connect();
  try {
    const result = await client.query<T>(text, values);
    return { rows: result.rows };
  } finally {
    client.release();
  }
}

export async function withClient<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const p = getPool();
  const client = await p.connect();
  try {
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function getRandomSites(
  exclude: string[],
  limit: number
): Promise<string[]> {
  if (limit <= 0) return [];
  const p = getPool();
  const client = await p.connect();
  try {
    const excludeFilter =
      exclude.length > 0
        ? "AND url != ALL($1::text[])"
        : "";
    const params =
      exclude.length > 0 ? [exclude, limit] : [limit];
    const sql = `SELECT url FROM sites WHERE score >= 0 ${excludeFilter} ORDER BY random() LIMIT $${exclude.length > 0 ? 2 : 1}`;
    const result = await client.query<{ url: string }>(sql, params);
    return result.rows.map((r) => r.url);
  } finally {
    client.release();
  }
}

export async function insertSite(url: string, source: string): Promise<void> {
  await withClient(async (client) => {
    await client.query("INSERT INTO sites (url, source) VALUES ($1, $2)", [
      url,
      source,
    ]);
  });
}

export async function insertReport(url: string, comment: string | null): Promise<void> {
  await withClient(async (client) => {
    await client.query(
      "INSERT INTO reports (url, comment) VALUES ($1, $2)",
      [url, comment ?? null]
    );
  });
}

export async function getSiteScore(url: string): Promise<number> {
  const { rows } = await query<{ score: number }>(
    "SELECT score FROM sites WHERE url = $1",
    [url]
  );
  return rows[0]?.score ?? 0;
}

export async function getSiteSource(
  url: string
): Promise<{ source: string | null; source_url: string | null }> {
  const { rows } = await query<{ source: string; source_url: string | null }>(
    "SELECT source, source_url FROM sites WHERE url = $1",
    [url]
  );
  const r = rows[0];
  return r
    ? { source: r.source, source_url: r.source_url ?? null }
    : { source: null, source_url: null };
}

export async function updateSiteScore(url: string, delta: number): Promise<number> {
  const { rows } = await query<{ score: number }>(
    "UPDATE sites SET score = score + $2 WHERE url = $1 RETURNING score",
    [url, delta]
  );
  return rows[0]?.score ?? 0;
}
