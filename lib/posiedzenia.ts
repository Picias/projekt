import { supabaseAdmin } from "@/lib/supabase-admin";

export type Posiedzenie = {
  id: string;
  numer: number;
  tytul: string;
  data_rozpoczecia: string;
  data_zakonczenia: string;
};

const COLUMNS = "id, numer, tytul, data_rozpoczecia, data_zakonczenia";

const fullDateFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

const dayMonthFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
});

// Daty posiedzeń z API Sejmu są kalendarzowe (bez strefy). Na Vercel zegar
// serwera jest w UTC, więc bierzemy dzień według Warszawy — inaczej rano
// w Polsce cron widziałby jeszcze wczoraj.
export function todayIso(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Warsaw",
  }).format(new Date());
}

function toUtcTime(date: string): number {
  const [year, month, day] = date.split("-").map(Number);

  return Date.UTC(year, month - 1, day);
}

export function daysBetween(from: string, to: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;

  return Math.round((toUtcTime(to) - toUtcTime(from)) / msPerDay);
}

export function formatPosiedzenieDate(date: string): string {
  return fullDateFormatter.format(new Date(`${date}T12:00:00Z`));
}

// Skracamy zakres, gdy oba dni mieszczą się w jednym miesiącu lub roku,
// żeby "2 września 2026 – 4 września 2026" nie zajmowało dwóch linii.
export function formatPosiedzenieRange(start: string, end: string): string {
  if (start === end) {
    return formatPosiedzenieDate(start);
  }

  const [startYear, startMonth, startDay] = start.split("-");
  const [endYear, endMonth] = end.split("-");

  if (startYear === endYear && startMonth === endMonth) {
    return `${Number(startDay)}–${formatPosiedzenieDate(end)}`;
  }

  if (startYear === endYear) {
    return `${dayMonthFormatter.format(new Date(`${start}T12:00:00Z`))} – ${formatPosiedzenieDate(end)}`;
  }

  return `${formatPosiedzenieDate(start)} – ${formatPosiedzenieDate(end)}`;
}

export function isOngoing(posiedzenie: Posiedzenie, today: string): boolean {
  return (
    posiedzenie.data_rozpoczecia <= today && posiedzenie.data_zakonczenia >= today
  );
}

export function isUpcoming(posiedzenie: Posiedzenie, today: string): boolean {
  return posiedzenie.data_zakonczenia >= today;
}

export function getCountdownLabel(posiedzenie: Posiedzenie, today: string): string {
  if (isOngoing(posiedzenie, today)) {
    return "Trwa";
  }

  if (posiedzenie.data_zakonczenia < today) {
    return "Zakończone";
  }

  const days = daysBetween(today, posiedzenie.data_rozpoczecia);

  return days === 1 ? "Za 1 dzień" : `Za ${days} dni`;
}

// Tytuły z API powtarzają w treści całą listę dni ("Posiedzenie Sejmu RP
// w dniach 2, 3 i 4 września 2026 r."), a zakres i tak pokazujemy obok.
export function getPosiedzenieName(
  posiedzenie: Pick<Posiedzenie, "numer" | "tytul">,
): string {
  if (posiedzenie.numer > 0) {
    return `${posiedzenie.numer}. posiedzenie Sejmu`;
  }

  return posiedzenie.tytul.split(/\s+w dni(?:ach|u)\s/)[0].trim() || "Posiedzenie Sejmu";
}

export async function fetchNextPosiedzenie(): Promise<Posiedzenie | null> {
  const { data, error } = await supabaseAdmin
    .from("posiedzenia")
    .select(COLUMNS)
    .gte("data_zakonczenia", todayIso())
    .order("data_rozpoczecia", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) {
    return null;
  }

  return (data as Posiedzenie | null) ?? null;
}

export async function fetchPosiedzenia(): Promise<Posiedzenie[]> {
  const { data } = await supabaseAdmin
    .from("posiedzenia")
    .select(COLUMNS)
    .order("data_rozpoczecia", { ascending: false });

  return (data ?? []) as Posiedzenie[];
}
