import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowRightLeft,
  ChevronLeft,
  FileDown,
  FileText,
  Lightbulb,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import LegislativeProgress from "@/components/legislative-progress";
import UstawaWatchedVotes from "@/components/ustawa-watched-votes";
import WatchUstawaButton from "@/components/watch-ustawa-button";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  formatUstawaDate,
  getStageLabel,
  hasReachedVoting,
  shortenTitle,
  type Ustawa,
} from "@/lib/ustawa";
import { detectDziedzina } from "@/lib/ustawa-human-summary";

type UstawaPageProps = {
  params: Promise<{ id: string }>;
};

async function fetchUstawa(idOrNumer: string): Promise<Ustawa | null> {
  const numericId = Number(idOrNumer);
  const column = Number.isInteger(numericId) && idOrNumer.trim() !== "" ? "id" : "numer_druku";
  const value = column === "id" ? numericId : decodeURIComponent(idOrNumer);

  const { data } = await supabaseAdmin
    .from("ustawy")
    .select("*")
    .eq(column, value)
    .maybeSingle();

  return (data as Ustawa | null) ?? null;
}

export async function generateMetadata({ params }: UstawaPageProps) {
  const { id } = await params;
  const ustawa = await fetchUstawa(id);

  if (!ustawa) {
    return { title: "Ustawa nie znaleziona — SEJM ON" };
  }

  return {
    title: `Druk nr ${ustawa.numer_druku} — SEJM ON`,
    description: ustawa.opis_ludzki ?? shortenTitle(ustawa.tytul_oficjalny, 150),
  };
}

function UnderstandCard({
  icon: Icon,
  label,
  content,
}: {
  icon: LucideIcon;
  label: string;
  content: string | null;
}) {
  return (
    <article className="rounded-2xl border border-emerald-400/15 bg-linear-to-br from-navy-800 via-navy-800 to-emerald-500/10 p-5 shadow-lg ring-1 ring-emerald-400/10">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
          <Icon size={20} strokeWidth={1.9} aria-hidden />
        </span>
        <h3 className="text-base font-bold leading-tight">{label}</h3>
      </div>

      {content ? (
        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-white/75">
          {content}
        </p>
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-white/45">
          Ta sekcja nie została jeszcze opracowana dla tego druku.
        </p>
      )}
    </article>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/10 py-3 last:border-b-0">
      <dt className="shrink-0 text-xs font-semibold uppercase tracking-wide text-white/45">
        {label}
      </dt>
      <dd className="text-right text-sm font-medium text-white/85">{value}</dd>
    </div>
  );
}

export default async function UstawaPage({ params }: UstawaPageProps) {
  const { id } = await params;
  const ustawa = await fetchUstawa(id);

  if (!ustawa) {
    notFound();
  }

  const dziedzina = detectDziedzina(ustawa.tytul_oficjalny);

  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <Link
        href="/ustawy"
        className="flex w-fit items-center gap-1 text-sm text-white/70 transition-colors hover:text-white"
      >
        <ChevronLeft size={18} aria-hidden />
        Wróć do listy ustaw
      </Link>

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-bold text-emerald-300 ring-1 ring-emerald-400/25">
            Druk nr {ustawa.numer_druku}
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-white/70">
            {getStageLabel(ustawa.etap_legislacyjny)}
          </span>
          <span className="rounded-full bg-white/5 px-3 py-1 text-xs font-medium text-white/50">
            {dziedzina}
          </span>
        </div>

        <h1 className="mt-4 text-2xl font-bold leading-snug">
          {shortenTitle(ustawa.tytul_oficjalny, 110)}
        </h1>
      </header>

      <section aria-labelledby="zrozum-ustawe">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles size={18} className="text-emerald-300" aria-hidden />
          <h2 id="zrozum-ustawe" className="text-lg font-semibold">
            Zrozum ustawę
          </h2>
          <span className="ml-auto rounded-full bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-white/40">
            Wersja demo
          </span>
        </div>

        <div className="grid gap-3">
          <UnderstandCard
            icon={Lightbulb}
            label="W skrócie"
            content={ustawa.opis_ludzki}
          />
          <UnderstandCard
            icon={Users}
            label="Kogo to dotyczy?"
            content={ustawa.kogo_dotyczy}
          />
          <UnderstandCard
            icon={ArrowRightLeft}
            label="Co realnie zmienia?"
            content={ustawa.co_zmienia}
          />
          <UnderstandCard
            icon={Wallet}
            label="Skąd na to pieniądze?"
            content={ustawa.koszty_i_finansowanie}
          />
        </div>

        <p className="mt-3 text-xs leading-relaxed text-white/35">
          Podsumowania powstają automatycznie i mają charakter pomocniczy. Wiążąca jest
          wyłącznie treść druku sejmowego.
        </p>
      </section>

      <UstawaWatchedVotes
        ustawaId={ustawa.id}
        hasVoting={hasReachedVoting(ustawa.etap_legislacyjny)}
      />

      <section aria-labelledby="metryka" className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <FileText size={18} className="text-emerald-300" aria-hidden />
          <h2 id="metryka" className="text-lg font-semibold">
            Metryka i postęp
          </h2>
        </div>

        <article className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-white/45">
            Tytuł oficjalny
          </h3>
          <p className="mt-2 text-sm leading-relaxed text-white/85">
            {ustawa.tytul_oficjalny}
          </p>

          <dl className="mt-4">
            <MetaRow label="Numer druku" value={ustawa.numer_druku} />
            <MetaRow label="Autor" value={ustawa.autor ?? "Nieokreślony"} />
            <MetaRow label="Data wpływu" value={formatUstawaDate(ustawa.data_wplywu)} />
            <MetaRow label="Etap" value={getStageLabel(ustawa.etap_legislacyjny)} />
          </dl>
        </article>

        {ustawa.pdf_url ? (
          <a
            href={ustawa.pdf_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-2xl border border-emerald-400/25 bg-emerald-400/10 p-4 transition-colors hover:border-emerald-400/45 hover:bg-emerald-400/15"
          >
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
              <FileDown size={20} strokeWidth={1.9} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-white">
                Czytaj oryginał (PDF)
              </span>
              <span className="block text-xs text-white/50">
                Pełna treść druku nr {ustawa.numer_druku} z serwera Sejmu
              </span>
            </span>
          </a>
        ) : (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-white/15 bg-white/5 p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-white/5 text-white/35">
              <FileDown size={20} strokeWidth={1.9} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-bold text-white/60">
                Czytaj oryginał (PDF)
              </span>
              <span className="block text-xs text-white/40">
                API Sejmu nie udostępnia skanu tego druku.
              </span>
            </span>
          </div>
        )}

        <LegislativeProgress etap={ustawa.etap_legislacyjny} />

        <WatchUstawaButton ustawaId={ustawa.id} numerDruku={ustawa.numer_druku} />

        <a
          href={`https://api.sejm.gov.pl/sejm/term10/prints/${encodeURIComponent(ustawa.numer_druku)}`}
          target="_blank"
          rel="noreferrer"
          className="text-center text-xs font-medium text-emerald-300/80 hover:text-emerald-300 hover:underline"
        >
          Zobacz dane źródłowe druku w API Sejmu
        </a>
      </section>
    </div>
  );
}
