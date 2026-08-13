"use client";

import { useCallback, useMemo, useState } from "react";
import {
  BarChart3,
  CheckCircle2,
  ChevronDown,
  FileText,
  Users,
  Vote,
  X,
  XCircle,
} from "lucide-react";
import VotePill from "@/components/vote-pill";
import type { ClubTheme } from "@/lib/club-colors";
import type { AttendanceComparison } from "@/lib/sejm-attendance";
import {
  formatInterpellationCount,
  formatVoteDate,
  formatVoteLabel,
  getVoteBadgeClass,
  type MpProfileStats,
  type MpVote,
} from "@/lib/mp-stats";
import type { InterpellationItem, VotingDeepDive } from "@/lib/sejm-voting";

type MpProfileInteractiveProps = {
  poselId: number;
  stats: MpProfileStats;
  comparison: AttendanceComparison;
  interpellations: InterpellationItem[];
  interpellationsTotal: number;
  voteDetails: Record<string, VotingDeepDive>;
  // Kolory klubu posła — nagłówki i ikony profilu zamiast stałej zieleni.
  clubTheme: ClubTheme;
};

type Panel = "attendance" | "interpellations" | null;

function FallbackNotice({ message }: { message: string }) {
  return (
    <p className="rounded-xl bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-100 ring-1 ring-amber-400/20">
      {message}
    </p>
  );
}

