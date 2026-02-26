"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export default function Roll() {
  const [current, setCurrent] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [queue, setQueue] = useState<string[]>([]);
  const [views, setViews] = useState<number | null>(null);
  const [votes, setVotes] = useState<number>(0);
  const [siteUrl, setSiteUrl] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(true);
  const fetchingRef = useRef(false);
  const seenRef = useRef(new Set<string>());

  // Fetch a batch of sites from the API
  const fetchBatch = useCallback(async (): Promise<string[]> => {
    if (fetchingRef.current) return [];
    fetchingRef.current = true;
    try {
      const exclude = [...seenRef.current].join(",");
      const res = await fetch(
        `/api/random?count=5&exclude=${encodeURIComponent(exclude)}`
      );
      const data = await res.json();
      const sites: string[] = data.sites || [];
      sites.forEach((s: string) => seenRef.current.add(s));
      return sites;
    } catch {
      return [];
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  // Refill queue when it's low
  const refillQueue = useCallback(async () => {
    const batch = await fetchBatch();
    if (batch.length > 0) {
      setQueue((prev) => [...prev, ...batch]);
    }
  }, [fetchBatch]);

  // Navigate to a specific site (used by back/forward and initial load)
  const navigateTo = useCallback(
    (site: string, pushHistory: boolean) => {
      setCurrent(site);
      setLoading(true);
      // Fetch votes for this site (fire-and-forget style, update when ready)
      fetch(`/api/votes?site=${encodeURIComponent(site)}`)
        .then((r) => r.json())
        .then((d) => setVotes(d.votes))
        .catch(() => setVotes(0));
      if (pushHistory) {
        setHistory((prev) => {
          const trimmed = prev.slice(0, historyIdx + 1);
          return [...trimmed, site];
        });
        setHistoryIdx((i) => i + 1);
      }
    },
    [historyIdx]
  );

  // Go to next site from queue (or fetch more)
  const goForward = useCallback(async () => {
    // If we're in the middle of history, go forward in history
    if (historyIdx < history.length - 1) {
      const next = history[historyIdx + 1];
      setHistoryIdx((i) => i + 1);
      setCurrent(next);
      setLoading(true);
      fetch(`/api/votes?site=${encodeURIComponent(next)}`)
        .then((r) => r.json())
        .then((d) => setVotes(d.votes))
        .catch(() => setVotes(0));
      return;
    }

    // Pop from queue
    if (queue.length > 0) {
      const [next, ...rest] = queue;
      setQueue(rest);
      navigateTo(next, true);
      // Prefetch more if queue is getting low
      if (rest.length <= 2) refillQueue();
    } else {
      // Queue empty, fetch now
      const batch = await fetchBatch();
      if (batch.length > 0) {
        const [next, ...rest] = batch;
        setQueue(rest);
        navigateTo(next, true);
      }
    }
  }, [historyIdx, history, queue, navigateTo, refillQueue, fetchBatch]);

  const goBack = useCallback(() => {
    if (historyIdx <= 0) return;
    const prev = history[historyIdx - 1];
    setHistoryIdx((i) => i - 1);
    setCurrent(prev);
    setLoading(true);
    fetch(`/api/votes?site=${encodeURIComponent(prev)}`)
      .then((r) => r.json())
      .then((d) => setVotes(d.votes))
      .catch(() => setVotes(0));
  }, [historyIdx, history]);

  // Initial load: fetch first batch and show first site
  useEffect(() => {
    (async () => {
      const batch = await fetchBatch();
      if (batch.length > 0) {
        const [first, ...rest] = batch;
        setQueue(rest);
        setCurrent(first);
        setHistory([first]);
        setHistoryIdx(0);
        seenRef.current.add(first);
        fetch(`/api/votes?site=${encodeURIComponent(first)}`)
          .then((r) => r.json())
          .then((d) => setVotes(d.votes))
          .catch(() => setVotes(0));
        // Prefetch another batch immediately
        refillQueue();
      }
      // Fire-and-forget view count
      fetch("/api/views", { method: "POST" })
        .then((r) => r.json())
        .then((d) => setViews(d.views))
        .catch(() => {});
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Arrow key navigation
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.target as HTMLElement).tagName === "INPUT") return;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        goBack();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        goForward();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goBack, goForward]);

  async function vote(direction: "up" | "down") {
    if (!current) return;
    // Optimistic update
    if (direction === "up") {
      setVotes((v) => v + 1);
    }
    const res = await fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site: current, direction }),
    });
    const data = await res.json();
    if (data.removed) {
      // Remove from seen so it doesn't get excluded (it's already gone from sites.txt)
      seenRef.current.delete(current);
      goForward();
    } else {
      setVotes(data.votes);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!siteUrl.trim() || submitting) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: siteUrl.trim() }),
      });
      if (res.ok) {
        setSubmitted(true);
        setSiteUrl("");
        setTimeout(() => setSubmitted(false), 3000);
      }
    } catch {
      // ignore
    } finally {
      setSubmitting(false);
    }
  }

  const hostname = current ? new URL(current).hostname : "";
  const canGoBack = historyIdx > 0;

  if (!current) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-900 text-white text-lg">
        Loading...
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col">
      <div className="flex h-11 items-center justify-between gap-4 bg-zinc-900 px-5 border-b-3 border-blue-500">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <button
              onClick={goBack}
              disabled={!canGoBack}
              className="rounded px-1.5 py-0.5 text-sm text-zinc-400 transition-colors hover:text-white disabled:opacity-30"
              title="Back (Left arrow)"
            >
              &larr;
            </button>
            <button
              onClick={goForward}
              className="rounded px-1.5 py-0.5 text-sm text-zinc-400 transition-colors hover:text-white"
              title="Forward / Random (Right arrow)"
            >
              &rarr;
            </button>
          </div>
          <span className="text-sm font-medium text-white">{hostname}</span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => vote("up")}
              className="rounded px-1.5 py-0.5 text-sm text-zinc-400 transition-colors hover:text-green-400"
              title="Upvote"
            >
              &#9650;
            </button>
            <span className="text-sm text-zinc-400 min-w-[1.5rem] text-center">
              {votes}
            </span>
            <button
              onClick={() => vote("down")}
              className="rounded px-1.5 py-0.5 text-sm text-zinc-400 transition-colors hover:text-red-400"
              title="Downvote (removes site)"
            >
              &#9660;
            </button>
          </div>
          {views !== null && (
            <span className="text-sm text-zinc-500">
              {views.toLocaleString()} views
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <form onSubmit={handleSubmit} className="flex items-center gap-2">
            <input
              type="text"
              value={siteUrl}
              onChange={(e) => setSiteUrl(e.target.value)}
              placeholder="yoursite.com"
              className="h-7 w-44 rounded-md bg-zinc-800 px-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:ring-1 focus:ring-zinc-600"
            />
            <button
              type="submit"
              disabled={submitting || !siteUrl.trim()}
              className="rounded-md bg-zinc-700 px-3 py-1 text-sm text-white transition-colors hover:bg-zinc-600 disabled:opacity-50"
            >
              {submitted ? "Added!" : "Add your site"}
            </button>
          </form>
        </div>
      </div>

      {loading && (
        <div className="absolute inset-0 top-11 z-10 flex items-center justify-center bg-zinc-900">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-white" />
        </div>
      )}
      <iframe
        src={current}
        className="flex-1 w-full border-none"
        onLoad={() => setLoading(false)}
      />
    </div>
  );
}
