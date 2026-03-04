"use client";

import { useState, useEffect } from "react";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<string[]>([]);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const controller = new AbortController();
    fetch(`/api/search?q=${encodeURIComponent(query)}`, { signal: controller.signal })
      .then((r) => r.json())
      .then((data) => setResults(data.results ?? []))
      .catch(() => {});
    return () => controller.abort();
  }, [query]);

  return (
    <div className="min-h-screen bg-white font-[family-name:var(--font-nunito)]">
      <div className="mx-auto max-w-3xl px-8 py-12">
        <input
          autoFocus
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search sites..."
          className="w-full border border-stone-300 px-4 py-3 text-lg text-stone-800 placeholder-stone-400 outline-none transition-colors focus:border-stone-800"
        />
        <div className="mt-6 flex flex-col divide-y divide-stone-100">
          {query && results.length === 0 && (
            <p className="py-3 text-sm text-stone-400">No results.</p>
          )}
          {results.map((url) => {
            const hostname = new URL(url).hostname.replace(/^www\./, "");
            return (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex flex-col gap-0.5 py-3"
              >
                <span className="text-[15px] font-semibold text-stone-800 group-hover:text-stone-600">
                  {hostname}
                </span>
                <span className="truncate text-sm text-stone-400">
                  {url}
                </span>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
}
