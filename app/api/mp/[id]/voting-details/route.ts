import { NextResponse } from "next/server";

import { fetchVotingDeepDive } from "@/lib/sejm-voting";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const mpId = Number(id);
  const { searchParams } = new URL(request.url);
  const sitting = Number(searchParams.get("sitting"));
  const num = Number(searchParams.get("num"));
  const mpVote = searchParams.get("vote") ?? undefined;

  if (!Number.isInteger(mpId) || !Number.isInteger(sitting) || !Number.isInteger(num)) {
    return json({ error: "Wymagane parametry: sitting, num" }, 400);
  }

  const { data } = await supabaseAdmin
    .from("poslowie")
    .select("partia")
    .eq("id", mpId)
    .maybeSingle();

  const details = await fetchVotingDeepDive(
    mpId,
    data?.partia ?? null,
    sitting,
    num,
    mpVote,
  );

  if (!details) {
    return json({ error: "Nie znaleziono głosowania" }, 404);
  }

  return json(details);
}
