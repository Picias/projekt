import Link from "next/link";
import { notFound } from "next/navigation";
import { CalendarDays, ChevronLeft, Users } from "lucide-react";

import GlosowanieLista from "@/components/glosowanie-lista";
import {
  formatDataGlosowania,
  GLOS_INFO,
  GLOSY_POSLA,
  type Glosowanie,
} from "@/lib/glosowania";
import {
  countGlosowaniaUstawy,
  fetchGlosyZProfilami,
  fetchNajnowszeGlosowanie,
} from "@/lib/glosowania-db";
import { getStageLabel, shortenTitle } from "@/lib/ustawa";
import { fetchUstawaByParam } from "@/lib/ustawa-db";

type GlosowaniePageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: GlosowaniePageProps) {
  const { id } = await params;
  const ustawa = await fetchUstawaByParam(id);

  if (!ustawa) {
    return { title: "Głosowanie nie znalezione — SEJM ON" };
  }

  return {
    title: `Wyniki głosowania — druk nr ${ustawa.numer_druku} — SEJM ON`,
    description: `Pełna lista głosów posłów nad drukiem nr ${ustawa.numer_druku}.`,
  };
}

function PodsumowanieKafelki({ glosowanie }: { glosowanie: Glosowanie }) {
  const wartosci: Record<(typeof GLOSY_POSLA)[number], number> = {
    ZA: glosowanie.za,
    PRZECIW: glosowanie.przeciw,
    WSTRZYMAL_SIE: glosowanie.wstrzymalo_sie,
    NIEOBECNY: glosowanie.nieobecni,
  };

  return (
    <div className="grid grid-cols-2 gap-3">
      {GLOSY_POSLA.map((glos) => {
        const info = GLOS_INFO[glos];

        return (
          <div key={glos} className="rounded-2xl bg-white/5 p-4 ring-1 ring-white/10">
            <span className={`text-xs font-semibold ${info.akcent}`}>
              {glos === "NIEOBECNY" ? "Nieobecni" : info.label}
            </span>
            <p className="mt-1 text-2xl font-bold text-white">{wartosci[glos]}</p>
          </div>
        );
      })}
    </div>
  );
}

export default async function UstawaGlosowaniePage({ params }: GlosowaniePageProps) {
  const { id } = await params;
  const ustawa = await fetchUstawaByParam(id);

  if (!ustawa) {
    notFound();
  }

  const glosowanie = await fetchNajnowszeGlosowanie(ustawa.id);
  const [glosy, liczbaGlosowan] = glosowanie
    ? await Promise.all([
        fetchGlosyZProfilami(glosowanie.id),
        countGlosowaniaUstawy(ustawa.id),
      ])
    : [[], 0];

  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <Link
        href={`/ustawy/${ustawa.id}`}
        className="flex w-fit items-center gap-1 text-sm text-white/70 transition-colors hover:text-white"
      >
        <ChevronLeft size={18} aria-hidden />
        Wróć do druku
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/25">
            Druk nr {ustawa.numer_druku}
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
            {getStageLabel(ustawa.etap_legislacyjny)}
          </span>
        </div>

        <h1 className="mt-4 text-2xl font-bold leading-snug">Wyniki głosowania</h1>

        <p className="mt-2 text-sm leading-relaxed text-white/55">
          {glosowanie ? glosowanie.tytul : shortenTitle(ustawa.tytul_oficjalny, 140)}
        </p>

        {glosowanie ? (
          <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-white/45">
            <span className="flex items-center gap-1.5">
              <CalendarDays size={13} className="text-emerald-300/70" aria-hidden />
              {formatDataGlosowania(glosowanie.data_glosowania)}
            </span>
            <span>
              Posiedzenie {glosowanie.sitting}, głosowanie nr {glosowanie.numer_glosowania}
            </span>
          </p>
        ) : null}
      </header>

      {!glosowanie ? (
        <section className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-5">
          <p className="text-sm font-semibold">Brak zapisanego głosowania nad tym drukiem</p>
          <p className="mt-1.5 text-sm leading-relaxed text-white/55">
            Sejm mógł jeszcze nie głosować nad tym projektem albo wyniki nie zostały
            pobrane z API Sejmu. Uruchom synchronizację pod adresem{" "}
            <Link href="/api/sync-votings" className="text-emerald-300 hover:underline">
              /api/sync-votings
            </Link>
            .
          </p>
        </section>
      ) : (
        <>
          <section aria-labelledby="podsumowanie" className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <Users size={18} className="text-emerald-300" aria-hidden />
              <h2 id="podsumowanie" className="text-lg font-semibold">
                Wszyscy posłowie ({glosy.length})
              </h2>
            </div>

            <PodsumowanieKafelki glosowanie={glosowanie} />

            {glosowanie.temat ? (
              <p className="text-xs leading-relaxed text-white/40">{glosowanie.temat}</p>
            ) : null}

            {liczbaGlosowan > 1 ? (
              <p className="text-xs leading-relaxed text-white/40">
                Nad tym drukiem odbyło się {liczbaGlosowan} głosowań — pokazujemy najnowsze.
              </p>
            ) : null}
          </section>

          <section aria-labelledby="lista-poslow" className="flex flex-col gap-4">
            <h2 id="lista-poslow" className="text-sm font-semibold text-white/70">
              Lista imienna
            </h2>

            <GlosowanieLista glosy={glosy} />
          </section>
        </>
      )}
    </div>
  );
}
