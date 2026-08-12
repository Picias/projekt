"use client";

import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { getAnonymousUserId } from "@/lib/anonymous-user";

type WatchMpButtonProps = {
  poselId: number;
  poselName: string;
  className?: string;
};

export default function WatchMpButton({
  poselId,
  poselName,
  className = "",
}: WatchMpButtonProps) {
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
          `/api/obserwowani?user_id=${encodeURIComponent(userId)}&posel_id=${poselId}`,
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
  }, [poselId]);

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
      const response = await fetch("/api/obserwowani", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: userId, posel_id: poselId }),
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

  return (
    <button
      type="button"
      aria-label={
        watching
          ? `Przestań obserwować ${poselName}`
          : `Obserwuj ${poselName}`
      }
      aria-pressed={watching}
      disabled={loading || pending}
      onClick={handleToggle}
      className={`flex size-10 items-center justify-center rounded-full transition-colors ${
        watching
          ? "bg-red-500/20 text-red-400 ring-1 ring-red-400/40"
          : "bg-white/10 text-white/50 ring-1 ring-white/15 hover:bg-white/15 hover:text-red-300"
      } ${loading || pending ? "opacity-60" : ""} ${className}`}
    >
      <Heart
        size={18}
        strokeWidth={2}
        className={watching ? "fill-current" : ""}
        aria-hidden
      />
    </button>
  );
}
