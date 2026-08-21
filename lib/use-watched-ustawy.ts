"use client";

import { useEffect, useState } from "react";

import { useAuthUser } from "@/lib/use-auth-user";
import type { Ustawa } from "@/lib/ustawa";

export type WatchedUstawa = Pick<
  Ustawa,
  "id" | "numer_druku" | "tytul_oficjalny" | "autor" | "data_wplywu" | "etap_legislacyjny"
>;

export function useWatchedUstawy(): { ustawy: WatchedUstawa[]; loading: boolean } {
  const user = useAuthUser();
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
        const response = await fetch("/api/obserwowane-ustawy");

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
  }, [user]);

  return { ustawy, loading };
}
