import { NextResponse } from "next/server";

import {
  demoBaseline,
  isTypGlosu,
  PUSTE_WYNIKI,
  type TypGlosu,
  type WynikiSondy,
} from "@/lib/glosy-obywateli";
import { getSessionUserId } from "@/lib/supabase-server";
import { supabaseAdmin } from "@/lib/supabase-admin";

type SondaResponse = {
  wyniki: WynikiSondy;
  moj_glos: TypGlosu | null;
  zalogowany: boolean;
};

async function fetchWyniki(ustawaId: number): Promise<WynikiSondy> {
  const { data, error } = await supabaseAdmin
    .from("glosy_obywateli")
    .select("typ_glosu")
    .eq("ustawa_id", ustawaId);

  if (error) {
    throw new Error(error.message);
  }

  const wyniki = { ...demoBaseline(ustawaId) };

  for (const row of data ?? []) {
    const typ = row.typ_glosu as string;

    if (isTypGlosu(typ)) {
      wyniki[typ] += 1;
    }
  }

  return wyniki;
}

async function fetchMojGlos(
  ustawaId: number,
  userId: string,
): Promise<TypGlosu | null> {
  const { data, error } = await supabaseAdmin
    .from("glosy_obywateli")
    .select("typ_glosu")
    .eq("ustawa_id", ustawaId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  const typ = data?.typ_glosu as string | undefined;

  return isTypGlosu(typ) ? typ : null;
}

async function buildResponse(
  ustawaId: number,
  userId: string | null,
): Promise<SondaResponse> {
  const [wyniki, mojGlos] = await Promise.all([
    fetchWyniki(ustawaId),
    userId ? fetchMojGlos(ustawaId, userId) : Promise.resolve(null),
  ]);

  return { wyniki, moj_glos: mojGlos, zalogowany: Boolean(userId) };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const ustawaId = Number(searchParams.get("ustawa_id"));

  if (!Number.isInteger(ustawaId)) {
    return NextResponse.json(
      { error: "Wymagany parametr: ustawa_id" },
      { status: 400 },
    );
  }

  try {
    const userId = await getSessionUserId();
    return NextResponse.json(await buildResponse(ustawaId, userId));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nie udało się pobrać wyników sondy.";
    return NextResponse.json({ error: message, wyniki: PUSTE_WYNIKI }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Zaloguj się, aby zagłosować.", code: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }

    const body = (await request.json()) as {
      ustawa_id?: number;
      typ_glosu?: string;
    };

    const ustawaId = body.ustawa_id;
    const typGlosu = body.typ_glosu;

    if (typeof ustawaId !== "number" || !Number.isInteger(ustawaId) || !isTypGlosu(typGlosu)) {
      return NextResponse.json(
        { error: "Wymagane pola: ustawa_id, typ_glosu" },
        { status: 400 },
      );
    }

    const { error } = await supabaseAdmin.from("glosy_obywateli").upsert(
      {
        ustawa_id: ustawaId,
        user_id: userId,
        typ_glosu: typGlosu,
        oddano_at: new Date().toISOString(),
      },
      { onConflict: "ustawa_id,user_id" },
    );

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(await buildResponse(ustawaId, userId));
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie" }, { status: 400 });
  }
}
