import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";

import { GenerateAiError, generateAiSummaryFromSejm } from "@/lib/generate-ai";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const maxDuration = 120;

type GenerateAiBody = {
  numer_druku?: unknown;
};

export async function POST(request: Request) {
  let body: GenerateAiBody;

  try {
    body = (await request.json()) as GenerateAiBody;
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie" }, { status: 400 });
  }

  const numerDruku =
    typeof body.numer_druku === "string" ? body.numer_druku.trim() : "";

  if (!numerDruku) {
    return NextResponse.json(
      { error: "Wymagane pole: numer_druku" },
      { status: 400 },
    );
  }

  const { data: ustawa, error: lookupError } = await supabaseAdmin
    .from("ustawy")
    .select("id, numer_druku")
    .eq("numer_druku", numerDruku)
    .maybeSingle();

  if (lookupError) {
    return NextResponse.json({ error: lookupError.message }, { status: 500 });
  }

  if (!ustawa) {
    return NextResponse.json(
      { error: "Nie znaleziono druku o podanym numerze." },
      { status: 404 },
    );
  }

  try {
    const summary = await generateAiSummaryFromSejm(numerDruku);

    const { error: updateError } = await supabaseAdmin
      .from("ustawy")
      .update({
        ...summary,
        zaktualizowano_at: new Date().toISOString(),
      })
      .eq("numer_druku", numerDruku);

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    revalidatePath(`/ustawy/${ustawa.id}`);
    revalidatePath(`/ustawy/${encodeURIComponent(numerDruku)}`);

    return NextResponse.json({ status: "ok", ...summary });
  } catch (error) {
    if (error instanceof GenerateAiError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }

    const message =
      error instanceof Error ? error.message : "Nie udało się wygenerować podsumowania.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
