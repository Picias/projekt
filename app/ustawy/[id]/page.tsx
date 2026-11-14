import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  ArrowRightLeft,
  FileDown,
  FileText,
  Lightbulb,
  Sparkles,
  Users,
  Wallet,
  type LucideIcon,
} from "lucide-react";

import BackButton from "@/components/back-button";
import { ShareButton } from "@/components/ShareCardGenerator";
import GenerateAiSummary from "@/components/generate-ai-summary";
import GlosObywateli from "@/components/glos-obywateli";
import ImpactMeter from "@/components/impact-meter";
import LegislativeProgress from "@/components/legislative-progress";
import LegislativeTitle from "@/components/legislative-title";
import UstawaWatchedVotes from "@/components/ustawa-watched-votes";
import WatchUstawaButton from "@/components/watch-ustawa-button";
import { detectImpactAreas, getWalletImpact } from "@/lib/impact";
import { plainTitle } from "@/lib/legislative-title";
import {
  formatUstawaDate,
  getStageLabel,
  hasAiSummary,
  hasReachedVoting,
  shortenTitle,
} from "@/lib/ustawa";
import { fetchUstawaByParam } from "@/lib/ustawa-db";

type UstawaPageProps = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: UstawaPageProps) {
  const { id } = await params;
  const ustawa = await fetchUstawaByParam(id);

  if (!ustawa) {
    return { title: "Ustawa nie znaleziona — SEJM ON" };
  }

  return {
    title: `${shortenTitle(plainTitle(ustawa.tytul_oficjalny), 70)} (druk nr ${ustawa.numer_druku}) — SEJM ON`,
    description: stripBold(
      ustawa.ai_w_skrocie ?? ustawa.opis_ludzki ?? shortenTitle(ustawa.tytul_oficjalny, 150),
    ),
  };
}

const BULLET_LINE = /^(?:•|–|-|\*)\s+/;
const NUMBERED_LINE = /^\d+[.)]\s+/;

function stripBold(text: string): string {
  return text.replace(/\*\*/g, "");
}

