"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import InfoCard from "./InfoCard";
import TutorialModal, { getSeenTutorial, setSeenTutorial } from "./TutorialModal";

const STORAGE_KEY = "sitescroll-last-url";
const BATCH_SIZE = 15;
const QUEUE_TARGET = 10;
const LOADING_PLACEHOLDER = "__loading__";
const SWIPE_DURATION_MS = 400;

const SCROLL_SWIPE_THRESHOLD = 80;

function SwipeOverlay({
  dir,
  visible,
}: {
  dir: "left" | "right";
  visible: boolean;
}) {
  if (!visible) return null;
  const isLeft = dir === "left";
  return (
    <>
      <div
        className={`pointer-events-none absolute inset-0 animate-swipe-tint ${
          isLeft ? "bg-red-500/20" : "bg-emerald-500/20"
        }`}
        aria-hidden
      />
      <div
        className={`pointer-events-none absolute inset-0 flex items-center ${
          isLeft ? "justify-start pl-[15%]" : "justify-end pr-[15%]"
        }`}
        aria-hidden
      >
        <div
          className={`h-24 w-24 rounded-full border-4 ${
            isLeft
              ? "border-red-500/90 bg-red-500/30 animate-swipe-flash-red"
              : "border-emerald-500/90 bg-emerald-500/30 animate-swipe-flash-green"
          }`}
        />
      </div>
    </>
  );
}

function LoaderGrid() {
  return (
    <div className="loader-grid" aria-hidden>
      <span className="loader-grid-dot" />
      <span className="loader-grid-dot" />
      <span className="loader-grid-dot" />
      <span className="loader-grid-dot" />
    </div>
  );
}

function getUrlFrom(
  history: string[],
  queue: string[],
  i: number
): string | undefined {
  if (i < 0) return undefined;
  return i < history.length ? history[i] : queue[i - history.length];
}

