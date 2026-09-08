import { NextResponse } from "next/server";

import type { GlosPosla } from "@/lib/glosowania";
import { fetchGlosyObserwowanych, fetchNajnowszeGlosowanie } from "@/lib/glosowania-db";
import { fetchWatchedPoslowie } from "@/lib/obserwowani-db";
import { getSessionUserId } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

type PoselZGlosem = {
  id: number;
  imie_nazwisko: string;
  partia: string | null;
  zdjecie_url: string | null;
  // null oznacza posła, którego nie ma na liście imiennej tego głosowania
  // (np. objął mandat później) — inaczej niż NIEOBECNY, czyli nieoddany głos.
  glos: GlosPosla | null;
};

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ustawaId = Number(searchParams.get("ustawa_id"));

  if (!Number.isInteger(ustawaId)) {
    return json({ error: "Wymagany parametr: ustawa_id" }, 400);
  }

  const userId = await getSessionUserId();

  try {
    if (!userId) {
      const glosowanie = await fetchNajnowszeGlosowanie(ustawaId);
      return json({ glosowanie, poslowie: [], zalogowany: false });
    }

    const [glosowanie, obserwowani] = await Promise.all([
      fetchNajnowszeGlosowanie(ustawaId),
      fetchWatchedPoslowie(userId),
    ]);

    if (!glosowanie) {
      return json({ glosowanie: null, poslowie: [] });
    }

    const glosy = await fetchGlosyObserwowanych(
      glosowanie.id,
      obserwowani.map((posel) => posel.id),
    );

    const poslowie: PoselZGlosem[] = obserwowani.map((posel) => ({
      id: posel.id,
      imie_nazwisko: posel.imie_nazwisko,
      partia: posel.partia,
      zdjecie_url: posel.zdjecie_url,
      glos: glosy[posel.id] ?? null,
    }));

    return json({ glosowanie, poslowie });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nie udało się pobrać wyników głosowania.";
    return json({ error: message }, 500);
  }
}
