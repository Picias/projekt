"use client";

import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";

import { createBrowserSupabase } from "@/lib/supabase-browser";

/**
 * undefined — sesja jeszcze się ładuje, null — gość, User — zalogowany.
 */
export function useAuthUser(): User | null | undefined {
  const [user, setUser] = useState<User | null | undefined>(undefined);

  useEffect(() => {
    const supabase = createBrowserSupabase();
    let cancelled = false;

    supabase.auth.getUser().then(({ data }) => {
      if (!cancelled) {
        setUser(data.user);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!cancelled) {
        setUser(session?.user ?? null);
      }
    });

    return () => {
      cancelled = true;
      subscription.unsubscribe();
    };
  }, []);

  return user;
}
