"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ChevronDown,
  ChevronRight,
  FileX,
  Mail,
  Minus,
  Play,
  SearchX,
  ThumbsDown,
  ThumbsUp,
  UserX,
  Vote,
} from "lucide-react";
import EmptyState from "@/components/EmptyState";
import type { ClubTheme } from "@/lib/club-colors";
import { formatVoteDate, formatVoteLabel, type MpVote } from "@/lib/mp-stats";
import { speechWatchHref, type ScrapedSpeech } from "@/lib/sejm-speech-types";
import {
  getInterpellationStatusClass,
  interpellationHref,
  votingDetailsHref,
  type InterpellationItem,
} from "@/lib/sejm-voting";

export type MpProfileTabId = "votes" | "speeches" | "interpellations" | "contact";

type GlosFilter = "" | "ZA" | "PRZECIW" | "WSTRZYMAŁ SIĘ" | "NIEOBECNY";

type MpProfileTabsProps = {
  poselId: number;
  votes: MpVote[];
  sittings?: number[];
  votesSimulated: boolean;
  speeches: ScrapedSpeech[] | null;
  speechesError: string | null;
  speechesLoading: boolean;
  interpellations: InterpellationItem[];
  interpellationsHasMore?: boolean;
  email: string | null;
  clubTheme: ClubTheme;
  activeTab: MpProfileTabId;
  onTabChange: (tab: MpProfileTabId) => void;
};

const TABS: { id: MpProfileTabId; label: string }[] = [
  { id: "votes", label: "Ostatnie głosowania" },
  { id: "speeches", label: "Wystąpienia" },
  { id: "interpellations", label: "Interpelacje" },
  { id: "contact", label: "Kontakt" },
];

const GLOS_FILTERS: { value: GlosFilter; label: string }[] = [
  { value: "", label: "Wszystkie głosy" },
  { value: "ZA", label: "ZA" },
  { value: "PRZECIW", label: "PRZECIW" },
  { value: "WSTRZYMAŁ SIĘ", label: "WSTRZYMAŁ SIĘ" },
  { value: "NIEOBECNY", label: "NIEOBECNY" },
];

const selectClassName =
  "w-full rounded-xl border border-white/10 bg-navy-800 px-3 py-2.5 text-sm text-white outline-none transition-colors [color-scheme:dark] focus:border-white/25";

const sittingListClassName =
  "absolute z-20 mt-1 max-h-60 w-full overflow-x-hidden overflow-y-auto rounded-xl border border-white/10 bg-navy-800 py-1 shadow-lg shadow-navy-950/40 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-700 hover:[&::-webkit-scrollbar-thumb]:bg-slate-600";

