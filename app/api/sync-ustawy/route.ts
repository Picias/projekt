import { NextResponse } from "next/server";

import { syncUstawy } from "@/lib/sync-ustawy";

export const maxDuration = 120;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const limitParam = Number(searchParams.get("limit") ?? 10);
  const refreshSummaries = searchParams.get("refresh_summaries") === "true";

  const limit =
    Number.isInteger(limitParam) && limitParam > 0 && limitParam <= 50 ? limitParam : 10;

  try {
    const result = await syncUstawy({ limit, refreshSummaries });

    if (result.status === "error") {
      return NextResponse.json(result, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nieznany błąd synchronizacji";

    return NextResponse.json(
      {
        status: "error",
        synced: 0,
        summariesGenerated: 0,
        drukiFromApi: 0,
        numery: [],
        message,
      },
      { status: 500 },
    );
  }
}
