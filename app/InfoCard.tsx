"use client";

import { useEffect, useState } from "react";
import { getSeenUpdate } from "./TutorialModal";

const SAVED_STORAGE_KEY = "sitescroll-saved";

function getSavedSites(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(SAVED_STORAGE_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    return Array.isArray(arr) && arr.every((x) => typeof x === "string") ? arr : [];
  } catch {
    return [];
  }
}

function setSavedSites(urls: string[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(SAVED_STORAGE_KEY, JSON.stringify(urls));
}

const SOURCE_IMAGES: Record<string, string> = {
  x: "/x.avif",
  twitter: "/x.avif",
  hn: "/yc.png",
  arena: "/arena.png",
};

function SourceLogo({ source, className }: { source: string; className?: string }) {
  const src = SOURCE_IMAGES[source.toLowerCase()];
  if (!src) return null;
  return (
    <img
      src={src}
      alt=""
      width={18}
      height={18}
      className={className}
    />
  );
}

type InfoCardProps = {
  currentUrl: string;
  onOpenTutorial?: () => void;
  onOpenUpdate?: () => void;
  onGoToUrl?: (url: string) => void;
  showNav?: boolean;
  onToggleNav?: () => void;
  onLike?: () => void;
  onNoLike?: () => void;
};

export default function InfoCard({ currentUrl, onOpenTutorial, onOpenUpdate, onGoToUrl, showNav, onToggleNav }: InfoCardProps) {
  const [hasUnseenUpdate] = useState(() => !getSeenUpdate());
  const [showRating, setShowRating] = useState(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem("sitescroll-show-rating");
    return v === null ? true : v === "true";
  });
  const [showBookmarks, setShowBookmarks] = useState(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem("sitescroll-show-bookmarks");
    return v === null ? true : v === "true";
  });
  const [showSiteUrl, setShowSiteUrl] = useState(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem("sitescroll-show-site-url");
    return v === null ? true : v === "true";
  });
  const [showDiscord, setShowDiscord] = useState(() => {
    if (typeof window === "undefined") return true;
    const v = localStorage.getItem("sitescroll-show-discord");
    return v === null ? true : v === "true";
  });
  const [open, setOpen] = useState(false);
  const [savedOpen, setSavedOpen] = useState(false);
  const [saved, setSaved] = useState<string[]>(() => getSavedSites());
  const isCurrentSaved = saved.includes(currentUrl);
  function toggleSave() {
    const next = isCurrentSaved ? saved.filter((u) => u !== currentUrl) : [...saved, currentUrl];
    setSaved(next);
    setSavedSites(next);
  }
  const [addUrl, setAddUrl] = useState("");
  const [addStatus, setAddStatus] = useState<"idle" | "sending" | "done">("idle");
  const [reportStatus, setReportStatus] = useState<"idle" | "sending" | "done">("idle");
  const [source, setSource] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [totalVisits, setTotalVisits] = useState<number | null>(null);
  const [vote, setVote] = useState<"up" | "down" | null>(null);

  async function submitAdd() {
    if (!addUrl.trim() || addStatus === "sending") return;
    setAddStatus("sending");
    try {
      const res = await fetch("/api/sites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: addUrl.trim() }),
      });
      if (res.ok) {
        setAddUrl("");
        setAddStatus("done");
        setTimeout(() => setAddStatus("idle"), 2500);
      }
    } catch {
      setAddStatus("idle");
    }
  }

  async function submitReport() {
    if (!currentUrl || reportStatus === "sending") return;
    setReportStatus("sending");
    try {
      const res = await fetch("/api/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: currentUrl, feedback: "broken" }),
      });
      if (res.ok) {
        setReportStatus("done");
        setTimeout(() => setReportStatus("idle"), 2500);
      }
    } catch {
      setReportStatus("idle");
    }
  }


  const hostname = currentUrl
    ? new URL(currentUrl).hostname.replace(/^www\./, "")
    : "";

  useEffect(() => {
    setVote(null);
  }, [currentUrl]);

  function castVote(direction: "up" | "down") {
    const undo = vote === direction;
    const nextVote = undo ? null : direction;
    setVote(nextVote);
    fetch("/api/votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ site: currentUrl, direction, undo }),
    }).catch(() => {});
  }

  useEffect(() => {
    if (!currentUrl) {
      setSource(null);
      setSourceUrl(null);
      return;
    }
    fetch(`/api/votes?site=${encodeURIComponent(currentUrl)}`)
      .then((res) => res.json())
      .then((data) => {
        setSource(data.source ?? null);
        setSourceUrl(data.source_url ?? null);
      })
      .catch(() => {
        setSource(null);
        setSourceUrl(null);
      });
  }, [currentUrl]);

  useEffect(() => {
    if (!open) return;
    const fetchTotal = () => {
      fetch("/api/stats")
        .then((res) => res.json())
        .then((data) => setTotalVisits(data.totalVisits ?? 0))
        .catch(() => setTotalVisits(null));
    };
    fetchTotal();
    const interval = setInterval(fetchTotal, 10000);
    return () => clearInterval(interval);
  }, [open]);


  const copySaved = () => {
    if (saved.length === 0) return;
    const text = saved.join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const savedListContent =
    saved.length === 0 ? (
      <p className="text-sm text-stone-500">No saved sites. Use the heart to save the current site.</p>
    ) : (
      <div className="relative max-h-48 overflow-y-auto pr-10">
        {saved.map((url) => (
          <a
            key={url}
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="block truncate text-[13px] font-mono text-stone-600 underline decoration-amber-400 underline-offset-1 hover:text-stone-900"
          >
            {url}
          </a>
        ))}
        <button
          type="button"
          onClick={copySaved}
          className="absolute right-0 top-0 flex h-6 w-6 shrink-0 items-center justify-center rounded text-stone-600 hover:bg-amber-200/80"
          aria-label={copied ? "Copied" : "Copy"}
        >
          <i className={`fa-sm ${copied ? "fa-solid fa-check" : "fa-regular fa-copy"}`} />
        </button>
      </div>
    );

  return (
    <>
      {showSiteUrl && hostname && (
        <div className="fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-[max(0.5rem,env(safe-area-inset-left))] z-40 font-[family-name:var(--font-nunito)] sm:left-6">
          <a
            href={currentUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 max-w-[calc(100vw-11rem)] sm:max-w-[280px] items-center gap-1.5 rounded-full bg-amber-100 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-amber-200 min-w-0 sm:h-10 sm:px-4 sm:text-[15px]"
          >
            <span className="truncate">{hostname}</span>
            <i className="fa-solid fa-arrow-up-right-from-square fa-xs shrink-0" />
          </a>
        </div>
      )}
      <div className="fixed bottom-[max(0.5rem,env(safe-area-inset-bottom))] left-[max(0.5rem,env(safe-area-inset-left))] right-[max(0.5rem,env(safe-area-inset-right))] z-40 flex max-w-full flex-col items-end gap-2 font-[family-name:var(--font-nunito)] sm:left-auto sm:right-6">
      {savedOpen && (
        <div
          className="mb-2 w-full max-w-[280px] rounded-2xl bg-amber-50/95 px-4 py-3 shadow-xl shadow-amber-900/5 sm:px-5 sm:py-4"
          style={{
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          {savedListContent}
        </div>
      )}
      {open && (
        <div
          className="mb-2 w-full max-w-[320px] rounded-2xl bg-amber-50/95 px-4 py-4 shadow-xl shadow-amber-900/5 sm:px-6 sm:py-6"
          style={{
            backdropFilter: "blur(12px)",
            WebkitBackdropFilter: "blur(12px)",
          }}
        >
          <div className="flex flex-col gap-4">
            <div className="border-b border-stone-200 pb-4 flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-stone-700">Navigation buttons</span>
                {onToggleNav && (
                  <button
                    type="button"
                    onClick={onToggleNav}
                    role="switch"
                    aria-checked={showNav}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full ${showNav ? "bg-amber-400" : "bg-stone-200"}`}
                  >
                    <span className={`my-0.5 inline-block h-4 w-4 rounded-full bg-white shadow ${showNav ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                )}
              </div>
              {([
                ["Site URL", showSiteUrl, setShowSiteUrl, "sitescroll-show-site-url"] as const,
                ["Bookmarks", showBookmarks, setShowBookmarks, "sitescroll-show-bookmarks"] as const,
                ["Rating", showRating, setShowRating, "sitescroll-show-rating"] as const,
                ["Discord button", showDiscord, setShowDiscord, "sitescroll-show-discord"] as const,
              ]).map(([label, value, setter, key]) => (
                <div key={key} className="flex items-center justify-between">
                  <span className="text-sm font-medium text-stone-700">{label}</span>
                  <button
                    type="button"
                    onClick={() => setter((v) => {
                      const next = !v;
                      localStorage.setItem(key, String(next));
                      return next;
                    })}
                    role="switch"
                    aria-checked={value}
                    className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full ${value ? "bg-amber-400" : "bg-stone-200"}`}
                  >
                    <span className={`my-0.5 inline-block h-4 w-4 rounded-full bg-white shadow ${value ? "translate-x-4" : "translate-x-0.5"}`} />
                  </button>
                </div>
              ))}
            </div>
            <div className="relative">
              <label className="mb-1.5 block text-sm font-medium text-stone-700">
                Add a site
              </label>
              <input
                type="text"
                value={addUrl}
                onChange={(e) => setAddUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitAdd()}
                placeholder="https://yoursite.com"
                className="w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3 text-[15px] text-stone-800 placeholder-stone-400 outline-none focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
              />
              {addStatus === "done" && (
                <span className="absolute right-0 top-0 text-[11px] font-medium text-green-600">added</span>
              )}
            </div>
            {showDiscord && (
              <a
                href="https://discord.gg/tKwAnxbA"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-medium text-white hover:bg-indigo-600"
              >
                <i className="fa-brands fa-discord" />
                Join Discord to give feedback
              </a>
            )}
          </div>

          <p className="mt-5 border-t border-stone-200 pt-4 text-center text-xs text-stone-500 sm:text-sm">
            {totalVisits != null && (
              <>
                <span className="text-stone-600">{totalVisits.toLocaleString()} total visits</span>
              </>
            )}

            {onOpenTutorial && (
              <>
                {" • "}
                <button
                  type="button"
                  onClick={onOpenTutorial}
                  className="font-medium text-stone-600 underline decoration-amber-300 underline-offset-2 hover:text-stone-800"
                >
                  info
                </button>
              </>
            )}
            {onOpenUpdate && (
              <>
                {" • "}
                <button
                  type="button"
                  onClick={onOpenUpdate}
                  className="relative font-medium text-stone-600 underline decoration-amber-300 underline-offset-2 hover:text-stone-800"
                >
                  what&apos;s new
                  {hasUnseenUpdate && (
                    <span className="absolute -right-1.5 -top-1 h-1.5 w-1.5 rounded-full bg-red-500" />
                  )}
                </button>
              </>
            )}
          </p>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-4">
        {showBookmarks && (
          <>
            <button
              type="button"
              onClick={toggleSave}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-amber-100 text-stone-700 hover:bg-amber-200 sm:h-10 sm:w-10"
              aria-label={isCurrentSaved ? "Unsave" : "Save"}
              title={isCurrentSaved ? "Unsave" : "Save"}
            >
              <i className={`fa-bookmark fa-lg ${isCurrentSaved ? "fa-solid" : "fa-regular"}`} />
            </button>
            <button
              onClick={() => {
                setOpen(false);
                setSavedOpen((o) => !o);
              }}
              className={`min-w-0 rounded-full px-3 py-2 text-center text-sm font-medium text-stone-700 hover:bg-amber-200 sm:w-[80px] sm:px-0 sm:text-[15px] ${savedOpen ? "bg-amber-300" : "bg-amber-100"}`}
            >
              saved{saved.length > 0 ? ` (${saved.length})` : ""}
            </button>
          </>
        )}

        {showRating && (
          <>
            <button
              type="button"
              onClick={() => castVote("up")}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-700 hover:bg-amber-200 sm:h-10 sm:w-10 ${vote === "up" ? "bg-amber-300" : "bg-amber-100"}`}
              aria-label="Thumbs up"
              title="Like"
            >
              <i className={`fa-thumbs-up fa-lg fa-flip-horizontal ${vote === "up" ? "fa-solid" : "fa-regular"}`} />
            </button>
            <button
              type="button"
              onClick={() => castVote("down")}
              className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-stone-700 hover:bg-amber-200 sm:h-10 sm:w-10 ${vote === "down" ? "bg-amber-300" : "bg-amber-100"}`}
              aria-label="Thumbs down"
              title="Dislike"
            >
              <i className={`fa-thumbs-down fa-lg ${vote === "down" ? "fa-solid" : "fa-regular"}`} />
            </button>
          </>
        )}

        <button
          type="button"
          onClick={submitReport}
          disabled={reportStatus !== "idle"}
          className="min-w-0 rounded-full bg-amber-100 px-3 py-2 text-center text-sm font-medium text-stone-700 hover:bg-amber-200 disabled:opacity-50 sm:w-[80px] sm:px-0 sm:text-[15px]"
        >
          {reportStatus === "done" ? "reported" : "report"}
        </button>
        <button
          onClick={() => {
            setSavedOpen(false);
            setOpen((o) => !o);
          }}
          className={`min-w-0 rounded-full px-3 py-2 text-center text-sm font-medium text-stone-700 hover:bg-amber-200 sm:w-[80px] sm:px-0 sm:text-[15px] ${open ? "bg-amber-300" : "bg-amber-100"}`}
        >
          {open ? "close" : "more"}
        </button>
      </div>
    </div>
    </>
  );
}
