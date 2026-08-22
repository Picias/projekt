import {
  fetchRecentVotes,
  type MpVote,
} from "@/lib/mp-stats";
import {
  fetchSejmJsonSafe,
  SEJM_API_BASE,
  SEJM_FETCH_TIMEOUT_MS,
  SEJM_TERM,
} from "@/lib/sejm-api";

export type SejmMpProfile = {
  id: number;
  firstName: string;
  lastName: string;
  firstLastName: string;
  club: string | null;
  districtName: string | null;
  districtNum: number | null;
  voivodeship: string | null;
  birthDate: string | null;
  birthLocation: string | null;
  educationLevel: string | null;
  profession: string | null;
  email: string | null;
  numberOfVotes: number | null;
  numberOfSpeeches: number | null;
  numberOfInterpellations: number | null;
  active: boolean;
  photoUrl: string;
};

export type FetchSejmMpResult =
  | { status: "ok"; mp: SejmMpProfile }
  | { status: "not_found" }
  | { status: "error"; message: string };

export type MpSpeech = {
  id: string;
  date: string;
  title: string;
  sittingLabel: string;
  sitting?: number;
  videoUrl?: string | null;
  transcriptUrl?: string | null;
};

export type MpSpeechActivity = {
  count: number | null;
  items: MpSpeech[];
  simulated: boolean;
};

export type MpVotingActivity = {
  votes: MpVote[];
  source: "api" | "simulated";
};

type SejmMpRaw = {
  id?: number;
  firstName?: string;
  lastName?: string;
  firstLastName?: string;
  club?: string;
  districtName?: string;
  districtNum?: number;
  voivodeship?: string;
  birthDate?: string;
  birthLocation?: string;
  educationLevel?: string;
  profession?: string;
  email?: string;
  numberOfVotes?: number;
  numberOfSpeeches?: number;
  numberOfInterpellations?: number;
  active?: boolean;
};

function text(value: string | undefined): string | null {
  return value?.trim() ? value.trim() : null;
}

