import { NextResponse } from "next/server";

import { fetchWatchedPoslowie } from "@/lib/obserwowani-db";
import { getSessionUserId } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const poselIdParam = searchParams.get("posel_id");
  const userId = await getSessionUserId();

  if (!userId) {
    if (poselIdParam !== null) {
      return json({ watching: false, zalogowany: false });
    }

    return json({ poslowie: [], zalogowany: false });
  }

  if (poselIdParam !== null) {
    const poselId = Number(poselIdParam);

    if (!Number.isInteger(poselId)) {
      return json({ error: "Nieprawidłowy parametr: posel_id" }, 400);
    }

    const { data, error } = await supabaseAdmin
      .from("obserwowani")
      .select("user_id")
      .eq("user_id", userId)
      .eq("posel_id", poselId)
      .maybeSingle();

    if (error) {
      return json({ error: error.message }, 500);
    }

    return json({ watching: Boolean(data), zalogowany: true });
  }

  try {
    const poslowie = await fetchWatchedPoslowie(userId);
    return json({ poslowie, zalogowany: true });
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
        { error: "Zaloguj się, aby obserwować posła.", code: "UNAUTHENTICATED" },
        401,
      );
    }

    const body = (await request.json()) as {
      posel_id?: number;
    };

    const poselId = body.posel_id;

    if (!Number.isInteger(poselId)) {
      return json({ error: "Wymagane pole: posel_id" }, 400);
    }

    const { data: existing, error: readError } = await supabaseAdmin
      .from("obserwowani")
      .select("user_id")
      .eq("user_id", userId)
      .eq("posel_id", poselId)
      .maybeSingle();

    if (readError) {
      return json({ error: readError.message }, 500);
    }

    if (existing) {
      const { error: deleteError } = await supabaseAdmin
        .from("obserwowani")
        .delete()
        .eq("user_id", userId)
        .eq("posel_id", poselId);

      if (deleteError) {
        return json({ error: deleteError.message }, 500);
      }

      return json({ watching: false });
    }

    const { error: insertError } = await supabaseAdmin
      .from("obserwowani")
      .insert({ user_id: userId, posel_id: poselId });

    if (insertError) {
      return json({ error: insertError.message }, 500);
    }

    return json({ watching: true });
  } catch {
    return json({ error: "Nieprawidłowe żądanie" }, 400);
  }
}
