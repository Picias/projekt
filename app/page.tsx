import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import { CalendarDays, ChevronRight, Radio, UserRound } from "lucide-react";
import DecyzjaDniaCard, { DecyzjaDniaSkeleton } from "@/components/decyzja-dnia";
import HotUstawy, { HotUstawySkeleton } from "@/components/hot-ustawy";
import JakPowstajeUstawa from "@/components/jak-powstaje-ustawa";
import MojKanal from "@/components/moj-kanal";
import MojOkreg from "@/components/moj-okreg";
import {
  fetchNextPosiedzenie,
  formatPosiedzenieRange,
  getCountdownLabel,
  isOngoing,
  todayIso,
} from "@/lib/posiedzenia";

// Badge "za X dni" i „Decyzja dnia” liczą się względem dzisiejszej daty,
// więc strona musi być renderowana na żądanie, a nie zapiekana w buildzie.
export const dynamic = "force-dynamic";

async function SessionStrip() {
  const posiedzenie = await fetchNextPosiedzenie();

  if (!posiedzenie) {
    return (
      <Link
        href="/obrady"
        className="flex min-h-12 items-center gap-3 rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-sm text-white/80 shadow-lg shadow-navy-950/20 backdrop-blur-md"
      >
        <CalendarDays size={18} className="shrink-0 text-emerald-300" aria-hidden />
        <span className="flex-1">Sprawdź kalendarz posiedzeń Sejmu</span>
        <ChevronRight size={18} className="shrink-0 text-white/60" aria-hidden />
      </Link>
    );
  }

  const today = todayIso();
  const live = isOngoing(posiedzenie, today);
  const dateLabel = formatPosiedzenieRange(
    posiedzenie.data_rozpoczecia,
    posiedzenie.data_zakonczenia,
  );

  return (
    <Link
      href="/obrady"
      className={`group flex min-h-14 items-center gap-3 rounded-2xl border px-4 py-3 shadow-lg backdrop-blur-md transition-colors ${
        live
          ? "border-red-300/30 bg-red-600/15 shadow-red-950/20 hover:bg-red-600/25"
          : "border-white/10 bg-white/10 shadow-navy-950/20 hover:bg-white/15"
      }`}
    >
      {live ? (
        <Radio size={20} className="shrink-0 text-red-300" aria-hidden />
      ) : (
        <CalendarDays size={20} className="shrink-0 text-emerald-300" aria-hidden />
      )}
      <span className="min-w-0 flex-1">
        <span className="block text-base font-bold text-white">
          {live ? "Sejm obraduje teraz" : `Posiedzenie Sejmu ${getCountdownLabel(posiedzenie, today).toLowerCase()}`}
        </span>
        <span className="block text-sm text-white/75">
          {live ? "Oglądaj transmisję i porządek obrad" : dateLabel}
        </span>
      </span>
      <ChevronRight
        size={18}
        className="shrink-0 text-white/60 transition-transform group-hover:translate-x-0.5"
        aria-hidden
      />
    </Link>
  );
}

function SessionStripSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Ładowanie informacji o posiedzeniu"
      className="h-16 animate-pulse rounded-2xl bg-white/10"
    />
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-col gap-12 px-5 pb-10">
      <header className="relative -mx-5 overflow-hidden px-5 pb-8 pt-5">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-linear-to-b from-[#1a3348] via-navy-800/80 to-navy-900"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute -right-20 -top-24 size-64 rounded-full bg-sejm-green/20 blur-3xl"
        />

        <div className="relative flex flex-col gap-6">
          <div className="flex items-center justify-between gap-3">
          <Image
            src="/logo.png"
            alt="SejmON"
            width={120}
            height={80}
            preload
            className="h-auto w-24 object-contain"
          />
          <Link
            href="/wiecej"
            aria-label="Twój profil i ustawienia"
            className="flex size-11 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/20 transition-colors hover:bg-white/15"
          >
            <UserRound size={20} aria-hidden />
          </Link>
          </div>

          <div>
          <h1 className="text-2xl font-semibold leading-snug text-balance text-white">
            Co dziś decyduje się na Wiejskiej?
          </h1>
          <p className="mt-2 text-sm leading-relaxed text-white/70">
            Zobacz, jak prawo zmieni Twoje życie — i zabierz głos.
          </p>
          </div>

          <Suspense fallback={<SessionStripSkeleton />}>
            <SessionStrip />
          </Suspense>
        </div>
      </header>

      <Suspense fallback={<DecyzjaDniaSkeleton />}>
        <DecyzjaDniaCard />
      </Suspense>

      <MojOkreg />

      <MojKanal />

      <Suspense fallback={<HotUstawySkeleton />}>
        <HotUstawy />
      </Suspense>

      <JakPowstajeUstawa />
    </div>
  );
}
