import { readFileSync } from "fs";
import path from "path";
import TopBar from "./top-bar";

export const dynamic = "force-dynamic";

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

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

async function checkSite(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
      redirect: "follow",
    });
    if (res.ok && canEmbed(res.headers)) return url;
  } catch {
    // unreachable or timed out
  }
  return null;
}

async function findEmbeddableSite(sites: string[]): Promise<string | null> {
  const shuffled = shuffle(sites);
  const batchSize = 10;

  for (let i = 0; i < shuffled.length; i += batchSize) {
    const batch = shuffled.slice(i, i + batchSize);
    const results = await Promise.all(batch.map(checkSite));
    // Return the first one from the batch that worked (preserves batch order)
    const found = results.find((r) => r !== null);
    if (found) return found;
  }

  return null;
}

export default async function Home() {
  const sites = readFileSync(path.join(process.cwd(), "sites.txt"), "utf-8")
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

  const site = await findEmbeddableSite(sites);

  if (!site) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-900 text-white text-lg">
        No embeddable sites found.
      </div>
    );
  }

  const name = new URL(site).hostname;

  return (
    <div className="flex h-screen flex-col">
      <TopBar name={name} />
      <iframe src={site} className="flex-1 w-full border-none" />
    </div>
  );
}
