import { htmlToPlainText, sanitizeSejmHtml } from "@/lib/sejm-document";
import { fetchSejmJson, SEJM_API_BASE, SEJM_TERM } from "@/lib/sejm-api";
import { todayIso } from "@/lib/posiedzenia";

export type SejmProceeding = {
  number: number;
  title: string;
  dates: string[];
  current?: boolean;
  agenda?: string | null;
  currentAffairs?: string | null;
};

export type SejmTodayVideo = {
  type?: string;
  title?: string;
  room?: string;
  playerLink?: string;
  playerLinkIFrame?: string;
  videoLink?: string;
  startDateTime?: string;
  endDateTime?: string;
};

export type SittingDay = {
  date: string;
  number: number;
  title: string;
};

function asProceeding(raw: Record<string, unknown>): SejmProceeding | null {
  const dates = Array.isArray(raw.dates)
    ? raw.dates.filter((item): item is string => typeof item === "string" && item.length > 0)
    : [];

  if (dates.length === 0) {
    return null;
  }

  const number = typeof raw.number === "number" ? raw.number : 0;

  return {
    number,
    title:
      (typeof raw.title === "string" && raw.title.trim()) ||
      `${number}. posiedzenie Sejmu`,
    dates,
    current: raw.current === true,
    agenda: typeof raw.agenda === "string" ? raw.agenda : null,
    currentAffairs: typeof raw.currentAffairs === "string" ? raw.currentAffairs : null,
  };
}

export async function fetchProceedings(): Promise<SejmProceeding[]> {
  const payload = await fetchSejmJson<Record<string, unknown>[]>(
    `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/proceedings`,
    { revalidate: 120, timeoutMs: 20_000 },
  );

  return (payload ?? [])
    .map((item) => asProceeding(item))
    .filter((item): item is SejmProceeding => item !== null);
}

export async function fetchCurrentProceeding(): Promise<SejmProceeding | null> {
  const payload = await fetchSejmJson<Record<string, unknown>>(
    `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/proceedings/current`,
    { revalidate: 30, timeoutMs: 10_000 },
  );

  return payload ? asProceeding(payload) : null;
}

export async function fetchTodayVideos(): Promise<SejmTodayVideo[]> {
  const payload = await fetchSejmJson<SejmTodayVideo[]>(
    `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/videos/today`,
    { revalidate: 30, timeoutMs: 10_000 },
  );

  return payload ?? [];
}

export function isLiveSitting(
  proceeding: SejmProceeding | null,
  today = todayIso(),
): boolean {
  return Boolean(proceeding && proceeding.dates.includes(today));
}

export function pickInitialCalendarDate(today: string, days: SittingDay[]): string {
  if (days.some((day) => day.date === today)) {
    return today;
  }

  const upcoming = days
    .filter((day) => day.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date));

  if (upcoming[0]) {
    return upcoming[0].date;
  }

  const past = [...days].sort((a, b) => b.date.localeCompare(a.date));
  return past[0]?.date ?? today;
}

export function toSittingDays(proceedings: SejmProceeding[]): SittingDay[] {
  const days: SittingDay[] = [];

  for (const proceeding of proceedings) {
    for (const date of proceeding.dates) {
      days.push({
        date,
        number: proceeding.number,
        title: proceeding.title,
      });
    }
  }

  return days;
}

export function findProceedingForDate(
  proceedings: SejmProceeding[],
  date: string,
): SejmProceeding | null {
  return proceedings.find((proceeding) => proceeding.dates.includes(date)) ?? null;
}

export function pickPlenaryVideo(videos: SejmTodayVideo[]): SejmTodayVideo | null {
  const plenary = videos.filter(
    (video) =>
      video.type === "posiedzenie" ||
      video.room === "Sala Posiedzeń" ||
      /posiedzenie sejmu/i.test(video.title ?? ""),
  );

  return plenary[0] ?? null;
}

export function sejmRichHtml(value: string | null | undefined): string | null {
  if (!value?.trim()) {
    return null;
  }

  const trimmed = value.trim();

  if (/<[a-z][\s\S]*>/i.test(trimmed)) {
    return sanitizeSejmHtml(trimmed) || null;
  }

  const text = htmlToPlainText(trimmed);

  if (!text) {
    return null;
  }

  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n/g, "<br />");
}