/** **fraza** z odpowiedzi modelu → <strong>, bez wstawiania surowego HTML. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, index) => {
    const isBold = part.startsWith("**") && part.endsWith("**") && part.length > 4;

    if (!isBold) {
      return part;
    }

    return (
      <strong key={`${keyPrefix}-${index}`} className="font-semibold text-white">
        {part.slice(2, -2)}
      </strong>
    );
  });
}

function SummaryBody({ content }: { content: string }) {
  const items: string[] = [];
  const paragraphs: string[] = [];

  for (const line of content.split("\n")) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    if (BULLET_LINE.test(trimmed) || NUMBERED_LINE.test(trimmed)) {
      items.push(trimmed.replace(BULLET_LINE, "").replace(NUMBERED_LINE, ""));
    } else {
      paragraphs.push(trimmed);
    }
  }

  return (
    <div className="mt-4 flex flex-col gap-3 text-base leading-relaxed text-white/80">
      {paragraphs.map((paragraph, index) => (
        <p key={`p-${index}`}>{renderInline(paragraph, `p-${index}`)}</p>
      ))}
      {items.length > 0 ? (
        <ul className="list-disc space-y-4 pl-5">
          {items.map((item, index) => (
            <li key={`li-${index}`}>{renderInline(item, `li-${index}`)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
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
    <article className="rounded-2xl border border-emerald-400/20 bg-linear-to-br from-navy-800 via-navy-800 to-emerald-500/10 p-5 shadow-lg">
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
          <Icon size={20} strokeWidth={1.9} aria-hidden />
        </span>
        <h3 className="text-lg font-bold leading-tight">{label}</h3>
      </div>

      {content ? (
        <SummaryBody content={content} />
      ) : (
        <p className="mt-4 text-sm leading-relaxed text-white/70">
          Ta sekcja nie została jeszcze opracowana dla tego druku.
        </p>
      )}
    </article>
  );
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/10 py-3 last:border-b-0">
      <dt className="shrink-0 text-sm font-semibold text-white/70">{label}</dt>
      <dd className="text-right text-sm font-medium text-white">{value}</dd>
    </div>
  );
}

export default async function UstawaPage({ params }: UstawaPageProps) {
  const { id } = await params;
  const ustawa = await fetchUstawaByParam(id);

  if (!ustawa) {
    notFound();
  }

  const aiReady = hasAiSummary(ustawa);
  const impactAreas = detectImpactAreas(ustawa);
  const wallet = getWalletImpact(impactAreas);
  const impactLabel = impactAreas[0]?.label ?? "Sprawy państwowe";

  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <BackButton label="Wróć do listy ustaw" />

      <header>
        <div className="flex flex-wrap items-center gap-2">
          <span className="rounded-full bg-emerald-400/15 px-3 py-1 text-sm font-bold text-emerald-200 ring-1 ring-emerald-400/30">
            Druk nr {ustawa.numer_druku}
          </span>
          <span className="rounded-full bg-white/10 px-3 py-1 text-sm font-semibold text-white">
            Etap: {getStageLabel(ustawa.etap_legislacyjny)}
          </span>
        </div>

        <div className="mt-4">
          <LegislativeTitle
            title={ustawa.tytul_oficjalny}
            as="h1"
            scale="hero"
            showOfficial
          />
        </div>

        <p className="mt-2 text-sm text-white/75">
          Zgłosił: {ustawa.autor ?? "wnioskodawca nieokreślony"} ·{" "}
          {formatUstawaDate(ustawa.data_wplywu)}
        </p>
      </header>

      <ImpactMeter ustawa={ustawa} />

      <ShareButton
        className="w-full"
        card={{
          type: "ustawa",
          title: shortenTitle(plainTitle(ustawa.tytul_oficjalny), 120),
          impactLabel,
          tags: [...impactAreas.map((area) => area.label), ...(ustawa.tagi ?? [])],
          summary: ustawa.ai_w_skrocie ?? ustawa.opis_ludzki,
          walletLabel: wallet.label,
          walletLevel: wallet.level,
        }}
      />

      <WatchUstawaButton
        ustawaId={ustawa.id}
        numerDruku={ustawa.numer_druku}
        liczbaObserwujacych={ustawa.liczba_obserwujacych ?? 0}
      />

      <section aria-labelledby="zrozum-ustawe">
        <div className="mb-4 flex items-center gap-2">
          <Sparkles size={20} className="text-emerald-300" aria-hidden />
          <h2 id="zrozum-ustawe" className="text-lg font-bold">
            Zrozum ustawę
          </h2>
        </div>

        {aiReady ? (
          <div className="grid gap-3">
            <UnderstandCard
              icon={Lightbulb}
              label="W skrócie"
              content={ustawa.ai_w_skrocie}
            />
            <UnderstandCard
              icon={Users}
              label="Kogo to dotyczy?"
              content={ustawa.ai_kogo_dotyczy}
            />
            <UnderstandCard
              icon={ArrowRightLeft}
              label="Co realnie zmienia?"
              content={ustawa.ai_co_zmienia}
            />
            <UnderstandCard
              icon={Wallet}
              label="Skąd na to pieniądze?"
              content={ustawa.ai_skad_pieniadze}
            />
          </div>
        ) : (
          <GenerateAiSummary numerDruku={ustawa.numer_druku} />
        )}

        <p className="mt-3 text-sm leading-relaxed text-white/70">
          Podsumowania i wskaźnik wpływu powstają automatycznie i mają charakter pomocniczy.
          Wiążąca jest wyłącznie treść druku sejmowego.
        </p>
      </section>

      <GlosObywateli printNum={ustawa.numer_druku} />

      <UstawaWatchedVotes
        ustawaId={ustawa.id}
        hasVoting={hasReachedVoting(ustawa.etap_legislacyjny)}
      />

      <section aria-labelledby="metryka" className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <FileText size={20} className="text-emerald-300" aria-hidden />
          <h2 id="metryka" className="text-lg font-bold">
            Metryka i postęp
          </h2>
        </div>

        <LegislativeProgress etap={ustawa.etap_legislacyjny} />

        <article className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/15">
          <dl>
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
              <span className="block text-sm text-white/75">
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
              <span className="block text-sm font-bold text-white/80">
                Czytaj oryginał (PDF)
              </span>
              <span className="block text-sm text-white/70">
                API Sejmu nie udostępnia skanu tego druku.
              </span>
            </span>
          </div>
        )}

        <a
          href={`https://api.sejm.gov.pl/sejm/term10/prints/${encodeURIComponent(ustawa.numer_druku)}`}
          target="_blank"
          rel="noreferrer"
          className="flex min-h-11 items-center justify-center text-center text-sm font-medium text-emerald-300 hover:underline"
        >
          Zobacz dane źródłowe druku w API Sejmu
        </a>
      </section>
    </div>
  );
}
