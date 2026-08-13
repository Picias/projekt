import { NextResponse } from "next/server";

import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Posel } from "@/lib/posel";

async function fetchWatchedPoslowie(userId: string): Promise<Posel[]> {
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

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user_id");
  const poselIdParam = searchParams.get("posel_id");

  if (!userId) {
    return NextResponse.json(
      { error: "Wymagany parametr: user_id" },
      { status: 400 },
    );
  }

  if (poselIdParam !== null) {
    const poselId = Number(poselIdParam);

    if (!Number.isInteger(poselId)) {
      return NextResponse.json(
        { error: "Nieprawidłowy parametr: posel_id" },
        { status: 400 },
      );
    }

    const { data, error } = await supabaseAdmin
      .from("obserwowani")
      .select("user_id")
      .eq("user_id", userId)
      .eq("posel_id", poselId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ watching: Boolean(data) });
  }

  try {
    const poslowie = await fetchWatchedPoslowie(userId);
    return NextResponse.json({ poslowie });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się pobrać listy.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as {
      user_id?: string;
      posel_id?: number;
    };

    const userId = body.user_id;
    const poselId = body.posel_id;

    if (!userId || !Number.isInteger(poselId)) {
      return NextResponse.json(
        { error: "Wymagane pola: user_id, posel_id" },
        { status: 400 },
      );
    }

    const { data: existing, error: readError } = await supabaseAdmin
      .from("obserwowani")
      .select("user_id")
      .eq("user_id", userId)
      .eq("posel_id", poselId)
      .maybeSingle();

    if (readError) {
      return NextResponse.json({ error: readError.message }, { status: 500 });
    }

    if (existing) {
      const { error: deleteError } = await supabaseAdmin
        .from("obserwowani")
        .delete()
        .eq("user_id", userId)
        .eq("posel_id", poselId);

      if (deleteError) {
        return NextResponse.json({ error: deleteError.message }, { status: 500 });
      }

      return NextResponse.json({ watching: false });
    }

    const { error: insertError } = await supabaseAdmin
      .from("obserwowani")
      .insert({ user_id: userId, posel_id: poselId });

    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({ watching: true });
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie" }, { status: 400 });
  }
}
