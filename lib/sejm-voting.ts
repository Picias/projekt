import { getClubLabel } from "@/lib/club-colors";
import {
  formatVoteLabel,
  type MpVote,
} from "@/lib/mp-stats";
import { sanitizeSejmHtml } from "@/lib/sejm-document";
import {
  fetchSejmJson,
  fetchSejmJsonList,
  fetchSejmText,
  formatMpApiId,
  SEJM_API_BASE,
  SEJM_DEFAULT_LIST_LIMIT,
  SEJM_FETCH_TIMEOUT_MS,
  SEJM_TERM,
} from "@/lib/sejm-api";

export type VotingDetailsVote = {
  MP: number;
  club?: string;
  firstName?: string;
  lastName?: string;
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
  notParticipating?: number;
  sitting?: number;
  votingNumber?: number;
  majorityVotes?: number;
  majorityType?: string;
  votes?: VotingDetailsVote[];
};

export type FetchVotingDetailsResult =
  | { status: "ok"; details: VotingDetails }
  | { status: "not_found" }
  | { status: "error"; message: string };

export type ClubVoteTally = {
  club: string;
  label: string;
  yes: number;
  no: number;
  abstain: number;
  absent: number;
  total: number;
};

export function votingDetailsHref(
  sitting: number,
  votingNumber: number,
  fromPath?: string,
): string {
  const path = `/glosowania/${sitting}/${votingNumber}`;

  if (!fromPath || !fromPath.startsWith("/") || fromPath.startsWith("//")) {
    return path;
  }

  return `${path}?from=${encodeURIComponent(fromPath)}`;
}

export function tallyVotesByClub(votes: VotingDetailsVote[]): ClubVoteTally[] {
  const map = new Map<string, ClubVoteTally>();

  for (const entry of votes) {
    const club = entry.club?.trim() || "niez.";
    const current = map.get(club) ?? {
      club,
      label: getClubLabel(club),
      yes: 0,
      no: 0,
      abstain: 0,
      absent: 0,
      total: 0,
    };

    current.total += 1;

    if (entry.vote === "YES") {
      current.yes += 1;
    } else if (entry.vote === "NO") {
      current.no += 1;
    } else if (entry.vote === "ABSTAIN") {
      current.abstain += 1;
    } else {
      current.absent += 1;
    }

    map.set(club, current);
  }

  return [...map.values()].sort(
    (a, b) => b.total - a.total || a.label.localeCompare(b.label, "pl"),
  );
}

