import { NextResponse } from "next/server";
import { hasDb, query } from "@/app/lib/db";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const q = searchParams.get("q")?.trim() ?? "";
  if (!q || !hasDb()) return NextResponse.json({ results: [] });
  const { rows } = await query<{ url: string; score: number }>(
    `SELECT DISTINCT url, score FROM sites WHERE url ILIKE $1 ORDER BY score DESC LIMIT 30`,
    [`%${q}%`]
  );
  return NextResponse.json({ results: rows.map((r) => r.url) });
}
