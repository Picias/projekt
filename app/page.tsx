import Image from "next/image";
import Link from "next/link";
import { Suspense } from "react";
import {
  CalendarDays,
  ChevronRight,
  ScrollText,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import HomeWatchedUstawy from "@/components/home-watched-ustawy";
import HotUstawy, { HotUstawySkeleton } from "@/components/hot-ustawy";
import WatchedMpsSection from "@/components/watched-mps-section";
import {
  fetchNextPosiedzenie,
  formatPosiedzenieRange,
  getCountdownLabel,
  getPosiedzenieName,
  todayIso,
} from "@/lib/posiedzenia";

// Badge "za X dni" liczy się względem dzisiejszej daty, więc strona
// musi być renderowana na żądanie, a nie zapiekana w czasie builda.
export const dynamic = "force-dynamic";

type QuickLink = {
  href: string;
  label: string;
  icon: LucideIcon;
};

// Skróty dublują dolną nawigację, więc są tu tylko wąskim pasem ikon.
const QUICK_LINKS: QuickLink[] = [
  { href: "/poslowie", label: "Posłowie", icon: Users },
  { href: "/ustawy", label: "Ustawy", icon: ScrollText },
  { href: "/kalendarz", label: "Kalendarz", icon: CalendarDays },
];

async function NextSessionHero() {
  const posiedzenie = await fetchNextPosiedzenie();

  if (!posiedzenie) {
    return (
      <article className="rounded-3xl border border-white/10 bg-navy-800/60 p-5">
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
          Najbliższe posiedzenie Sejmu
        </p>
        <p className="mt-3 text-sm leading-relaxed text-white/60">
          Brak zaplanowanych posiedzeń w bazie. Uruchom synchronizację pod adresem{" "}
          <Link href="/api/sync-sessions" className="text-sejm-green-light hover:underline">
            /api/sync-sessions
          </Link>
          .
        </p>
      </article>
    );
  }

  const today = todayIso();
  const countdown = getCountdownLabel(posiedzenie, today);
  const dateLabel = formatPosiedzenieRange(
    posiedzenie.data_rozpoczecia,
    posiedzenie.data_zakonczenia,
  );

  return (
    <Link
      href="/obrady"
      className="group relative block overflow-hidden rounded-3xl border border-sejm-green/25 bg-linear-to-br from-navy-800 via-navy-800 to-sejm-green/20 p-5 shadow-xl shadow-navy-950/50 transition-colors hover:border-sejm-green/50"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-12 -top-14 size-44 rounded-full bg-sejm-green/20 blur-3xl"
      />

      <div className="relative flex items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-sejm-green-light">
          <span className="size-1.5 shrink-0 rounded-full bg-sejm-green-light" aria-hidden />
          Najbliższe posiedzenie
        </p>
        <span className="shrink-0 rounded-full bg-sejm-green px-3 py-1 text-[10px] font-bold uppercase tracking-wide text-white shadow-lg shadow-sejm-green/25">
          {countdown}
        </span>
      </div>

      <h2 className="relative mt-4 text-2xl font-bold leading-tight">
        {getPosiedzenieName(posiedzenie)}
      </h2>

      <p className="relative mt-2 flex items-center gap-2 text-sm font-medium text-white/75">
        <CalendarDays size={15} className="shrink-0 text-sejm-green-light" aria-hidden />
        {dateLabel}
      </p>

      <p className="relative mt-3 line-clamp-2 text-xs leading-relaxed text-white/45">
        {posiedzenie.tytul}
      </p>

      <span className="relative mt-4 inline-flex items-center gap-1 text-xs font-semibold text-sejm-green-light">
        Zobacz harmonogram obrad
        <ChevronRight
          size={14}
          className="transition-transform group-hover:translate-x-0.5"
          aria-hidden
        />
      </span>
    </Link>
  );
}

function NextSessionHeroSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Ładowanie informacji o posiedzeniu"
      className="h-52 animate-pulse rounded-3xl bg-white/10"
    />
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-col gap-8 px-5 pb-4 pt-5">
      <header className="flex flex-col gap-6">
        <div className="flex justify-end">
          <Link
            href="/wiecej"
            aria-label="Twój profil"
            className="flex size-9 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/15 transition-colors hover:bg-white/15"
          >
            <UserRound size={18} aria-hidden />
          </Link>
        </div>

        <div className="flex flex-col items-center text-center">
          <Image
            src="/logo.png"
            alt="SejmON"
            width={192}
            height={128}
            preload
            className="h-auto w-48 object-contain"
          />
          <p className="mt-4 text-sm font-medium text-white/70">
            Włącz się w decyzje
          </p>
        </div>
      </header>

      <Suspense fallback={<NextSessionHeroSkeleton />}>
        <NextSessionHero />
      </Suspense>

      <nav aria-label="Szybkie skróty" className="grid grid-cols-3 gap-3">
        {QUICK_LINKS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className="flex flex-col items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/5 px-2 py-3.5 text-white/80 transition-colors hover:border-sejm-green/35 hover:bg-white/10 hover:text-white"
          >
            <Icon size={26} strokeWidth={1.8} className="text-sejm-green-light" aria-hidden />
            <span className="text-xs font-semibold leading-none">{label}</span>
          </Link>
        ))}
      </nav>

      <WatchedMpsSection />

      <HomeWatchedUstawy />

      <Suspense fallback={<HotUstawySkeleton />}>
        <HotUstawy />
      </Suspense>
    </div>
  );
}
