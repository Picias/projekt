"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, CalendarDays, Vote } from "lucide-react";

import MpAvatar from "@/components/mp-avatar";
import { getClubLabel, getClubTheme } from "@/lib/club-colors";
import { useAuthUser } from "@/lib/use-auth-user";
import {
  formatDataGlosowania,
  GLOS_INFO,
  type GlosPosla,
  type Glosowanie,
} from "@/lib/glosowania";

type UstawaWatchedVotesProps = {
  ustawaId: number;
  // Etap legislacyjny mówi, czy druk w ogóle powinien mieć już głosowanie —
  // dzięki temu rozróżniamy „jeszcze nie głosowano” od „brak danych w bazie”.
  hasVoting: boolean;
};

type PoselZGlosem = {
  id: number;
  imie_nazwisko: string;
  partia: string | null;
  zdjecie_url: string | null;
  glos: GlosPosla | null;
};

function SectionShell({
  children,
  pelneWynikiHref,
}: {
  children: React.ReactNode;
  pelneWynikiHref?: string;
}) {
  return (
    <section aria-labelledby="twoi-poslowie" className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Vote size={18} className="text-emerald-300" aria-hidden />
        <h2 id="twoi-poslowie" className="text-lg font-semibold">
          Twoi posłowie w tym głosowaniu
        </h2>
      </div>

      {children}

      {pelneWynikiHref ? (
        <Link
          href={pelneWynikiHref}
          className="group flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-xs font-semibold text-white/70 transition-colors hover:border-emerald-400/30 hover:bg-white/10 hover:text-white"
        >
          Zobacz pełne wyniki głosowania (460 posłów)
          <ArrowRight
            size={14}
            className="transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      ) : null}
    </section>
  );
}

function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-5">
      <p className="text-sm font-semibold">{title}</p>
      <p className="mt-1.5 text-sm leading-relaxed text-white/55">{children}</p>
    </div>
  );
}

export default function UstawaWatchedVotes({
  ustawaId,
  hasVoting,
}: UstawaWatchedVotesProps) {
  const user = useAuthUser();
  const [glosowanie, setGlosowanie] = useState<Glosowanie | null>(null);
  const [poslowie, setPoslowie] = useState<PoselZGlosem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadGlosowanie() {
      try {
        const response = await fetch(`/api/glosowanie?ustawa_id=${ustawaId}`);

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          glosowanie?: Glosowanie | null;
          poslowie?: PoselZGlosem[];
        };

        if (!cancelled) {
          setGlosowanie(data.glosowanie ?? null);
          setPoslowie(data.poslowie ?? []);
        }
      } catch {
        // Nieudany odczyt zostawia sekcję w stanie „brak danych o głosowaniu”.
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadGlosowanie();

    return () => {
      cancelled = true;
    };
  }, [ustawaId, user?.id]);

  if (loading) {
    return (
      <SectionShell>
        <div className="h-28 animate-pulse rounded-2xl bg-white/10" aria-busy="true" />
      </SectionShell>
    );
  }

  if (!glosowanie) {
    return (
      <SectionShell>
        <InfoCard
          title={
            hasVoting
              ? "Brak zapisanych wyników głosowania"
              : "Ten druk czeka jeszcze na głosowanie"
          }
        >
          {hasVoting
            ? "Druk trafił już pod obrady, ale wyniki nie zostały jeszcze pobrane z API Sejmu."
            : "Kiedy ta ustawa trafi pod głosowanie, zobaczysz tutaj decyzje polityków, których obserwujesz."}
        </InfoCard>
      </SectionShell>
    );
  }

  const pelneWynikiHref = `/ustawy/${ustawaId}/glosowanie`;

  if (poslowie.length === 0) {
    return (
      <SectionShell pelneWynikiHref={pelneWynikiHref}>
        <InfoCard title="Nie obserwujesz jeszcze żadnego posła">
          Dodaj posłów do obserwowanych na{" "}
          <Link href="/poslowie" className="text-emerald-300 hover:underline">
            liście posłów
          </Link>
          , a przy każdym głosowaniu zobaczysz tutaj ich decyzje.
        </InfoCard>
      </SectionShell>
    );
  }

  return (
    <SectionShell pelneWynikiHref={pelneWynikiHref}>
      <p className="flex items-center gap-1.5 text-xs text-white/45">
        <CalendarDays size={13} className="text-emerald-300/70" aria-hidden />
        {formatDataGlosowania(glosowanie.data_glosowania)}
      </p>

      <ul className="flex flex-col gap-2">
        {poslowie.map((posel) => {
          const theme = getClubTheme(posel.partia);
          const info = posel.glos ? GLOS_INFO[posel.glos] : null;

          return (
            <li key={posel.id}>
              <Link
                href={`/poslowie/${posel.id}`}
                className={`flex items-center gap-3 rounded-2xl border bg-navy-800/60 p-3 transition-colors hover:border-white/30 hover:bg-navy-800 ${theme.border}`}
              >
                <MpAvatar
                  name={posel.imie_nazwisko}
                  photoUrl={posel.zdjecie_url}
                  size="sm"
                  frameClassName={`border-2 ${theme.border}`}
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-white">
                    {posel.imie_nazwisko}
                  </span>
                  <span className="block truncate text-xs text-white/45">
                    {getClubLabel(posel.partia)}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${
                    info ? info.badge : "bg-white/5 text-white/40 ring-white/10"
                  }`}
                >
                  {info ? info.label : "Brak danych"}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </SectionShell>
  );
}
