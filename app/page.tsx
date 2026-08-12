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
import SejmOnLogo from "@/components/sejm-on-logo";
import WatchedMpsSection from "@/components/watched-mps-section";
import {
  fetchNextProceeding,
  formatProceedingDate,
  getProceedingCountdownLabel,
} from "@/lib/sejm";
type QuickLink = {
  href: string;
  label: string;
  icon: LucideIcon;
  span?: "full";
};

const QUICK_LINKS: QuickLink[] = [
  { href: "/ustawy", label: "Śledzone ustawy", icon: ScrollText },
  { href: "/kalendarz", label: "Kalendarz obrad", icon: CalendarDays },
  { href: "/poslowie", label: "Posłowie", icon: Users, span: "full" },
];

const LEGISLATIVE_STAGES = [
  "Projekt",
  "Komisja",
  "Sejm",
  "Senat",
] as const;

const TRACKED_BILLS = [
  {
    title: "Ustawa o rachunkowości",
    category: "Podatki",
    voteLabel: "Głosowanie: za 4 dni",
    status: "W toku legislacyjnym",
    activeStage: 1,
  },
  {
    title: "Prawo zamówień publicznych",
    category: "Gospodarka",
    voteLabel: "Głosowanie: za 12 dni",
    status: "Prace w komisji",
    activeStage: 2,
  },
];

async function NextSessionCard() {
  const proceeding = await fetchNextProceeding();

  if (!proceeding) {
    return (
      <article className="rounded-2xl border border-white/15 bg-navy-800 p-4 shadow-lg ring-1 ring-sejm-green/20">
        <p className="text-xs font-semibold uppercase tracking-wider text-sejm-green-light">
          Najbliższe posiedzenie
        </p>
        <p className="mt-2 text-sm text-white/70">
          Brak danych o terminie posiedzenia Sejmu.
        </p>
      </article>
    );
  }

  const countdown = getProceedingCountdownLabel(proceeding);
  const dateLabel =
    proceeding.startDate === proceeding.endDate
      ? formatProceedingDate(proceeding.startDate)
      : `${formatProceedingDate(proceeding.startDate)} – ${formatProceedingDate(proceeding.endDate)}`;

  return (
    <Link
      href="/obrady"
      className="block overflow-hidden rounded-2xl border border-sejm-green/30 bg-linear-to-br from-navy-800 via-navy-800 to-sejm-green/20 p-4 shadow-lg ring-1 ring-sejm-green/25 transition-shadow hover:shadow-xl"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-wider text-sejm-green-light">
            Najbliższe posiedzenie Sejmu
          </p>
          <h3 className="mt-2 text-lg font-bold leading-snug">
            {proceeding.number}. posiedzenie
          </h3>
          <p className="mt-1 text-sm text-white/75">{dateLabel}</p>
        </div>
        <span className="flex shrink-0 flex-col items-center rounded-xl bg-sejm-green px-3 py-2 text-center">
          <CalendarDays size={18} className="text-white" aria-hidden />
          <span className="mt-1 text-[10px] font-bold uppercase leading-none text-white">
            {countdown}
          </span>
        </span>
      </div>
      <p className="mt-3 line-clamp-2 text-xs text-white/55">{proceeding.title}</p>
    </Link>
  );
}

function NextSessionCardSkeleton() {
  return (
    <article
      aria-busy="true"
      aria-label="Ładowanie informacji o posiedzeniu"
      className="h-36 animate-pulse rounded-2xl bg-white/10"
    />
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex justify-end px-5 pt-5">
        <Link
          href="/wiecej"
          aria-label="Twój profil"
          className="flex size-9 items-center justify-center rounded-xl bg-white/10 text-white ring-1 ring-white/15 transition-colors hover:bg-white/15"
        >
          <UserRound size={18} aria-hidden />
        </Link>
      </header>

      <section className="px-5 pb-1">
        <SejmOnLogo />
      </section>

      <section className="px-5">
        <nav className="grid grid-cols-2 gap-3">
          {QUICK_LINKS.map(({ href, label, icon: Icon, span }) => (
            <Link
              key={href}
              href={href}
              className={`flex flex-col items-start justify-between gap-3 rounded-2xl bg-white p-4 text-navy-900 shadow-md transition-shadow hover:shadow-lg ${
                span === "full" ? "col-span-2 flex-row items-center" : "aspect-[4/3]"
              }`}
            >
              <span className="flex size-10 items-center justify-center rounded-xl bg-navy-900/5 text-navy-800">
                <Icon size={20} strokeWidth={1.9} aria-hidden />
              </span>
              <span className="text-sm font-semibold leading-snug">{label}</span>
            </Link>
          ))}
        </nav>
      </section>

      <WatchedMpsSection />

      <section className="px-5 pb-2">
        <div className="flex items-baseline justify-between">
          <h2 className="text-lg font-semibold">Nowości</h2>
          <Link
            href="/wiecej"
            className="text-xs font-medium text-sejm-green-light hover:underline"
          >
            Zobacz wszystkie
          </Link>
        </div>

        <div className="mt-3 flex flex-col gap-3">
          <Suspense fallback={<NextSessionCardSkeleton />}>
            <NextSessionCard />
          </Suspense>
          <BillCard {...TRACKED_BILLS[0]} />
          <BillCard {...TRACKED_BILLS[1]} />
        </div>
      </section>
    </div>
  );
}

function LegislativeStepper({ activeStage }: { activeStage: number }) {
  return (
    <div
      role="group"
      aria-label={`Etap legislacyjny: ${LEGISLATIVE_STAGES[activeStage - 1] ?? "nieznany"}`}
      className="mt-3 flex items-center gap-1.5"
    >
      {LEGISLATIVE_STAGES.map((stage, index) => {
        const stageNumber = index + 1;
        const isActive = stageNumber === activeStage;
        const isPast = stageNumber < activeStage;

        return (
          <div key={stage} className="flex flex-1 flex-col gap-1">
            <div
              className={`h-1.5 rounded-full transition-colors ${
                isActive
                  ? "bg-sejm-green"
                  : isPast
                    ? "bg-sejm-green/40"
                    : "bg-slate-200"
              }`}
              aria-hidden
            />
            <span
              className={`truncate text-[9px] font-medium ${
                isActive ? "text-sejm-green" : "text-slate-400"
              }`}
            >
              {stage}
            </span>
          </div>
        );
      })}
    </div>
  );
}

function BillCard({
  title,
  category,
  voteLabel,
  status,
  activeStage,
}: (typeof TRACKED_BILLS)[number]) {
  return (
    <article className="rounded-2xl bg-white p-4 text-navy-900 shadow-md">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <span className="inline-block rounded-md bg-navy-900/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-navy-600">
            {category}
          </span>
          <h3 className="mt-2 text-[15px] font-semibold leading-snug">{title}</h3>
        </div>
        <span className="flex shrink-0 items-center gap-0.5 text-[11px] font-medium text-slate-500">
          {voteLabel}
          <ChevronRight size={14} className="text-slate-400" aria-hidden />
        </span>
      </div>

      <LegislativeStepper activeStage={activeStage} />

      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs text-slate-500">{status}</span>
        <button
          type="button"
          className="shrink-0 rounded-full border border-sejm-green/50 px-4 py-1.5 text-xs font-semibold text-sejm-green transition-colors hover:border-sejm-green hover:bg-sejm-green/5"
        >
          Śledź
        </button>
      </div>
    </article>
  );
}
