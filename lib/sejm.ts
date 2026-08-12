const SEJM_TERM = 10;
const SEJM_API_BASE = "https://api.sejm.gov.pl";

export type SejmProceeding = {
  number?: number;
  title?: string;
  dates?: string[];
  current?: boolean;
};

export type NextProceedingInfo = {
  number: number;
  title: string;
  startDate: string;
  endDate: string;
  daysUntil: number;
  isOngoing: boolean;
};

const dateFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

function startOfDay(date: Date): Date {
  const normalized = new Date(date);
  normalized.setHours(0, 0, 0, 0);
  return normalized;
}

function diffDays(from: Date, to: Date): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((startOfDay(to).getTime() - startOfDay(from).getTime()) / msPerDay);
}

export function formatProceedingDate(date: string): string {
  return dateFormatter.format(new Date(`${date}T12:00:00`));
}

export async function fetchNextProceeding(): Promise<NextProceedingInfo | null> {
  try {
    const response = await fetch(
      `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/proceedings/current`,
      { headers: { Accept: "application/json" }, next: { revalidate: 3600 } },
    );

    if (!response.ok) {
      return null;
    }

    const proceeding = (await response.json()) as SejmProceeding;
    const dates = proceeding.dates?.filter(Boolean) ?? [];

    if (!proceeding.number || dates.length === 0) {
      return null;
    }

    const today = startOfDay(new Date());
    const startDate = dates[0];
    const endDate = dates[dates.length - 1];
    const start = startOfDay(new Date(`${startDate}T12:00:00`));
    const end = startOfDay(new Date(`${endDate}T12:00:00`));
    const isOngoing = today >= start && today <= end;

    return {
      number: proceeding.number,
      title: proceeding.title ?? `${proceeding.number}. posiedzenie Sejmu RP`,
      startDate,
      endDate,
      daysUntil: diffDays(today, start),
      isOngoing,
    };
  } catch {
    return null;
  }
}

export function getProceedingCountdownLabel(info: NextProceedingInfo): string {
  if (info.isOngoing) {
    return "Posiedzenie trwa";
  }

  if (info.daysUntil === 0) {
    return "Posiedzenie dziś";
  }

  if (info.daysUntil === 1) {
    return "Za 1 dzień";
  }

  if (info.daysUntil > 1) {
    return `Za ${info.daysUntil} dni`;
  }

  return "Termin nieznany";
}
