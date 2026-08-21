import Link from "next/link";
import { ChevronRight, Eye, Flame } from "lucide-react";

import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  formatObserwujacy,
  getStageLabel,
  shortenTitle,
  type Ustawa,
} from "@/lib/ustawa";

type HotUstawa = Pick<
  Ustawa,
  "id" | "numer_druku" | "tytul_oficjalny" | "etap_legislacyjny" | "liczba_obserwujacych"
>;

async function fetchHotUstawy(): Promise<HotUstawa[]> {
  const { data } = await supabaseAdmin
    .from("ustawy")
    .select("id, numer_druku, tytul_oficjalny, etap_legislacyjny, liczba_obserwujacych")
    // Druk bez ani jednego obserwującego nie jest „gorący” — lepiej pokazać
    // pustą sekcję niż ranking samych zer.
    .gt("liczba_obserwujacych", 0)
    .order("liczba_obserwujacych", { ascending: false })
    .limit(3);

  return (data ?? []) as HotUstawa[];
}

function SectionHeader() {
  return (
    <div className="flex items-baseline justify-between">
      <div className="flex items-center gap-2">
        <Flame size={18} className="text-amber-300" aria-hidden />
        <h2 className="text-lg font-semibold">Gorące projekty</h2>
      </div>
      <Link href="/ustawy" className="text-xs font-medium text-emerald-300 hover:underline">
        Zobacz wszystkie
      </Link>
    </div>
  );
}

export function HotUstawySkeleton() {
  return (
    <section>
      <SectionHeader />
      <div
        className="mt-3 flex flex-col gap-3"
        aria-busy="true"
        aria-label="Ładowanie najpopularniejszych ustaw"
      >
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-24 animate-pulse rounded-2xl bg-white/10" />
        ))}
      </div>
    </section>
  );
}

export default async function HotUstawy() {
  const ustawy = await fetchHotUstawy();

  return (
    <section>
      <SectionHeader />

      <p className="mt-1 text-xs text-white/45">
        Projekty, które obserwuje teraz najwięcej osób.
      </p>

      <div className="mt-3 flex flex-col gap-3">
        {ustawy.length === 0 ? (
          <article className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-5 ring-1 ring-white/10">
            <div className="flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/45">
                <Flame size={18} aria-hidden />
              </span>
              <p className="text-sm leading-relaxed text-white/60">
                Żaden projekt nie ma jeszcze obserwujących. Zacznij śledzić ustawę na
                liście{" "}
                <Link href="/ustawy" className="font-medium text-emerald-300 hover:underline">
                  Ustawy
                </Link>
                , a pojawi się tutaj ranking najpopularniejszych.
              </p>
            </div>
          </article>
        ) : null}

        {ustawy.map((ustawa, index) => (
          <Link
            key={ustawa.id}
            href={`/ustawy/${ustawa.id}`}
            className="group relative overflow-hidden rounded-2xl border border-amber-400/20 bg-linear-to-br from-navy-800 via-navy-800 to-amber-500/10 p-4 transition-colors hover:border-amber-400/40"
          >
            <span
              aria-hidden
              className="pointer-events-none absolute -right-10 -top-12 size-32 rounded-full bg-amber-400/10 blur-3xl"
            />

            <div className="relative flex items-start gap-3">
              <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-400/15 text-sm font-bold text-amber-300 ring-1 ring-amber-400/25">
                {index + 1}
              </span>

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
                    Druk {ustawa.numer_druku}
                  </span>
                  <span className="text-[10px] font-medium text-white/40">
                    {getStageLabel(ustawa.etap_legislacyjny)}
                  </span>
                </div>

                <p className="mt-2 line-clamp-2 text-sm font-medium leading-snug">
                  {shortenTitle(ustawa.tytul_oficjalny, 120)}
                </p>

                <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-2.5 py-1 text-[11px] font-semibold text-amber-200 ring-1 ring-amber-400/20">
                  <Eye size={12} aria-hidden />
                  {formatObserwujacy(ustawa.liczba_obserwujacych)}
                </span>
              </div>

              <ChevronRight
                size={16}
                className="mt-1 shrink-0 text-white/30 transition-transform group-hover:translate-x-0.5"
                aria-hidden
              />
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
