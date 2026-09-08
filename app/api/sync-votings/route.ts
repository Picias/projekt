import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { syncVotings } from "@/lib/sync-votings";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

function readPositiveInt(value: string | null): number | undefined {
  const parsed = Number(value);

  return value !== null && Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export async function GET(request: Request) {
  const authorized = await isAuthorizedCronRequest(request);

  if (!authorized) {
    return NextResponse.json(
      { status: "error", message: "Unauthorized" },
      { status: 401 },
    );
  }

  const { searchParams } = new URL(request.url);

  try {
    const result = await syncVotings({
      // Ile ostatnich posiedzeń przejrzeć…
      sittings: readPositiveInt(searchParams.get("sittings")),
      // …albo jedno konkretne, gdy trzeba uzupełnić brakujące głosowanie.
      sitting: readPositiveInt(searchParams.get("sitting")),
      maxVotings: readPositiveInt(searchParams.get("max")),
    });

    if (result.status === "error") {
      return NextResponse.json(result, { status: 502 });
    }

    return NextResponse.json(result);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nieznany błąd synchronizacji";

    return NextResponse.json(
      {
        status: "error",
        posiedzenia: [],
        glosowanZApi: 0,
        dopasowanych: 0,
        zapisanychGlosowan: 0,
        zapisanychGlosow: 0,
        message,
      },
      { status: 500 },
    );
  }
}
