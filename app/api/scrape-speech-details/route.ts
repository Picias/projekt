import { NextResponse } from "next/server";

import { scrapeSpeechDetails } from "@/lib/sejm-speeches";

export async function GET(request: Request) {
  const path = new URL(request.url).searchParams.get("path")?.trim() ?? "";

  if (!path) {
    return NextResponse.json({ error: "Brak parametru path" }, { status: 400 });
  }

  try {
    const details = await scrapeSpeechDetails(path);
    return NextResponse.json(details);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Nie udało się pobrać szczegółów wystąpienia.";
    const invalid = message.includes("Nieprawidłowa ścieżka");

    return NextResponse.json({ error: message }, { status: invalid ? 400 : 502 });
  }
}
