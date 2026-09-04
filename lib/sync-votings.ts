import {
  drukLookupKeys,
  extractDrukNumbers,
  mapVoteValue,
  policzGlosy,
  type GlosPosla,
} from "@/lib/glosowania";
import {
  fetchSejmJson,
  mapWithConcurrency,
  SEJM_API_BASE,
  SEJM_TERM,
} from "@/lib/sejm-api";
import { supabaseAdmin } from "@/lib/supabase-admin";

// Jedno głosowanie to 460 wierszy w glosy_poslow, więc domyślnie bierzemy tylko
// kilka ostatnich posiedzeń. Całą kadencję da się dociągnąć parametrami, ale
// wtedy trzeba to puścić kilkoma przebiegami.
const DEFAULT_SITTINGS = 3;
const DEFAULT_MAX_VOTINGS = 40;

const SITTING_LIST_CONCURRENCY = 6;
const VOTING_DETAIL_CONCURRENCY = 6;
const VOTES_CHUNK_SIZE = 500;

type SejmProceedingDay = {
  proceeding?: number;
  date?: string;
  votingsNum?: number;
};

type SejmVotingSummary = {
  sitting?: number;
  votingNumber?: number;
  title?: string;
  topic?: string;
  description?: string;
  date?: string;
};

type SejmVote = {
  MP?: number;
  club?: string;
  vote?: string;
};

type SejmVotingDetails = SejmVotingSummary & {
  votes?: SejmVote[];
};

export type SyncVotingsOptions = {
  sittings?: number;
  sitting?: number;
  maxVotings?: number;
};

export type SyncVotingsResult = {
  status: "ok" | "error";
  posiedzenia: number[];
  glosowanZApi: number;
  dopasowanych: number;
  zapisanychGlosowan: number;
  zapisanychGlosow: number;
  message?: string;
};

/**
 * Numery posiedzeń bierzemy z listy dni głosowań — endpoint /votings zwraca po
 * jednym wpisie na dzień, więc numery trzeba odfiltrować z duplikatów.
 */
async function fetchSittingNumbers(): Promise<number[]> {
  const days = await fetchSejmJson<SejmProceedingDay[]>(
    `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/votings`,
    { revalidate: 0, timeoutMs: 20_000 },
  );

  const numbers = new Set<number>();

  for (const day of days ?? []) {
    if (day.proceeding && (day.votingsNum ?? 0) > 0) {
      numbers.add(day.proceeding);
    }
  }

  return [...numbers].sort((a, b) => b - a);
}

async function fetchVotingsForSitting(sitting: number): Promise<SejmVotingSummary[]> {
  const votings = await fetchSejmJson<SejmVotingSummary[]>(
    `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/votings/${sitting}`,
    { revalidate: 0, timeoutMs: 20_000 },
  );

  return votings ?? [];
}

async function fetchVotingDetails(
  sitting: number,
  votingNumber: number,
): Promise<SejmVotingDetails | null> {
  return fetchSejmJson<SejmVotingDetails>(
    `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/votings/${sitting}/${votingNumber}`,
    { revalidate: 0, timeoutMs: 20_000 },
  );
}

async function fetchDrukIndex(): Promise<Map<string, number>> {
  const { data, error } = await supabaseAdmin
    .from("ustawy")
    .select("id, numer_druku")
    .range(0, 9999);

  if (error) {
    throw new Error(error.message);
  }

  const index = new Map<string, number>();

  for (const row of data ?? []) {
    index.set(String((row as { numer_druku: string }).numer_druku), Number((row as { id: number }).id));
  }

  return index;
}

async function fetchKnownPoselIds(): Promise<Set<number>> {
  const { data, error } = await supabaseAdmin.from("poslowie").select("id").range(0, 999);

  if (error) {
    throw new Error(error.message);
  }

  return new Set((data ?? []).map((row) => Number((row as { id: number }).id)));
}

/**
 * Tytuł głosowania wymienia druki, których dotyczy. Wybieramy pierwszy numer
 * obecny w naszej bazie — pozostałe to zwykle autopoprawki do tego samego
 * projektu, a jedno głosowanie może wskazywać tylko jedną ustawę.
 */
function matchUstawaId(
  voting: SejmVotingSummary,
  drukIndex: Map<string, number>,
): number | null {
  const numery = extractDrukNumbers(
    [voting.title, voting.description, voting.topic].filter(Boolean).join(" "),
  );

  for (const numer of numery) {
    for (const key of drukLookupKeys(numer)) {
      const ustawaId = drukIndex.get(key);

      if (ustawaId !== undefined) {
        return ustawaId;
      }
    }
  }

  return null;
}

type PreparedVoting = {
  ustawaId: number;
  sitting: number;
  votingNumber: number;
  summary: SejmVotingSummary;
};

