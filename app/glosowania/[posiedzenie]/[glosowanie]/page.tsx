import { notFound } from "next/navigation";
import BackButton from "@/components/back-button";
import { getClubTheme } from "@/lib/club-colors";
import { GLOS_INFO } from "@/lib/glosowania";
import { formatVoteDate } from "@/lib/mp-stats";
import {
  fetchSejmVotingDetails,
  resolveVotingOutcome,
  tallyVotesByClub,
  type ClubVoteTally,
  type VotingDetails,
} from "@/lib/sejm-voting";

type VotingPageProps = {
  params: Promise<{ posiedzenie: string; glosowanie: string }>;
};

export async function generateMetadata({ params }: VotingPageProps) {
  const { posiedzenie, glosowanie } = await params;
  const sitting = Number(posiedzenie);
  const votingNumber = Number(glosowanie);

  if (!Number.isInteger(sitting) || !Number.isInteger(votingNumber)) {
    return { title: "Nie znaleziono głosowania — SEJM ON" };
  }

  const result = await fetchSejmVotingDetails(sitting, votingNumber);

  if (result.status !== "ok") {
    return { title: "Nie znaleziono głosowania — SEJM ON" };
  }

  const title = result.details.topic || result.details.title || "Głosowanie";

  return {
    title: `${title} — SEJM ON`,
    description: `Wyniki głosowania nr ${votingNumber} na posiedzeniu nr ${sitting} Sejmu RP.`,
  };
}

function VoteStack({
  yes,
  no,
  abstain,
  absent,
  size = "md",
}: {
  yes: number;
  no: number;
  abstain: number;
  absent: number;
  size?: "md" | "lg";
}) {
  const total = yes + no + abstain + absent;

  if (total === 0) {
    return <div className="h-3 rounded-full bg-white/10" />;
  }

  const segments = [
    { key: "yes", value: yes, className: GLOS_INFO.ZA.pasek },
    { key: "no", value: no, className: GLOS_INFO.PRZECIW.pasek },
    { key: "abstain", value: abstain, className: GLOS_INFO.WSTRZYMAL_SIE.pasek },
    { key: "absent", value: absent, className: GLOS_INFO.NIEOBECNY.pasek },
  ].filter((segment) => segment.value > 0);

  return (
    <div
      className={`flex overflow-hidden rounded-full bg-white/10 ${size === "lg" ? "h-3.5" : "h-2.5"}`}
      role="img"
      aria-label={`Za ${yes}, przeciw ${no}, wstrzymało się ${abstain}, nieobecnych ${absent}`}
    >
      {segments.map((segment) => (
        <div
          key={segment.key}
          className={segment.className}
          style={{ width: `${(segment.value / total) * 100}%` }}
        />
      ))}
    </div>
  );
}

function TotalsGrid({
  yes,
  no,
  abstain,
  absent,
}: {
  yes: number;
  no: number;
  abstain: number;
  absent: number;
}) {
  const cells = [
    { key: "ZA", value: yes, info: GLOS_INFO.ZA },
    { key: "PRZECIW", value: no, info: GLOS_INFO.PRZECIW },
    { key: "WSTRZYMAŁO SIĘ", value: abstain, info: GLOS_INFO.WSTRZYMAL_SIE },
    { key: "NIEOBECNI", value: absent, info: GLOS_INFO.NIEOBECNY },
  ] as const;

  return (
    <div className="grid grid-cols-2 gap-2">
      {cells.map((cell) => (
        <div
          key={cell.key}
          className="rounded-xl border border-white/10 bg-white/5 px-3 py-2.5"
        >
          <p className={`text-[10px] font-semibold uppercase tracking-wide ${cell.info.akcent}`}>
            {cell.key}
          </p>
          <p className="mt-1 text-xl font-bold tabular-nums">{cell.value}</p>
        </div>
      ))}
    </div>
  );
}

function ClubRow({ row }: { row: ClubVoteTally }) {
  const theme = getClubTheme(row.club);
  const parts = [
    row.yes > 0 ? `${row.yes} Za` : null,
    row.no > 0 ? `${row.no} Przeciw` : null,
    row.abstain > 0 ? `${row.abstain} Wstrzymało się` : null,
    row.absent > 0 ? `${row.absent} Nieobecnych` : null,
  ].filter(Boolean);

  return (
    <article className={`rounded-2xl border bg-navy-800/70 p-4 ${theme.border}`}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className={`text-sm font-semibold ${theme.text}`}>{row.label}</h3>
        <span className="text-[11px] tabular-nums text-white/40">{row.total} os.</span>
      </div>
      <VoteStack
        yes={row.yes}
        no={row.no}
        abstain={row.abstain}
        absent={row.absent}
      />
      <p className="mt-2 text-[11px] leading-relaxed text-white/50">
        {parts.join(" · ") || "Brak oddanych głosów"}
      </p>
    </article>
  );
}

