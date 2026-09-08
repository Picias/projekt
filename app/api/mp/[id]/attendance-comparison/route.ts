import { NextResponse } from "next/server";

import { fetchAttendanceComparison } from "@/lib/sejm-attendance";
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

export async function GET(_request: Request, context: RouteContext) {
  const { id } = await context.params;
  const mpId = Number(id);

  if (!Number.isInteger(mpId)) {
    return json({ error: "Nieprawidłowe ID posła" }, 400);
  }

  const { data } = await supabaseAdmin
    .from("poslowie")
    .select("partia")
    .eq("id", mpId)
    .maybeSingle();

  const comparison = await fetchAttendanceComparison(mpId, data?.partia ?? null);

  return json(comparison);
}
