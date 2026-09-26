import { NextResponse } from "next/server";

import { getSessionUserId } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Ustawa } from "@/lib/ustawa";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

const USTAWA_COLUMNS =
  "id, numer_druku, tytul_oficjalny, autor, data_wplywu, etap_legislacyjny, tagi";

async function fetchWatchedUstawy(userId: string): Promise<Partial<Ustawa>[]> {
  const { data: watched, error } = await supabaseAdmin
    .from("obserwowane_ustawy")
    .select("ustawa_id")
    .eq("user_id", userId);

  if (error) {
    throw new Error(error.message);
  }

  const ustawaIds = (watched ?? []).map((row) => row.ustawa_id as number);

  if (ustawaIds.length === 0) {
    return [];
  }

  const { data: ustawy, error: ustawyError } = await supabaseAdmin
    .from("ustawy")
    .select(USTAWA_COLUMNS)
    .in("id", ustawaIds)
    .order("data_wplywu", { ascending: false });

  if (ustawyError) {
    throw new Error(ustawyError.message);
  }

  return (ustawy ?? []) as Partial<Ustawa>[];
}

/**
 * Licznik przy druku przelicza się z tabeli obserwujących zamiast rosnąć
 * o jeden przy każdym kliknięciu. Inkrementacja gubi się przy równoległych
 * żądaniach i po ręcznych zmianach w bazie, a przeliczenie samo naprawia
 * rozjazd przy najbliższym kliknięciu.
 *
 * Nieudany zapis licznika (np. w bazie bez kolumny liczba_obserwujacych)
 * zwraca null zamiast wyjątku — samo obserwowanie druku ma działać dalej.
 */
async function refreshLiczbaObserwujacych(ustawaId: number): Promise<number | null> {
  const { count, error } = await supabaseAdmin
    .from("obserwowane_ustawy")
    .select("user_id", { count: "exact", head: true })
    .eq("ustawa_id", ustawaId);

  if (error) {
    return null;
  }

  const liczba = count ?? 0;

  const { error: updateError } = await supabaseAdmin
    .from("ustawy")
    .update({ liczba_obserwujacych: liczba })
    .eq("id", ustawaId);

  return updateError ? null : liczba;
}

async function readLiczbaObserwujacych(ustawaId: number): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("ustawy")
    .select("liczba_obserwujacych")
    .eq("id", ustawaId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return (data?.liczba_obserwujacych as number | null) ?? 0;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ustawaIdParam = searchParams.get("ustawa_id");
  const userId = await getSessionUserId();

  if (!userId) {
    if (ustawaIdParam !== null) {
      const ustawaId = Number(ustawaIdParam);

      return json({
        watching: false,
        zalogowany: false,
        liczba_obserwujacych: Number.isInteger(ustawaId)
          ? await readLiczbaObserwujacych(ustawaId)
          : null,
      });
    }

    return json({ ustawy: [], zalogowany: false });
  }

  if (ustawaIdParam !== null) {
    const ustawaId = Number(ustawaIdParam);

    if (!Number.isInteger(ustawaId)) {
      return json({ error: "Nieprawidłowy parametr: ustawa_id" }, 400);
    }

    const { data, error } = await supabaseAdmin
      .from("obserwowane_ustawy")
      .select("user_id")
      .eq("user_id", userId)
      .eq("ustawa_id", ustawaId)
      .maybeSingle();

    if (error) {
      return json({ error: error.message }, 500);
    }

    return json({
      watching: Boolean(data),
      zalogowany: true,
      liczba_obserwujacych: await readLiczbaObserwujacych(ustawaId),
    });
  }

  try {
    const ustawy = await fetchWatchedUstawy(userId);
    return json({ ustawy, zalogowany: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się pobrać listy.";
    return json({ error: message }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return json(
        { error: "Zaloguj się, aby śledzić ustawę.", code: "UNAUTHENTICATED" },
        401,
      );
    }

    const body = (await request.json()) as {
      ustawa_id?: number;
    };

    const ustawaId = body.ustawa_id;

    if (typeof ustawaId !== "number" || !Number.isInteger(ustawaId)) {
      return json({ error: "Wymagane pole: ustawa_id" }, 400);
    }

    const { data: existing, error: readError } = await supabaseAdmin
      .from("obserwowane_ustawy")
      .select("user_id")
      .eq("user_id", userId)
      .eq("ustawa_id", ustawaId)
      .maybeSingle();

    if (readError) {
      return json({ error: readError.message }, 500);
    }

    if (existing) {
      const { error: deleteError } = await supabaseAdmin
        .from("obserwowane_ustawy")
        .delete()
        .eq("user_id", userId)
        .eq("ustawa_id", ustawaId);

      if (deleteError) {
        return json({ error: deleteError.message }, 500);
      }

      return json({
        watching: false,
        liczba_obserwujacych: await refreshLiczbaObserwujacych(ustawaId),
      });
    }

    const { error: insertError } = await supabaseAdmin
      .from("obserwowane_ustawy")
      .insert({ user_id: userId, ustawa_id: ustawaId });

    if (insertError) {
      return json({ error: insertError.message }, 500);
    }

    return json({
      watching: true,
      liczba_obserwujacych: await refreshLiczbaObserwujacych(ustawaId),
    });
  } catch {
    return json({ error: "Nieprawidłowe żądanie" }, 400);
  }
}