function SittingSelect({
  sittings,
  value,
  onChange,
}: {
  sittings: number[];
  value: string;
  onChange: (next: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const label = value ? `Nr ${value}` : "Wszystkie";

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className={`${selectClassName} flex items-center justify-between gap-2 text-left`}
      >
        <span>{label}</span>
        <ChevronDown
          size={16}
          className={`shrink-0 text-white/45 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {open ? (
        <ul role="listbox" className={sittingListClassName}>
          <li>
            <button
              type="button"
              role="option"
              aria-selected={!value}
              onClick={() => {
                onChange("");
                setOpen(false);
              }}
              className={`w-full px-3 py-2 text-left text-sm ${
                !value ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/8"
              }`}
            >
              Wszystkie
            </button>
          </li>
          {sittings.map((sitting) => {
            const selected = value === String(sitting);

            return (
              <li key={sitting}>
                <button
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(String(sitting));
                    setOpen(false);
                  }}
                  className={`w-full px-3 py-2 text-left text-sm ${
                    selected ? "bg-white/10 text-white" : "text-white/80 hover:bg-white/8"
                  }`}
                >
                  Nr {sitting}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function VoteIcon({ vote }: { vote: string }) {
  if (vote === "YES") {
    return (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sejm-green/20 text-sejm-green-light ring-1 ring-sejm-green/35">
        <ThumbsUp size={18} aria-hidden />
      </span>
    );
  }

  if (vote === "NO") {
    return (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-red-500/20 text-red-300 ring-1 ring-red-400/35">
        <ThumbsDown size={18} aria-hidden />
      </span>
    );
  }

  if (vote === "ABSENT") {
    return (
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-slate-500/20 text-slate-300 ring-1 ring-slate-400/30">
        <UserX size={18} aria-hidden />
      </span>
    );
  }

  return (
    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/30">
      <Minus size={18} aria-hidden />
    </span>
  );
}

function voteToneClass(vote: string): string {
  if (vote === "YES") return "text-sejm-green-light";
  if (vote === "NO") return "text-red-300";
  if (vote === "ABSENT") return "text-slate-300";
  return "text-amber-200";
}

function voteFilterKey(vote: string): GlosFilter {
  switch (vote) {
    case "YES":
      return "ZA";
    case "NO":
      return "PRZECIW";
    case "ABSTAIN":
      return "WSTRZYMAŁ SIĘ";
    case "ABSENT":
    case "NO_VOTE":
      return "NIEOBECNY";
    default:
      return "";
  }
}

function VotesPanel({
  votes,
  sittings: sittingsProp,
  simulated,
  poselId,
}: {
  votes: MpVote[];
  sittings?: number[];
  simulated: boolean;
  poselId: number;
}) {
  const [filtrPosiedzenia, setFiltrPosiedzenia] = useState("");
  const [filtrGlosu, setFiltrGlosu] = useState<GlosFilter>("");
  const [visibleCount, setVisibleCount] = useState(80);

  useEffect(() => {
    setVisibleCount(80);
  }, [filtrPosiedzenia, filtrGlosu]);

  const sittings = useMemo(() => {
    const fromVotes = votes.map((vote) => vote.sitting).filter(Boolean);
    return [...new Set([...(sittingsProp ?? []), ...fromVotes])].sort((a, b) => b - a);
  }, [votes, sittingsProp]);

  const filteredVotes = useMemo(() => {
    return votes.filter((vote) => {
      if (filtrPosiedzenia && String(vote.sitting) !== filtrPosiedzenia) {
        return false;
      }

      if (filtrGlosu && voteFilterKey(vote.vote) !== filtrGlosu) {
        return false;
      }

      return true;
    });
  }, [votes, filtrPosiedzenia, filtrGlosu]);

  const visibleVotes = filtrPosiedzenia
    ? filteredVotes
    : filteredVotes.slice(0, visibleCount);
  const hiddenVotes = filteredVotes.length - visibleVotes.length;

  if (votes.length === 0) {
    return (
      <EmptyState
        icon={Vote}
        title="Brak głosowań"
        description="Ten poseł nie ma jeszcze zarejestrowanych głosowań w tej kadencji."
      />
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {simulated ? (
        <p className="rounded-xl bg-amber-400/10 px-3 py-2 text-xs leading-relaxed text-amber-100 ring-1 ring-amber-400/20">
          Podgląd listy — API Sejmu nie zwróciło jeszcze głosowań dla tego ID.
        </p>
      ) : null}

      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
            Posiedzenie
          </span>
          <SittingSelect
            sittings={sittings}
            value={filtrPosiedzenia}
            onChange={setFiltrPosiedzenia}
          />
        </label>

        <label className="flex flex-col gap-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/45">
            Oddany głos
          </span>
          <select
            value={filtrGlosu}
            onChange={(event) => setFiltrGlosu(event.target.value as GlosFilter)}
            className={selectClassName}
          >
            {GLOS_FILTERS.map((option) => (
              <option key={option.value || "all"} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {filteredVotes.length === 0 ? (
        <EmptyState
          icon={SearchX}
          title="Brak wyników"
          description="Żadne głosowanie nie pasuje do wybranych filtrów."
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {visibleVotes.map((vote) => {
            const content = (
              <div className="flex items-start gap-3">
                <VoteIcon vote={vote.vote} />
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-white/45">
                    {formatVoteDate(vote.date)}
                    {vote.sitting ? ` · pos. ${vote.sitting}` : ""}
                  </p>
                  <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug">
                    {vote.title ?? vote.topic ?? "Głosowanie"}
                  </p>
                  {vote.topic && vote.title ? (
                    <p className="mt-1 line-clamp-1 text-[11px] text-white/40">
                      {vote.topic}
                    </p>
                  ) : null}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wide ${voteToneClass(vote.vote)}`}
                  >
                    {formatVoteLabel(vote.vote)}
                  </span>
                  {simulated ? null : (
                    <ChevronRight size={16} className="text-white/30" aria-hidden />
                  )}
                </div>
              </div>
            );

            return (
              <li key={`${vote.sitting}-${vote.date}-${vote.votingNumber}`}>
                {simulated ? (
                  <div className="rounded-2xl border border-white/10 bg-navy-800/70 p-4">
                    {content}
                  </div>
                ) : (
                  <Link
                    href={votingDetailsHref(
                      vote.sitting,
                      vote.votingNumber,
                      `/poslowie/${poselId}`,
                    )}
                    className="block rounded-2xl border border-white/10 bg-navy-800/70 p-4 transition-colors hover:border-white/20 hover:bg-white/8"
                  >
                    {content}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {hiddenVotes > 0 ? (
        <button
          type="button"
          onClick={() => setVisibleCount((count) => count + 80)}
          className="rounded-xl border border-white/10 bg-navy-800/70 px-4 py-3 text-sm font-semibold text-white/80 transition-colors hover:bg-white/8"
        >
          Pokaż wcześniejsze głosowania ({hiddenVotes})
        </button>
      ) : null}
    </div>
  );
}

function SpeechesPanel({
  poselId,
  items,
  error,
  loading,
}: {
  poselId: number;
  items: ScrapedSpeech[] | null;
  error: string | null;
  loading: boolean;
}) {
  if (error) {
    return (
      <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-5 text-sm text-red-200">
        <p className="font-semibold text-red-100">Nie udało się wczytać wystąpień</p>
        <p className="mt-2">{error}</p>
      </div>
    );
  }

  if (loading && items === null) {
    return (
      <div className="flex flex-col gap-2" aria-busy="true" aria-label="Ładowanie wystąpień">
        {[1, 2, 3, 4].map((item) => (
          <div key={item} className="h-20 animate-pulse rounded-2xl bg-white/10" />
        ))}
      </div>
    );
  }

  const list = items ?? [];

  if (list.length === 0) {
    return (
      <p className="text-white/60 text-sm py-4 text-center">
        Brak ostatnich wystąpień w systemie.
      </p>
    );
  }

  return (
    <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
      {list.map((speech) => {
        const dateText = speech.date
          ? formatVoteDate(speech.date)
          : speech.dateLabel ?? "—";
        const meta = [
          dateText,
          speech.sitting ? `pos. ${speech.sitting}` : null,
          speech.day ? `dzień ${speech.day}` : null,
        ]
          .filter(Boolean)
          .join(" · ");

        return (
          <li key={speech.path}>
            <Link
              href={speechWatchHref(
                speech.path,
                `/poslowie/${poselId}`,
                speech.videoPath,
                speech.streamUrl,
              )}
              className="block rounded-2xl border border-white/10 bg-navy-800/70 p-4 transition-colors hover:border-white/20 hover:bg-white/8"
            >
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sejm-green/20 text-sejm-green-light ring-1 ring-sejm-green/35">
                  <Play size={16} aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-white/45">{meta}</p>
                  <p className="mt-1 line-clamp-2 text-sm font-medium leading-snug">
                    {speech.title}
                  </p>
                </div>
                <ChevronRight size={16} className="mt-1 shrink-0 text-white/30" aria-hidden />
              </div>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function InterpellationsPanel({
  items,
  hasMore,
  poselId,
}: {
  items: InterpellationItem[];
  hasMore: boolean;
  poselId: number;
}) {
  if (items.length === 0) {
    return (
      <EmptyState
        icon={FileX}
        title="Brak interpelacji"
        description="Ten poseł nie złożył jeszcze żadnej interpelacji."
      />
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {hasMore ? (
        <p className="text-xs text-white/45">
          Pokazujemy {items.length} najnowszych interpelacji.
        </p>
      ) : null}
      <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
        {items.map((item) => (
          <li key={item.num}>
            <Link
              href={interpellationHref(item.num, `/poslowie/${poselId}`)}
              className="block rounded-2xl border border-white/10 bg-navy-800/70 p-4 transition-colors hover:border-white/20 hover:bg-white/8"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[11px] text-white/45">
                    {item.receiptDate
                      ? formatVoteDate(item.receiptDate)
                      : item.sentDate
                        ? formatVoteDate(item.sentDate)
                        : "—"}
                    {item.to?.length ? ` · do: ${item.to.join(", ")}` : ""}
                  </p>
                  <p className="mt-1 text-sm font-medium leading-snug">{item.title}</p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  {item.status ? (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${getInterpellationStatusClass(item.status)}`}
                    >
                      {item.status}
                    </span>
                  ) : null}
                  <ChevronRight size={16} className="text-white/30" aria-hidden />
                </div>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContactPanel({ email }: { email: string | null }) {
  if (!email) {
    return (
      <div className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-5 text-sm text-white/60">
        API Sejmu nie zwraca adresu e-mail dla tego posła.
      </div>
    );
  }

  return (
    <a
      href={`mailto:${email}`}
      className="flex items-center gap-3 rounded-2xl border border-white/10 bg-navy-800/70 p-4 transition-colors hover:bg-white/8"
    >
      <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-sejm-green/15 text-sejm-green-light">
        <Mail size={18} aria-hidden />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">
          E-mail poselski
        </p>
        <p className="mt-0.5 truncate text-sm font-semibold">{email}</p>
      </div>
    </a>
  );
}

export default function MpProfileTabs({
  poselId,
  votes,
  sittings,
  votesSimulated,
  speeches,
  speechesError,
  speechesLoading,
  interpellations,
  interpellationsHasMore = false,
  email,
  clubTheme,
  activeTab,
  onTabChange,
}: MpProfileTabsProps) {
  return (
    <section>
      <div
        role="tablist"
        aria-label="Szczegóły aktywności posła"
        className="flex gap-1 overflow-x-auto rounded-2xl border border-white/10 bg-navy-800/60 p-1"
      >
        {TABS.map(({ id, label }) => {
          const selected = activeTab === id;

          return (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={selected}
              id={`mp-tab-${id}`}
              aria-controls={`mp-panel-${id}`}
              onClick={() => onTabChange(id)}
              className={`shrink-0 rounded-xl px-2.5 py-2 text-[11px] font-semibold whitespace-nowrap transition-colors ${
                selected
                  ? `${clubTheme.bg} ${clubTheme.text} ring-1 ${clubTheme.border}`
                  : "text-white/50 hover:text-white/80"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`mp-panel-${activeTab}`}
        aria-labelledby={`mp-tab-${activeTab}`}
        className="mt-4"
      >
        {activeTab === "votes" ? (
          <VotesPanel
            votes={votes}
            sittings={sittings}
            simulated={votesSimulated}
            poselId={poselId}
          />
        ) : null}
        {activeTab === "speeches" ? (
          <SpeechesPanel
            poselId={poselId}
            items={speeches}
            error={speechesError}
            loading={speechesLoading}
          />
        ) : null}
        {activeTab === "interpellations" ? (
          <InterpellationsPanel
            items={interpellations}
            hasMore={interpellationsHasMore}
            poselId={poselId}
          />
        ) : null}
        {activeTab === "contact" ? <ContactPanel email={email} /> : null}
      </div>
    </section>
  );
}
