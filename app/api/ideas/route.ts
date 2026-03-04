import { NextResponse } from "next/server";
import { hasDb, getIdeas, saveIdeas, type IdeaRow } from "@/app/lib/db";

const CORS_ORIGIN = process.env.IDEAS_CORS_ORIGIN ?? "https://alexhamidi.github.io";
let ideasTableEnsured = false;

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": CORS_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

async function ensureIdeasTable() {
  if (ideasTableEnsured) return;
  const { withClient } = await import("@/app/lib/db");
  await withClient(async (client) => {
    await client.query(`
      CREATE TABLE IF NOT EXISTS ideas (
        id SERIAL PRIMARY KEY,
        session_id TEXT NOT NULL,
        text TEXT NOT NULL,
        color TEXT,
        rotation DOUBLE PRECISION DEFAULT 0,
        x DOUBLE PRECISION DEFAULT 0,
        y DOUBLE PRECISION DEFAULT 0,
        timestamp BIGINT NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);
    await client.query(
      "CREATE INDEX IF NOT EXISTS ideas_session_id_idx ON ideas (session_id)"
    );
  });
  ideasTableEnsured = true;
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: corsHeaders() });
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const sessionId = searchParams.get("session_id");
  if (!sessionId || sessionId.length > 256) {
    return NextResponse.json(
      { error: "session_id required (max 256 chars)" },
      { status: 400, headers: corsHeaders() }
    );
  }

  if (!hasDb()) {
    return NextResponse.json(
      { ideas: [] },
      { status: 200, headers: corsHeaders() }
    );
  }

  try {
    if (!ideasTableEnsured) await ensureIdeasTable();
    const ideas = await getIdeas(sessionId);
    return NextResponse.json({ ideas }, { headers: corsHeaders() });
  } catch (e) {
    console.error("GET /api/ideas:", e);
    return NextResponse.json(
      { error: "Failed to load ideas" },
      { status: 503, headers: corsHeaders() }
    );
  }
}

export async function POST(req: Request) {
  let body: { session_id?: string; ideas?: IdeaRow[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON" },
      { status: 400, headers: corsHeaders() }
    );
  }

  const sessionId =
    typeof body?.session_id === "string" ? body.session_id.trim() : "";
  const ideas = Array.isArray(body?.ideas) ? body.ideas : [];

  if (!sessionId || sessionId.length > 256) {
    return NextResponse.json(
      { error: "session_id required (max 256 chars)" },
      { status: 400, headers: corsHeaders() }
    );
  }

  const normalized: IdeaRow[] = ideas.slice(0, 200).map((item) => ({
    text: typeof item?.text === "string" ? item.text : "",
    color: typeof item?.color === "string" ? item.color : null,
    rotation: Number(item?.rotation) || 0,
    x: Number(item?.x) || 0,
    y: Number(item?.y) || 0,
    timestamp: Number(item?.timestamp) || Date.now(),
  }));

  if (!hasDb()) {
    return NextResponse.json({ ok: true }, { headers: corsHeaders() });
  }

  try {
    if (!ideasTableEnsured) await ensureIdeasTable();
    await saveIdeas(sessionId, normalized);
    return NextResponse.json({ ok: true }, { headers: corsHeaders() });
  } catch (e) {
    console.error("POST /api/ideas:", e);
    return NextResponse.json(
      { error: "Failed to save ideas" },
      { status: 503, headers: corsHeaders() }
    );
  }
}