async function saveVoting(
  prepared: PreparedVoting,
  knownPoselIds: Set<number>,
): Promise<{ glosy: number } | { error: string }> {
  const details = await fetchVotingDetails(prepared.sitting, prepared.votingNumber);

  if (!details) {
    return { error: `Brak szczegółów głosowania ${prepared.sitting}/${prepared.votingNumber}` };
  }

  const glosy = (details.votes ?? [])
    .filter((vote): vote is SejmVote & { MP: number } =>
      typeof vote.MP === "number" && knownPoselIds.has(vote.MP),
    )
    .map((vote) => ({
      posel_id: vote.MP,
      klub: vote.club ?? null,
      glos: mapVoteValue(vote.vote) as GlosPosla,
    }));

  // Kafelki podsumowania liczymy z listy imiennej, a nie z pól zbiorczych API,
  // żeby suma czterech liczb zawsze zgadzała się z długością listy pod spodem.
  const podsumowanie = policzGlosy(glosy);

  const { data: saved, error: votingError } = await supabaseAdmin
    .from("glosowania")
    .upsert(
      {
        ustawa_id: prepared.ustawaId,
        sitting: prepared.sitting,
        numer_glosowania: prepared.votingNumber,
        tytul: details.title ?? prepared.summary.title ?? "Głosowanie",
        temat: details.topic ?? prepared.summary.topic ?? null,
        data_glosowania: details.date ?? prepared.summary.date ?? null,
        za: podsumowanie.ZA,
        przeciw: podsumowanie.PRZECIW,
        wstrzymalo_sie: podsumowanie.WSTRZYMAL_SIE,
        nieobecni: podsumowanie.NIEOBECNY,
        zaktualizowano_at: new Date().toISOString(),
      },
      { onConflict: "sitting,numer_glosowania" },
    )
    .select("id")
    .single();

  if (votingError) {
    return { error: votingError.message };
  }

  const glosowanieId = Number((saved as { id: number }).id);

  for (let start = 0; start < glosy.length; start += VOTES_CHUNK_SIZE) {
    const chunk = glosy
      .slice(start, start + VOTES_CHUNK_SIZE)
      .map((glos) => ({ ...glos, glosowanie_id: glosowanieId }));

    const { error: votesError } = await supabaseAdmin
      .from("glosy_poslow")
      .upsert(chunk, { onConflict: "glosowanie_id,posel_id" });

    if (votesError) {
      return { error: votesError.message };
    }
  }

  return { glosy: glosy.length };
}

export async function syncVotings(
  options: SyncVotingsOptions = {},
): Promise<SyncVotingsResult> {
  const emptyResult: Omit<SyncVotingsResult, "status"> = {
    posiedzenia: [],
    glosowanZApi: 0,
    dopasowanych: 0,
    zapisanychGlosowan: 0,
    zapisanychGlosow: 0,
  };

  // Smart CRON podaje numer bieżącego posiedzenia z /proceedings/current,
  // zanim pojawią się pierwsze głosowania — wtedy listy /votings jeszcze nie ma.
  let sittings: number[];

  if (options.sitting) {
    sittings = [options.sitting];
  } else {
    const allSittings = await fetchSittingNumbers();

    if (allSittings.length === 0) {
      return {
        ...emptyResult,
        status: "error",
        message: "API Sejmu nie zwróciło listy posiedzeń z głosowaniami",
      };
    }

    sittings = allSittings.slice(0, options.sittings ?? DEFAULT_SITTINGS);
  }

  const [drukIndex, knownPoselIds] = await Promise.all([
    fetchDrukIndex(),
    fetchKnownPoselIds(),
  ]);

  if (drukIndex.size === 0) {
    return {
      ...emptyResult,
      status: "error",
      posiedzenia: sittings,
      message: "Tabela ustawy jest pusta — najpierw uruchom /api/sync-ustawy",
    };
  }

  if (knownPoselIds.size === 0) {
    return {
      ...emptyResult,
      status: "error",
      posiedzenia: sittings,
      message: "Tabela poslowie jest pusta — najpierw uruchom /api/sync-mps",
    };
  }

  const listy = await mapWithConcurrency(sittings, SITTING_LIST_CONCURRENCY, (sitting) =>
    fetchVotingsForSitting(sitting),
  );

  const wszystkie = listy.flat();
  const dopasowane: PreparedVoting[] = [];

  for (const voting of wszystkie) {
    const sitting = voting.sitting;
    const votingNumber = voting.votingNumber;

    if (typeof sitting !== "number" || typeof votingNumber !== "number") {
      continue;
    }

    const ustawaId = matchUstawaId(voting, drukIndex);

    if (ustawaId !== null) {
      dopasowane.push({ ustawaId, sitting, votingNumber, summary: voting });
    }
  }

  // Najnowsze głosowania są najciekawsze, więc gdy limit obetnie listę,
  // odpadają najstarsze pozycje.
  const wybrane = [...dopasowane]
    .sort((a, b) => b.sitting - a.sitting || b.votingNumber - a.votingNumber)
    .slice(0, options.maxVotings ?? DEFAULT_MAX_VOTINGS);

  const zapisy = await mapWithConcurrency(wybrane, VOTING_DETAIL_CONCURRENCY, (prepared) =>
    saveVoting(prepared, knownPoselIds),
  );

  let zapisanychGlosowan = 0;
  let zapisanychGlosow = 0;
  let firstError: string | null = null;

  for (const zapis of zapisy) {
    if ("error" in zapis) {
      firstError ??= zapis.error;
      continue;
    }

    zapisanychGlosowan += 1;
    zapisanychGlosow += zapis.glosy;
  }

  return {
    status: firstError && zapisanychGlosowan === 0 ? "error" : "ok",
    posiedzenia: sittings,
    glosowanZApi: wszystkie.length,
    dopasowanych: dopasowane.length,
    zapisanychGlosowan,
    zapisanychGlosow,
    message: firstError ?? undefined,
  };
}