function integer(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function getMpPhotoUrl(id: number): string {
  return `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/MP/${id}/photo`;
}

function mapSejmMp(raw: SejmMpRaw, id: number): SejmMpProfile {
  const firstLastName =
    text(raw.firstLastName) ??
    [raw.firstName, raw.lastName].filter(Boolean).join(" ").trim() ??
    `Poseł #${id}`;

  return {
    id: raw.id ?? id,
    firstName: text(raw.firstName) ?? firstLastName,
    lastName: text(raw.lastName) ?? "",
    firstLastName,
    club: text(raw.club),
    districtName: text(raw.districtName),
    districtNum: integer(raw.districtNum),
    voivodeship: text(raw.voivodeship),
    birthDate: text(raw.birthDate),
    birthLocation: text(raw.birthLocation),
    educationLevel: text(raw.educationLevel),
    profession: text(raw.profession),
    email: text(raw.email),
    numberOfVotes: integer(raw.numberOfVotes),
    numberOfSpeeches: integer(raw.numberOfSpeeches),
    numberOfInterpellations: integer(raw.numberOfInterpellations),
    active: raw.active !== false,
    photoUrl: getMpPhotoUrl(raw.id ?? id),
  };
}

export async function fetchSejmMp(id: number): Promise<FetchSejmMpResult> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), SEJM_FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(
      `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/MP/${id}`,
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

    const raw = (await response.json()) as SejmMpRaw;

    if (!raw || typeof raw !== "object") {
      return { status: "not_found" };
    }

    return { status: "ok", mp: mapSejmMp(raw, id) };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";

    return {
      status: "error",
      message: timedOut
        ? "API Sejmu odpowiada zbyt wolno. Spróbuj odświeżyć profil za chwilę."
        : "Nie udało się pobrać danych posła z API Sejmu.",
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

const SIMULATED_VOTES: MpVote[] = [
  {
    date: "2025-12-05",
    sitting: 47,
    title: "Rządowy projekt ustawy o zmianie ustawy o podatku od towarów i usług",
    topic: "głosowanie nad całością projektu",
    vote: "YES",
    votingNumber: 18,
  },
  {
    date: "2025-12-05",
    sitting: 47,
    title: "Poselski projekt ustawy o ochronie zdrowia psychicznego dzieci i młodzieży",
    topic: "poprawka 3.",
    vote: "NO",
    votingNumber: 17,
  },
  {
    date: "2025-12-04",
    sitting: 47,
    title: "Sprawozdanie Komisji o rządowym projekcie ustawy budżetowej",
    topic: "głosowanie nad całością",
    vote: "ABSTAIN",
    votingNumber: 9,
  },
  {
    date: "2025-11-07",
    sitting: 45,
    title: "Rządowy projekt ustawy o zmianie ustawy — Prawo oświatowe",
    topic: "odrzucony wniosek o odrzucenie projektu",
    vote: "YES",
    votingNumber: 4,
  },
];

export function withVotingActivityFallback(votes: MpVote[]): MpVotingActivity {
  if (votes.length > 0) {
    return { votes, source: "api" };
  }

  return { votes: SIMULATED_VOTES, source: "simulated" };
}

export async function fetchLatestMpVotingActivity(
  mpId: number,
): Promise<MpVotingActivity> {
  const votes = await fetchRecentVotes(mpId);
  return withVotingActivityFallback(votes);
}

function buildSimulatedSpeeches(mpName: string): MpSpeech[] {
  return [
    {
      id: "sim-1",
      date: "2025-12-05",
      title: `Wystąpienie w debacie nad informacją Rady Ministrów — ${mpName}`,
      sittingLabel: "Posiedzenie nr 47",
      sitting: 47,
    },
    {
      id: "sim-2",
      date: "2025-11-07",
      title: "Głos w dyskusji nad sprawozdaniem komisji sejmowej",
      sittingLabel: "Posiedzenie nr 45",
      sitting: 45,
    },
    {
      id: "sim-3",
      date: "2025-10-09",
      title: "Oświadczenie poselskie z trybuny sejmowej",
      sittingLabel: "Posiedzenie nr 42",
      sitting: 42,
    },
  ];
}

type SejmSpeechRaw = {
  id?: number | string;
  date?: string;
  title?: string;
  topic?: string;
  sitting?: number;
  videoUrl?: string;
  video?: string;
  transcriptUrl?: string;
  transcript?: string;
};

function mapSejmSpeech(raw: SejmSpeechRaw, index: number): MpSpeech {
  const sitting = typeof raw.sitting === "number" ? raw.sitting : undefined;

  return {
    id: raw.id != null ? String(raw.id) : `speech-${index}`,
    date: raw.date ?? "",
    title: raw.title?.trim() || raw.topic?.trim() || "Wystąpienie poselskie",
    sittingLabel: sitting ? `Posiedzenie nr ${sitting}` : "Posiedzenie Sejmu",
    sitting,
    videoUrl: raw.videoUrl ?? raw.video ?? null,
    transcriptUrl: raw.transcriptUrl ?? raw.transcript ?? null,
  };
}

// API Sejmu nie publikuje stabilnego endpointu wystąpień per poseł.
// Próbujemy /MP/{id}/speeches; gdy go brak, wracamy do szkieletu listy.
export async function fetchMpSpeechActivity(
  mp: Pick<SejmMpProfile, "id" | "firstLastName" | "numberOfSpeeches">,
): Promise<MpSpeechActivity> {
  const result = await fetchSejmJsonSafe<SejmSpeechRaw[]>(
    `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/MP/${mp.id}/speeches`,
    { revalidate: 3600, timeoutMs: SEJM_FETCH_TIMEOUT_MS },
  );

  if (result.data && Array.isArray(result.data) && result.data.length > 0) {
    const items = result.data.map(mapSejmSpeech);

    return {
      count: mp.numberOfSpeeches ?? items.length,
      items,
      simulated: false,
    };
  }

  return {
    count: mp.numberOfSpeeches,
    items: buildSimulatedSpeeches(mp.firstLastName),
    simulated: true,
  };
}

export function getMpSpeechActivity(
  mp: Pick<SejmMpProfile, "firstLastName" | "numberOfSpeeches">,
): MpSpeechActivity {
  return {
    count: mp.numberOfSpeeches,
    items: buildSimulatedSpeeches(mp.firstLastName),
    simulated: true,
  };
}
