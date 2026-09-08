import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { supabaseAdmin } from "@/lib/supabase-admin";

const SEJM_TERM = 10;
// Lista posiedzeń kadencji siedzi pod /proceedings — /sessions zwraca 404.
const SEJM_PROCEEDINGS_URL = `https://api.sejm.gov.pl/sejm/term${SEJM_TERM}/proceedings`;

type SejmProceeding = {
  number?: number;
  title?: string;
  dates?: string[];
};

type PosiedzenieRow = {
  id: string;
  numer: number;
  tytul: string;
  data_rozpoczecia: string;
  data_zakonczenia: string;
  zaktualizowano_at: string;
};

function mapProceeding(
  proceeding: SejmProceeding,
  syncedAt: string,
): PosiedzenieRow | null {
  // API nie gwarantuje kolejności dni, a posiedzenie potrafi mieć przerwy
  // (np. pierwsze posiedzenie kadencji X: od 13 listopada do 21 grudnia).
  const dates = [...(proceeding.dates ?? [])].filter(Boolean).sort();

  if (dates.length === 0) {
    return null;
  }

  const numer = typeof proceeding.number === "number" ? proceeding.number : 0;
  const startDate = dates[0];

  return {
    id: startDate,
    numer,
    tytul: proceeding.title?.trim() || `${numer}. posiedzenie Sejmu RP`,
    data_rozpoczecia: startDate,
    data_zakonczenia: dates[dates.length - 1],
    zaktualizowano_at: syncedAt,
  };
}

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorized = await isAuthorizedCronRequest(request);

  if (!authorized) {
    return NextResponse.json(
      { status: "error", message: "Unauthorized", synced: 0 },
      { status: 401 },
    );
  }

  try {
    const response = await fetch(SEJM_PROCEEDINGS_URL, {
      headers: { Accept: "application/json" },
      next: { revalidate: 0 },
    });

    if (!response.ok) {
      return NextResponse.json(
        {
          status: "error",
          message: `Sejm API zwróciło status ${response.status}`,
          synced: 0,
        },
        { status: 502 },
      );
    }

    const proceedings = (await response.json()) as SejmProceeding[];

    if (!Array.isArray(proceedings) || proceedings.length === 0) {
      return NextResponse.json(
        {
          status: "error",
          message: "Sejm API nie zwróciło listy posiedzeń",
          synced: 0,
        },
        { status: 502 },
      );
    }

    const syncedAt = new Date().toISOString();
    const rows = proceedings
      .map((proceeding) => mapProceeding(proceeding, syncedAt))
      .filter((row): row is PosiedzenieRow => row !== null);

    if (rows.length === 0) {
      return NextResponse.json(
        {
          status: "error",
          message: "Żadne posiedzenie z API nie miało dat",
          synced: 0,
        },
        { status: 502 },
      );
    }

    // supabaseAdmin łączy się kluczem service_role, więc upsert omija RLS.
    const { data, error } = await supabaseAdmin
      .from("posiedzenia")
      .upsert(rows, { onConflict: "id" })
      .select("id");

    if (error) {
      return NextResponse.json(
        {
          status: "error",
          message: error.message,
          synced: 0,
        },
        { status: 500 },
      );
    }

    return NextResponse.json({
      status: "ok",
      term: SEJM_TERM,
      synced: data?.length ?? rows.length,
      totalFromApi: proceedings.length,
      skipped: proceedings.length - rows.length,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nieznany błąd synchronizacji";

    return NextResponse.json(
      {
        status: "error",
        message,
        synced: 0,
      },
      { status: 500 },
    );
  }
}
