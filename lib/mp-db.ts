import { supabaseAdmin } from "@/lib/supabase-admin";
import type { AttendanceComparison } from "@/lib/sejm-attendance";
import {
  createEmptyMpProfileStats,
  formatVoteLabel,
  type MpProfileStats,
  type MpVote,
} from "@/lib/mp-stats";
import type { InterpellationItem, VotingDeepDive } from "@/lib/sejm-voting";

const INTERPELLATIONS_LIMIT = 20;
const GLOSOWANIA_PAGE_SIZE = 1000;

type PoselFrekwencjaRow = {
  frekwencja_procent: number | null;
  total_glosowan: number;
  uczestniczyl_w: number;
};

type PoselGlosowanieRow = {
  sitting: number;
  numer_glosowania: number;
  data: string;
  tytul: string | null;
  temat: string | null;
  opis: string | null;
  glos: string;
  wynik: string | null;
  glosy_za: number | null;
  glosy_przeciw: number | null;
  glosy_wstrzymal: number | null;
  linia_klubu: string | null;
  zgodnosc_klubowa: boolean | null;
};

type InterpelacjaRow = {
  id: number;
  tytul: string;
  data: string | null;
  status: string | null;
  odbiorca: string | null;
};

export type MpProfileBundle = {
  stats: MpProfileStats;
  comparison: AttendanceComparison;
  interpellations: InterpellationItem[];
  interpellationsTotal: number;
  voteDetails: Record<string, VotingDeepDive>;
};

function mapGlosowanieToVote(row: PoselGlosowanieRow): MpVote {
  return {
    date: row.data,
    sitting: row.sitting,
    title: row.tytul ?? undefined,
    topic: row.temat ?? undefined,
    description: row.opis ?? undefined,
    vote: row.glos,
    votingNumber: row.numer_glosowania,
  };
}

function outcomeLabelFromCode(code: string | null): string {
  switch (code) {
    case "passed":
      return "Przyjęta w głosowaniu";
    case "rejected":
      return "Odrzucona w głosowaniu";
    default:
      return "Wynik niejednoznaczny";
  }
}

function mapGlosowanieToDeepDive(row: PoselGlosowanieRow): VotingDeepDive {
  const outcome =
    row.wynik === "passed" || row.wynik === "rejected" || row.wynik === "inconclusive"
      ? row.wynik
      : "inconclusive";

  return {
    title: row.tytul ?? row.temat ?? "Głosowanie",
    description: row.opis ?? "",
    topic: row.temat ?? "",
    date: row.data,
    mpVote: row.glos,
    mpVoteLabel: formatVoteLabel(row.glos),
    clubLine: row.linia_klubu,
    clubLineLabel: row.linia_klubu ? formatVoteLabel(row.linia_klubu) : "Brak danych klubowych",
    clubAligned: row.zgodnosc_klubowa,
    outcome,
    outcomeLabel: outcomeLabelFromCode(row.wynik),
    yes: row.glosy_za ?? 0,
    no: row.glosy_przeciw ?? 0,
    abstain: row.glosy_wstrzymal ?? 0,
    partial: false,
    fallbackMessage: null,
  };
}

function voteKey(sitting: number, numer: number): string {
  return `${sitting}-${numer}`;
}

function mapInterpelacja(row: InterpelacjaRow): InterpellationItem {
  return {
    num: row.id,
    title: row.tytul,
    receiptDate: row.data ?? undefined,
    to: row.odbiorca ? row.odbiorca.split(", ") : undefined,
    status: row.status ?? undefined,
  };
}

