import { NextResponse } from "next/server";

import { supabase } from "@/lib/supabase";

const SEJM_TERM = 10;
const SEJM_MP_URL = "https://api.sejm.gov.pl/sejm/term10/MP";
const SEJM_API_BASE = "https://api.sejm.gov.pl";

type SejmMp = {
  id: number;
  firstLastName?: string;
  club?: string;
};

type PoselRow = {
  id: number;
  imie_nazwisko: string;
  partia: string | null;
  zdjecie_url: string;
};

function getMpPhotoUrl(id: number): string {
  return `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/MP/${id}/photo`;
}

function mapMpToPosel(mp: SejmMp): PoselRow {
  return {
    id: mp.id,
    imie_nazwisko: mp.firstLastName?.trim() ?? "",
    partia: mp.club?.trim() || null,
    zdjecie_url: getMpPhotoUrl(mp.id),
  };
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

    const { data, error } = await supabase
      .from("poslowie")
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
