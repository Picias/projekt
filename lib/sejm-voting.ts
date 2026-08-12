import {
  formatVoteLabel,
  type MpVote,
} from "@/lib/mp-stats";
import {
  fetchSejmJson,
  formatMpApiId,
  SEJM_API_BASE,
  SEJM_DEFAULT_LIST_LIMIT,
  SEJM_FETCH_TIMEOUT_MS,
  SEJM_TERM,
} from "@/lib/sejm-api";

type VotingDetailsVote = {
  MP: number;
  club?: string;
  vote: string;
};

export type VotingDetails = {
  title?: string;
  description?: string;
  topic?: string;
  date?: string;
  yes?: number;
  no?: number;
  abstain?: number;
  majorityVotes?: number;
  majorityType?: string;
  votes?: VotingDetailsVote[];
};

export type VotingDeepDive = {
  title: string;
  description: string;
  topic: string;
  date: string;
  mpVote: string;
  mpVoteLabel: string;
  clubLine: string | null;
  clubLineLabel: string;
  clubAligned: boolean | null;
  outcome: "passed" | "rejected" | "inconclusive";
  outcomeLabel: string;
  yes: number;
  no: number;
  abstain: number;
  partial: boolean;
  fallbackMessage: string | null;
};

function resolveClubLine(
  votes: VotingDetailsVote[],
  club: string,
): { line: string | null; label: string } {
  const clubVotes = votes.filter(
    (entry) =>
      entry.club === club &&
      entry.vote !== "ABSENT" &&
      entry.vote !== "PRESENT" &&
      entry.vote !== "NO_VOTE",
  );

  if (clubVotes.length === 0) {
    return { line: null, label: "Brak danych klubowych" };
  }

  const tally = new Map<string, number>();

  for (const entry of clubVotes) {
    tally.set(entry.vote, (tally.get(entry.vote) ?? 0) + 1);
  }

  let topVote: string | null = null;
  let topCount = 0;

  for (const [vote, count] of tally.entries()) {
    if (count > topCount) {
      topVote = vote;
      topCount = count;
    }
  }

  if (!topVote) {
    return { line: null, label: "Brak danych klubowych" };
  }

  const tied = [...tally.entries()].filter(([, count]) => count === topCount);

  if (tied.length > 1) {
    return { line: null, label: "Klub głosował mieszanie" };
  }

  return { line: topVote, label: formatVoteLabel(topVote) };
}

function resolveOutcome(details: VotingDetails): {
  outcome: VotingDeepDive["outcome"];
  label: string;
} {
  const yes = details.yes ?? 0;
  const no = details.no ?? 0;
  const majority = details.majorityVotes ?? Math.floor((yes + no) / 2) + 1;

  if (yes >= majority && yes > no) {
    return { outcome: "passed", label: "Przyjęta w głosowaniu" };
  }

  if (no >= majority && no > yes) {
    return { outcome: "rejected", label: "Odrzucona w głosowaniu" };
  }

  if (yes > no) {
    return { outcome: "passed", label: "Przyjęta w głosowaniu" };
  }

  if (no > yes) {
    return { outcome: "rejected", label: "Odrzucona w głosowaniu" };
  }

  return { outcome: "inconclusive", label: "Wynik niejednoznaczny" };
}

export async function fetchVotingDeepDive(
  mpId: number,
  club: string | null,
  sitting: number,
  votingNumber: number,
  mpVoteFromList?: string,
): Promise<VotingDeepDive | null> {
  const details = await fetchSejmJson<VotingDetails>(
    `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/votings/${sitting}/${votingNumber}`,
    { timeoutMs: SEJM_FETCH_TIMEOUT_MS },
  );

  if (!details) {
    if (mpVoteFromList) {
      return {
        title: "Głosowanie",
        description: "",
        topic: "",
        date: "",
        mpVote: mpVoteFromList,
        mpVoteLabel: formatVoteLabel(mpVoteFromList),
        clubLine: null,
        clubLineLabel: "Brak danych — API niedostępne",
        clubAligned: null,
        outcome: "inconclusive",
        outcomeLabel: "Brak danych o wyniku",
        yes: 0,
        no: 0,
        abstain: 0,
        partial: true,
        fallbackMessage: "Pełne szczegóły głosowania są chwilowo niedostępne.",
      };
    }

    return null;
  }

  const mpEntry = details.votes?.find((entry) => entry.MP === mpId);
  const mpVote = mpEntry?.vote ?? mpVoteFromList ?? "ABSENT";
  const { line: clubLine, label: clubLineLabel } = club
    ? resolveClubLine(details.votes ?? [], club)
    : { line: null, label: "Brak klubu" };

  const clubAligned =
    clubLine && mpVote !== "ABSENT" && mpVote !== "PRESENT" && mpVote !== "NO_VOTE"
      ? mpVote === clubLine
      : null;

  const { outcome, label: outcomeLabel } = resolveOutcome(details);

  return {
    title: details.title ?? "Głosowanie",
    description: details.description ?? "",
    topic: details.topic ?? "",
    date: details.date ?? "",
    mpVote,
    mpVoteLabel: formatVoteLabel(mpVote),
    clubLine,
    clubLineLabel,
    clubAligned,
    outcome,
    outcomeLabel,
    yes: details.yes ?? 0,
    no: details.no ?? 0,
    abstain: details.abstain ?? 0,
    partial: false,
    fallbackMessage: null,
  };
}

export type InterpellationItem = {
  num: number;
  title: string;
  receiptDate?: string;
  sentDate?: string;
  to?: string[];
  status?: string;
};

export type InterpellationsPage = {
  items: InterpellationItem[];
  limit: number;
  hasMore: boolean;
};

export async function fetchInterpellationsList(
  mpId: number,
  limit = SEJM_DEFAULT_LIST_LIMIT,
): Promise<InterpellationsPage> {
  const mpApiId = formatMpApiId(mpId);
  const batch = await fetchSejmJson<
    {
      num: number;
      title: string;
      receiptDate?: string;
      sentDate?: string;
      to?: string[];
    }[]
  >(
    `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/interpellations?from=${mpApiId}&limit=${limit}&sort=-receiptDate`,
    { timeoutMs: SEJM_FETCH_TIMEOUT_MS },
  );

  if (!batch) {
    return { items: [], limit, hasMore: false };
  }

  const items = batch
    .map((item) => ({
      num: item.num,
      title: item.title,
      receiptDate: item.receiptDate,
      sentDate: item.sentDate,
      to: item.to,
    }))
    .sort((a, b) => (b.receiptDate ?? "").localeCompare(a.receiptDate ?? ""));

  return {
    items,
    limit,
    hasMore: items.length >= limit,
  };
}

export function voteToDeepDiveKey(vote: MpVote): string {
  return `${vote.sitting}-${vote.votingNumber}`;
}
