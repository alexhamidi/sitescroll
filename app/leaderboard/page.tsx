"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

type LeaderboardEntry = {
  url: string;
  score: number;
  first_name: string | null;
  last_name: string | null;
};

function siteName(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function personName(entry: LeaderboardEntry): string {
  const first = (entry.first_name ?? "").trim();
  const last = (entry.last_name ?? "").trim();
  if (first || last) return [first, last].filter(Boolean).join(" ");
  return siteName(entry.url);
}

export default function LeaderboardPage() {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/leaderboard")
      .then((r) => r.json())
      .then((data) => {
        setEntries(data.leaderboard ?? []);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="min-h-screen bg-white font-[family-name:var(--font-nunito)]">
      <div className="mx-auto max-w-4xl px-6 py-8 sm:px-8">
        <div className="mb-8 flex items-center justify-between">
          <Link
            href="/"
            className="text-sm font-medium text-stone-500 underline decoration-amber-300 underline-offset-2 hover:text-stone-700"
          >
            ← back to scroll
          </Link>
        </div>
        <h1 className="mb-8 text-2xl font-semibold text-stone-800">Leaderboard</h1>

        {loading && (
          <p className="py-8 text-center text-sm text-stone-400">Loading…</p>
        )}

        {!loading && entries.length === 0 && (
          <p className="py-8 text-center text-sm text-stone-400">No sites yet.</p>
        )}

        <div className="flex flex-col gap-10">
          {entries.map((entry, i) => (
            <article
              key={entry.url}
              className="rounded-xl border border-stone-200 bg-stone-50/50 overflow-hidden"
            >
              <div className="flex flex-wrap items-baseline gap-3 border-b border-stone-200 bg-white px-4 py-3 sm:gap-4">
                <span className="text-lg font-bold tabular-nums text-amber-600">
                  #{i + 1}
                </span>
                <span className="text-2xl font-semibold text-stone-800">
                  {personName(entry)}
                </span>
                <span className="text-sm text-stone-400">{siteName(entry.url)}</span>
                <span className="text-sm font-medium text-stone-500">
                  {entry.score} {entry.score === 1 ? "vote" : "votes"}
                </span>
                <a
                  href={entry.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto text-sm font-medium text-amber-600 underline decoration-amber-300 underline-offset-2 hover:text-amber-700"
                >
                  open site →
                </a>
              </div>
              <div className="h-[60vh] min-h-[320px] w-full bg-stone-100">
                <iframe
                  src={entry.url}
                  title={siteName(entry.url)}
                  className="h-full w-full border-0"
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
                />
              </div>
            </article>
          ))}
        </div>
      </div>
    </div>
  );
}
