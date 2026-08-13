import {
  calculateAttendance,
  fetchRecentVotes,
  formatVoteLabel,
  type VotingStat,
} from "@/lib/mp-stats";
import {
  fetchSejmJson,
  formatMpApiId,
  mapWithConcurrency,
  SEJM_API_BASE,
  SEJM_DEFAULT_LIST_LIMIT,
  SEJM_RECENT_VOTES_LIMIT,
  SEJM_TERM,
} from "@/lib/sejm-api";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { VotingDetails } from "@/lib/sejm-voting";

const SYNC_CONCURRENCY = 3;
const INTERPELLATION_PAGE_SIZE = 50;

type SejmInterpellation = {
  num: number;
  title: string;
  receiptDate?: string;
  sentDate?: string;
  to?: string[];
  replies?: unknown[];
  answerDelayedDays?: number;
};

type SyncMpResult = {
  poselId: number;
  frekwencja: boolean;
  glosowania: number;
  interpelacje: number;
  errors: string[];
};

export type SyncDetailsResult = {
  status: "ok" | "error";
  processed: number;
  results: SyncMpResult[];
  aggregatesUpdated: boolean;
  message?: string;
};

export type SyncAllDetailsResult = {
  status: "ok" | "error";
  syncedAll: boolean;
  total: number;
  processed: number;
  failed: number;
  aggregatesUpdated: boolean;
  message?: string;
};

function resolveInterpellationStatus(item: SejmInterpellation): string {
  if (item.replies && item.replies.length > 0) {
    return "odpowiedziano";
  }

  if (item.answerDelayedDays && item.answerDelayedDays > 0) {
    return "opóźniona";
  }

  return "oczekuje";
}

function resolveOutcomeLabel(details: VotingDetails): string {
  const yes = details.yes ?? 0;
  const no = details.no ?? 0;
  const majority = details.majorityVotes ?? Math.floor((yes + no) / 2) + 1;

  if (yes >= majority && yes > no) {
    return "passed";
  }

  if (no >= majority && no > yes) {
    return "rejected";
  }

  if (yes > no) {
    return "passed";
  }

  if (no > yes) {
    return "rejected";
  }

  return "inconclusive";
}

