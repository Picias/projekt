"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Bell, Loader2 } from "lucide-react";

import AppToast from "@/components/app-toast";
import { loginHref } from "@/lib/profile";
import {
  SUBSCRIPTIONS_CHANGED_EVENT,
  type SubscriptionTargetType,
} from "@/lib/subscriptions";
import { useAuthUser } from "@/lib/use-auth-user";

type SubscribeButtonProps = {
  targetType: SubscriptionTargetType;
  targetId: number;
  name: string;
  variant?: "icon" | "pill" | "full";
  className?: string;
  onCountChange?: (count: number) => void;
};

export default function SubscribeButton({
  targetType,
  targetId,
  name,
  variant = "pill",
  className = "",
  onCountChange,
}: SubscribeButtonProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthUser();
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: "ok" | "error" } | null>(
    null,
  );
  const onCountChangeRef = useRef(onCountChange);

  useEffect(() => {
    onCountChangeRef.current = onCountChange;
  }, [onCountChange]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;

    async function loadState() {
      try {
        const response = await fetch(
          `/api/subscriptions?target_type=${targetType}&target_id=${targetId}`,
        );

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          subscribed?: boolean;
          liczba_obserwujacych?: number | null;
        };

        if (!cancelled) {
          setSubscribed(Boolean(data.subscribed));

          if (typeof data.liczba_obserwujacych === "number") {
            onCountChangeRef.current?.(data.liczba_obserwujacych);
          }
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadState();

    return () => {
      cancelled = true;
    };
  }, [targetId, targetType, user?.id]);

  async function handleToggle(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();

    if (pending || user === undefined) {
      return;
    }

    if (!user) {
      router.push(loginHref(pathname));
      return;
    }

    setPending(true);

    try {
      const response = await fetch(
        subscribed
          ? `/api/subscriptions?target_type=${targetType}&target_id=${targetId}`
          : "/api/subscriptions",
        {
          method: subscribed ? "DELETE" : "POST",
          headers: { "Content-Type": "application/json" },
          body: subscribed
            ? undefined
            : JSON.stringify({ target_type: targetType, target_id: targetId }),
        },
      );

      if (response.status === 401) {
        router.push(loginHref(pathname));
        return;
      }

      if (!response.ok) {
        setToast({
          tone: "error",
          message: "Nie udało się zapisać obserwacji.",
        });
        return;
      }

      const data = (await response.json()) as {
        subscribed?: boolean;
        liczba_obserwujacych?: number | null;
      };
      const nextSubscribed = Boolean(data.subscribed);
      setSubscribed(nextSubscribed);
      window.dispatchEvent(new Event(SUBSCRIPTIONS_CHANGED_EVENT));

      if (typeof data.liczba_obserwujacych === "number") {
        onCountChangeRef.current?.(data.liczba_obserwujacych);
      }

      const noun = targetType === "posel" ? "posła" : "ustawę";
      setToast({
        tone: "ok",
        message: nextSubscribed
          ? `Obserwujesz ${noun}: ${name}`
          : `Usunięto z obserwowanych: ${name}`,
      });
    } catch {
      setToast({
        tone: "error",
        message: "Nie udało się zapisać obserwacji.",
      });
    } finally {
      setPending(false);
    }
  }

  const busy = loading || pending || user === undefined;
  const label = subscribed ? "Obserwujesz" : "Obserwuj";
  const ariaLabel = subscribed
    ? `Przestań obserwować: ${name}`
    : `Obserwuj: ${name}`;

  const icon = pending ? (
    <Loader2 size={16} className="animate-spin" aria-hidden />
  ) : (
    <Bell
      size={16}
      strokeWidth={2}
      className={subscribed ? "fill-current" : ""}
      aria-hidden
    />
  );

  const variantClass =
    variant === "icon"
      ? `flex size-11 items-center justify-center rounded-full ${
          subscribed
            ? "bg-sejm-green text-white"
            : "bg-navy-900/80 text-white/70 ring-1 ring-white/15 hover:bg-white/15 hover:text-white"
        }`
      : variant === "full"
        ? `flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-base font-semibold ${
            subscribed
              ? "bg-green-700 text-white hover:bg-green-800"
              : "bg-white/10 text-white ring-1 ring-emerald-400/40 hover:bg-white/15"
          }`
        : `inline-flex min-h-11 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold ${
            subscribed
              ? "bg-green-700 text-white"
              : "bg-white/10 text-white ring-1 ring-white/15 hover:bg-white/15"
          }`;

  return (
    <>
      <button
        type="button"
        onClick={handleToggle}
        disabled={busy}
        aria-pressed={subscribed}
        aria-label={ariaLabel}
        className={`transition-colors ${variantClass} ${busy ? "opacity-60" : ""} ${className}`}
      >
        {icon}
        {variant === "icon" ? (
          <span className="sr-only">{label}</span>
        ) : (
          <span>{label}</span>
        )}
      </button>
      <AppToast message={toast?.message ?? null} tone={toast?.tone} />
    </>
  );
}
