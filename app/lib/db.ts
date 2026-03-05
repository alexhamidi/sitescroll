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
    const httpsOnly = "AND url LIKE 'https://%'";
    const excludeFilter =
      exclude.length > 0
        ? "AND url != ALL($1::text[])"
        : "";
    const params =
      exclude.length > 0 ? [exclude, limit] : [limit];
    const sql =
      exclude.length > 0
        ? `WITH total AS (SELECT count(*)::int AS n FROM sites WHERE score >= 0 ${httpsOnly} AND url != ALL($1::text[])), r AS (SELECT floor(random() * greatest(0, (SELECT n FROM total) - $2))::int AS off) SELECT url FROM sites WHERE score >= 0 ${httpsOnly} AND url != ALL($1::text[]) ORDER BY ctid OFFSET (SELECT off FROM r) LIMIT $2`
        : `WITH total AS (SELECT count(*)::int AS n FROM sites WHERE score >= 0 ${httpsOnly}), r AS (SELECT floor(random() * greatest(0, (SELECT n FROM total) - $1))::int AS off) SELECT url FROM sites WHERE score >= 0 ${httpsOnly} ORDER BY ctid OFFSET (SELECT off FROM r) LIMIT $1`;
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

export async function incrementVisits(url: string): Promise<void> {
  await query(
    "UPDATE sites SET visits = COALESCE(visits, 0) + 1 WHERE url = $1",
    [url]
  );
}

export async function getTotalVisits(): Promise<number> {
  const { rows } = await query<{ total: string }>(
    "SELECT COALESCE(SUM(visits), 0)::text AS total FROM sites"
  );
  return Number(rows[0]?.total ?? 0);
}

export async function getTopSites(limit: number): Promise<{ url: string; score: number; first_name: string | null; last_name: string | null }[]> {
  try {
    const { rows } = await query<{ url: string; score: number; first_name: string | null; last_name: string | null }>(
      "SELECT url, score, first_name, last_name FROM sites WHERE score >= 0 ORDER BY score DESC LIMIT $1",
      [limit]
    );
    return rows;
  } catch {
    const { rows } = await query<{ url: string; score: number }>(
      "SELECT url, score FROM sites WHERE score >= 0 ORDER BY score DESC LIMIT $1",
      [limit]
    );
    return rows.map((r) => ({ ...r, first_name: null, last_name: null }));
  }
}

export type IdeaRow = {
  text: string;
  color: string | null;
  rotation: number;
  x: number;
  y: number;
  timestamp: number;
};

export async function getIdeas(sessionId: string): Promise<IdeaRow[]> {
  const { rows } = await query<{
    text: string;
    color: string | null;
    rotation: number;
    x: number;
    y: number;
    timestamp: string;
  }>(
    "SELECT text, color, rotation, x, y, timestamp FROM ideas WHERE session_id = $1 ORDER BY id",
    [sessionId]
  );
  return rows.map((r) => ({
    text: r.text,
    color: r.color ?? "#fde047",
    rotation: Number(r.rotation),
    x: Number(r.x),
    y: Number(r.y),
    timestamp: Number(r.timestamp),
  }));
}

export async function saveIdeas(sessionId: string, ideas: IdeaRow[]): Promise<void> {
  await withClient(async (client) => {
    await client.query("DELETE FROM ideas WHERE session_id = $1", [sessionId]);
    for (const row of ideas) {
      await client.query(
        "INSERT INTO ideas (session_id, text, color, rotation, x, y, timestamp) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [
          sessionId,
          row.text,
          row.color ?? null,
          row.rotation ?? 0,
          row.x ?? 0,
          row.y ?? 0,
          String(row.timestamp),
        ]
      );
    }
  });
}
