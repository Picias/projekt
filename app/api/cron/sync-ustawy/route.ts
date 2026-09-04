import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { syncUstawy } from "@/lib/sync-ustawy";

// Dodaj do pliku .env.local (oraz do zmiennych środowiskowych na Vercel):
//   CRON_SECRET=jakies_trudne_haslo_123
// Ta zmienna zabezpiecza skrypt przed niepowołanym uruchomieniem z zewnątrz.
// Vercel Cron dołączy ją automatycznie jako nagłówek Authorization: Bearer …
//
// Do ręcznego przycisku w panelu potrzebny jest też Twój e-mail:
//   ADMIN_EMAIL=twoj@email.pl

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
