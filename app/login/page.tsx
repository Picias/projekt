import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft, Landmark } from "lucide-react";

import LoginForm from "@/components/login-form";
import { isOnboardingComplete, safeNextPath, type Profile } from "@/lib/profile";
import { createServerSupabase } from "@/lib/supabase-server";

export const metadata = {
  title: "Logowanie — SEJM ON",
};

type LoginPageProps = {
  searchParams: Promise<{ next?: string }>;
};

function LoginFormFallback() {
  return <div className="h-72 animate-pulse rounded-2xl bg-white/10" aria-busy="true" />;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const { next } = await searchParams;
  const nextPath = safeNextPath(next);
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data } = await supabase.from("profile").select("*").eq("id", user.id).maybeSingle();
    const destination = isOnboardingComplete((data as Profile | null) ?? null)
      ? nextPath
      : nextPath === "/"
        ? "/onboarding"
        : `/onboarding?next=${encodeURIComponent(nextPath)}`;
    redirect(destination);
  }

  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <Link
        href="/"
        className="flex w-fit items-center gap-1 text-sm text-white/70 transition-colors hover:text-white"
      >
        <ChevronLeft size={18} aria-hidden />
        Wróć na start
      </Link>

      <header className="flex flex-col items-center text-center">
        <span className="flex size-14 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300 ring-1 ring-emerald-400/25">
          <Landmark size={26} strokeWidth={1.8} aria-hidden />
        </span>
        <h1 className="mt-4 text-2xl font-bold">Witaj w SEJM ON</h1>
        <p className="mt-2 max-w-sm text-sm leading-relaxed text-white/55">
          Zaloguj się, żeby głosować nad ustawami, śledzić druki i zbudować swój
          publiczny profil obywatelski.
        </p>
      </header>

      <Suspense fallback={<LoginFormFallback />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
