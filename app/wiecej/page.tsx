"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronLeft, Loader2, LogIn, LogOut, UserRound } from "lucide-react";

import { useAuthUser } from "@/lib/use-auth-user";
import { createBrowserSupabase } from "@/lib/supabase-browser";

export default function WiecejPage() {
  const router = useRouter();
  const user = useAuthUser();
  const [pending, setPending] = useState(false);

  async function handleLogout() {
    setPending(true);
    const supabase = createBrowserSupabase();
    await supabase.auth.signOut();
    router.refresh();
    setPending(false);
  }

  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <Link
        href="/"
        className="flex w-fit items-center gap-1 text-sm text-white/70 transition-colors hover:text-white"
      >
        <ChevronLeft size={18} aria-hidden />
        Wróć
      </Link>

      <h1 className="text-3xl font-bold leading-tight">Więcej</h1>

      <section className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
        <div className="flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
            <UserRound size={20} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-semibold">Twoje konto</h2>
            <p className="truncate text-xs text-white/50">
              {user === undefined
                ? "Sprawdzanie sesji..."
                : user
                  ? user.email
                  : "Jesteś niezalogowany"}
            </p>
          </div>
        </div>

        {user === undefined ? (
          <div className="mt-4 h-12 animate-pulse rounded-xl bg-white/10" aria-busy="true" />
        ) : user ? (
          <div className="mt-4 flex flex-col gap-2">
            <Link
              href="/onboarding"
              className="rounded-xl bg-white/5 px-4 py-3 text-center text-sm font-semibold text-white ring-1 ring-white/10 hover:bg-white/10"
            >
              Edytuj profil demograficzny
            </Link>
            <button
              type="button"
              onClick={handleLogout}
              disabled={pending}
              className="flex items-center justify-center gap-2 rounded-xl bg-white/5 px-4 py-3 text-sm font-semibold text-white/80 ring-1 ring-white/10 hover:bg-white/10 disabled:opacity-60"
            >
              {pending ? (
                <Loader2 size={16} className="animate-spin" aria-hidden />
              ) : (
                <LogOut size={16} aria-hidden />
              )}
              Wyloguj się
            </button>
          </div>
        ) : (
          <Link
            href="/login"
            className="mt-4 flex items-center justify-center gap-2 rounded-xl bg-sejm-green px-4 py-3 text-sm font-semibold text-white hover:bg-sejm-green/85"
          >
            <LogIn size={16} aria-hidden />
            Zaloguj się / Załóż konto
          </Link>
        )}
      </section>

      <div className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
        <p className="text-sm leading-relaxed text-white/70">
          Słowniczek pojęć sejmowych, powiadomienia i informacje o aplikacji pojawią
          się w kolejnych odsłonach.
        </p>
      </div>
    </div>
  );
}
