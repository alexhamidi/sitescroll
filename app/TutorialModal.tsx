"use client";

import { motion } from "motion/react";
import { useState } from "react";

const TUTORIAL_KEY = "sitescroll-seen-tutorial";
const UPDATE_KEY = "sitescroll-seen-update-v1";

export function getSeenTutorial(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(TUTORIAL_KEY) === "1";
}

export function setSeenTutorial() {
  if (typeof window !== "undefined") {
    localStorage.setItem(TUTORIAL_KEY, "1");
  }
}

export function getSeenUpdate(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(UPDATE_KEY) === "1";
}

export function setSeenUpdate() {
  if (typeof window !== "undefined") {
    localStorage.setItem(UPDATE_KEY, "1");
  }
}

type ModalProps = {
  open: boolean;
  onClose: () => void;
};

const transition = { type: "spring" as const, stiffness: 400, damping: 28 };

function ModalShell({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <>
      <div
        className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        onClick={onClose}
        role="presentation"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={transition}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-md rounded-2xl border-2 border-amber-200/80 bg-amber-50/95 px-6 py-6 shadow-xl shadow-amber-900/10 font-[family-name:var(--font-nunito)]"
          style={{ backdropFilter: "blur(12px)", WebkitBackdropFilter: "blur(12px)" }}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 flex h-7 w-7 items-center justify-center rounded-full text-stone-400 transition-colors hover:bg-stone-200 hover:text-stone-600"
            aria-label="Close"
          >
            <i className="fa-solid fa-xmark" />
          </button>
          {children}
        </motion.div>
      </div>
    </>
  );
}

export function WelcomeModal({ open, onClose }: ModalProps) {
  if (!open) return null;
  return (
    <ModalShell onClose={onClose}>
      <h2 className="mb-4 text-lg font-semibold text-stone-800">Welcome</h2>
      <p className="mb-4 text-base leading-relaxed text-stone-600">
        Browsing personal sites is a great way to discover people & learn things. However,
        they&apos;re way too hard to discover. So I crawled a million
        of them so you can doomscroll!
      </p>
      <div className="mb-6 space-y-2 text-sm text-stone-600">
        <p className="font-medium text-stone-700">How to use</p>
        <ul className="list-disc list-inside space-y-1 pl-1">
          <li><strong>Option+left</strong> — swipe left (don&apos;t like)</li>
          <li><strong>Option+right</strong> — swipe right (like)</li>
          <li><strong>Option+down</strong> — next (no vote). Same: Option+scroll down.</li>
          <li><strong>Option+up</strong> — previous. Same: Option+scroll up.</li>
        </ul>
      </div>
      <button
        onClick={onClose}
        className="w-full rounded-xl border-2 border-amber-200 bg-amber-100 px-4 py-3 text-[15px] font-medium text-stone-700 transition-colors hover:bg-amber-200"
      >
        Let&apos;s Go!
      </button>
    </ModalShell>
  );
}

export function UpdateModal({ open, onClose }: ModalProps) {
  const [usedSave, setUsedSave] = useState<"yes" | "no" | null>(null);
  const [feedback, setFeedback] = useState("");
  const [submitStatus, setSubmitStatus] = useState<"idle" | "sending" | "done">("idle");

  async function handleClose() {
    if (submitStatus === "idle" && usedSave) {
      setSubmitStatus("sending");
      try {
        await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            url: "survey",
            message: `SURVEY — used save: ${usedSave} | feedback: ${feedback.trim() || "none"}`,
          }),
        });
      } catch {}
      setSubmitStatus("done");
    }
    onClose();
  }

  if (!open) return null;
  return (
    <ModalShell onClose={handleClose}>
      <h2 className="mb-4 text-lg font-semibold text-stone-800">What&apos;s New</h2>

      <div className="mb-4">
        <p className="mb-2 text-sm font-medium italic text-stone-700">Update — March 4</p>
        <ul className="space-y-1 text-sm text-stone-600">
          <li>— Adjusted to 100k curated sites</li>
          <li>— Improved detection for broken and non-personal sites</li>
          <li>— Better algorithm for recommending profiles</li>
          <li>— Updated UX</li>
          <li>— Added full names to site data</li>
        </ul>
      </div>

      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium text-stone-700">Optional survey</p>
        <div>
          <label className="mb-1.5 block text-sm text-stone-600">Have you used the save feature?</label>
          <div className="flex gap-2">
            {(["yes", "no"] as const).map((opt) => (
              <button
                key={opt}
                type="button"
                onClick={() => setUsedSave(opt)}
                className={`flex-1 rounded-xl border-2 py-2 text-sm font-medium transition-colors ${
                  usedSave === opt
                    ? "border-amber-400 bg-amber-200 text-stone-800"
                    : "border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
                }`}
              >
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="mb-1.5 block text-sm text-stone-600">Feedback</label>
          <input
            type="text"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleClose()}
            placeholder="Suggestions, bugs, anything..."
            className="w-full rounded-xl border-2 border-stone-200 bg-white px-4 py-3 text-[15px] text-stone-800 placeholder-stone-400 outline-none transition-colors focus:border-amber-400 focus:ring-2 focus:ring-amber-200"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={handleClose}
        disabled={submitStatus === "sending"}
        className="mt-4 w-full rounded-xl border-2 border-amber-200 bg-amber-100 px-4 py-3 text-[15px] font-medium text-stone-700 transition-colors hover:bg-amber-200 disabled:opacity-50"
      >
        Let&apos;s Go!
      </button>
    </ModalShell>
  );
}

export default function TutorialModal({ open, onClose }: ModalProps) {
  return <WelcomeModal open={open} onClose={onClose} />;
}
