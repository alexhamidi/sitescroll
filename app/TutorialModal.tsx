"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

const TUTORIAL_KEY = "sitescroll-seen-tutorial";

export function getSeenTutorial(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(TUTORIAL_KEY) === "1";
}

export function setSeenTutorial() {
  if (typeof window !== "undefined") {
    localStorage.setItem(TUTORIAL_KEY, "1");
  }
}

type TutorialModalProps = {
  open: boolean;
  onClose: () => void;
};

export default function TutorialModal({ open, onClose }: TutorialModalProps) {
  const [addUrl, setAddUrl] = useState("");
  const [addStatus, setAddStatus] = useState<"idle" | "sending" | "done">("idle");
  const transition = { type: "spring" as const, stiffness: 400, damping: 28 };

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

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={transition}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
            onClick={onClose}
          />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              key="tutorial"
              initial={{ opacity: 0, scale: 0.94, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94, y: 8 }}
              transition={transition}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl border-2 border-amber-200/80 bg-amber-50/95 px-6 py-6 shadow-xl shadow-amber-900/10 font-[family-name:var(--font-nunito)]"
              style={{
                backdropFilter: "blur(12px)",
                WebkitBackdropFilter: "blur(12px)",
              }}
            >
              <h2 className="mb-4 text-lg font-semibold text-stone-800">
                Welcome
              </h2>
              <p className="mb-4 text-base leading-relaxed text-stone-600">
                Browsing personal sites is a great way to discover people & learn things. However,
                they&apos;re way too hard to discover. So I crawled a million
                of them so you can doomscroll!
              </p>
              <div className="mb-4 space-y-2 text-sm text-stone-600">
                <p className="font-medium text-stone-700">How to use</p>
                <p>Arrow keys or Option + vertical scroll to move between sites.</p>

                <p > Next to each site you’ll see{" "}
                  <i className="fa-slab fa-regular fa-thumbs-down fa-sm align-middle scale-x-[-1]" aria-hidden />{" "}
                  and{" "}
                  <i className="fa-slab fa-regular fa-thumbs-up fa-sm align-middle" aria-hidden />.
                  Thumbs down for generic, boring, or low-effort sites. Thumbs up for distinctive, interesting, or exceptional ones.
                </p>
              </div>
              <div className="mb-4">
                <label className="mb-1.5 block text-sm font-medium text-stone-700">
                  Add your site
                </label>
                <input
                  type="text"
                  value={addUrl}
                  onChange={(e) => setAddUrl(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && submitAdd()}
                  placeholder="https://yoursite.com"
                  className="w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3 text-[15px] text-stone-800 placeholder-stone-400 outline-none transition-colors focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
                />
                {addStatus === "done" && (
                  <span className="mt-1.5 block text-sm font-medium text-green-600">added</span>
                )}
              </div>
              <p className="mb-4 text-sm text-stone-600">
                Want to add more or report issues? Use the actions in the bottom right.
              </p>
              <button
                onClick={onClose}
                className="w-full rounded-xl border-2 border-amber-200 bg-amber-100 px-4 py-3 text-[15px] font-medium text-stone-700 transition-colors hover:bg-amber-200"
              >
                Get started
              </button>
            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  );
}
