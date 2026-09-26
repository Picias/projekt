"use client";

import { useEffect, useId, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  CheckCircle2,
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
  /** "full" — sekcja na stronie druku, "compact" — karta „Decyzji dnia”. */
  variant?: "full" | "compact";
  /** Link „dowiedz się więcej” pokazywany po oddaniu głosu w wariancie compact. */
  detailsHref?: string;
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
    spoczynek: "bg-emerald-400/15 text-emerald-200 ring-emerald-400/40 hover:bg-emerald-400/25",
    wybrany: "bg-green-700 text-white ring-emerald-300 shadow-lg shadow-emerald-500/25",
    pasek: "bg-emerald-400",
    tekst: "text-emerald-300",
  },
  {
    typ: "PRZECIW",
    label: "Przeciw",
    icon: ThumbsDown,
    spoczynek: "bg-red-400/15 text-red-200 ring-red-400/40 hover:bg-red-400/25",
    wybrany: "bg-red-700 text-white ring-red-300 shadow-lg shadow-red-500/25",
    pasek: "bg-red-400",
    tekst: "text-red-300",
  },
  {
    typ: "WSTRZYMAL_SIE",
    label: "Nie mam zdania",
    icon: MinusCircle,
    spoczynek: "bg-amber-300/15 text-amber-100 ring-amber-300/40 hover:bg-amber-300/25",
    wybrany: "bg-amber-400 text-navy-950 ring-amber-200 shadow-lg shadow-amber-400/25",
    pasek: "bg-amber-300",
    tekst: "text-amber-200",
  },
];

function formatOsoby(count: number): string {
  if (count === 1) {
    return "1 osoba";
  }

  const rest = count % 10;
  const teens = count % 100;
  const plural = rest >= 2 && rest <= 4 && (teens < 12 || teens > 14);

  return `${formatLiczba(count)} ${plural ? "osoby" : "osób"}`;
}

function SectionShell({ children }: { children: React.ReactNode }) {
  return (
    <section aria-labelledby="glos-obywateli" className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Megaphone size={20} className="text-emerald-300" aria-hidden />
        <h2 id="glos-obywateli" className="text-lg font-bold">
          Sonda Obywatelska
        </h2>
      </div>

      {children}
    </section>
  );
}

function StackedResults({ wyniki }: { wyniki: WynikiSondy }) {
  const procenty = toProcenty(wyniki);
  const razem = sumaGlosow(wyniki);

  return (
    <div aria-live="polite">
      <div
        className="flex h-3 overflow-hidden rounded-full bg-white/10"
        role="img"
        aria-label={OPCJE.map((opcja) => `${opcja.label}: ${procenty[opcja.typ]}%`).join(", ")}
      >
        {OPCJE.map((opcja) =>
          procenty[opcja.typ] > 0 ? (
            <span
              key={opcja.typ}
              className={`h-full transition-[width] duration-500 ${opcja.pasek}`}
              style={{ width: `${procenty[opcja.typ]}%` }}
            />
          ) : null,
        )}
      </div>
      <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
        {OPCJE.map((opcja) => (
          <li key={opcja.typ} className="flex items-center gap-1.5">
            <span className={`size-2.5 rounded-full ${opcja.pasek}`} aria-hidden />
            <span className="text-white/80">{opcja.label}</span>
            <span className={`font-bold ${opcja.tekst}`}>{procenty[opcja.typ]}%</span>
          </li>
        ))}
      </ul>
      <p className="mt-1.5 text-sm text-white/70">
        {razem === 0 ? "Bądź pierwszą osobą, która zagłosuje!" : `Zagłosowało ${formatOsoby(razem)}.`}
      </p>
    </div>
  );
}

