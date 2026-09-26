import Link from "next/link";
import { ChevronRight, Eye, Flame } from "lucide-react";

import { ImpactChips } from "@/components/impact-meter";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { plainTitle, titleSizeClass } from "@/lib/legislative-title";
import {
  formatObserwujacy,
  getStageLabel,
  shortenTitle,
  type Ustawa,
} from "@/lib/ustawa";

type HotUstawa = Pick<
  Ustawa,
  "id" | "numer_druku" | "tytul_oficjalny" | "etap_legislacyjny" | "liczba_obserwujacych" | "tagi"
>;

async function fetchHotUstawy(): Promise<HotUstawa[]> {
  const { data } = await supabaseAdmin
    .from("ustawy")
    .select("id, numer_druku, tytul_oficjalny, etap_legislacyjny, liczba_obserwujacych, tagi")
    // Druk bez ani jednego obserwującego nie jest „gorący” — lepiej pokazać
    // pustą sekcję niż ranking samych zer.
    .gt("liczba_obserwujacych", 0)
    .order("liczba_obserwujacych", { ascending: false })
    .limit(3);

  return (data ?? []) as HotUstawa[];
}

function SectionHeader() {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <Flame size={20} className="text-amber-300" aria-hidden />
        <h2 id="gorace-projekty" className="text-lg font-bold">
          Czym żyje Polska
        </h2>
      </div>
      <Link
        href="/ustawy"
        className="flex min-h-11 items-center text-sm font-semibold text-emerald-300 hover:underline"
      >
        Wszystkie ustawy
      </Link>
    </div>
  );
}

export function HotUstawySkeleton() {
  return (
    <section aria-labelledby="gorace-projekty">
      <SectionHeader />
      <div
        className="mt-3 flex flex-col gap-3"
        aria-busy="true"
        aria-label="Ładowanie najpopularniejszych ustaw"
      >
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-28 animate-pulse rounded-2xl bg-white/10" />
        ))}
      </div>
    </section>
  );
}

export default async function HotUstawy() {
  const ustawy = await fetchHotUstawy();

  return (
    <section aria-labelledby="gorace-projekty">
      <SectionHeader />

      <p className="mt-1 text-sm text-white/70">
        Projekty, które obserwuje teraz najwięcej obywateli.
      </p>

      <div className="mt-3 flex flex-col gap-3">
        {ustawy.length === 0 ? (
          <article className="rounded-2xl border border-dashed border-white/25 bg-white/5 p-5">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/70">
                <Flame size={18} aria-hidden />
              </span>
              <p className="text-sm leading-relaxed text-white/80">
                Żaden projekt nie ma jeszcze obserwujących. Zacznij śledzić ustawę na
                liście{" "}
                <Link href="/ustawy" className="font-semibold text-emerald-300 underline">
                  Ustawy
                </Link>
                , a pojawi się tutaj ranking najpopularniejszych.
              </p>
            </div>
          </article>
        ) : null}

        {ustawy.map((ustawa, index) => {
          const title = shortenTitle(plainTitle(ustawa.tytul_oficjalny), 120);

          return (
            <Link
              key={ustawa.id}
              href={`/ustawy/${ustawa.id}`}
              className="group relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-navy-800 via-navy-800 to-amber-500/15 p-4 shadow-lg shadow-amber-500/5 transition-colors hover:border-amber-300/30"
            >
              <div className="relative flex items-start gap-3">
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-sm font-bold text-amber-200 ring-1 ring-amber-400/30"
                  aria-label={`Miejsce ${index + 1}`}
                >
                  {index + 1}
                </span>

                <div className="min-w-0 flex-1">
                  <p className="flex flex-wrap items-center gap-x-2 text-xs font-medium text-white/70">
                    <span className="font-bold text-emerald-300">Druk {ustawa.numer_druku}</span>
                    <span aria-hidden>·</span>
                    <span>{getStageLabel(ustawa.etap_legislacyjny)}</span>
                  </p>

                  <h3 className={`mt-1.5 ${titleSizeClass(title, "compact")}`}>{title}</h3>

                  <ImpactChips source={ustawa} className="mt-2" />

                  <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-2.5 py-1 text-xs font-semibold text-amber-100 ring-1 ring-amber-400/25">
                    <Eye size={13} aria-hidden />
                    {formatObserwujacy(ustawa.liczba_obserwujacych)}
                  </span>
                </div>

                <ChevronRight
                  size={18}
                  className="mt-1 shrink-0 text-white/50 transition-transform group-hover:translate-x-0.5"
                  aria-hidden
                />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
