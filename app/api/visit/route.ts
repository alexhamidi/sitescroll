import { NextResponse } from "next/server";
import { hasDb, incrementVisits } from "@/app/lib/db";
import { getClientIp, checkRateLimit } from "@/app/lib/rateLimit";

export async function POST(req: Request) {
  if (!hasDb()) return NextResponse.json({ ok: false });
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(ip, "visit", 60);
  if (!allowed) return NextResponse.json({ ok: false });
  const { url } = await req.json();
  if (!url || typeof url !== "string") return NextResponse.json({ ok: false });
  incrementVisits(url).catch(() => {});
  return NextResponse.json({ ok: true });
}
