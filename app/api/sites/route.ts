import { appendFileSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";

const SITES_FILE = path.join(process.cwd(), "sites.txt");

export async function POST(req: Request) {
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

  appendFileSync(SITES_FILE, "\n" + normalized);
  return NextResponse.json({ ok: true });
}