function StatCardButton({
  icon: Icon,
  label,
  value,
  hint,
  active,
  onClick,
  theme,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  hint?: string;
  active?: boolean;
  onClick: () => void;
  theme: ClubTheme;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={`rounded-2xl border p-4 text-left transition-all hover:bg-white/8 ${
        active ? `${theme.border} ${theme.bg}` : "border-white/10 bg-white/5"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <div className={`flex items-center gap-2 ${theme.text}`}>
          <Icon size={16} aria-hidden />
          <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
        </div>
        <ChevronDown
          size={16}
          className={`shrink-0 text-white/40 transition-transform ${active ? "rotate-180" : ""}`}
          aria-hidden
        />
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-white/50">{hint}</p> : null}
    </button>
  );
}

function ComparisonBar({
  label,
  value,
  display,
  highlight,
  theme,
}: {
  label: string;
  value: number;
  display: string;
  highlight?: boolean;
  theme: ClubTheme;
}) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
        <span className={highlight ? `font-semibold ${theme.text}` : "text-white/70"}>
          {label}
        </span>
        <span className="font-semibold tabular-nums">{display}</span>
      </div>
      {/* Kolor słupka posła bierzemy z klasy tekstu klubu przez bg-current,
          bo mapa kolorów nie definiuje wariantu tła w pełnym kryciu. */}
      <div className={`h-2.5 overflow-hidden rounded-full bg-white/10 ${theme.text}`}>
        <div
          className={`h-full rounded-full transition-all ${
            highlight ? "bg-current" : "bg-white/35"
          }`}
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  );
}

function AttendancePanel({
  poselId,
  data,
  theme,
}: {
  poselId: number;
  data: AttendanceComparison;
  theme: ClubTheme;
}) {
  return (
    <div className="flex flex-col gap-4 pt-2">
      {data.fallbackMessage ? <FallbackNotice message={data.fallbackMessage} /> : null}
      <p className="text-xs text-white/50">
        Porównanie frekwencji w głosowaniach X kadencji Sejmu (poseł #{poselId}). Dane z bazy
        Supabase.
      </p>
      <ComparisonBar
        label="Ten poseł"
        value={data.mp ?? 0}
        display={data.mp !== null ? `${data.mp}%` : "—"}
        highlight
        theme={theme}
      />
      {data.clubName ? (
        <ComparisonBar
          label={`Klub ${data.clubName}`}
          value={data.club ?? 0}
          display={data.club !== null ? `${data.club}%` : "—"}
          theme={theme}
        />
      ) : null}
      <ComparisonBar
        label="Średnia Sejmu"
        value={data.sejm ?? 0}
        display={data.sejm !== null ? `${data.sejm}%` : "—"}
        theme={theme}
      />
    </div>
  );
}

function InterpellationsPanel({
  items,
  total,
}: {
  items: InterpellationItem[];
  total: number;
}) {
  if (items.length === 0) {
    return (
      <p className="py-4 text-sm text-white/60">
        Brak interpelacji w bazie. Uruchom synchronizację pod adresem /api/sync-details.
      </p>
    );
  }

  const hasMore = total > items.length;

  return (
    <>
      {hasMore ? (
        <p className="text-xs text-white/45">
          Wyświetlamy {items.length} z {total} interpelacji w bazie.
        </p>
      ) : null}
      <ul className="mt-2 flex max-h-80 flex-col gap-2 overflow-y-auto">
        {items.map((item) => (
          <li
            key={item.num}
            className="border-b border-white/10 py-3 last:border-b-0"
          >
            <p className="text-xs text-white/45">
              {item.receiptDate
                ? formatVoteDate(item.receiptDate)
                : item.sentDate
                  ? formatVoteDate(item.sentDate)
                  : "—"}
              {item.status ? ` · ${item.status}` : ""}
              {item.to?.length ? ` · do: ${item.to.join(", ")}` : ""}
            </p>
            <p className="mt-1 text-sm leading-snug">{item.title}</p>
          </li>
        ))}
      </ul>
    </>
  );
}

function VotingDetailsModal({
  open,
  details,
  onClose,
}: {
  open: boolean;
  details: VotingDeepDive | null;
  onClose: () => void;
}) {
  if (!open || !details) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 p-4 sm:items-center"
      role="presentation"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="voting-details-title"
        className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-navy-800 p-5 ring-1 ring-white/15"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <h3 id="voting-details-title" className="text-lg font-bold leading-snug">
            Szczegóły głosowania
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Zamknij"
            className="flex size-8 shrink-0 items-center justify-center rounded-full bg-white/10 text-white/70 hover:bg-white/15"
          >
            <X size={16} aria-hidden />
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {details.fallbackMessage ? <FallbackNotice message={details.fallbackMessage} /> : null}
          {details.date ? (
            <p className="text-xs text-white/45">{formatVoteDate(details.date)}</p>
          ) : null}
          <p className="text-base font-semibold leading-snug">{details.title}</p>
          {details.topic ? <p className="text-sm text-white/70">{details.topic}</p> : null}
          {details.description ? (
            <p className="text-sm leading-relaxed text-white/60">{details.description}</p>
          ) : null}

          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
                Głos posła
              </p>
              <p className="mt-2">
                <span
                  className={`inline-flex rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${getVoteBadgeClass(details.mpVote)}`}
                >
                  {details.mpVoteLabel}
                </span>
              </p>
            </div>
            <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
                Linia klubu
              </p>
              <p className="mt-2 text-sm font-medium">{details.clubLineLabel}</p>
              {details.clubAligned !== null ? (
                <p
                  className={`mt-1 flex items-center gap-1 text-xs ${
                    details.clubAligned ? "text-sejm-green-light" : "text-amber-300"
                  }`}
                >
                  {details.clubAligned ? (
                    <CheckCircle2 size={12} aria-hidden />
                  ) : (
                    <XCircle size={12} aria-hidden />
                  )}
                  {details.clubAligned ? "Zgodnie z klubem" : "Niezgodnie z klubem"}
                </p>
              ) : null}
            </div>
          </div>

          <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
            <p className="text-[10px] font-semibold uppercase tracking-wide text-white/45">
              Wynik głosowania
            </p>
            <p
              className={`mt-2 text-sm font-semibold ${
                details.outcome === "passed"
                  ? "text-sejm-green-light"
                  : details.outcome === "rejected"
                    ? "text-red-300"
                    : "text-white/70"
              }`}
            >
              {details.outcomeLabel}
            </p>
            <div className="mt-2 flex flex-wrap gap-3 text-xs text-white/55">
              <span>ZA: {details.yes}</span>
              <span>PRZECIW: {details.no}</span>
              <span>WSTRZYMAŁ SIĘ: {details.abstain}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function voteKey(vote: MpVote): string {
  return `${vote.sitting}-${vote.votingNumber}`;
}

function buildFallbackDeepDive(vote: MpVote): VotingDeepDive {
  return {
    title: vote.title ?? vote.topic ?? "Głosowanie",
    description: vote.description ?? "",
    topic: vote.topic ?? "",
    date: vote.date,
    mpVote: vote.vote,
    mpVoteLabel: formatVoteLabel(vote.vote),
    clubLine: null,
    clubLineLabel: "Brak danych klubowych",
    clubAligned: null,
    outcome: "inconclusive",
    outcomeLabel: "Brak danych o wyniku",
    yes: 0,
    no: 0,
    abstain: 0,
    partial: true,
    fallbackMessage: "Szczegóły nie zostały jeszcze zsynchronizowane do bazy.",
  };
}

export default function MpProfileInteractive({
  poselId,
  stats,
  comparison,
  interpellations,
  interpellationsTotal,
  voteDetails,
  clubTheme,
}: MpProfileInteractiveProps) {
  const [activePanel, setActivePanel] = useState<Panel>(null);
  const [selectedVote, setSelectedVote] = useState<MpVote | null>(null);

  const togglePanel = useCallback((panel: Panel) => {
    setActivePanel((current) => (current === panel ? null : panel));
  }, []);

  const selectedDetails = useMemo(() => {
    if (!selectedVote) {
      return null;
    }

    return voteDetails[voteKey(selectedVote)] ?? buildFallbackDeepDive(selectedVote);
  }, [selectedVote, voteDetails]);

  return (
    <>
      <div className="flex flex-col gap-6">
        {stats.fallbackMessage ? <FallbackNotice message={stats.fallbackMessage} /> : null}

        <section>
          <h2
            className={`mb-3 text-sm font-semibold uppercase tracking-wide ${clubTheme.text}`}
          >
            Statystyki
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <StatCardButton
              icon={BarChart3}
              label="Frekwencja"
              theme={clubTheme}
              value={
                stats.attendancePercent !== null ? `${stats.attendancePercent}%` : "—"
              }
              hint={
                stats.totalVotings > 0
                  ? `${stats.participatedVotings} z ${stats.totalVotings} głosowań`
                  : "Brak danych w bazie"
              }
              active={activePanel === "attendance"}
              onClick={() => togglePanel("attendance")}
            />
            <StatCardButton
              icon={FileText}
              label="Interpelacje"
              theme={clubTheme}
              value={formatInterpellationCount(
                stats.interpellationCount,
                stats.interpellationApproximate,
              )}
              hint="w X kadencji (z bazy)"
              active={activePanel === "interpellations"}
              onClick={() => togglePanel("interpellations")}
            />
          </div>

          {activePanel === "attendance" ? (
            <article
              className={`mt-3 rounded-2xl border bg-white/5 p-4 ${clubTheme.border}`}
            >
              <div className={`mb-2 flex items-center gap-2 ${clubTheme.text}`}>
                <Users size={14} aria-hidden />
                <p className="text-xs font-semibold uppercase tracking-wide">
                  Porównanie frekwencji
                </p>
              </div>
              <AttendancePanel poselId={poselId} data={comparison} theme={clubTheme} />
            </article>
          ) : null}

          {activePanel === "interpellations" ? (
            <article
              className={`mt-3 rounded-2xl border bg-white/5 p-4 ${clubTheme.border}`}
            >
              <div className={`mb-2 flex items-center gap-2 ${clubTheme.text}`}>
                <FileText size={14} aria-hidden />
                <p className="text-xs font-semibold uppercase tracking-wide">
                  Interpelacje posła
                </p>
              </div>
              <InterpellationsPanel items={interpellations} total={interpellationsTotal} />
            </article>
          ) : null}
        </section>

        <section>
          <div className={`mb-3 flex items-center gap-2 ${clubTheme.text}`}>
            <Vote size={16} aria-hidden />
            <h2 className="text-sm font-semibold uppercase tracking-wide">
              Ostatnie głosowania
            </h2>
          </div>

          {stats.recentVotes.length === 0 ? (
            <div className="rounded-2xl bg-white/5 p-4 text-sm text-white/60 ring-1 ring-white/10">
              Brak głosowań w bazie. Uruchom synchronizację pod adresem /api/sync-details.
            </div>
          ) : (
            <ul className="flex flex-col gap-2">
              {stats.recentVotes.map((vote) => (
                <li key={`${vote.sitting}-${vote.date}-${vote.votingNumber}`}>
                  <button
                    type="button"
                    onClick={() => setSelectedVote(vote)}
                    className={`w-full rounded-2xl border bg-white/5 p-4 text-left transition-colors hover:bg-white/8 ${clubTheme.border}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs text-white/45">{formatVoteDate(vote.date)}</p>
                        <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug">
                          {vote.title ?? vote.topic ?? "Głosowanie"}
                        </p>
                        <p className="mt-1 text-[10px] text-white/35">
                          Kliknij, aby zobaczyć szczegóły
                        </p>
                      </div>
                      <VotePill vote={vote.vote} />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <VotingDetailsModal
        open={selectedVote !== null}
        details={selectedDetails}
        onClose={() => setSelectedVote(null)}
      />
    </>
  );
}
