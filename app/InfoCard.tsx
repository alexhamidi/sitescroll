"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";

const VOTES_STORAGE_KEY = "sitescroll-votes";
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

function getUserVote(url: string): "up" | "down" | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(VOTES_STORAGE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw) as Record<string, string>;
    const v = obj[url];
    return v === "up" || v === "down" ? v : null;
  } catch {
    return null;
  }
}

function persistUserVote(url: string, direction: "up" | "down" | null) {
  if (typeof window === "undefined") return;
  try {
    const raw = localStorage.getItem(VOTES_STORAGE_KEY);
    const obj: Record<string, string> = raw ? JSON.parse(raw) : {};
    if (direction === null) delete obj[url];
    else obj[url] = direction;
    localStorage.setItem(VOTES_STORAGE_KEY, JSON.stringify(obj));
  } catch {}
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
  onGoToUrl?: (url: string) => void;
  showNav?: boolean;
  onToggleNav?: () => void;
  nextButton?: React.ReactNode;
};

export default function InfoCard({ currentUrl, onOpenTutorial, onGoToUrl, showNav, onToggleNav, nextButton }: InfoCardProps) {
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
  const [reportFeedback, setReportFeedback] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [addStatus, setAddStatus] = useState<"idle" | "sending" | "done">("idle");
  const [reportStatus, setReportStatus] = useState<"idle" | "sending" | "done">("idle");
  const [feedbackStatus, setFeedbackStatus] = useState<"idle" | "sending" | "done">("idle");
  const [voteCount, setVoteCount] = useState<number | null>(null);
  const [voteStatus, setVoteStatus] = useState<"idle" | "sending">("idle");
  const [userVote, setUserVote] = useState<"up" | "down" | null>(null);
  const [source, setSource] = useState<string | null>(null);
  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

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
        body: JSON.stringify({ url: currentUrl, feedback: reportFeedback.trim() }),
      });
      if (res.ok) {
        setReportFeedback("");
        setReportStatus("done");
        setTimeout(() => setReportStatus("idle"), 2500);
      }
    } catch {
      setReportStatus("idle");
    }
  }

  async function submitFeedback() {
    if (!feedbackText.trim() || feedbackStatus === "sending" || !currentUrl) return;
    setFeedbackStatus("sending");
    try {
      const res = await fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: currentUrl, message: feedbackText.trim() }),
      });
      if (res.ok) {
        setFeedbackText("");
        setFeedbackStatus("done");
        setTimeout(() => setFeedbackStatus("idle"), 2500);
      }
    } catch {
      setFeedbackStatus("idle");
    }
  }

  const hostname = currentUrl
    ? new URL(currentUrl).hostname.replace(/^www\./, "")
    : "";

  useEffect(() => {
    if (!currentUrl) {
      setVoteCount(null);
      setUserVote(null);
      setSource(null);
      setSourceUrl(null);
      return;
    }
    setUserVote(getUserVote(currentUrl));
    fetch(`/api/votes?site=${encodeURIComponent(currentUrl)}`)
      .then((res) => res.json())
      .then((data) => {
        setVoteCount(data.votes ?? 0);
        setSource(data.source ?? null);
        setSourceUrl(data.source_url ?? null);
      })
      .catch(() => {
        setVoteCount(null);
        setSource(null);
        setSourceUrl(null);
      });
  }, [currentUrl]);

  async function submitVote(direction: "up" | "down") {
    if (!currentUrl || voteStatus === "sending") return;
    const undo = userVote === direction;
    setVoteStatus("sending");
    try {
      const res = await fetch("/api/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ site: currentUrl, direction, undo }),
      });
      const data = await res.json();
      if (res.ok) {
        setVoteCount(data.votes ?? 0);
        if (undo) {
          setUserVote(null);
          persistUserVote(currentUrl, null);
        } else {
          setUserVote(direction);
          persistUserVote(currentUrl, direction);
        }
      }
    } finally {
      setVoteStatus("idle");
    }
  }

  const panelTransition = { type: "spring" as const, stiffness: 400, damping: 28 };

  const copySaved = () => {
    if (saved.length === 0) return;
    const text = saved.join("\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  const savedListContent = (
    <div className="flex flex-col gap-2">
      {saved.length === 0 ? (
        <p className="text-sm text-stone-500">No saved sites. Use the heart to save the current site.</p>
      ) : (
        <>
          <div className="relative">
            <pre className="max-h-48 overflow-y-auto rounded-lg border border-stone-200 bg-stone-100/80 px-3 py-2.5 pl-3 pr-14 text-left text-[13px] font-mono text-stone-700">
              <code className="block">
                {saved.map((url) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block truncate text-stone-600 underline decoration-amber-400 underline-offset-1 hover:text-stone-900"
                  >
                    {url}
                  </a>
                ))}
              </code>
            </pre>
            <button
              type="button"
              onClick={copySaved}
              className="absolute right-2 top-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-sm border border-stone-300 bg-white/90 text-stone-600 hover:bg-stone-50"
              aria-label={copied ? "Copied" : "Copy"}
            >
              <i className={`fa-sm ${copied ? "fa-solid fa-check" : "fa-regular fa-copy"}`} />
            </button>
          </div>
        </>
      )}
    </div>
  );

  return (
    <div
      className="fixed left-4 right-4 z-40 flex flex-col items-end gap-4 font-[family-name:var(--font-nunito)] sm:left-6 sm:right-6"
      style={{ bottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
    >
      <AnimatePresence>
        {savedOpen && (
          <motion.div
            key="saved-panel"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={panelTransition}
            className="mb-2 w-[280px] max-w-[calc(100vw-3rem)] rounded-2xl border-2 border-amber-200/80 bg-amber-50/95 px-5 py-4 shadow-xl shadow-amber-900/5"
            style={{
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              transformOrigin: "right bottom",
            }}
          >
            {savedListContent}
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {open && (
          <motion.div
            key="actions-panel"
            initial={{ opacity: 0, y: 12, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.96 }}
            transition={panelTransition}
            className="mb-2 w-[320px] max-w-[calc(100vw-3rem)] rounded-2xl border-2 border-amber-200/80 bg-amber-50/95 px-6 py-6 shadow-xl shadow-amber-900/5"
            style={{
              backdropFilter: "blur(12px)",
              WebkitBackdropFilter: "blur(12px)",
              transformOrigin: "right bottom",
            }}
          >
          <div className="flex flex-col gap-4">
            {sourceUrl && source && (
              <a
                href={sourceUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 text-sm text-stone-600 underline decoration-amber-300 underline-offset-2 hover:text-stone-800 hover:decoration-amber-400"
              >
                <SourceLogo source={source} className="shrink-0 text-stone-500" />
                <span className="truncate">{sourceUrl}</span>
              </a>
            )}
            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-stone-700">
                  Report <span className="font-semibold">{hostname}</span>
                </label>
                {reportStatus === "done" && (
                  <span className="text-sm font-medium text-green-700">done</span>
                )}
              </div>
              <input
                type="text"
                value={reportFeedback}
                onChange={(e) => setReportFeedback(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitReport()}
                placeholder="e.g. broken, spam, nsfw..."
                className="w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3 text-[15px] text-stone-800 placeholder-stone-400 outline-none transition-colors focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-stone-700">Add a site</label>
                {addStatus === "done" && (
                  <span className="text-sm font-medium text-green-700">done</span>
                )}
              </div>
              <input
                type="text"
                value={addUrl}
                onChange={(e) => setAddUrl(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitAdd()}
                placeholder="https://yoursite.com"
                className="w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3 text-[15px] text-stone-800 placeholder-stone-400 outline-none transition-colors focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
              />
            </div>

            <div>
              <div className="mb-1.5 flex items-center justify-between">
                <label className="text-sm font-medium text-stone-700">Feedback</label>
                {feedbackStatus === "done" && (
                  <span className="text-sm font-medium text-green-700">done</span>
                )}
              </div>
              <input
                type="text"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submitFeedback()}
                placeholder="Suggestions, bugs, other feedback..."
                className="w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3 text-[15px] text-stone-800 placeholder-stone-400 outline-none transition-colors focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
              />
            </div>
          </div>

          <p className="mt-5 border-t border-stone-200 pt-4 text-center text-sm text-stone-500">
            built by{" "}
            <a
              href="https://ahamidi.me"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-stone-600 underline decoration-amber-300 underline-offset-2 hover:text-stone-800"
            >
              alexhamidi
            </a>
            {onOpenTutorial && (
              <>
                {" • "}
                <button
                  type="button"
                  onClick={onOpenTutorial}
                  className="font-medium text-stone-600 underline decoration-amber-300 underline-offset-2 hover:text-stone-800"
                >
                  more info
                </button>
              </>
            )}
          </p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex h-10 w-full items-center justify-between gap-2 md:w-auto md:justify-end md:gap-4">
        <div className="flex min-w-0 shrink items-center gap-2">
          {hostname && (
            <a
              href={currentUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="truncate text-base font-semibold text-stone-700 underline decoration-amber-300 underline-offset-2 transition-colors hover:text-stone-900 hover:decoration-amber-400"
            >
              {hostname}
            </a>
          )}
          <button
            type="button"
            onClick={toggleSave}
            className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-100 text-stone-700 transition-colors hover:bg-amber-200 md:flex"
            aria-label={isCurrentSaved ? "Unsave" : "Save"}
            title={isCurrentSaved ? "Unsave" : "Save"}
          >
            <i className={`fa-bookmark fa-lg ${isCurrentSaved ? "fa-solid" : "fa-regular"}`} />
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={() => {
              setSavedOpen(false);
              setOpen((o) => !o);
            }}
            className={`flex h-10 w-[80px] items-center justify-center rounded-full text-[15px] font-medium text-stone-700 transition-colors hover:bg-amber-200 ${open ? "bg-amber-200" : "bg-amber-100"}`}
          >
            {open ? "close" : "actions"}
          </button>
          <button
            onClick={() => {
              setOpen(false);
              setSavedOpen((o) => !o);
            }}
            className={`hidden h-10 w-[80px] rounded-full text-center text-[15px] font-medium text-stone-700 transition-colors hover:bg-amber-200 md:inline-flex md:items-center md:justify-center ${savedOpen ? "bg-amber-200" : "bg-amber-100"}`}
          >
            saved{saved.length > 0 ? ` (${saved.length})` : ""}
          </button>
          {onToggleNav && (
            <button
              type="button"
              onClick={onToggleNav}
              className="flex h-10 w-[80px] items-center justify-center rounded-full bg-amber-100 text-[15px] font-medium text-stone-700 transition-colors hover:bg-amber-200"
            >
              {showNav ? "hide nav" : "show nav"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
