import { NextResponse } from "next/server";
import { hasDb, getTopSites } from "@/app/lib/db";

export async function GET() {
  if (!hasDb()) return NextResponse.json({ leaderboard: [] });
  const leaderboard = await getTopSites(20);
  return NextResponse.json({ leaderboard });
}
