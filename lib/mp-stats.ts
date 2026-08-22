import {
  fetchSejmJson,
  fetchSejmJsonList,
  fetchSejmJsonSafe,
  formatMpApiId,
  mapWithConcurrency,
  SEJM_API_BASE,
  SEJM_FETCH_TIMEOUT_MS,
  SEJM_RECENT_VOTES_LIMIT,
  SEJM_RECENT_VOTING_DAYS,
  SEJM_TERM,
  withTimeout,
} from "@/lib/sejm-api";

export type VotingStat = {
  date: string;
  sitting: number;
  numVoted: number;
  numMissed: number;
  numVotings: number;
  absenceExcuse?: boolean;
};

export type MpVote = {
  date: string;
  sitting: number;
  title?: string;
  topic?: string;
  description?: string;
  vote: string;
  votingNumber: number;
};

export type MpProfileStats = {
  attendancePercent: number | null;
  totalVotings: number;
  participatedVotings: number;
  interpellationCount: number | null;
  interpellationApproximate: boolean;
  recentVotes: MpVote[];
  partial: boolean;
  fallbackMessage: string | null;
};

export const SEJM_RECENT_SITTINGS_LIMIT = 5;

const FORMAL_VOTE_PATTERN =
  /przerwę|przerwe|przerwa|odroczenie|wniosek formalny|zamknięcie posiedzenia/i;

export function isFormalVote(vote: MpVote): boolean {
  const haystack = [vote.title, vote.topic, vote.description]
    .filter(Boolean)
    .join(" ");

  return FORMAL_VOTE_PATTERN.test(haystack);
}

export function calculateAttendance(stats: VotingStat[]): {
  percent: number | null;
  total: number;
  participated: number;
} {
  if (stats.length === 0) {
    return { percent: null, total: 0, participated: 0 };
  }

  const total = stats.reduce((sum, day) => sum + day.numVotings, 0);
  const participated = stats.reduce((sum, day) => sum + day.numVoted, 0);

  if (total === 0) {
    return { percent: null, total: 0, participated: 0 };
  }

  return {
    percent: Math.round((participated / total) * 100),
    total,
    participated,
  };
}

export async function fetchInterpellationSummary(
  mpId: number,
): Promise<{ count: number | null; approximate: boolean }> {
  const mpApiId = formatMpApiId(mpId);
  const result = await fetchSejmJsonList<unknown>(
    `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/interpellations?from=${mpApiId}&limit=1&sort=-receiptDate`,
    { revalidate: 3600, timeoutMs: SEJM_FETCH_TIMEOUT_MS },
  );

  if (result.total != null) {
    return { count: result.total, approximate: false };
  }

  if (!result.items) {
    return { count: null, approximate: false };
  }

  return {
    count: result.items.length,
    approximate: result.items.length >= 1,
  };
}

// GET /sejm/term10/MP/{id}/votings/{sitting}/{date}
// np. /MP/2/votings/47/2025-12-05 — wszystkie głosy posła w danym dniu posiedzenia.
export async function fetchMpVotesForSitting(
  mpId: number,
  sitting: number,
  date: string,
): Promise<MpVote[]> {
  const votes = await fetchSejmJson<
    {
      date: string;
      title?: string;
      topic?: string;
      description?: string;
      vote: string;
      votingNumber: number;
    }[]
  >(
    `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/MP/${mpId}/votings/${sitting}/${date}`,
    { timeoutMs: SEJM_FETCH_TIMEOUT_MS },
  );

  if (!votes) {
    return [];
  }

  return votes.map((vote) => ({
    date: vote.date,
    sitting,
    title: vote.title,
    topic: vote.topic,
    description: vote.description,
    vote: vote.vote,
    votingNumber: vote.votingNumber,
  }));
}

export async function fetchRecentVotes(
  mpId: number,
  limit = SEJM_RECENT_VOTES_LIMIT,
): Promise<MpVote[]> {
  const stats = await fetchSejmJson<VotingStat[]>(
    `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/MP/${mpId}/votings/stats`,
    { timeoutMs: SEJM_FETCH_TIMEOUT_MS },
  );

  if (!stats || stats.length === 0) {
    return [];
  }

  const recentDays = [...stats]
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, SEJM_RECENT_VOTING_DAYS);

  const collected: MpVote[] = [];

  for (const day of recentDays) {
    if (collected.length >= limit) {
      break;
    }

    const votes = await fetchMpVotesForSitting(mpId, day.sitting, day.date);
    const visibleVotes = votes.filter((vote) => vote.vote !== "PRESENT");

    for (let index = visibleVotes.length - 1; index >= 0; index -= 1) {
      if (collected.length >= limit) {
        break;
      }

      collected.push(visibleVotes[index]);
    }
  }

  return collected;
}

type SejmSitting = {
  number?: number;
  num?: number;
  id?: number;
  dates?: string[];
};

function sittingNumber(sitting: SejmSitting): number {
  return sitting.number ?? sitting.num ?? sitting.id ?? 0;
}

