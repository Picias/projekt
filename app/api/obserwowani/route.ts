import { NextResponse } from "next/server";

import { fetchWatchedPoslowie } from "@/lib/obserwowani-db";
import { getSessionUserId } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const poselIdParam = searchParams.get("posel_id");
  const userId = await getSessionUserId();

  if (!userId) {
    if (poselIdParam !== null) {
      return NextResponse.json({ watching: false, zalogowany: false });
    }

    return NextResponse.json({ poslowie: [], zalogowany: false });
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

    return NextResponse.json({ watching: Boolean(data), zalogowany: true });
  }

  try {
    const poslowie = await fetchWatchedPoslowie(userId);
    return NextResponse.json({ poslowie, zalogowany: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się pobrać listy.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Zaloguj się, aby obserwować posła.", code: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }

    const body = (await request.json()) as {
      posel_id?: number;
    };

    const poselId = body.posel_id;

    if (!Number.isInteger(poselId)) {
      return NextResponse.json(
        { error: "Wymagane pole: posel_id" },
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
