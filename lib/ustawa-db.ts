import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Ustawa } from "@/lib/ustawa";

/**
 * Adres druku przyjmuje zarówno klucz z bazy, jak i numer druku sejmowego
 * (np. /ustawy/1234 i /ustawy/PL-1234), więc kolumnę do filtrowania wybieramy
 * po tym, czy segment ścieżki jest liczbą.
 */
export async function fetchUstawaByParam(idOrNumer: string): Promise<Ustawa | null> {
  const numericId = Number(idOrNumer);
  const column = Number.isInteger(numericId) && idOrNumer.trim() !== "" ? "id" : "numer_druku";
  const value = column === "id" ? numericId : decodeURIComponent(idOrNumer);

  const { data } = await supabaseAdmin
    .from("ustawy")
    .select("*")
    .eq(column, value)
    .maybeSingle();

  return (data as Ustawa | null) ?? null;
}