export default function GlosObywateli({
  printNum,
  variant = "full",
  detailsHref,
}: GlosObywateliProps) {
  const router = useRouter();
  const pathname = usePathname();
  const user = useAuthUser();
  const questionId = useId();
  const [wyniki, setWyniki] = useState<WynikiSondy>(PUSTE_WYNIKI);
  const [userVote, setUserVote] = useState<TypGlosu | null>(null);
  const [loading, setLoading] = useState(true);
  const [pending, setPending] = useState<TypGlosu | null>(null);
  const [blad, setBlad] = useState(false);
  const [justVoted, setJustVoted] = useState(false);

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
      setJustVoted(true);
    } catch {
      setBlad(true);
    } finally {
      setPending(null);
    }
  }

  const compact = variant === "compact";

  if (loading) {
    const skeleton = (
      <div
        className={`${compact ? "h-32" : "h-52"} animate-pulse rounded-2xl bg-white/10`}
        aria-busy="true"
        aria-label="Ładowanie sondy"
      />
    );

    return compact ? skeleton : <SectionShell>{skeleton}</SectionShell>;
  }

  const procenty = toProcenty(wyniki);
  const razem = sumaGlosow(wyniki);

  const buttons = (
    <div role="group" aria-labelledby={questionId} className="grid grid-cols-3 gap-2.5">
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
            className={`flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-2xl px-1.5 py-3 text-center ring-1 transition-all ${
              wybrany ? opcja.wybrany : opcja.spoczynek
            } ${pending !== null && !ladowanie ? "opacity-60" : ""}`}
          >
            {ladowanie ? (
              <Loader2 size={24} className="animate-spin" aria-hidden />
            ) : (
              <Icon size={24} strokeWidth={2} aria-hidden />
            )}
            <span className="text-sm font-bold leading-tight">{opcja.label}</span>
          </button>
        );
      })}
    </div>
  );

  const errorBox = blad ? (
    <p
      role="alert"
      className="rounded-xl border border-red-400/30 bg-red-400/10 px-4 py-2.5 text-center text-sm font-medium text-red-100"
    >
      Nie udało się zapisać głosu. Spróbuj ponownie za chwilę.
    </p>
  ) : null;

  const loginHint =
    user === null ? (
      <p className="text-sm text-white/75">
        Głosowanie wymaga konta — zakładasz je w pół minuty, a Twój głos trafi do sondy.
      </p>
    ) : null;

  if (compact) {
    return (
      <div className="flex flex-col gap-3">
        <p id={questionId} className="text-base font-semibold text-white">
          Jak Ty byś zagłosował(a)?
        </p>
        {buttons}
        {errorBox}
        {loginHint}
        {userVote || razem > 0 ? <StackedResults wyniki={wyniki} /> : null}
        {justVoted ? (
          <p
            role="status"
            className="flex items-start gap-2 rounded-xl bg-emerald-400/10 px-3 py-2.5 text-sm text-emerald-50 ring-1 ring-emerald-400/30"
          >
            <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-emerald-300" aria-hidden />
            <span>
              Dziękujemy, Twój głos jest w sondzie!
              {detailsHref ? (
                <>
                  {" "}
                  <Link href={detailsHref} className="font-semibold underline">
                    Zobacz, co dokładnie zmienia ta ustawa
                  </Link>
                  .
                </>
              ) : null}
            </span>
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <SectionShell>
      <article className="flex flex-col gap-4 rounded-3xl border border-white/15 bg-navy-800 p-5 shadow-lg shadow-navy-950/30">
        <div>
          <p id={questionId} className="text-base font-semibold text-white">
            Jak Ty zagłosował(a)byś nad tym projektem?
          </p>
          <p className="mt-1 text-sm leading-relaxed text-white/75">
            To sonda SejmON — nie zmienia wyniku w Sejmie, ale pokazuje posłom, co myślą
            obywatele.
          </p>
        </div>

        {buttons}
        {errorBox}
        {loginHint}

        <div className="flex flex-col gap-3" aria-live="polite">
          {OPCJE.map((opcja) => (
            <div key={opcja.typ}>
              <div className="flex items-baseline justify-between gap-3 text-sm">
                <span className={`font-semibold ${opcja.tekst}`}>{opcja.label}</span>
                <span className="text-white/75">
                  <span className="font-bold text-white">{procenty[opcja.typ]}%</span> ·{" "}
                  {formatLiczba(wyniki[opcja.typ])}
                </span>
              </div>
              <div
                className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-white/10"
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

          <p className="text-sm leading-relaxed text-white/75">
            {razem === 0
              ? "Bądź pierwszą osobą, która zagłosuje!"
              : `Zagłosowało ${formatOsoby(razem)}.`}
            {userVote
              ? " Możesz zmienić zdanie — wybierz inną odpowiedź, a Twój głos się zaktualizuje."
              : ""}
          </p>
        </div>
      </article>
    </SectionShell>
  );
}
