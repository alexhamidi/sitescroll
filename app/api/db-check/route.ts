import { NextResponse } from "next/server";
import { hasDb } from "@/app/lib/db";
import { getPool } from "@/app/lib/db";

export async function GET() {
  if (!hasDb()) {
    return NextResponse.json(
      {
        ok: false,
        error: "POSTGRES_URL / DATABASE_URL not set",
        detail:
          "Next.js loads .env only from the project root (the folder with package.json). Put POSTGRES_URL in sitescroll/.env, not in app/.env. Then restart the dev server.",
      },
      { status: 503 }
    );
  }

  try {
    const pool = getPool();
    const client = await pool.connect();
    try {
      await client.query("SELECT 1");
      const countResult = await client.query(
        "SELECT COUNT(*)::int AS n FROM sites"
      );
      const count = countResult.rows[0]?.n ?? 0;
      return NextResponse.json({ ok: true, sitesCount: count });
    } finally {
      client.release();
    }
  } catch (e) {
    const err = e as Error & { code?: string };
    const message = err.message ?? String(e);
    const code = err.code ?? null;
    return NextResponse.json(
      {
        ok: false,
        error: message,
        code,
        detail:
          code === "42P01"
            ? "Table 'sites' does not exist. Run the ingest schema (stuffs/ingest/scripts/schema.py) against this DB."
            : code === "ECONNREFUSED"
              ? "Connection refused. Is the DB host correct and the server running?"
              : code === "ENOTFOUND"
                ? "DB host could not be resolved. Check the URL."
                : code === "28P01"
                  ? "Password authentication failed. Check POSTGRES_URL."
                  : "See 'error' and 'code' above.",
      },
      { status: 503 }
    );
  }
}
