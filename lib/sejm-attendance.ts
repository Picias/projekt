import { unstable_cache } from "next/cache";

import {
  calculateAttendance,
  type VotingStat,
} from "@/lib/mp-stats";
import {
  fetchAllMps,
  fetchSejmJson,
  mapWithConcurrency,
  SEJM_API_BASE,
  SEJM_FETCH_TIMEOUT_MS,
  SEJM_TERM,
  withTimeout,
} from "@/lib/sejm-api";

export type AttendanceComparison = {
  mp: number | null;
  club: number | null;
  clubName: string | null;
  sejm: number | null;
  partial: boolean;
  fallbackMessage: string | null;
};

const ATTENDANCE_FETCH_CONCURRENCY = 12;
const CLUB_SAMPLE_SIZE = 24;
const SEJM_SAMPLE_SIZE = 40;

async function fetchMpVotingStats(mpId: number): Promise<VotingStat[]> {
  const stats = await fetchSejmJson<VotingStat[]>(
    `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/MP/${mpId}/votings/stats`,
    { revalidate: 3600, timeoutMs: SEJM_FETCH_TIMEOUT_MS },
  );
  return stats ?? [];
}

async function averageAttendanceForMps(mpIds: number[]): Promise<number | null> {
  if (mpIds.length === 0) {
    return null;
  }

  const percents = await mapWithConcurrency(mpIds, ATTENDANCE_FETCH_CONCURRENCY, async (id) => {
    const stats = await fetchMpVotingStats(id);
    return calculateAttendance(stats).percent;
  });

  const valid = percents.filter((value): value is number => value !== null);

  if (valid.length === 0) {
    return null;
  }

  return Math.round(valid.reduce((sum, value) => sum + value, 0) / valid.length);
}

function sampleMpIds(ids: number[], sampleSize: number): number[] {
  if (ids.length <= sampleSize) {
    return ids;
  }

  const step = ids.length / sampleSize;
  const sampled: number[] = [];

  for (let index = 0; index < sampleSize; index += 1) {
    sampled.push(ids[Math.floor(index * step)]);
  }

  return sampled;
}

const getSejmAverageAttendance = unstable_cache(
  async () => {
    const ids = await getActiveMpIds();
    return averageAttendanceForMps(sampleMpIds(ids, SEJM_SAMPLE_SIZE));
  },
  ["sejm-term10-attendance-average"],
  { revalidate: 86400 },
);

const getClubAverageAttendance = unstable_cache(
  async (clubName: string) => {
    const mps = await fetchAllMps();
    const clubIds = mps
      .filter((mp) => mp.club === clubName && mp.active !== false)
      .map((mp) => mp.id);

    return averageAttendanceForMps(sampleMpIds(clubIds, CLUB_SAMPLE_SIZE));
  },
  ["sejm-term10-club-attendance-average"],
  { revalidate: 86400 },
);

async function getActiveMpIds(): Promise<number[]> {
  const mps = await fetchAllMps();
  return mps.filter((mp) => mp.active !== false).map((mp) => mp.id);
}

function createFallbackComparison(
  mpId: number,
  clubName: string | null,
  mpPercent: number | null,
  message: string,
): AttendanceComparison {
  return {
    mp: mpPercent,
    club: null,
    clubName,
    sejm: null,
    partial: true,
    fallbackMessage: message,
  };
}

async function loadAttendanceComparison(
  mpPercent: number | null,
  clubName: string | null,
): Promise<AttendanceComparison> {
  const [clubPercent, sejmPercent] = await Promise.all([
    clubName ? getClubAverageAttendance(clubName) : Promise.resolve(null),
    getSejmAverageAttendance(),
  ]);

  const partial =
    mpPercent === null ||
    (clubName ? clubPercent === null : false) ||
    sejmPercent === null;

  return {
    mp: mpPercent,
    club: clubPercent,
    clubName,
    sejm: sejmPercent,
    partial,
    fallbackMessage: partial
      ? "Porównanie klubu i Sejmu może być przybliżone lub chwilowo niedostępne."
      : null,
  };
}

export async function fetchAttendanceComparison(
  mpId: number,
  clubName: string | null,
): Promise<AttendanceComparison> {
  const mpStats = await fetchMpVotingStats(mpId);
  const mpPercent = calculateAttendance(mpStats).percent;

  const { value, timedOut } = await withTimeout(
    loadAttendanceComparison(mpPercent, clubName),
    SEJM_FETCH_TIMEOUT_MS,
    createFallbackComparison(
      mpId,
      clubName,
      mpPercent,
      "Porównanie frekwencji jest chwilowo niedostępne — pokazujemy tylko dane posła.",
    ),
  );

  if (timedOut) {
    return value;
  }

  return value;
}

export function buildComparisonBar(value: number | null, label: string) {
  return {
    label,
    value: value ?? 0,
    display: value !== null ? `${value}%` : "—",
  };
}
