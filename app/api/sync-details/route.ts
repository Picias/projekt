import { NextResponse } from "next/server";

import { syncAllMpDetails, syncMpDetailsBatch } from "@/lib/sync-mp-details";

export const maxDuration = 300;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const poselIdParam = searchParams.get("posel_id");

  try {
    if (poselIdParam) {
      const poselId = Number(poselIdParam);

      if (!Number.isInteger(poselId)) {
        return NextResponse.json(
          { status: "error", message: "Nieprawidłowy parametr posel_id" },
          { status: 400 },
        );
      }

      const result = await syncMpDetailsBatch({
        poselId,
        recomputeAggregates: searchParams.get("recompute_aggregates") !== "false",
      });

      if (result.status === "error") {
        return NextResponse.json(result, { status: 404 });
      }

      return NextResponse.json({
        status: "ok",
        syncedAll: false,
        total: 1,
        processed: result.processed,
        failed: result.results.filter((item) => item.errors.length > 0).length,
        aggregatesUpdated: result.aggregatesUpdated,
        results: result.results,
      });
    }

    const result = await syncAllMpDetails();

    if (result.status === "error") {
      return NextResponse.json(result, { status: 404 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Błąd synchronizacji";

    return NextResponse.json(
      {
        status: "error",
        syncedAll: false,
        total: 0,
        processed: 0,
        failed: 0,
        aggregatesUpdated: false,
        message,
      },
      { status: 500 },
    );
  }
}
