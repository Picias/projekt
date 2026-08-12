import { NextResponse } from "next/server";

import { fetchVotingDeepDive } from "@/lib/sejm-voting";
import { supabase } from "@/lib/supabase";

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
    return NextResponse.json(
      { error: "Wymagane parametry: sitting, num" },
      { status: 400 },
    );
  }

  const { data } = await supabase
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
    return NextResponse.json({ error: "Nie znaleziono głosowania" }, { status: 404 });
  }

  return NextResponse.json(details);
}
