import type { Posel } from "@/lib/posel";
import { supabaseAdmin } from "@/lib/supabase-admin";

/**
 * Lista obserwowanych posłów. Najpierw próbujemy jednym zapytaniem z joinem,
 * a gdy relacja nie jest widoczna dla PostgREST (baza sprzed migracji z kluczem
 * obcym), dobieramy profile drugim zapytaniem po identyfikatorach.
 */
export async function fetchWatchedPoslowie(userId: string): Promise<Posel[]> {
  const { data: joined, error: joinError } = await supabaseAdmin
    .from("obserwowani")
    .select("posel_id, poslowie(id, imie_nazwisko, partia, zdjecie_url)")
    .eq("user_id", userId);

  if (!joinError && joined) {
    const poslowie = joined
      .map((row) => row.poslowie as Posel | Posel[] | null)
      .flatMap((posel) => (posel ? (Array.isArray(posel) ? posel : [posel]) : []));

    if (poslowie.length > 0 || joined.length === 0) {
      return poslowie;
    }
  }

  const { data: watched, error: watchedError } = await supabaseAdmin
    .from("obserwowani")
    .select("posel_id")
    .eq("user_id", userId);

  if (watchedError) {
    throw new Error(watchedError.message);
  }

  const poselIds = (watched ?? []).map((row) => row.posel_id);

  if (poselIds.length === 0) {
    return [];
  }

  const { data: poslowie, error: poslowieError } = await supabaseAdmin
    .from("poslowie")
    .select("id, imie_nazwisko, partia, zdjecie_url")
    .in("id", poselIds);

  if (poslowieError) {
    throw new Error(poslowieError.message);
  }

  return (poslowie ?? []) as Posel[];
}
