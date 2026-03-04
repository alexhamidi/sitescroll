import { NextResponse } from "next/server";
import { hasDb, insertReport } from "@/app/lib/db";
import { getClientIp, checkRateLimit, RATE_LIMITS } from "@/app/lib/rateLimit";

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(ip, "report", RATE_LIMITS.report);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  const body = await req.json();
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const message = typeof body?.message === "string" ? body.message.trim() : "";

  if (!url || !message) {
    return NextResponse.json({ error: "URL and message are required" }, { status: 400 });
  }

  let normalized = url;
  if (/^https?:\/\//i.test(normalized)) {
    try { new URL(normalized); } catch {
      return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
    }
  }

  if (hasDb()) {
    try {
      await insertReport(normalized, message);
      return NextResponse.json({ ok: true });
    } catch (e) {
      console.error("DB insert feedback:", e);
      return NextResponse.json({ error: "Failed to save feedback" }, { status: 503 });
    }
  }

  return NextResponse.json({ ok: true });
}
