"use client";

import { useEffect, useState } from "react";
import { Bell, BellRing, Loader2 } from "lucide-react";

import { getAnonymousUserId } from "@/lib/anonymous-user";

type WatchUstawaButtonProps = {
  ustawaId: number;
  numerDruku: string;
  className?: string;
};

export default function WatchUstawaButton({
  ustawaId,
  numerDruku,
  className = "",
}: WatchUstawaButtonProps) {
  const [watching, setWatching] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadWatchState() {
      const userId = getAnonymousUserId();

      if (!userId) {
        setLoading(false);
        return;
      }

      try {
        const response = await fetch(
          `/api/obserwowane-ustawy?user_id=${encodeURIComponent(userId)}&ustawa_id=${ustawaId}`,
        );

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { watching?: boolean };

        if (!cancelled) {
          setWatching(Boolean(data.watching));
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadWatchState();

    return () => {
      cancelled = true;
    };
  }, [ustawaId]);

  async function handleToggle() {
    if (pending) {
      return;
    }

    const userId = getAnonymousUserId();

    if (!userId) {
      return;
    }

    setPending(true);

    try {
      const response = await fetch("/api/obserwowane-ustawy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, ustawa_id: ustawaId }),
      });

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as { watching?: boolean };
      setWatching(Boolean(data.watching));
    } finally {
      setPending(false);
    }
  }

  const busy = loading || pending;

  return (
    <button
      type="button"
      onClick={handleToggle}
      disabled={busy}
      aria-pressed={watching}
      aria-label={
        watching
          ? `Przestań śledzić druk ${numerDruku}`
          : `Śledź druk ${numerDruku}`
      }
      className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-semibold transition-colors ${
        watching
          ? "bg-sejm-green text-white hover:bg-sejm-green/85"
          : "bg-white/10 text-white ring-1 ring-emerald-400/30 hover:bg-white/15"
      } ${busy ? "opacity-60" : ""} ${className}`}
    >
      {pending ? (
        <Loader2 size={16} className="animate-spin" aria-hidden />
      ) : watching ? (
        <BellRing size={16} aria-hidden />
      ) : (
        <Bell size={16} aria-hidden />
      )}
      {watching ? "Śledzisz tę ustawę" : "Śledź / Obserwuj"}
    </button>
  );
}
