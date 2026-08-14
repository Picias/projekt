import Link from "next/link";
import { CalendarCheck, CalendarDays, ChevronLeft, History } from "lucide-react";

import {
  fetchPosiedzenia,
  formatPosiedzenieRange,
  getCountdownLabel,
  getPosiedzenieName,
  isOngoing,
  isUpcoming,
  todayIso,
  type Posiedzenie,
} from "@/lib/posiedzenia";

// Podział na nadchodzące i zakończone zależy od dzisiejszej daty,
// więc strona nie może zostać zapiekana w czasie builda.
export const dynamic = "force-dynamic";

type PosiedzenieCardProps = {
  posiedzenie: Posiedzenie;
  today: string;
  variant: "upcoming" | "past";
};

function PosiedzenieCard({ posiedzenie, today, variant }: PosiedzenieCardProps) {
  const ongoing = variant === "upcoming" && isOngoing(posiedzenie, today);
  const planned = posiedzenie.numer === 0;

  return (
    <article
      className={`rounded-2xl p-4 ring-1 ${
        ongoing
          ? "bg-sejm-green/10 ring-sejm-green/40"
          : "bg-white/5 ring-white/10"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                variant === "upcoming"
                  ? "bg-emerald-400/15 text-emerald-300"
                  : "bg-white/10 text-white/50"
              }`}
            >
              {planned ? "Planowane" : `Nr ${posiedzenie.numer}`}
            </span>

            {variant === "upcoming" && (
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                  ongoing
                    ? "bg-sejm-green text-white"
                    : "bg-white/10 text-white/60"
                }`}
              >
                {getCountdownLabel(posiedzenie, today)}
              </span>
            )}
          </div>

          <h3 className="mt-2 text-sm font-semibold leading-snug">
            {getPosiedzenieName(posiedzenie)}
          </h3>

          <p className="mt-1 flex items-center gap-1.5 text-xs text-white/50">
            <CalendarDays size={13} className="shrink-0" aria-hidden />
            {formatPosiedzenieRange(
              posiedzenie.data_rozpoczecia,
              posiedzenie.data_zakonczenia,
            )}
          </p>
        </div>
      </div>
    </article>
  );
}

export default async function ObradyPage() {
  const posiedzenia = await fetchPosiedzenia();
  const today = todayIso();

  // Baza jest sortowana malejąco, więc nadchodzące odwracamy — najbliższe pierwsze.
  const upcoming = posiedzenia
    .filter((posiedzenie) => isUpcoming(posiedzenie, today))
    .reverse();
  const past = posiedzenia.filter((posiedzenie) => !isUpcoming(posiedzenie, today));

  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <Link
        href="/"
        className="flex w-fit items-center gap-1 text-sm text-white/70 transition-colors hover:text-white"
      >
        <ChevronLeft size={18} aria-hidden />
        Wróć
      </Link>

      <header>
        <h1 className="text-3xl font-bold leading-tight">Kalendarz obrad</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/60">
          Terminy posiedzeń Sejmu RP kadencji X — te już zaplanowane i te za nami.
        </p>
      </header>

      {posiedzenia.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-5">
          <p className="text-sm font-semibold">Brak posiedzeń w bazie</p>
          <p className="mt-1 text-sm leading-relaxed text-white/55">
            Uruchom synchronizację pod adresem{" "}
            <Link href="/api/sync-sessions" className="text-emerald-300 hover:underline">
              /api/sync-sessions
            </Link>
            , aby pobrać terminy posiedzeń z API Sejmu.
          </p>
        </div>
      ) : (
        <>
          <section>
            <div className="mb-3 flex items-center gap-2">
              <CalendarCheck size={16} className="text-emerald-300" aria-hidden />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
                Nadchodzące
              </h2>
              <span className="text-xs font-medium text-white/40">{upcoming.length}</span>
            </div>

            {upcoming.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-4 text-sm leading-relaxed text-white/55">
                Sejm nie ma obecnie zaplanowanych posiedzeń.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {upcoming.map((posiedzenie) => (
                  <PosiedzenieCard
                    key={posiedzenie.id}
                    posiedzenie={posiedzenie}
                    today={today}
                    variant="upcoming"
                  />
                ))}
              </div>
            )}
          </section>

          <section>
            <div className="mb-3 flex items-center gap-2">
              <History size={16} className="text-white/40" aria-hidden />
              <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
                Zakończone
              </h2>
              <span className="text-xs font-medium text-white/40">{past.length}</span>
            </div>

            {past.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-4 text-sm leading-relaxed text-white/55">
                Żadne posiedzenie z bazy jeszcze się nie zakończyło.
              </p>
            ) : (
              <div className="flex flex-col gap-3">
                {past.map((posiedzenie) => (
                  <PosiedzenieCard
                    key={posiedzenie.id}
                    posiedzenie={posiedzenie}
                    today={today}
                    variant="past"
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
