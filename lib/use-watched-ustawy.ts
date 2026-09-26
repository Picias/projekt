"use client";

import { useEffect, useState } from "react";

import { SUBSCRIPTIONS_CHANGED_EVENT } from "@/lib/subscriptions";
import { useAuthUser } from "@/lib/use-auth-user";
import type { Ustawa } from "@/lib/ustawa";

export type WatchedUstawa = Pick<
  Ustawa,
  "id" | "numer_druku" | "tytul_oficjalny" | "autor" | "data_wplywu" | "etap_legislacyjny"
> &
  Partial<Pick<Ustawa, "tagi">>;

/** Licznik zmian obserwacji — każde kliknięcie dzwonka wymusza ponowny odczyt list. */
export function useSubscriptionsVersion(): number {
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const bump = () => setVersion((value) => value + 1);
    window.addEventListener(SUBSCRIPTIONS_CHANGED_EVENT, bump);
    return () => window.removeEventListener(SUBSCRIPTIONS_CHANGED_EVENT, bump);
  }, []);

  return version;
}

export function useWatchedUstawy(): { ustawy: WatchedUstawa[]; loading: boolean } {
  const user = useAuthUser();
  const version = useSubscriptionsVersion();
  const [ustawy, setUstawy] = useState<WatchedUstawa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadWatched() {
      if (user === undefined) {
        return;
      }

      if (!user) {
        if (!cancelled) {
          setUstawy([]);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await fetch("/api/obserwowane-ustawy", { cache: "no-store" });

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { ustawy?: WatchedUstawa[] };

        if (!cancelled) {
          setUstawy(data.ustawy ?? []);
        }
      } catch {
        // Nieudany odczyt zostawia pustą listę — pokażemy stan „nic nie śledzisz”.
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadWatched();

    return () => {
      cancelled = true;
    };
  }, [user, version]);

  return { ustawy, loading };
}
