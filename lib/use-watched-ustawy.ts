"use client";

import { useEffect, useState } from "react";

import { getAnonymousUserId } from "@/lib/anonymous-user";
import type { Ustawa } from "@/lib/ustawa";

export type WatchedUstawa = Pick<
  Ustawa,
  "id" | "numer_druku" | "tytul_oficjalny" | "autor" | "data_wplywu" | "etap_legislacyjny"
>;

/**
 * Tożsamość użytkownika żyje w localStorage, więc listę obserwowanych druków
 * można pobrać dopiero po stronie klienta.
 */
export function useWatchedUstawy(): { ustawy: WatchedUstawa[]; loading: boolean } {
  const [ustawy, setUstawy] = useState<WatchedUstawa[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadWatched() {
      const userId = getAnonymousUserId();

      if (!userId) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      try {
        const response = await fetch(
          `/api/obserwowane-ustawy?user_id=${encodeURIComponent(userId)}`,
        );

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
  }, []);

  return { ustawy, loading };
}
