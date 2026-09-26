import { NextResponse } from "next/server";

import type { MojOkregResponse, OkregOption } from "@/lib/moj-okreg";
import { sortPoslowieByNazwisko, toPoselProfil } from "@/lib/posel";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

// Skład okręgów zmienia się tylko po synchronizacji posłów, więc odpowiedź
// może chwilę poleżeć w cache CDN.
const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
};

export async function GET(request: Request) {
  const numerParam = new URL(request.url).searchParams.get("numer");
  const numer = numerParam === null ? null : Number(numerParam);

  if (numer !== null && (!Number.isInteger(numer) || numer <= 0 || numer > 100)) {
    return NextResponse.json({ error: "Nieprawidłowy numer okręgu" }, { status: 400 });
  }

  // select("*") jak na liście posłów — kolumny okręgu dochodzą migracją,
  // a bez nich endpoint ma zwrócić pustą listę zamiast błędu.
  const { data, error } = await supabaseAdmin.from("poslowie").select("*");

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const poslowie = (data ?? []).map(toPoselProfil).filter((posel) => posel.okreg_numer);
  const okregi = new Map<number, OkregOption>();

  for (const posel of poslowie) {
    const key = posel.okreg_numer!;
    const existing = okregi.get(key);

    if (existing) {
      existing.liczbaPoslow += 1;
    } else {
      okregi.set(key, {
        numer: key,
        siedziba: posel.okreg_wyborczy ?? `Okręg ${key}`,
        liczbaPoslow: 1,
      });
    }
  }

  const body: MojOkregResponse = {
    okregi: [...okregi.values()].sort((a, b) => a.numer - b.numer),
    poslowie:
      numer === null
        ? []
        : sortPoslowieByNazwisko(poslowie.filter((posel) => posel.okreg_numer === numer)).map(
            ({ id, imie_nazwisko, partia, zdjecie_url }) => ({
              id,
              imie_nazwisko,
              partia,
              zdjecie_url,
            }),
          ),
  };

  return NextResponse.json(body, { headers: CACHE_HEADERS });
}
