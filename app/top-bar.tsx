"use client";

import { useRouter } from "next/navigation";

export default function TopBar({ name }: { name: string }) {
  const router = useRouter();

  return (
    <div className="flex h-11 items-center justify-between bg-zinc-900 px-5">
      <span className="text-sm font-medium text-white">{name}</span>
      <button
        onClick={() => router.refresh()}
        className="rounded-md bg-zinc-700 px-3 py-1 text-sm text-white transition-colors hover:bg-zinc-600"
      >
        Randomize
      </button>
    </div>
  );
}