function resolveClubLineFromDetails(
  details: VotingDetails,
  club: string,
): { line: string | null; label: string } {
  const clubVotes = (details.votes ?? []).filter(
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

async function fetchInterpellationsForMp(mpId: number): Promise<SejmInterpellation[]> {
  const mpApiId = formatMpApiId(mpId);
  const items: SejmInterpellation[] = [];
  let offset = 0;

  while (true) {
    const batch = await fetchSejmJson<SejmInterpellation[]>(
      `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/interpellations?from=${mpApiId}&limit=${INTERPELLATION_PAGE_SIZE}&offset=${offset}&sort=-receiptDate`,
      { revalidate: 0, timeoutMs: 15_000 },
    );

    if (!batch || batch.length === 0) {
      break;
    }

    items.push(...batch);

    if (batch.length < INTERPELLATION_PAGE_SIZE) {
      break;
    }

    offset += INTERPELLATION_PAGE_SIZE;
  }

  return items;
}

async function syncMpFrekwencja(mpId: number): Promise<boolean> {
  const stats = await fetchSejmJson<VotingStat[]>(
    `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/MP/${mpId}/votings/stats`,
    { revalidate: 0, timeoutMs: 15_000 },
  );

  if (!stats) {
    return false;
  }

  const attendance = calculateAttendance(stats);

  const { error } = await supabaseAdmin.from("posel_frekwencja").upsert(
    {
      posel_id: mpId,
      frekwencja_procent: attendance.percent,
      total_glosowan: attendance.total,
      uczestniczyl_w: attendance.participated,
      zaktualizowano_at: new Date().toISOString(),
    },
    { onConflict: "posel_id" },
  );

  return !error;
}

async function syncMpGlosowania(
  mpId: number,
  clubName: string | null,
): Promise<number> {
  const recentVotes = await fetchRecentVotes(mpId, SEJM_RECENT_VOTES_LIMIT);

  await supabaseAdmin.from("posel_glosowania").delete().eq("posel_id", mpId);

  if (recentVotes.length === 0) {
    return 0;
  }

  const rows = await mapWithConcurrency(recentVotes, 2, async (vote) => {
    const details = await fetchSejmJson<VotingDetails>(
      `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/votings/${vote.sitting}/${vote.votingNumber}`,
      { revalidate: 0, timeoutMs: 10_000 },
    );

    let wynik: string | null = null;
    let glosyZa: number | null = null;
    let glosyPrzeciw: number | null = null;
    let glosyWstrzymal: number | null = null;
    let liniaKlubu: string | null = null;
    let zgodnoscKlubowa: boolean | null = null;

    if (details) {
      wynik = resolveOutcomeLabel(details);
      glosyZa = details.yes ?? null;
      glosyPrzeciw = details.no ?? null;
      glosyWstrzymal = details.abstain ?? null;

      if (clubName) {
        const { line } = resolveClubLineFromDetails(details, clubName);
        liniaKlubu = line;
        zgodnoscKlubowa =
          line &&
          vote.vote !== "ABSENT" &&
          vote.vote !== "PRESENT" &&
          vote.vote !== "NO_VOTE"
            ? vote.vote === line
            : null;
      }
    }

    return {
      posel_id: mpId,
      sitting: vote.sitting,
      numer_glosowania: vote.votingNumber,
      data: vote.date,
      tytul: vote.title ?? null,
      temat: vote.topic ?? null,
      opis: vote.description ?? null,
      glos: vote.vote,
      wynik,
      glosy_za: glosyZa,
      glosy_przeciw: glosyPrzeciw,
      glosy_wstrzymal: glosyWstrzymal,
      linia_klubu: liniaKlubu,
      zgodnosc_klubowa: zgodnoscKlubowa,
    };
  });

  const { error } = await supabaseAdmin.from("posel_glosowania").insert(rows);

  if (error) {
    return 0;
  }

  return rows.length;
}

async function syncMpInterpelacje(mpId: number): Promise<number> {
  const items = await fetchInterpellationsForMp(mpId);

  if (items.length === 0) {
    await supabaseAdmin.from("interpelacje").delete().eq("posel_id", mpId);
    return 0;
  }

  const rows = items.map((item) => ({
    id: item.num,
    posel_id: mpId,
    tytul: item.title,
    data: item.receiptDate ?? item.sentDate ?? null,
    status: resolveInterpellationStatus(item),
    odbiorca: item.to?.join(", ") ?? null,
  }));

  await supabaseAdmin.from("interpelacje").delete().eq("posel_id", mpId);

  for (let offset = 0; offset < rows.length; offset += SEJM_DEFAULT_LIST_LIMIT) {
    const chunk = rows.slice(offset, offset + SEJM_DEFAULT_LIST_LIMIT);
    const { error } = await supabaseAdmin.from("interpelacje").insert(chunk);

    if (error) {
      return offset;
    }
  }

  return rows.length;
}

export async function syncMpDetails(
  mpId: number,
  clubName: string | null,
): Promise<SyncMpResult> {
  const errors: string[] = [];

  const frekwencjaOk = await syncMpFrekwencja(mpId);

  if (!frekwencjaOk) {
    errors.push("frekwencja");
  }

  let glosowania = 0;

  try {
    glosowania = await syncMpGlosowania(mpId, clubName);
  } catch {
    errors.push("glosowania");
  }

  let interpelacje = 0;

  try {
    interpelacje = await syncMpInterpelacje(mpId);
  } catch {
    errors.push("interpelacje");
  }

  return {
    poselId: mpId,
    frekwencja: frekwencjaOk,
    glosowania,
    interpelacje,
    errors,
  };
}

export async function recomputeFrekwencjaAggregates(): Promise<boolean> {
  const { data: frekwencje, error } = await supabaseAdmin
    .from("posel_frekwencja")
    .select("posel_id, frekwencja_procent");

  if (error || !frekwencje || frekwencje.length === 0) {
    return false;
  }

  const { data: poslowie } = await supabaseAdmin.from("poslowie").select("id, partia");

  const partiaById = new Map(
    (poslowie ?? []).map((posel) => [posel.id as number, posel.partia as string | null]),
  );

  const validPercents = frekwencje
    .map((row) => row.frekwencja_procent as number | null)
    .filter((value): value is number => value !== null);

  const sejmAverage =
    validPercents.length > 0
      ? Math.round(validPercents.reduce((sum, value) => sum + value, 0) / validPercents.length)
      : null;

  const clubBuckets = new Map<string, number[]>();

  for (const row of frekwencje) {
    const percent = row.frekwencja_procent as number | null;

    if (percent === null) {
      continue;
    }

    const partia = partiaById.get(row.posel_id as number);

    if (!partia) {
      continue;
    }

    const bucket = clubBuckets.get(partia) ?? [];
    bucket.push(percent);
    clubBuckets.set(partia, bucket);
  }

  const aggregateRows = [
    {
      klucz: "sejm",
      frekwencja_procent: sejmAverage,
      zaktualizowano_at: new Date().toISOString(),
    },
    ...[...clubBuckets.entries()].map(([klucz, percents]) => ({
      klucz,
      frekwencja_procent: Math.round(
        percents.reduce((sum, value) => sum + value, 0) / percents.length,
      ),
      zaktualizowano_at: new Date().toISOString(),
    })),
  ];

  const { error: upsertError } = await supabaseAdmin
    .from("frekwencja_agregaty")
    .upsert(aggregateRows, { onConflict: "klucz" });

  return !upsertError;
}

export async function syncMpDetailsBatch(options: {
  poselId?: number;
  offset?: number;
  limit?: number;
  recomputeAggregates?: boolean;
}): Promise<SyncDetailsResult> {
  const limit = options.limit ?? 5;
  const offset = options.offset ?? 0;

  let mpRows: { id: number; partia: string | null }[] = [];

  if (options.poselId) {
    const { data } = await supabaseAdmin
      .from("poslowie")
      .select("id, partia")
      .eq("id", options.poselId)
      .maybeSingle();

    if (!data) {
      return {
        status: "error",
        processed: 0,
        results: [],
        aggregatesUpdated: false,
        message: "Nie znaleziono posła w bazie",
      };
    }

    mpRows = [data as { id: number; partia: string | null }];
  } else {
    const { data } = await supabaseAdmin
      .from("poslowie")
      .select("id, partia")
      .order("id")
      .range(offset, offset + limit - 1);

    mpRows = (data ?? []) as { id: number; partia: string | null }[];
  }

  if (mpRows.length === 0) {
    return {
      status: "error",
      processed: 0,
      results: [],
      aggregatesUpdated: false,
      message: "Brak posłów do synchronizacji",
    };
  }

  const results = await mapWithConcurrency(mpRows, SYNC_CONCURRENCY, async (mp) =>
    syncMpDetails(mp.id, mp.partia),
  );

  let aggregatesUpdated = false;

  if (options.recomputeAggregates !== false) {
    aggregatesUpdated = await recomputeFrekwencjaAggregates();
  }

  return {
    status: "ok",
    processed: results.length,
    results,
    aggregatesUpdated,
  };
}

async function fetchAllPoslowieFromDb(): Promise<{ id: number; partia: string | null }[]> {
  const pageSize = 100;
  const allRows: { id: number; partia: string | null }[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabaseAdmin
      .from("poslowie")
      .select("id, partia")
      .order("id")
      .range(offset, offset + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      break;
    }

    allRows.push(...(data as { id: number; partia: string | null }[]));

    if (data.length < pageSize) {
      break;
    }

    offset += pageSize;
  }

  return allRows;
}

export async function syncAllMpDetails(): Promise<SyncAllDetailsResult> {
  const poslowie = await fetchAllPoslowieFromDb();

  if (poslowie.length === 0) {
    return {
      status: "error",
      syncedAll: false,
      total: 0,
      processed: 0,
      failed: 0,
      aggregatesUpdated: false,
      message: "Brak posłów w tabeli poslowie. Uruchom najpierw /api/sync-mps.",
    };
  }

  const results: SyncMpResult[] = [];

  for (const mp of poslowie) {
    results.push(await syncMpDetails(mp.id, mp.partia));
  }

  const aggregatesUpdated = await recomputeFrekwencjaAggregates();
  const failed = results.filter((result) => result.errors.length > 0).length;

  return {
    status: "ok",
    syncedAll: failed === 0,
    total: poslowie.length,
    processed: results.length,
    failed,
    aggregatesUpdated,
  };
}
