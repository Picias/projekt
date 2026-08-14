"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { MinusCircle, ThumbsDown, ThumbsUp, Vote, type LucideIcon } from "lucide-react";

import MpAvatar from "@/components/mp-avatar";
import { getAnonymousUserId } from "@/lib/anonymous-user";
import { getClubLabel, getClubTheme } from "@/lib/club-colors";
import type { Posel } from "@/lib/posel";

type UstawaWatchedVotesProps = {
  ustawaId: number;
  // Głosowania trafiają do bazy osobnym modułem, więc na razie wnioskujemy
  // z etapu, czy druk zdążył już stanąć pod głosowaniem.
  hasVoting: boolean;
};

type VoteKind = "za" | "przeciw" | "wstrzymal";

const VOTE_STYLES: Record<
  VoteKind,
  { label: string; icon: LucideIcon; className: string }
> = {
  za: {
    label: "Za",
    icon: ThumbsUp,
    className: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/25",
  },
  przeciw: {
    label: "Przeciw",
    icon: ThumbsDown,
    className: "bg-red-400/15 text-red-300 ring-red-400/25",
  },
  wstrzymal: {
    label: "Wstrzymał się",
    icon: MinusCircle,
    className: "bg-white/10 text-white/60 ring-white/15",
  },
};

/**
 * Do czasu podłączenia wyników głosowań pokazujemy stały układ decyzji —
 * wyliczany z identyfikatorów, żeby nie zmieniał się przy każdym renderze.
 */
function placeholderVote(poselId: number, ustawaId: number): VoteKind {
  const seed = (poselId * 31 + ustawaId * 17) % 10;

  if (seed < 6) {
    return "za";
  }

  return seed < 9 ? "przeciw" : "wstrzymal";
}

function SectionShell({ children }: { children: React.ReactNode }) {
  return (
    <section aria-labelledby="twoi-poslowie" className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Vote size={18} className="text-emerald-300" aria-hidden />
        <h2 id="twoi-poslowie" className="text-lg font-semibold">
          Twoi posłowie w tym głosowaniu
        </h2>
        <span className="ml-auto rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/40">
          Wersja demo
        </span>
      </div>

      {children}
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
  const [poslowie, setPoslowie] = useState<Posel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function loadWatched() {
      const userId = getAnonymousUserId();

      if (!userId) {
        if (!cancelled) {
          setLoading(false);
        }
        return;
      }

      try {
        const response = await fetch(
          `/api/obserwowani?user_id=${encodeURIComponent(userId)}`,
        );

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as { poslowie?: Posel[] };

        if (!cancelled) {
          setPoslowie(data.poslowie ?? []);
        }
      } catch {
        // Nieudany odczyt zostawia pustą listę — pokażemy zachętę do obserwowania.
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadWatched();

    return () => {
      cancelled = true;
    };
  }, []);

  if (!hasVoting) {
    return (
      <SectionShell>
        <InfoCard title="Ten druk czeka jeszcze na głosowanie">
          Kiedy ta ustawa trafi pod głosowanie, zobaczysz tutaj decyzje polityków,
          których obserwujesz.
        </InfoCard>
      </SectionShell>
    );
  }

  if (loading) {
    return (
      <SectionShell>
        <div className="h-28 animate-pulse rounded-2xl bg-white/10" aria-busy="true" />
      </SectionShell>
    );
  }

  if (poslowie.length === 0) {
    return (
      <SectionShell>
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
    <SectionShell>
      <ul className="flex flex-col gap-2">
        {poslowie.map((posel) => {
          const vote = VOTE_STYLES[placeholderVote(posel.id, ustawaId)];
          const theme = getClubTheme(posel.partia);
          const VoteIcon = vote.icon;

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
                  className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${vote.className}`}
                >
                  <VoteIcon size={13} aria-hidden />
                  {vote.label}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>

      <p className="text-xs leading-relaxed text-white/35">
        Decyzje są na razie przykładowe. Po podłączeniu wyników głosowań pojawią się
        tutaj realne głosy obserwowanych posłów.
      </p>
    </SectionShell>
  );
}
