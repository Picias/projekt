import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Ustawa } from "@/lib/ustawa";

const USTAWA_COLUMNS =
  "id, numer_druku, tytul_oficjalny, autor, data_wplywu, etap_legislacyjny";

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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  const ustawaIdParam = searchParams.get("ustawa_id");

  if (!userId) {
    return NextResponse.json({ error: "Wymagany parametr: user_id" }, { status: 400 });
  }

  if (ustawaIdParam !== null) {
    const ustawaId = Number(ustawaIdParam);

    if (!Number.isInteger(ustawaId)) {
      return NextResponse.json(
        { error: "Nieprawidłowy parametr: ustawa_id" },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("obserwowane_ustawy")
      .select("user_id")
      .eq("user_id", userId)
      .eq("ustawa_id", ustawaId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ watching: Boolean(data) });
  }

  try {
    const ustawy = await fetchWatchedUstawy(userId);
    return NextResponse.json({ ustawy });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się pobrać listy.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      user_id?: string;
      ustawa_id?: number;
    };

    const userId = body.user_id;
    const ustawaId = body.ustawa_id;

    if (!userId || !Number.isInteger(ustawaId)) {
      return NextResponse.json(
        { error: "Wymagane pola: user_id, ustawa_id" },
        { status: 400 },
      );
    }

    const { data: existing, error: readError } = await supabaseAdmin
      .from("obserwowane_ustawy")
      .select("user_id")
      .eq("user_id", userId)
      .eq("ustawa_id", ustawaId)
      .maybeSingle();

    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: 500 });
    }

    if (existing) {
      const { error: deleteError } = await supabaseAdmin
        .from("obserwowane_ustawy")
        .delete()
        .eq("user_id", userId)
        .eq("ustawa_id", ustawaId);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      return NextResponse.json({ watching: false });
    }

    const { error: insertError } = await supabaseAdmin
      .from("obserwowane_ustawy")
      .insert({ user_id: userId, ustawa_id: ustawaId });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ watching: true });
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie" }, { status: 400 });
  }
}
