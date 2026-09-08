import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { syncUstawy } from "@/lib/sync-ustawy";

// CRON_SECRET i ADMIN_EMAIL ustaw wyłącznie w .env.local / Vercel.
// Vercel Cron wysyła Authorization: Bearer <CRON_SECRET>.

export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request: Request) {
  const authorized = await isAuthorizedCronRequest(request);

  if (!authorized) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    // Ta sama ścieżka co dotychczasowe /api/sync-ustawy: lista procesów
    // legislacyjnych z API Sejmu + metadane druków, zapis przez upsert
    // na unikalnym numerze_druku (nowe ustawy wstawiane, istniejące
    // aktualizują etap i datę).
    const result = await syncUstawy({});

    if (result.status === "error") {
      return NextResponse.json(
        {
          success: false,
          message: result.message ?? "Synchronizacja nie powiodła się",
          synced: result.synced,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      success: true,
      message: `Zsynchronizowano ${result.synced} ustaw`,
      synced: result.synced,
      summariesGenerated: result.summariesGenerated,
      drukiFromApi: result.drukiFromApi,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nieznany błąd synchronizacji";

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
