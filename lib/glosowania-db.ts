import { isGlosPosla, type Glosowanie, type GlosPosla } from "@/lib/glosowania";
import { supabaseAdmin } from "@/lib/supabase-admin";

const GLOSOWANIE_COLUMNS =
  "id, ustawa_id, sitting, numer_glosowania, tytul, temat, data_glosowania, za, przeciw, wstrzymalo_sie, nieobecni";

export type GlosPoslaZProfilem = {
  posel_id: number;
  imie_nazwisko: string;
  nazwisko: string | null;
  // Klub z dnia głosowania (glosy_poslow.klub) z zapasem w postaci bieżącej
  // przynależności posła, gdy API nie podało go przy głosowaniu.
  klub: string | null;
  zdjecie_url: string | null;
  glos: GlosPosla;
};

type PoselJoin = {
  id: number;
  imie_nazwisko: string;
  nazwisko: string | null;
  partia: string | null;
  zdjecie_url: string | null;
};

function readPoselJoin(value: unknown): PoselJoin | null {
  if (Array.isArray(value)) {
    return (value[0] as PoselJoin | undefined) ?? null;
  }

  return (value as PoselJoin | null) ?? null;
}

/**
 * Nad jednym drukiem Sejm głosuje wielokrotnie (poprawki, całość projektu).
 * Ekran wyników pokazuje najnowsze głosowanie, bo to ono rozstrzyga losy ustawy.
 */
export async function fetchNajnowszeGlosowanie(
  ustawaId: number,
): Promise<Glosowanie | null> {
  const { data } = await supabaseAdmin
    .from("glosowania")
    .select(GLOSOWANIE_COLUMNS)
    .eq("ustawa_id", ustawaId)
    .order("data_glosowania", { ascending: false, nullsFirst: false })
    .order("numer_glosowania", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (data as Glosowanie | null) ?? null;
}

export async function countGlosowaniaUstawy(ustawaId: number): Promise<number> {
  const { count } = await supabaseAdmin
    .from("glosowania")
    .select("id", { count: "exact", head: true })
    .eq("ustawa_id", ustawaId);

  return count ?? 0;
}

export async function fetchGlosyZProfilami(
  glosowanieId: number,
): Promise<GlosPoslaZProfilem[]> {
  const { data } = await supabaseAdmin
    .from("glosy_poslow")
    .select("posel_id, klub, glos, poslowie(id, imie_nazwisko, nazwisko, partia, zdjecie_url)")
    .eq("glosowanie_id", glosowanieId)
    .range(0, 999);

  const glosy: GlosPoslaZProfilem[] = [];

  for (const row of data ?? []) {
    const posel = readPoselJoin((row as { poslowie: unknown }).poslowie);
    const glos = (row as { glos: string }).glos;

    if (!posel || !isGlosPosla(glos)) {
      continue;
    }

    glosy.push({
      posel_id: Number((row as { posel_id: number }).posel_id),
      imie_nazwisko: posel.imie_nazwisko,
      nazwisko: posel.nazwisko,
      klub: (row as { klub: string | null }).klub ?? posel.partia,
      zdjecie_url: posel.zdjecie_url,
      glos,
    });
  }

  return glosy;
}

/**
 * Głosy posłów obserwowanych przez użytkownika — zwracane jako mapa
 * posel_id → głos, żeby sekcja na stronie ustawy mogła je dopiąć do listy
 * obserwowanych bez drugiego zapytania o profile.
 */
export async function fetchGlosyObserwowanych(
  glosowanieId: number,
  poselIds: number[],
): Promise<Record<number, GlosPosla>> {
  if (poselIds.length === 0) {
    return {};
  }

  const { data } = await supabaseAdmin
    .from("glosy_poslow")
    .select("posel_id, glos")
    .eq("glosowanie_id", glosowanieId)
    .in("posel_id", poselIds);

  const mapa: Record<number, GlosPosla> = {};

  for (const row of data ?? []) {
    const glos = (row as { glos: string }).glos;

    if (isGlosPosla(glos)) {
      mapa[Number((row as { posel_id: number }).posel_id)] = glos;
    }
  }

  return mapa;
}
