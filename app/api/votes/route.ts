import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";

const VOTES_FILE = path.join(process.cwd(), "votes.json");
const SITES_FILE = path.join(process.cwd(), "sites.txt");

function getVotes(): Record<string, number> {
  try {
    return JSON.parse(readFileSync(VOTES_FILE, "utf-8"));
  } catch {
    return {};
  }
}

function saveVotes(votes: Record<string, number>) {
  writeFileSync(VOTES_FILE, JSON.stringify(votes, null, 2));
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const site = searchParams.get("site");
  if (!site) return NextResponse.json({ error: "site required" }, { status: 400 });
  const votes = getVotes();
  return NextResponse.json({ votes: votes[site] || 0 });
}

export async function POST(req: Request) {
  const { site, direction } = await req.json();
  if (!site || !["up", "down"].includes(direction)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const votes = getVotes();
  const current = votes[site] || 0;

  if (direction === "down") {
    // Remove the site from sites.txt
    const sites = readFileSync(SITES_FILE, "utf-8")
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s && s !== site);
    writeFileSync(SITES_FILE, sites.join("\n") + "\n");
    delete votes[site];
    saveVotes(votes);
    return NextResponse.json({ votes: 0, removed: true });
  }

  votes[site] = current + 1;
  saveVotes(votes);
  return NextResponse.json({ votes: votes[site], removed: false });
}