export async function fetchSejmVotingDetails(
  sitting: number,
  votingNumber: number,
): Promise<FetchVotingDetailsResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEJM_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/votings/${sitting}/${votingNumber}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 3600 },
        signal: controller.signal,
      },
    );

    if (response.status === 404) {
      return { status: "not_found" };
    }

    if (!response.ok) {
      return {
        status: "error",
        message: `API Sejmu zwróciło status ${response.status}.`,
      };
    }

    const details = (await response.json()) as VotingDetails;

    if (!details || typeof details !== "object") {
      return { status: "not_found" };
    }

    return { status: "ok", details };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";

    return {
      status: "error",
      message: timedOut
        ? "API Sejmu odpowiada zbyt wolno. Spróbuj odświeżyć stronę za chwilę."
        : "Nie udało się pobrać szczegółów głosowania z API Sejmu.",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

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

export function resolveVotingOutcome(details: VotingDetails): {
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

  const { outcome, label: outcomeLabel } = resolveVotingOutcome(details);

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

export function interpellationHref(num: number, fromPath?: string): string {
  const path = `/interpelacje/${num}`;

  if (!fromPath || !fromPath.startsWith("/") || fromPath.startsWith("//")) {
    return path;
  }

  return `${path}?from=${encodeURIComponent(fromPath)}`;
}

export type InterpellationAttachment = {
  URL?: string;
  name?: string;
};

export type InterpellationReply = {
  key?: string;
  from?: string;
  receiptDate?: string;
  lastModified?: string;
  prolongation?: boolean;
  onlyAttachment?: boolean;
  links?: { href?: string; rel?: string }[];
  attachments?: InterpellationAttachment[];
  htmlBody?: string | null;
};

export type InterpellationDetails = {
  num: number;
  title: string;
  receiptDate?: string;
  sentDate?: string;
  from?: string[];
  to?: string[];
  replies?: InterpellationReply[];
  answerDelayedDays?: number;
  links?: { href?: string; rel?: string }[];
  htmlBody?: string | null;
};

export type FetchInterpellationResult =
  | { status: "ok"; details: InterpellationDetails }
  | { status: "not_found" }
  | { status: "error"; message: string };

export function resolveInterpellationStatus(item: {
  replies?: unknown[];
  answerDelayedDays?: number;
}): string {
  if (item.replies && item.replies.length > 0) {
    return "Odpowiedziano";
  }

  if (item.answerDelayedDays && item.answerDelayedDays > 0) {
    return "Opóźniona";
  }

  return "Oczekuje";
}

export function getInterpellationStatusClass(status: string): string {
  if (status === "Odpowiedziano") {
    return "bg-sejm-green/15 text-sejm-green-light ring-1 ring-sejm-green/30";
  }

  if (status === "Opóźniona") {
    return "bg-amber-400/15 text-amber-200 ring-1 ring-amber-400/25";
  }

  return "bg-sky-400/15 text-sky-200 ring-1 ring-sky-400/25";
}

export function resolveSejmDocumentUrl(
  links?: { href?: string; rel?: string }[],
): string | null {
  if (!links?.length) {
    return null;
  }

  const body = links.find((link) => link.rel === "body" && link.href);
  if (body?.href) {
    return body.href;
  }

  const webBody = links.find((link) => link.rel === "web-body" && link.href);
  return webBody?.href ?? null;
}

const INTERPELLATION_HTML_TIMEOUT_MS = 20_000;

async function fetchInterpellationHtml(url: string): Promise<string | null> {
  const raw = await fetchSejmText(url, {
    revalidate: 3600,
    timeoutMs: INTERPELLATION_HTML_TIMEOUT_MS,
  });

  if (!raw) {
    return null;
  }

  const html = sanitizeSejmHtml(raw);
  return html || null;
}

async function attachInterpellationBodies(
  num: number | string,
  details: InterpellationDetails,
): Promise<InterpellationDetails> {
  const replies = details.replies ?? [];
  const base = `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/interpellations/${num}`;

  const [htmlBody, ...replyBodies] = await Promise.all([
    fetchInterpellationHtml(`${base}/body`),
    ...replies.map((reply) =>
      reply.key
        ? fetchInterpellationHtml(
            `${base}/reply/${encodeURIComponent(reply.key)}/body`,
          )
        : Promise.resolve(null),
    ),
  ]);

  return {
    ...details,
    htmlBody,
    replies: replies.map((reply, index) => ({
      ...reply,
      htmlBody: replyBodies[index] ?? null,
    })),
  };
}

export async function fetchSejmInterpellation(
  num: number | string,
  options: { includeBodies?: boolean } = {},
): Promise<FetchInterpellationResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEJM_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/interpellations/${num}`,
      {
        headers: { Accept: "application/json" },
        next: { revalidate: 3600 },
        signal: controller.signal,
      },
    );

    if (response.status === 404) {
      return { status: "not_found" };
    }

    if (!response.ok) {
      return {
        status: "error",
        message: `API Sejmu zwróciło status ${response.status}.`,
      };
    }

    const details = (await response.json()) as InterpellationDetails;

    if (!details || typeof details !== "object" || details.num == null) {
      return { status: "not_found" };
    }

    if (!options.includeBodies) {
      return { status: "ok", details };
    }

    return {
      status: "ok",
      details: await attachInterpellationBodies(num, details),
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";

    return {
      status: "error",
      message: timedOut
        ? "API Sejmu odpowiada zbyt wolno. Spróbuj odświeżyć stronę za chwilę."
        : "Nie udało się pobrać interpelacji z API Sejmu.",
    };
  } finally {
    clearTimeout(timeoutId);
  }
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
  total: number | null;
};

export async function fetchInterpellationsList(
  mpId: number,
  limit = SEJM_DEFAULT_LIST_LIMIT,
): Promise<InterpellationsPage> {
  const mpApiId = formatMpApiId(mpId);
  const result = await fetchSejmJsonList<{
    num: number;
    title: string;
    receiptDate?: string;
    sentDate?: string;
    to?: string[];
    replies?: unknown[];
    answerDelayedDays?: number;
  }>(
    `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/interpellations?from=${mpApiId}&limit=${limit}&sort=-receiptDate`,
    { timeoutMs: SEJM_FETCH_TIMEOUT_MS },
  );

  if (!result.items) {
    return { items: [], limit, hasMore: false, total: result.total };
  }

  const items = result.items
    .map((item) => ({
      num: item.num,
      title: item.title,
      receiptDate: item.receiptDate,
      sentDate: item.sentDate,
      to: item.to,
      status: resolveInterpellationStatus(item),
    }))
    .sort((a, b) => (b.receiptDate ?? "").localeCompare(a.receiptDate ?? ""));

  const total = result.total;
  const hasMore = total != null ? items.length < total : items.length >= limit;

  return {
    items,
    limit,
    hasMore,
    total,
  };
}

export function voteToDeepDiveKey(vote: MpVote): string {
  return `${vote.sitting}-${vote.votingNumber}`;
}
