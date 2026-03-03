"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import InfoCard from "./InfoCard";
import TutorialModal, { getSeenTutorial, setSeenTutorial } from "./TutorialModal";

const SLIDE_HEIGHT = "100vh";
const SCROLL_SENSITIVITY = 0.0022;
const SCROLL_END_MS = 180;
const SNAP_DURATION_MS = 320;
const MAX_PREV = 2;
const STORAGE_KEY = "sitescroll-last-url";
const BATCH_SIZE = 15;
const QUEUE_TARGET = 10;
const LOADING_PLACEHOLDER = "__loading__";

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
  const [scrollOffset, setScrollOffset] = useState(0);
  const [isSnapping, setIsSnapping] = useState(false);
  const scrollEndTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scrollOffsetRef = useRef(0);
  const fetchingRef = useRef(false);
  const focusRef = useRef<HTMLDivElement>(null);
  const snapTargetRef = useRef(0);
  const handleScrollEndRef = useRef(() => {});

  const stateRef = useRef({ history, historyIdx, queue });
  stateRef.current = { history, historyIdx, queue };

  const canGoBack = historyIdx > 0;
  const currentUrl =
    getUrlFrom(history, queue, historyIdx) ?? current;
  const nextUrl = getUrlFrom(history, queue, historyIdx + 1) ?? null;

  const slideUrls: string[] = [];
  for (let i = -MAX_PREV; i <= 1; i++) {
    const u = getUrlFrom(history, queue, historyIdx + i);
    if (u) slideUrls.push(u);
  }
  if (slideUrls.length === 0 && currentUrl) slideUrls.push(currentUrl);

  const prevCount = Math.min(historyIdx, MAX_PREV);
  const actualMinOffset = -prevCount;
  const canGoForward =
    !!nextUrl ||
    (historyIdx === history.length - 1 &&
      queue.length === 0 &&
      getUrlFrom(history, queue, historyIdx) !== LOADING_PLACEHOLDER);
  const maxOffset = canGoForward ? 1 : 0;
  const slideOffset = prevCount + scrollOffset;
  scrollOffsetRef.current = scrollOffset;

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
    (skipLoading = false) => {
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

  const goBack = useCallback((steps = 1, _skipLoading = false) => {
    const { history: h, historyIdx: idx } = stateRef.current;
    if (idx < steps) return;
    const prev = h[idx - steps];
    setHistoryIdx(idx - steps);
    setCurrent(prev);
    setLoading(false);
  }, []);

  const commitAndSnap = useCallback(
    (targetOffset: number, fromScroll: boolean) => {
      snapTargetRef.current = targetOffset;
      setIsSnapping(true);
      setScrollOffset(targetOffset);
      scrollOffsetRef.current = targetOffset;

      setTimeout(() => {
        if (targetOffset >= 1) {
          const current = scrollOffsetRef.current;
          goForward(fromScroll);
          const overflow = Math.max(0, Math.min(1, current - 1));
          scrollOffsetRef.current = overflow;
          setScrollOffset(overflow);
          snapTargetRef.current = 0;
          if (overflow > 0) {
            if (scrollEndTimeoutRef.current) clearTimeout(scrollEndTimeoutRef.current);
            scrollEndTimeoutRef.current = setTimeout(() => {
              scrollEndTimeoutRef.current = null;
              handleScrollEndRef.current();
            }, SCROLL_END_MS);
          }
        } else if (targetOffset <= -1) {
          const { historyIdx: idx } = stateRef.current;
          const steps = Math.min(Math.round(-targetOffset), idx);
          const current = scrollOffsetRef.current;
          goBack(steps, fromScroll);
          const overflow = current - targetOffset;
          snapTargetRef.current = 0;
          if (overflow < 0) {
            const actualMin = -Math.min(idx - steps, MAX_PREV);
            const next = Math.max(actualMin, Math.min(0, overflow));
            scrollOffsetRef.current = next;
            setScrollOffset(next);
            if (scrollEndTimeoutRef.current) clearTimeout(scrollEndTimeoutRef.current);
            scrollEndTimeoutRef.current = setTimeout(() => {
              scrollEndTimeoutRef.current = null;
              handleScrollEndRef.current();
            }, SCROLL_END_MS);
          } else {
            scrollOffsetRef.current = 0;
            setScrollOffset(0);
          }
        } else {
          setScrollOffset(0);
          scrollOffsetRef.current = 0;
          snapTargetRef.current = 0;
        }
        setIsSnapping(false);
      }, SNAP_DURATION_MS);
    },
    [goForward, goBack]
  );

  const animateToNext = useCallback(() => {
    if (!nextUrl) {
      goForward(false);
      return;
    }
    commitAndSnap(1, false);
  }, [nextUrl, goForward, commitAndSnap]);

  const animateToPrev = useCallback(() => {
    if (!canGoBack) return;
    commitAndSnap(-1, false);
  }, [canGoBack, commitAndSnap]);

  const handleScrollEnd = useCallback(() => {
    const offset = scrollOffsetRef.current;
    const { history: h, historyIdx: idx, queue: q } = stateRef.current;
    const hasNext =
      getUrlFrom(h, q, idx + 1) ||
      (idx === h.length - 1 &&
        q.length === 0 &&
        getUrlFrom(h, q, idx) !== LOADING_PLACEHOLDER);

    if (offset >= 0.5 && hasNext) {
      commitAndSnap(1, true);
      return;
    }
    if (offset <= -1.5 && idx >= 2) {
      commitAndSnap(-2, true);
      return;
    }
    if (offset <= -0.5 && idx >= 1) {
      commitAndSnap(-1, true);
      return;
    }
    setIsSnapping(true);
    setScrollOffset(0);
    setTimeout(() => setIsSnapping(false), SNAP_DURATION_MS);
  }, [commitAndSnap]);

  useEffect(() => {
    handleScrollEndRef.current = handleScrollEnd;
  }, [handleScrollEnd]);

  const handleOptionScroll = useCallback(
    (e: React.WheelEvent) => {
      if (!e.altKey) {
        setOptionKeyHeld(false);
        return;
      }
      e.preventDefault();
      e.stopPropagation();
      const delta = e.deltaY * SCROLL_SENSITIVITY;

      if (isSnapping) {
        const target = snapTargetRef.current;
        if (target >= 1) {
          setScrollOffset((prev) => {
            const next = Math.max(1, Math.min(2, prev + delta));
            scrollOffsetRef.current = next;
            return next;
          });
        } else if (target <= -1) {
          const actualMin = -Math.min(stateRef.current.historyIdx, MAX_PREV);
          setScrollOffset((prev) => {
            const next = Math.max(-2, Math.min(-1, prev + delta));
            scrollOffsetRef.current = next;
            return next;
          });
        }
        return;
      }

      setScrollOffset((prev) => {
        const next = Math.max(
          actualMinOffset,
          Math.min(maxOffset, prev + delta)
        );
        scrollOffsetRef.current = next;
        return next;
      });

      if (scrollEndTimeoutRef.current) {
        clearTimeout(scrollEndTimeoutRef.current);
      }
      scrollEndTimeoutRef.current = setTimeout(() => {
        scrollEndTimeoutRef.current = null;
        handleScrollEnd();
      }, SCROLL_END_MS);
    },
    [actualMinOffset, maxOffset, isSnapping, handleScrollEnd]
  );

  useEffect(() => {
    return () => {
      if (scrollEndTimeoutRef.current) {
        clearTimeout(scrollEndTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setShowTutorial(!getSeenTutorial());
  }, []);

  useEffect(() => {
    (async () => {
      const saved =
        typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
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
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        animateToPrev();
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        animateToNext();
      }
    }
    window.addEventListener("keydown", handleKeyDown, true);
    return () => window.removeEventListener("keydown", handleKeyDown, true);
  }, [animateToPrev, animateToNext]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      const target = e.target as HTMLElement;
      if (target.tagName === "INPUT" || target.tagName === "TEXTAREA") return;
      if (e.key === "Alt" || e.key === "Option") setOptionKeyHeld(true);
    }
    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === "Alt" || e.key === "Option") setOptionKeyHeld(false);
    }
    function handleBlur() {
      setOptionKeyHeld(false);
    }
    window.addEventListener("keydown", handleKeyDown, true);
    window.addEventListener("keyup", handleKeyUp, true);
    window.addEventListener("blur", handleBlur);
    return () => {
      window.removeEventListener("keydown", handleKeyDown, true);
      window.removeEventListener("keyup", handleKeyUp, true);
      window.removeEventListener("blur", handleBlur);
    };
  }, []);

  if (!currentUrl) {
    return (
      <div className="flex h-screen items-center justify-center bg-zinc-900 text-white text-lg">
        Loading...
      </div>
    );
  }

  const totalOffset = prevCount + scrollOffset;

  return (
    <div
      ref={focusRef}
      tabIndex={0}
      className="relative flex h-screen flex-col outline-none"
      aria-label="Sitescroll: use arrow keys or Option+scroll to navigate"
    >
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-zinc-900">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-600 border-t-white" />
        </div>
      )}
      {optionKeyHeld && (
        <div
          className="absolute inset-0 z-20 cursor-default"
          onWheel={handleOptionScroll}
          style={{ pointerEvents: "auto" }}
        />
      )}

      <TutorialModal
        open={showTutorial}
        onClose={() => {
          setSeenTutorial();
          setShowTutorial(false);
        }}
      />
      {currentUrl !== LOADING_PLACEHOLDER && (
        <InfoCard currentUrl={currentUrl} />
      )}

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          style={
            {
              "--slide-offset": totalOffset,
              transform: `translateY(calc(var(--slide-offset) * -100vh))`,
              transition: isSnapping
                ? `transform ${SNAP_DURATION_MS}ms cubic-bezier(0.25, 0.1, 0.25, 1)`
                : "none",
            } as React.CSSProperties & { "--slide-offset": number }
          }
        >
          {slideUrls.map((url) => (
            <div
              key={url}
              className="w-full shrink-0"
              style={{ height: SLIDE_HEIGHT }}
            >
              {url === LOADING_PLACEHOLDER ? (
                <div className="flex h-full w-full items-center justify-center bg-zinc-900">
                  <div className="h-8 w-8 animate-spin rounded-full border-2 border-zinc-600 border-t-white" />
                </div>
              ) : (
                <iframe
                  src={url}
                  className="h-full w-full border-none"
                  onLoad={() => {
                    if (url === currentUrl) setLoading(false);
                  }}
                  title={url}
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
