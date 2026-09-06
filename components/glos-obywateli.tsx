"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  Loader2,
  Megaphone,
  MinusCircle,
  ThumbsDown,
  ThumbsUp,
  type LucideIcon,
} from "lucide-react";

import { loginHref } from "@/lib/profile";
import { useAuthUser } from "@/lib/use-auth-user";
import {
  PUSTE_WYNIKI,
  sumaGlosow,
  toProcenty,
  type TypGlosu,
  type WynikiSondy,
} from "@/lib/glosy-obywateli";
import { formatLiczba } from "@/lib/ustawa";

type GlosObywateliProps = {
  printNum: string;
};

type Opcja = {
  typ: TypGlosu;
  label: string;
  icon: LucideIcon;
  // Przyciski udają pulpit do głosowania z sali plenarnej, więc każdy ma
  // własny akcent — wygaszony do czasu wybrania i podświetlony po kliknięciu.
  spoczynek: string;
  wybrany: string;
  pasek: string;
  tekst: string;
};

const OPCJE: Opcja[] = [
  {
    typ: "ZA",
    label: "Za",
    icon: ThumbsUp,
    spoczynek: "bg-emerald-400/10 text-emerald-300 ring-emerald-400/25 hover:bg-emerald-400/20",
    wybrany: "bg-emerald-500 text-white ring-emerald-300 shadow-lg shadow-emerald-500/25",
    pasek: "bg-emerald-400",
    tekst: "text-emerald-300",
  },
  {
    typ: "PRZECIW",
    label: "Przeciw",
    icon: ThumbsDown,
    spoczynek: "bg-red-400/10 text-red-300 ring-red-400/25 hover:bg-red-400/20",
    wybrany: "bg-red-500 text-white ring-red-300 shadow-lg shadow-red-500/25",
    pasek: "bg-red-400",
    tekst: "text-red-300",
  },
  {
    typ: "WSTRZYMAL_SIE",
    label: "Wstrzymuję się",
    icon: MinusCircle,
    spoczynek: "bg-amber-300/10 text-amber-200 ring-amber-300/25 hover:bg-amber-300/20",
    wybrany: "bg-amber-400 text-navy-950 ring-amber-200 shadow-lg shadow-amber-400/25",
    pasek: "bg-amber-300",
    tekst: "text-amber-200",
  },
];

function SectionShell({ children }: { children: React.ReactNode }) {
  return (
    <section aria-labelledby="glos-obywateli" className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Megaphone size={18} className="text-emerald-300" aria-hidden />
        <h2 id="glos-obywateli" className="text-lg font-semibold">
          Głos Obywateli (SejmON)
        </h2>
        <span className="ml-auto rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/40">
          Sonda
        </span>
      </div>

      {children}
    </section>
  );
}

