import { NextResponse } from "next/server";

import { fetchInterpellationsList } from "@/lib/sejm-voting";
import { SEJM_DEFAULT_LIST_LIMIT } from "@/lib/sejm-api";

type RouteContext = {
  params: Promise<{ id: string }>;
};

export async function GET(request: Request, context: RouteContext) {
  const { id } = await context.params;
  const mpId = Number(id);
  const { searchParams } = new URL(request.url);
  const limit = Number(searchParams.get("limit") ?? SEJM_DEFAULT_LIST_LIMIT);

  if (!Number.isInteger(mpId)) {
    return NextResponse.json({ error: "Nieprawidłowe ID posła" }, { status: 400 });
  }

  const safeLimit = Number.isInteger(limit) && limit > 0 && limit <= 50 ? limit : SEJM_DEFAULT_LIST_LIMIT;
  const page = await fetchInterpellationsList(mpId, safeLimit);

  return NextResponse.json({
    interpellations: page.items,
    hasMore: page.hasMore,
    limit: page.limit,
  });
}