function OutcomeBanner({
  outcome,
}: {
  outcome: ReturnType<typeof resolveVotingOutcome>;
}) {
  if (outcome.outcome === "passed") {
    return (
      <p className="rounded-2xl bg-sejm-green/15 px-4 py-3 text-center text-lg font-bold tracking-wide text-sejm-green-light ring-1 ring-sejm-green/30">
        PRZYJĘTO
      </p>
    );
  }

  if (outcome.outcome === "rejected") {
    return (
      <p className="rounded-2xl bg-red-500/15 px-4 py-3 text-center text-lg font-bold tracking-wide text-red-300 ring-1 ring-red-400/30">
        ODRZUCONO
      </p>
    );
  }

  return (
    <p className="rounded-2xl bg-amber-400/10 px-4 py-3 text-center text-sm font-bold tracking-wide text-amber-200 ring-1 ring-amber-400/25">
      WYNIK NIEJEDNOZNACZNY
    </p>
  );
}

function FetchError({ message }: { message: string }) {
  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <BackButton />
      <section className="rounded-2xl border border-red-400/25 bg-red-500/10 p-5 text-sm text-red-200">
        <p className="font-semibold text-red-100">Nie udało się wczytać głosowania</p>
        <p className="mt-2">{message}</p>
      </section>
    </div>
  );
}

function VotingBody({
  sitting,
  votingNumber,
  details,
}: {
  sitting: number;
  votingNumber: number;
  details: VotingDetails;
}) {
  const yes = details.yes ?? 0;
  const no = details.no ?? 0;
  const abstain = details.abstain ?? 0;
  const clubs = tallyVotesByClub(details.votes ?? []);
  const absent =
    details.notParticipating ??
    clubs.reduce((sum, row) => sum + row.absent, 0);
  const outcome = resolveVotingOutcome(details);
  const heading = details.topic || details.title || "Głosowanie";

  return (
    <>
      <header>
        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
          Posiedzenie nr {sitting}, głosowanie nr {votingNumber}
        </p>
        <h1 className="mt-2 text-xl font-bold leading-snug">{heading}</h1>
        {details.topic && details.title && details.topic !== details.title ? (
          <p className="mt-2 text-sm leading-relaxed text-white/60">{details.title}</p>
        ) : null}
        {details.date ? (
          <p className="mt-2 text-xs text-white/45">{formatVoteDate(details.date)}</p>
        ) : null}
      </header>

      <section className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-navy-800/70 p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
          Wynik Sejmu
        </h2>
        <OutcomeBanner outcome={outcome} />
        <VoteStack yes={yes} no={no} abstain={abstain} absent={absent} size="lg" />
        <TotalsGrid yes={yes} no={no} abstain={abstain} absent={absent} />
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
          Rozkład na kluby
        </h2>
        {clubs.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-white/15 bg-white/5 p-5 text-sm text-white/60">
            API Sejmu nie zwróciło imiennej listy głosów dla tego głosowania.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {clubs.map((row) => (
              <ClubRow key={row.club} row={row} />
            ))}
          </div>
        )}
      </section>
    </>
  );
}

export default async function GlosowanieSzczegolyPage({
  params,
}: VotingPageProps) {
  const { posiedzenie, glosowanie } = await params;
  const sitting = Number(posiedzenie);
  const votingNumber = Number(glosowanie);

  if (!Number.isInteger(sitting) || sitting <= 0 || !Number.isInteger(votingNumber) || votingNumber <= 0) {
    notFound();
  }

  const result = await fetchSejmVotingDetails(sitting, votingNumber);

  if (result.status === "not_found") {
    notFound();
  }

  if (result.status === "error") {
    return <FetchError message={result.message} />;
  }

  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <BackButton />
      <VotingBody
        sitting={result.details.sitting ?? sitting}
        votingNumber={result.details.votingNumber ?? votingNumber}
        details={result.details}
      />
    </div>
  );
}
