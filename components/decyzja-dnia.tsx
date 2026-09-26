import Link from "next/link";
import { ArrowRight, CalendarDays, Flame, Radio } from "lucide-react";

import GlosObywateli from "@/components/glos-obywateli";
import { ImpactStrip } from "@/components/impact-meter";
import LegislativeTitle from "@/components/legislative-title";
import { fetchDecyzjaDnia, type DecyzjaDnia } from "@/lib/decyzja-dnia";
import { formatPosiedzenieDate } from "@/lib/posiedzenia";

function firstSentences(text: string | null, maxLength = 220): string | null {
  const clean = text
    ?.replace(/\*\*/g, "")
    .replace(/^[•\-\s]+/gm, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) {
    return null;
  }

  if (clean.length <= maxLength) {
    return clean;
  }

  const cut = clean.slice(0, maxLength);
  const sentenceEnd = cut.lastIndexOf(". ");

  return sentenceEnd > 80 ? cut.slice(0, sentenceEnd + 1) : `${cut.trimEnd()}…`;
}

function ReasonBadge({ decyzja }: { decyzja: DecyzjaDnia }) {
  if (decyzja.powod === "obrady-dzis") {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-600 px-3 py-1 text-xs font-bold text-white">
        <Radio size={13} aria-hidden />
        Dziś na sali plenarnej
      </span>
    );
  }

  if (decyzja.powod === "obrady-najblizsze" && decyzja.dataObrad) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-bold text-white ring-1 ring-white/25">
        <CalendarDays size={13} aria-hidden />
        W porządku obrad · {formatPosiedzenieDate(decyzja.dataObrad)}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-300/20 px-3 py-1 text-xs font-bold text-amber-100 ring-1 ring-amber-300/35">
      <Flame size={13} aria-hidden />
      Gorący temat
    </span>
  );
}

export function DecyzjaDniaSkeleton() {
  return (
    <div
      aria-busy="true"
      aria-label="Ładowanie decyzji dnia"
      className="h-96 animate-pulse rounded-3xl bg-white/10"
    />
  );
}

export default async function DecyzjaDniaCard() {
  const decyzja = await fetchDecyzjaDnia();

  if (!decyzja) {
    return (
      <section
        aria-labelledby="decyzja-dnia"
        className="rounded-3xl border border-white/10 bg-linear-to-br from-white/10 to-navy-800 p-6 shadow-lg shadow-sejm-green/5"
      >
        <h2 id="decyzja-dnia" className="text-lg font-bold">
          Decyzja dnia
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-white/80">
          Nie udało się teraz ustalić, nad czym pracuje Sejm. Przejrzyj{" "}
          <Link href="/ustawy" className="font-semibold text-emerald-300 underline">
            listę ustaw
          </Link>{" "}
          i wybierz projekt, który Cię interesuje.
        </p>
      </section>
    );
  }

  const { ustawa } = decyzja;
  const href = `/ustawy/${ustawa.id}`;
  const skrot = firstSentences(ustawa.ai_w_skrocie);

  return (
    <section
      aria-labelledby="decyzja-dnia"
      className="relative overflow-hidden rounded-3xl border border-white/10 bg-linear-to-br from-[#16324a] via-navy-800 to-sejm-green/20 p-6 shadow-lg shadow-sejm-green/5"
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -right-14 -top-16 size-48 rounded-full bg-sejm-green/20 blur-3xl"
      />

      <div className="relative flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2
            id="decyzja-dnia"
            className="text-sm font-bold uppercase tracking-[0.12em] text-emerald-300"
          >
            Decyzja dnia
          </h2>
          <ReasonBadge decyzja={decyzja} />
        </div>

        <div>
          <LegislativeTitle title={ustawa.tytul_oficjalny} as="p" scale="card" />
          <p className="mt-1.5 text-sm text-white/70">
            Druk nr {ustawa.numer_druku}
            {ustawa.autor ? ` · ${ustawa.autor}` : ""}
          </p>
        </div>

        {skrot ? <p className="text-base leading-relaxed text-white/90">{skrot}</p> : null}

        <ImpactStrip ustawa={ustawa} />

        <div className="rounded-2xl bg-navy-950/40 p-4 ring-1 ring-white/10">
          <GlosObywateli printNum={ustawa.numer_druku} variant="compact" detailsHref={href} />
        </div>

        <Link
          href={href}
          className="group flex min-h-12 items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-base font-bold text-navy-900 transition-colors hover:bg-emerald-50"
        >
          Zrozum tę ustawę w minutę
          <ArrowRight
            size={18}
            className="transition-transform group-hover:translate-x-0.5"
            aria-hidden
          />
        </Link>
      </div>
    </section>
  );
}
