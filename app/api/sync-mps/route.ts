import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";

const SEJM_TERM = 10;
const SEJM_MP_URL = "https://api.sejm.gov.pl/sejm/term10/MP";
const SEJM_API_BASE = "https://api.sejm.gov.pl";

type SejmMp = {
  id: number;
  firstLastName?: string;
  lastName?: string;
  club?: string;
  birthDate?: string;
  educationLevel?: string;
  profession?: string;
  districtName?: string;
  districtNum?: number;
  numberOfVotes?: number;
};

type PoselBaseRow = {
  id: number;
  imie_nazwisko: string;
  partia: string | null;
  zdjecie_url: string;
};

type PoselRow = PoselBaseRow & {
  nazwisko: string | null;
  data_urodzenia: string | null;
  wyksztalcenie: string | null;
  zawod: string | null;
  okreg_wyborczy: string | null;
  okreg_numer: number | null;
  liczba_glosow: number | null;
};

function getMpPhotoUrl(id: number): string {
  return `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/MP/${id}/photo`;
}

function text(value: string | undefined): string | null {
  return value?.trim() || null;
}

function integer(value: number | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mapMpToPosel(mp: SejmMp): PoselRow {
  return {
    id: mp.id,
    imie_nazwisko: mp.firstLastName?.trim() ?? "",
    partia: text(mp.club),
    zdjecie_url: getMpPhotoUrl(mp.id),
    nazwisko: text(mp.lastName),
    data_urodzenia: text(mp.birthDate),
    wyksztalcenie: text(mp.educationLevel),
    zawod: text(mp.profession),
    // districtName to nazwa miejscowości będącej siedzibą okręgu.
    okreg_wyborczy: text(mp.districtName),
    okreg_numer: integer(mp.districtNum),
    liczba_glosow: integer(mp.numberOfVotes),
  };
}

function toBaseRow(row: PoselRow): PoselBaseRow {
  return {
    id: row.id,
    imie_nazwisko: row.imie_nazwisko,
    partia: row.partia,
    zdjecie_url: row.zdjecie_url,
  };
}

// Kolumny profilowe dodaje supabase/schema.sql. Zanim ktoś uruchomi migrację,
// Supabase odrzuca cały upsert, więc rozpoznajemy ten przypadek i zapisujemy
// przynajmniej dane podstawowe.
function isMissingColumnError(error: { code?: string; message: string }): boolean {
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    /column .* does not exist|could not find the .* column/i.test(error.message)
  );
}

export async function GET() {
  try {
    const response = await fetch(SEJM_MP_URL, {
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

    const mps = (await response.json()) as SejmMp[];

    if (!Array.isArray(mps) || mps.length === 0) {
      return NextResponse.json(
        {
          status: "error",
          message: "Sejm API nie zwróciło listy posłów",
          synced: 0,
        },
        { status: 502 },
      );
    }

    const rows = mps.map(mapMpToPosel);

    // supabaseAdmin łączy się kluczem service_role, więc upsert omija RLS.
    const { data, error } = await supabaseAdmin
      .from("poslowie")
      .upsert(rows, { onConflict: "id" })
      .select("id");

    if (error && !isMissingColumnError(error)) {
      return NextResponse.json(
        {
          status: "error",
          message: error.message,
          synced: 0,
        },
        { status: 500 },
      );
    }

    if (error) {
      const fallback = await supabaseAdmin
        .from("poslowie")
        .upsert(rows.map(toBaseRow), { onConflict: "id" })
        .select("id");

      if (fallback.error) {
        return NextResponse.json(
          {
            status: "error",
            message: fallback.error.message,
            synced: 0,
          },
          { status: 500 },
        );
      }

      return NextResponse.json({
        status: "ok",
        term: SEJM_TERM,
        synced: fallback.data?.length ?? rows.length,
        totalFromApi: mps.length,
        warning:
          "Zapisano tylko dane podstawowe — uruchom supabase/schema.sql, " +
          "aby dodać kolumny profilowe (nazwisko, data_urodzenia, wyksztalcenie, " +
          "zawod, okreg_wyborczy, okreg_numer, liczba_glosow).",
      });
    }

    return NextResponse.json({
      status: "ok",
      term: SEJM_TERM,
      synced: data?.length ?? rows.length,
      totalFromApi: mps.length,
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
