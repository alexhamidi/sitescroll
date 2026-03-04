import { NextResponse } from "next/server";
import { hasDb, getTotalVisits } from "@/app/lib/db";

export async function GET() {
  if (!hasDb()) {
    return NextResponse.json({ totalVisits: 0 });
  }
  try {
    const totalVisits = await getTotalVisits();
    return NextResponse.json({ totalVisits });
  } catch {
    return NextResponse.json({ totalVisits: 0 });
  }
}