export default function Roll() {
  const [showTutorial, setShowTutorial] = useState(false);
  const [current, setCurrent] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const [queue, setQueue] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [optionKeyHeld, setOptionKeyHeld] = useState(false);
  const [swipeDir, setSwipeDir] = useState<
    "left" | "right" | "up" | "down" | null
  >(null);
  const [verticalPhase, setVerticalPhase] = useState<"from" | "to" | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const fetchingRef = useRef(false);
  const focusRef = useRef<HTMLDivElement>(null);
  const swipingRef = useRef(false);
  const swipingStartedAtRef = useRef(0);
  const scrollAccumRef = useRef(0);
  const scrollResetRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const optionKeyUpTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );

  const stateRef = useRef({ history, historyIdx, queue });
  stateRef.current = { history, historyIdx, queue };

  const currentUrl = getUrlFrom(history, queue, historyIdx) ?? current;
  const nextUrl = getUrlFrom(history, queue, historyIdx + 1) ?? null;
  const prevUrl = getUrlFrom(history, queue, historyIdx - 1) ?? null;

  const fetchBatch = useCallback(async (): Promise<string[]> => {
    if (fetchingRef.current) return [];
    fetchingRef.current = true;
    try {
      const res = await fetch(`/api/random?count=${BATCH_SIZE}`);
      const data = await res.json();
      const sites: string[] = data.sites || [];
      return sites;
    } catch {
      return [];
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  const refillQueue = useCallback(async () => {
    const batch = await fetchBatch();
    if (batch.length > 0) {
      setQueue((prev) => [...prev, ...batch]);
    }
  }, [fetchBatch]);

  const goForward = useCallback(
    () => {
      const { history: h, historyIdx: idx, queue: q } = stateRef.current;

      if (idx < h.length - 1) {
        const next = h[idx + 1];
        setHistoryIdx(idx + 1);
        setCurrent(next);
        setLoading(false);
        return;
      }

      if (q.length > 0) {
        const [next, ...rest] = q;
        setQueue(rest);
        setHistory((prev) => [...prev.slice(0, idx + 1), next]);
        setHistoryIdx(idx + 1);
        setCurrent(next);
        setLoading(false);
        refillQueue();
      } else {
        setHistory((prev) => [...prev.slice(0, idx + 1), LOADING_PLACEHOLDER]);
        setHistoryIdx(idx + 1);
        setCurrent(LOADING_PLACEHOLDER);
        fetchBatch().then((batch) => {
          if (batch.length > 0) {
            const [first, ...rest] = batch;
            setHistory((prev) => prev.slice(0, -1).concat(first));
            setQueue(rest);
            setCurrent(first);
            setLoading(false);
            refillQueue();
          } else {
            setHistory((prev) => prev.slice(0, -1));
            setHistoryIdx(idx);
            setCurrent(h[idx]);
          }
        });
      }
    },
    [refillQueue, fetchBatch]
  );

  const goBack = useCallback(() => {
    const { history: h, historyIdx: idx } = stateRef.current;
    if (idx < 1) return;
    const prev = h[idx - 1];
    setHistoryIdx(idx - 1);
    setCurrent(prev);
    setLoading(false);
  }, []);

  const goToUrl = useCallback((url: string) => {
    setHistory([url]);
    setHistoryIdx(0);
    setCurrent(url);
    setLoading(false);
  }, []);

  const handleSwipe = useCallback(
    (dir: "left" | "right" | "up" | "down") => {
      if (swipingRef.current) {
        const elapsed = Date.now() - swipingStartedAtRef.current;
        if (elapsed > 2500) {
          console.log("[ss] handleSwipe force-clear swipingRef (stuck", elapsed, "ms)");
          swipingRef.current = false;
          setSwipeDir(null);
        } else {
          console.log("[ss] handleSwipe skipped (swipingRef)");
          return;
        }
      }
      console.log("[ss] handleSwipe", dir);
      const { history: h, historyIdx: idx, queue: q } = stateRef.current;
      if (dir === "down" && idx < 1) return;
      const site = getUrlFrom(h, q, idx);
      if (
        (dir === "left" || dir === "right") &&
        site &&
        site !== LOADING_PLACEHOLDER
      ) {
        fetch("/api/votes", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            site,
            direction: dir === "left" ? "down" : "up",
          }),
        }).catch(() => {});
      }
      swipingRef.current = true;
      swipingStartedAtRef.current = Date.now();
      setSwipeDir(dir);
      if (dir === "up" || dir === "down") setVerticalPhase("from");
      const safetyId = setTimeout(() => {
        console.log("[ss] safety timeout, clearing swipingRef");
        swipingRef.current = false;
        setSwipeDir(null);
        setVerticalPhase(null);
      }, 2000);
      setTimeout(() => {
        try {
          if (dir === "down") goBack();
          else goForward();
        } finally {
          clearTimeout(safetyId);
          setSwipeDir(null);
          setVerticalPhase(null);
          swipingRef.current = false;
          console.log("[ss] swipe done, swipingRef = false");
        }
      }, SWIPE_DURATION_MS);
    },
    [goForward, goBack]
  );

  const handleOptionScroll = useCallback(
    (e: React.WheelEvent) => {
      if (!e.altKey) {
        setOptionKeyHeld(false);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      if (swipingRef.current) return;

      scrollAccumRef.current += e.deltaY;

      if (scrollResetRef.current) clearTimeout(scrollResetRef.current);
      scrollResetRef.current = setTimeout(() => {
        scrollAccumRef.current = 0;
      }, 300);

      if (scrollAccumRef.current > SCROLL_SWIPE_THRESHOLD) {
        scrollAccumRef.current = 0;
        handleSwipe("up");
      } else if (scrollAccumRef.current < -SCROLL_SWIPE_THRESHOLD) {
        scrollAccumRef.current = 0;
        handleSwipe("down");
      }
    },
    [handleSwipe]
  );

  useEffect(() => {
    if (
      (swipeDir === "up" || swipeDir === "down") &&
      verticalPhase === "from"
    ) {
      const id = requestAnimationFrame(() => {
        setVerticalPhase("to");
      });
      return () => cancelAnimationFrame(id);
    }
  }, [swipeDir, verticalPhase]);

  useEffect(() => {
    return () => {
      if (scrollResetRef.current) clearTimeout(scrollResetRef.current);
    };
  }, []);

  useEffect(() => {
    setShowTutorial(!getSeenTutorial());
  }, []);

  useEffect(() => {
    (async () => {
      const saved =
        typeof window !== "undefined"
          ? localStorage.getItem(STORAGE_KEY)
          : null;
      const batch = await fetchBatch();
      if (batch.length > 0 || saved) {
        let first: string;
        let rest = [...batch];
        if (saved) {
          first = saved;
          const idx = rest.indexOf(saved);
          if (idx >= 0) rest.splice(idx, 1);
        } else {
          first = rest[0];
          rest = rest.slice(1);
        }
        setQueue(rest);
        setCurrent(first);
        setHistory([first]);
        setHistoryIdx(0);
        refillQueue();
        setLoadFailed(false);
      } else {
        setLoading(false);
        setLoadFailed(true);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (
      currentUrl &&
      currentUrl !== LOADING_PLACEHOLDER &&
      typeof window !== "undefined"
    ) {
      localStorage.setItem(STORAGE_KEY, currentUrl);
    }
  }, [currentUrl]);

  useEffect(() => {
    if (
      currentUrl &&
      currentUrl !== LOADING_PLACEHOLDER &&
      queue.length < QUEUE_TARGET
    ) {
      refillQueue();
    }
  }, [currentUrl, queue.length, refillQueue]);

  useEffect(() => {
    focusRef.current?.focus();
  }, [currentUrl]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.altKey) {
        if (e.key === "ArrowLeft") {
          e.preventDefault();
          handleSwipe("left");
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          handleSwipe("right");
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          handleSwipe("up");
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          handleSwipe("down");
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [handleSwipe]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.key === "Alt" || e.key === "Option") {
        if (optionKeyUpTimeoutRef.current) {
          clearTimeout(optionKeyUpTimeoutRef.current);
          optionKeyUpTimeoutRef.current = null;
        }
        console.log("[ss] Option keydown -> optionKeyHeld true");
        setOptionKeyHeld(true);
      }
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === "Alt" || e.key === "Option") {
        if (optionKeyUpTimeoutRef.current) clearTimeout(optionKeyUpTimeoutRef.current);
        console.log("[ss] Option keyup, scheduling clear in 150ms");
        optionKeyUpTimeoutRef.current = setTimeout(() => {
          optionKeyUpTimeoutRef.current = null;
          setOptionKeyHeld(false);
          console.log("[ss] Option keyup timeout -> optionKeyHeld false");
        }, 150);
      }
    }
    function handleBlur() {
      if (optionKeyUpTimeoutRef.current) {
        clearTimeout(optionKeyUpTimeoutRef.current);
        optionKeyUpTimeoutRef.current = null;
      }
      console.log("[ss] window blur -> optionKeyHeld false");
      setOptionKeyHeld(false);
    }
    function pullFocus() {
      if (focusRef.current) {
        focusRef.current.focus();
        console.log("[ss] pullFocus");
      }
    }
    function handleFocus() {
      pullFocus();
      setTimeout(pullFocus, 50);
      setTimeout(pullFocus, 150);
      setTimeout(pullFocus, 400);
      setTimeout(pullFocus, 800);
    }
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        handleFocus();
      }
    }
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("blur", handleBlur);
    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      if (optionKeyUpTimeoutRef.current) clearTimeout(optionKeyUpTimeoutRef.current);
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("blur", handleBlur);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!e.altKey) return;
      const dir: "left" | "right" =
        e.clientX < window.innerWidth / 2 ? "left" : "right";
      console.log("[ss] window click (capture, altKey), dir:", dir);
      e.preventDefault();
      e.stopPropagation();
      handleSwipe(dir);
    }
    window.addEventListener("click", handleClick, true);
    return () => window.removeEventListener("click", handleClick, true);
  }, [handleSwipe]);

  if (!currentUrl) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-white text-stone-800">
        {loadFailed ? (
          <>
            <p className="text-lg">Couldn&apos;t load sites.</p>
            <p className="text-sm text-stone-500">
              Check that the API is running and the database is configured.
            </p>
            <button
              type="button"
              onClick={() => {
                setLoadFailed(false);
                setLoading(true);
                (async () => {
                  const batch = await fetchBatch();
                  const saved =
                    typeof window !== "undefined"
                      ? localStorage.getItem(STORAGE_KEY)
                      : null;
                  if (batch.length > 0 || saved) {
                    let first: string;
                    let rest = [...batch];
                    if (saved) {
                      first = saved;
                      const idx = rest.indexOf(saved);
                      if (idx >= 0) rest.splice(idx, 1);
                    } else {
                      first = rest[0];
                      rest = rest.slice(1);
                    }
                    setQueue(rest);
                    setCurrent(first);
                    setHistory([first]);
                    setHistoryIdx(0);
                    refillQueue();
                  } else {
                    setLoadFailed(true);
                  }
                  setLoading(false);
                })();
              }}
              className="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-amber-400"
            >
              Retry
            </button>
          </>
        ) : (
          <LoaderGrid />
        )}
      </div>
    );
  }

  const isVertical = swipeDir === "up" || swipeDir === "down";
  const verticalUrls =
    swipeDir === "down" && prevUrl
      ? [prevUrl, currentUrl]
      : [currentUrl, nextUrl].filter((u): u is string => !!u);
  const visibleUrls = [currentUrl, nextUrl].filter(
    (u): u is string => !!u
  );
  const uniqueUrls = isVertical ? verticalUrls : [...new Set(visibleUrls)];

  return (
    <div
      ref={focusRef}
      tabIndex={0}
      className="relative flex h-screen flex-col outline-none"
    >
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
          <LoaderGrid />
        </div>
      )}

      <div
        id="iframe-overlay"
        className="absolute inset-0 z-20"
        style={{
          pointerEvents: optionKeyHeld ? "auto" : "none",
          cursor: optionKeyHeld ? "pointer" : undefined,
        }}
        onWheel={handleOptionScroll}
        onClick={(e) => {
          const dir: "left" | "right" =
            e.clientX < window.innerWidth / 2 ? "left" : "right";
          if (!e.altKey) {
            setOptionKeyHeld(false);
            return;
          }
          e.preventDefault();
          e.stopPropagation();
          handleSwipe(dir);
        }}
      />

      <TutorialModal
        open={showTutorial}
        onClose={() => {
          setSeenTutorial();
          setShowTutorial(false);
        }}
      />
      {currentUrl !== LOADING_PLACEHOLDER && (
        <InfoCard
          currentUrl={currentUrl}
          onOpenTutorial={() => setShowTutorial(true)}
          onGoToUrl={goToUrl}
        />
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        {uniqueUrls.map((url, i) => {
          const isCurrent = url === currentUrl;
          const isVerticalFrom = isVertical && verticalPhase === "from";
          const isVerticalTo = isVertical && verticalPhase === "to";

          let transform = "none";
          let transition = "none";
          let origin = "center";

          if (isVertical && (swipeDir === "up" || swipeDir === "down")) {
            const ease = `cubic-bezier(0.4, 0, 0.2, 1)`;
            transition = `transform ${SWIPE_DURATION_MS}ms ${ease}`;
            if (swipeDir === "up") {
              if (i === 0) {
                transform = isVerticalFrom ? "translateY(0)" : "translateY(-100%)";
              } else {
                transform = isVerticalFrom ? "translateY(100%)" : "translateY(0)";
              }
              origin = "center top";
            } else {
              if (i === 0) {
                transform = isVerticalFrom ? "translateY(-100%)" : "translateY(0)";
              } else {
                transform = isVerticalFrom ? "translateY(0)" : "translateY(100%)";
              }
              origin = "center bottom";
            }
          } else if (isCurrent && swipeDir && (swipeDir === "left" || swipeDir === "right")) {
            if (swipeDir === "left") {
              transform = "translateX(-120%) rotate(-12deg)";
              origin = "bottom left";
            } else {
              transform = "translateX(120%) rotate(12deg)";
              origin = "bottom right";
            }
            transition = `transform ${SWIPE_DURATION_MS}ms cubic-bezier(0.4, 0, 0.2, 1)`;
          }

          return (
            <div
              key={url}
              className="absolute inset-0 bg-white"
              style={{
                zIndex: isCurrent ? 1 : 0,
                transform,
                transition,
                transformOrigin: origin,
              }}
            >
              {isCurrent &&
                swipeDir &&
                (swipeDir === "left" || swipeDir === "right") && (
                  <SwipeOverlay dir={swipeDir} visible />
                )}
              {url === LOADING_PLACEHOLDER ? (
                <div className="flex h-full w-full items-center justify-center bg-white">
                  <LoaderGrid />
                </div>
              ) : (
                <iframe
                  src={url}
                  className="h-full w-full border-none bg-white"
                  onLoad={() => {
                    if (url === currentUrl) setLoading(false);
                  }}
                  title={url}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
