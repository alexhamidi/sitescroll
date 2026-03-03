import { NextResponse } from "next/server";
import { hasDb, insertReport } from "@/app/lib/db";

export async function POST(req: Request) {
  const body = await req.json();
  const url = typeof body?.url === "string" ? body.url.trim() : "";
  const feedback = typeof body?.feedback === "string" ? body.feedback.trim() : null;
  const removeOwn = Boolean(body?.remove_own);

  if (!url) {
    return NextResponse.json({ error: "URL is required" }, { status: 400 });
  }

  let normalized = url;
  if (!/^https?:\/\//i.test(normalized)) {
    normalized = "https://" + normalized;
  }
  try {
    new URL(normalized);
  } catch {
    return NextResponse.json({ error: "Invalid URL" }, { status: 400 });
  }

  const comment = removeOwn ? "[remove request]" : (feedback || null);

  if (hasDb()) {
    try {
      await insertReport(normalized, comment);
      return NextResponse.json({ ok: true });
    } catch (e) {
      console.error("DB insert report:", e);
      return NextResponse.json(
        { error: "Failed to save report" },
        { status: 503 }
      );
    }
  }

  return NextResponse.json({ ok: true });
}
