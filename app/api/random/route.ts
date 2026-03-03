import { NextResponse } from "next/server";
import { hasDb, getRandomSites } from "@/app/lib/db";

export async function GET(req: Request) {
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

  const { searchParams } = new URL(req.url);
  const count = Math.min(
    Math.max(1, parseInt(searchParams.get("count") ?? "15", 10)),
    30
  );
  const excludeRaw = searchParams.get("exclude") ?? "";
  const exclude = excludeRaw.split(",").map((s) => s.trim()).filter(Boolean);

  try {
    const sites = await getRandomSites(exclude, count);
    return NextResponse.json({ sites });
  } catch (e) {
    const err = e as Error;
    const message = err.message ?? String(e);
    const code = "code" in err ? (err as { code: string }).code : undefined;
    console.error("getRandomSites failed:", message, code);
    return NextResponse.json(
      { error: "DB error", detail: message, code: code ?? null },
      { status: 503 }
    );
  }
}
