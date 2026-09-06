import { NextResponse } from "next/server";

import { scrapeMpSpeeches } from "@/lib/sejm-speeches";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
};

export async function GET(request: Request) {
  const rawId = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  const mpId = Number(rawId);

  if (!Number.isInteger(mpId) || mpId <= 0) {
    return NextResponse.json(
      { error: "Nieprawidłowe ID posła" },
      { status: 400, headers: NO_STORE_HEADERS },
    );
  }

  try {
    const speeches = await scrapeMpSpeeches(mpId);
    return NextResponse.json(speeches, { headers: NO_STORE_HEADERS });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nie udało się pobrać wystąpień Sejmu.";

    return NextResponse.json({ error: message }, { status: 502, headers: NO_STORE_HEADERS });
  }
}
