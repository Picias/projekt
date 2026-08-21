"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, BellRing, Eye, Loader2 } from "lucide-react";

import { loginHref } from "@/lib/profile";
import { useAuthUser } from "@/lib/use-auth-user";
import { formatObserwujacy } from "@/lib/ustawa";

type WatchUstawaButtonProps = {
  ustawaId: number;
  numerDruku: string;
  liczbaObserwujacych: number;
  className?: string;
};

export default function WatchUstawaButton({
  ustawaId,
  numerDruku,
  liczbaObserwujacych,
  className = "",
}: WatchUstawaButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthUser();
  const [watching, setWatching] = useState(false);
  const [obserwujacy, setObserwujacy] = useState(liczbaObserwujacych);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadWatchState() {
      try {
        const response = await fetch(`/api/obserwowane-ustawy?ustawa_id=${ustawaId}`);

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          watching?: boolean;
          liczba_obserwujacych?: number;
        };

        if (!cancelled) {
          setWatching(Boolean(data.watching));

          if (typeof data.liczba_obserwujacych === "number") {
            setObserwujacy(data.liczba_obserwujacych);
          }
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
  }, [ustawaId, user?.id]);

  async function handleToggle() {
    if (pending || user === undefined) {
      return;
    }

    if (!user) {
      router.push(loginHref(pathname));
      return;
    }

    setPending(true);

    try {
      const response = await fetch("/api/obserwowane-ustawy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ustawa_id: ustawaId }),
      });

      if (response.status === 401) {
        router.push(loginHref(pathname));
        return;
      }

      if (!response.ok) {
        return;
      }

      const data = (await response.json()) as {
        watching?: boolean;
        liczba_obserwujacych?: number;
      };

      setWatching(Boolean(data.watching));

      if (typeof data.liczba_obserwujacych === "number") {
        setObserwujacy(data.liczba_obserwujacych);
      }
    } finally {
      setPending(false);
    }
  }

  const busy = loading || pending || user === undefined;

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
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
        } ${busy ? "opacity-60" : ""}`}
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

      <p
        aria-live="polite"
        className="flex items-center justify-center gap-1.5 text-xs font-medium text-white/50"
      >
        <Eye size={13} className="text-emerald-300/70" aria-hidden />
        {formatObserwujacy(obserwujacy)}
      </p>
    </div>
  );
}
