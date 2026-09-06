import { NextResponse } from "next/server";

import { scrapeSpeechDetails } from "@/lib/sejm-speeches";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
};

export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get("path")?.trim() ?? "";

  if (!path) {
    return NextResponse.json(
      { error: "Brak parametru path" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const details = await scrapeSpeechDetails(path);
    return NextResponse.json(details, { headers: NO_STORE_HEADERS });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nie udało się pobrać szczegółów wystąpienia.";
    const invalid = message.includes("Nieprawidłowa ścieżka");

    return NextResponse.json(
      { error: message },
      { status: invalid ? 400 : 502, headers: NO_STORE_HEADERS },
    );
  }
}