export async function fetchRecentSejmSittings(
  limit = SEJM_RECENT_SITTINGS_LIMIT,
): Promise<{ number: number; dates: string[] }[]> {
  const sittingsResult = await fetchSejmJsonSafe<SejmSitting[]>(
    `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/sittings`,
    { revalidate: 3600, timeoutMs: SEJM_FETCH_TIMEOUT_MS },
  );

  const source =
    sittingsResult.data && sittingsResult.data.length > 0
      ? sittingsResult.data
      : ((
          await fetchSejmJsonSafe<SejmSitting[]>(
            `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/proceedings`,
            { revalidate: 3600, timeoutMs: SEJM_FETCH_TIMEOUT_MS },
          )
        ).data ?? []);

  return source
    .map((sitting) => ({
      number: sittingNumber(sitting),
      dates: [...new Set(sitting.dates ?? [])].filter(Boolean).sort(),
    }))
    .filter((sitting) => sitting.number > 0 && sitting.dates.length > 0)
    .sort((a, b) => b.number - a.number)
    .slice(0, limit);
}

export async function fetchMpVotesFromRecentSittings(
  mpId: number,
  sittingLimit = SEJM_RECENT_SITTINGS_LIMIT,
): Promise<MpVote[]> {
  const sittings = await fetchRecentSejmSittings(sittingLimit);
  const jobs = sittings.flatMap((sitting) =>
    sitting.dates.map((date) => ({ sitting: sitting.number, date })),
  );

  const batches = await mapWithConcurrency(jobs, 3, ({ sitting, date }) =>
    fetchMpVotesForSitting(mpId, sitting, date),
  );

  return batches
    .flat()
    .filter((vote) => vote.vote !== "PRESENT" && !isFormalVote(vote))
    .sort(
      (a, b) =>
        b.date.localeCompare(a.date) || b.votingNumber - a.votingNumber,
    );
}

export function createEmptyMpProfileStats(
  fallbackMessage: string | null = null,
): MpProfileStats {
  return {
    attendancePercent: null,
    totalVotings: 0,
    participatedVotings: 0,
    interpellationCount: null,
    interpellationApproximate: false,
    recentVotes: [],
    partial: Boolean(fallbackMessage),
    fallbackMessage,
  };
}

export async function fetchMpProfileStats(mpId: number): Promise<MpProfileStats> {
  const { value, timedOut } = await withTimeout(
    loadMpProfileStats(mpId),
    SEJM_FETCH_TIMEOUT_MS,
    createEmptyMpProfileStats(
      "API Sejmu odpowiada zbyt wolno — wyświetlamy dostępne dane w trybie awaryjnym.",
    ),
  );

  if (timedOut) {
    return {
      ...value,
      partial: true,
      fallbackMessage:
        value.fallbackMessage ??
        "Przekroczono limit czasu pobierania statystyk. Spróbuj odświeżyć profil za chwilę.",
    };
  }

  return value;
}

async function loadMpProfileStats(mpId: number): Promise<MpProfileStats> {
  const [statsResult, interpellationSummary] = await Promise.all([
    fetchSejmJsonSafe<VotingStat[]>(
      `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/MP/${mpId}/votings/stats`,
      { revalidate: 3600, timeoutMs: SEJM_FETCH_TIMEOUT_MS },
    ),
    fetchInterpellationSummary(mpId),
  ]);

  const attendance = calculateAttendance(statsResult.data ?? []);
  const partial =
    statsResult.timedOut ||
    statsResult.failed ||
    interpellationSummary.count === null;

  return {
    attendancePercent: attendance.percent,
    totalVotings: attendance.total,
    participatedVotings: attendance.participated,
    interpellationCount: interpellationSummary.count,
    interpellationApproximate: interpellationSummary.approximate,
    recentVotes: [],
    partial,
    fallbackMessage: partial
      ? "Część danych statystycznych jest chwilowo niedostępna."
      : null,
  };
}

export function formatVoteLabel(vote: string): string {
  switch (vote) {
    case "YES":
      return "ZA";
    case "NO":
      return "PRZECIW";
    case "ABSTAIN":
      return "WSTRZYMAŁ SIĘ";
    case "ABSENT":
      return "NIEOBECNY";
    case "PRESENT":
      return "OBECNY";
    default:
      return vote.toUpperCase();
  }
}

export function getVoteBadgeClass(vote: string): string {
  switch (vote) {
    case "YES":
      return "bg-sejm-green/25 text-sejm-green-light ring-1 ring-sejm-green/40";
    case "NO":
      return "bg-red-500/20 text-red-300 ring-1 ring-red-400/35";
    case "ABSTAIN":
      return "bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/30";
    case "ABSENT":
      return "bg-slate-500/15 text-slate-300 ring-1 ring-slate-400/25";
    default:
      return "bg-white/10 text-white/70 ring-1 ring-white/15";
  }
}

const voteDateFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "short",
  year: "numeric",
});

export function formatVoteDate(date: string): string {
  return voteDateFormatter.format(new Date(date));
}

export function formatInterpellationCount(
  count: number | null,
  approximate: boolean,
): string {
  if (count === null) {
    return "—";
  }

  if (approximate) {
    return `${count}+`;
  }

  return String(count);
}
