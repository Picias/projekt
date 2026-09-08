import { NextResponse } from "next/server";

import { fetchInterpellationsList } from "@/lib/sejm-voting";
import { SEJM_DEFAULT_LIST_LIMIT } from "@/lib/sejm-api";

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
  const limit = Number(searchParams.get("limit") ?? SEJM_DEFAULT_LIST_LIMIT);

  if (!Number.isInteger(mpId)) {
    return json({ error: "Nieprawidłowe ID posła" }, 400);
  }

  const safeLimit = Number.isInteger(limit) && limit > 0 && limit <= 50 ? limit : SEJM_DEFAULT_LIST_LIMIT;
  const page = await fetchInterpellationsList(mpId, safeLimit);

  return json({
    interpellations: page.items,
    hasMore: page.hasMore,
    limit: page.limit,
  });
}
