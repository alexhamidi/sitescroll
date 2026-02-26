import { readFileSync } from "fs";
import path from "path";
import { NextResponse } from "next/server";

const SITES_FILE = path.join(process.cwd(), "sites.txt");

// In-memory embeddability cache — survives across requests in the same process
const cache = new Map<string, { embeddable: boolean; ts: number }>();
const CACHE_TTL = 1000 * 60 * 60; // 1 hour

function canEmbed(headers: Headers): boolean {
  const xfo = headers.get("x-frame-options");
  if (xfo) {
    const val = xfo.toLowerCase();
    if (val === "deny" || val === "sameorigin") return false;
  }
  const csp = headers.get("content-security-policy");
  if (csp) {
    const match = csp.match(/frame-ancestors\s+([^;]+)/i);
    if (match) {
      const val = match[1].trim().toLowerCase();
      if (val === "'none'" || val === "'self'") return false;
    }
  }
  return true;
}

async function checkSite(url: string): Promise<boolean> {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.ts < CACHE_TTL) return cached.embeddable;

  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(2000),
      redirect: "follow",
    });
    const ok = res.ok && canEmbed(res.headers);
    cache.set(url, { embeddable: ok, ts: Date.now() });
    return ok;
  } catch {
    cache.set(url, { embeddable: false, ts: Date.now() });
    return false;
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const count = Math.min(parseInt(searchParams.get("count") || "5", 10), 20);
  const excludeRaw = searchParams.get("exclude") || "";
  const exclude = new Set(excludeRaw.split(",").filter(Boolean));

  const sites = readFileSync(SITES_FILE, "utf-8")
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s && !exclude.has(s));

  const shuffled = shuffle(sites);
  const results: string[] = [];
  const batchSize = 15;

  for (let i = 0; i < shuffled.length && results.length < count; i += batchSize) {
    const batch = shuffled.slice(i, i + batchSize);
    const checks = await Promise.all(
      batch.map(async (url) => ({ url, ok: await checkSite(url) }))
    );
    for (const { url, ok } of checks) {
      if (ok && results.length < count) results.push(url);
    }
  }

  return NextResponse.json({ sites: results });
}
