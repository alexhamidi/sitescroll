import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";

const VIEWS_FILE = path.join(process.cwd(), "views.txt");

function getViews(): number {
  try {
    return parseInt(readFileSync(VIEWS_FILE, "utf-8").trim(), 10) || 0;
  } catch {
    return 0;
  }
}

export async function GET() {
  return NextResponse.json({ views: getViews() });
}

export async function POST() {
  const views = getViews() + 1;
  writeFileSync(VIEWS_FILE, String(views));
  return NextResponse.json({ views });
}