export async function fetchAttendanceComparisonFromDb(
  mpId: number,
  clubName: string | null,
): Promise<AttendanceComparison> {
  const [{ data: mpRow }, { data: sejmRow }, clubResponse] = await Promise.all([
    supabaseAdmin
      .from("posel_frekwencja")
      .select("frekwencja_procent")
      .eq("posel_id", mpId)
      .maybeSingle(),
    supabaseAdmin
      .from("frekwencja_agregaty")
      .select("frekwencja_procent")
      .eq("klucz", "sejm")
      .maybeSingle(),
    clubName
      ? supabaseAdmin
          .from("frekwencja_agregaty")
          .select("frekwencja_procent")
          .eq("klucz", clubName)
          .maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ]);

  const mpPercent = (mpRow as { frekwencja_procent: number | null } | null)?.frekwencja_procent ?? null;
  const sejmPercent =
    (sejmRow as { frekwencja_procent: number | null } | null)?.frekwencja_procent ?? null;
  const clubPercent =
    (clubResponse.data as { frekwencja_procent: number | null } | null)?.frekwencja_procent ??
    null;

  const hasAnyData = mpPercent !== null || clubPercent !== null || sejmPercent !== null;

  return {
    mp: mpPercent,
    club: clubPercent,
    clubName,
    sejm: sejmPercent,
    partial: !hasAnyData,
    fallbackMessage: hasAnyData
      ? null
      : "Brak zsynchronizowanych danych porównawczych. Uruchom /api/sync-details.",
  };
}

async function fetchPoselGlosowania(mpId: number): Promise<PoselGlosowanieRow[]> {
  const rows: PoselGlosowanieRow[] = [];

  for (let from = 0; ; from += GLOSOWANIA_PAGE_SIZE) {
    const { data, error } = await supabaseAdmin
      .from("posel_glosowania")
      .select("*")
      .eq("posel_id", mpId)
      .order("sitting", { ascending: false })
      .order("numer_glosowania", { ascending: false })
      .range(from, from + GLOSOWANIA_PAGE_SIZE - 1);

    if (error) {
      throw new Error(error.message);
    }

    const page = (data ?? []) as PoselGlosowanieRow[];
    rows.push(...page);

    if (page.length < GLOSOWANIA_PAGE_SIZE) {
      return rows;
    }
  }
}

export async function fetchMpProfileBundleFromDb(
  mpId: number,
  clubName: string | null,
): Promise<MpProfileBundle> {
  const [
    frekwencjaResponse,
    glosowaniaResponse,
    interpelacjeResponse,
    interpelacjeCountResponse,
    comparison,
  ] = await Promise.all([
    supabaseAdmin.from("posel_frekwencja").select("*").eq("posel_id", mpId).maybeSingle(),
    fetchPoselGlosowania(mpId),
    supabaseAdmin
      .from("interpelacje")
      .select("*")
      .eq("posel_id", mpId)
      .order("data", { ascending: false })
      .limit(INTERPELLATIONS_LIMIT),
    supabaseAdmin
      .from("interpelacje")
      .select("id", { count: "exact", head: true })
      .eq("posel_id", mpId),
    fetchAttendanceComparisonFromDb(mpId, clubName),
  ]);

  const frekwencja = frekwencjaResponse.data as PoselFrekwencjaRow | null;
  const glosowania = glosowaniaResponse;
  const interpelacje = (interpelacjeResponse.data ?? []) as InterpelacjaRow[];
  const interpellationsTotal = interpelacjeCountResponse.count ?? interpelacje.length;

  const recentVotes = glosowania.map(mapGlosowanieToVote);
  const voteDetails: Record<string, VotingDeepDive> = {};

  for (const row of glosowania) {
    voteDetails[voteKey(row.sitting, row.numer_glosowania)] = mapGlosowanieToDeepDive(row);
  }

  const hasSyncedData =
    frekwencja !== null || glosowania.length > 0 || interpelacje.length > 0;

  const stats: MpProfileStats = frekwencja
    ? {
        attendancePercent: frekwencja.frekwencja_procent,
        totalVotings: frekwencja.total_glosowan,
        participatedVotings: frekwencja.uczestniczyl_w,
        interpellationCount: interpellationsTotal,
        interpellationApproximate: false,
        recentVotes,
        partial: false,
        fallbackMessage: null,
      }
    : {
        ...createEmptyMpProfileStats(
          hasSyncedData
            ? null
            : "Brak zsynchronizowanych statystyk. Uruchom GET /api/sync-details?posel_id=" +
                mpId,
        ),
        interpellationCount: interpellationsTotal > 0 ? interpellationsTotal : null,
        interpellationApproximate: false,
        recentVotes,
      };

  return {
    stats,
    comparison,
    interpellations: interpelacje.map(mapInterpelacja),
    interpellationsTotal,
    voteDetails,
  };
}