export default function GlosObywateli({ printNum }: GlosObywateliProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthUser();
  const [wyniki, setWyniki] = useState<WynikiSondy>(PUSTE_WYNIKI);
  const [userVote, setUserVote] = useState<TypGlosu | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<TypGlosu | null>(null);
  const [blad, setBlad] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function loadSonda() {
      try {
        const response = await fetch(
          `/api/citizen-votes?print_num=${encodeURIComponent(printNum)}`,
          { cache: "no-store" },
        );

        if (!response.ok) {
          return;
        }

        const data = (await response.json()) as {
          wyniki?: WynikiSondy;
          userVote?: TypGlosu | null;
        };

        if (!cancelled) {
          setWyniki(data.wyniki ?? PUSTE_WYNIKI);
          setUserVote(data.userVote ?? null);
        }
      } catch {
        // Nieudany odczyt zostawia sondę bez głosów — paski na 0%.
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadSonda();

    return () => {
      cancelled = true;
    };
  }, [printNum, user?.id]);

  async function handleVote(typ: TypGlosu) {
    if (pending || typ === userVote || user === undefined) {
      return;
    }

    if (!user) {
      router.push(loginHref(pathname));
      return;
    }

    setPending(typ);
    setBlad(false);

    try {
      const response = await fetch("/api/citizen-votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        cache: "no-store",
        body: JSON.stringify({
          print_num: printNum,
          vote_type: typ,
        }),
      });

      if (response.status === 401) {
        router.push(loginHref(pathname));
        return;
      }

      if (!response.ok) {
        setBlad(true);
        return;
      }

      const data = (await response.json()) as {
        wyniki?: WynikiSondy;
        userVote?: TypGlosu | null;
      };

      setWyniki(data.wyniki ?? PUSTE_WYNIKI);
      setUserVote(data.userVote ?? typ);
    } catch {
      setBlad(true);
    } finally {
      setPending(null);
    }
  }

  if (loading) {
    return (
      <SectionShell>
        <div className="h-52 animate-pulse rounded-3xl bg-white/10" aria-busy="true" />
      </SectionShell>
    );
  }

  const procenty = toProcenty(wyniki);
  const razem = sumaGlosow(wyniki);

  return (
    <SectionShell>
      <article className="rounded-3xl border border-white/10 bg-navy-800/60 p-5 shadow-lg shadow-navy-950/30">
        <p className="text-sm font-semibold text-white">
          Jak Ty zagłosowałbyś nad tym projektem?
        </p>
        <p className="mt-1 text-xs leading-relaxed text-white/45">
          Sonda obywatelska SejmON. Nie ma wpływu na wynik głosowania w Sejmie.
          {user === null ? " Żeby oddać głos, zaloguj się." : ""}
        </p>

        <div className="mt-4 grid grid-cols-3 gap-2.5">
          {OPCJE.map((opcja) => {
            const Icon = opcja.icon;
            const wybrany = userVote === opcja.typ;
            const ladowanie = pending === opcja.typ;

            return (
              <button
                key={opcja.typ}
                type="button"
                onClick={() => handleVote(opcja.typ)}
                disabled={pending !== null}
                aria-pressed={wybrany}
                className={`flex flex-col items-center justify-center gap-2 rounded-2xl px-2 py-4 text-center ring-1 transition-all ${
                  wybrany ? opcja.wybrany : opcja.spoczynek
                } ${pending !== null && !ladowanie ? "opacity-50" : ""}`}
              >
                {ladowanie ? (
                  <Loader2 size={22} className="animate-spin" aria-hidden />
                ) : (
                  <Icon size={22} strokeWidth={1.9} aria-hidden />
                )}
                <span className="text-[11px] font-bold uppercase leading-tight tracking-wide">
                  {opcja.label}
                </span>
              </button>
            );
          })}
        </div>

        {blad ? (
          <p
            role="status"
            className="mt-4 rounded-xl border border-red-400/25 bg-red-400/10 px-4 py-2.5 text-center text-xs font-medium text-red-200"
          >
            Nie udało się zapisać głosu. Spróbuj ponownie za chwilę.
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-3" aria-live="polite">
          {OPCJE.map((opcja) => (
            <div key={opcja.typ}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className={`font-semibold ${opcja.tekst}`}>{opcja.label}</span>
                <span className="font-medium text-white/45">
                  <span className="font-bold text-white/80">{procenty[opcja.typ]}%</span>{" "}
                  · {formatLiczba(wyniki[opcja.typ])}
                </span>
              </div>
              <div
                className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10"
                role="img"
                aria-label={`${opcja.label}: ${procenty[opcja.typ]} procent`}
              >
                <div
                  className={`h-full rounded-full transition-[width] duration-500 ${opcja.pasek}`}
                  style={{ width: `${procenty[opcja.typ]}%` }}
                />
              </div>
            </div>
          ))}

          {razem === 0 ? (
            <p className="mt-1 text-center text-[11px] leading-relaxed text-white/40">
              Bądź pierwszym, który odda głos!
            </p>
          ) : (
            <p className="mt-1 text-[11px] leading-relaxed text-white/40">
              Zagłosowało {formatLiczba(razem)} osób.
              {userVote
                ? " Możesz zmienić zdanie — wybierz inną odpowiedź, a Twój głos się zaktualizuje."
                : ""}
            </p>
          )}
        </div>
      </article>
    </SectionShell>
  );
}
