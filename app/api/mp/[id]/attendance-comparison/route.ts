import { NextResponse } from "next/server";

import { fetchAttendanceComparison } from "@/lib/sejm-attendance";
import { supabaseAdmin } from "@/lib/supabase-admin";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const mpId = Number(id);

  if (!Number.isInteger(mpId)) {
    return NextResponse.json({ error: "Nieprawidłowe ID posła" }, { status: 400 });
  }

  const { data } = await supabaseAdmin
    .from("poslowie")
    .select("partia")
    .eq("id", mpId)
    .maybeSingle();

  const comparison = await fetchAttendanceComparison(mpId, data?.partia ?? null);

  return NextResponse.json(comparison);
}
