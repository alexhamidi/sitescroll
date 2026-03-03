import { NextResponse } from "next/server";
import { hasDb, insertSite } from "@/app/lib/db";
import { getClientIp, checkRateLimit, RATE_LIMITS } from "@/app/lib/rateLimit";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(ip, "sites", RATE_LIMITS.sites);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  if (!hasDb()) {
    return NextResponse.json(
      {
        error: "DB not configured",
        detail:
          "Set DATABASE_URL or POSTGRES_URL in .env at the project root (sitescroll/.env). Next.js does not load app/.env.",
      },
      { status: 503 }
    );
  }

  const { url } = await req.json();

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  let normalized = url.trim();
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = "https://" + normalized;
  }

  try {
    new URL(normalized);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  try {
    await insertSite(normalized, "submit");
    return NextResponse.json({ ok: true });
  } catch (e) {
    const err = e as Error;
    const message = err.message ?? String(e);
    const code = "code" in err ? (err as { code: string }).code : undefined;
    console.error("insertSite failed:", message, code);
    return NextResponse.json(
      { error: "DB error", detail: message, code: code ?? null },
      { status: 503 }
    );
  }
}
