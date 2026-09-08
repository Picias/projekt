import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { syncUstawy } from "@/lib/sync-ustawy";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const authorized = await isAuthorizedCronRequest(request);

  if (!authorized) {
    return NextResponse.json(
      { status: "error", message: "Unauthorized" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);
  const rawLimit = searchParams.get("limit");
  const refreshSummaries = searchParams.get("refresh_summaries") === "true";

  // Bez parametru pobieramy całą kadencję. limit służy już tylko do szybkiego
  // sprawdzenia synchronizacji na kilku najnowszych drukach.
  const parsedLimit = Number(rawLimit);
  const limit =
    rawLimit !== null && Number.isInteger(parsedLimit) && parsedLimit > 0
      ? parsedLimit
      : undefined;

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
