import { readFileSync, writeFileSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";
import { hasDb, getSiteScore, getSiteSource, updateSiteScore } from "@/app/lib/db";
import { getClientIp, checkRateLimit, RATE_LIMITS } from "@/app/lib/rateLimit";

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
  if (hasDb()) {
    try {
      const [score, src] = await Promise.all([
        getSiteScore(site),
        getSiteSource(site),
      ]);
      return NextResponse.json({
        votes: score,
        source: src.source ?? null,
        source_url: src.source_url ?? null,
      });
    } catch {
      return NextResponse.json({ votes: 0, source: null, source_url: null });
    }
  }
  const votes = getVotes();
  return NextResponse.json({
    votes: votes[site] || 0,
    source: null,
    source_url: null,
  });
}

export async function POST(req: Request) {
  const ip = getClientIp(req);
  const { allowed } = await checkRateLimit(ip, "votes", RATE_LIMITS.votes);
  if (!allowed) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }
  const { site, direction, undo } = await req.json();
  if (!site || !["up", "down"].includes(direction)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  if (hasDb()) {
    try {
      const rawDelta = direction === "up" ? 1 : -1;
      const delta = undo ? -rawDelta : rawDelta;
      const current = await getSiteScore(site);
      const nextScore = Math.max(0, current + delta);
      updateSiteScore(site, delta).catch((e) =>
        console.error("vote update failed:", e)
      );
      return NextResponse.json({ votes: nextScore, removed: false });
    } catch (e) {
      console.error("vote get/update failed:", e);
      return NextResponse.json({ error: "Vote failed" }, { status: 503 });
    }
  }

  const votes = getVotes();
  const current = votes[site] || 0;

  if (undo) {
    if (direction === "up" && current > 0) {
      const next = current - 1;
      if (next === 0) delete votes[site];
      else votes[site] = next;
      saveVotes(votes);
      return NextResponse.json({ votes: next, removed: false });
    }
    return NextResponse.json({ votes: current, removed: false });
  }

  if (direction === "down") {
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
