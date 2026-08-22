import { NextResponse } from "next/server";

import { scrapeMpSpeeches } from "@/lib/sejm-speeches";

export async function GET(request: Request) {
  const rawId = new URL(request.url).searchParams.get("id")?.trim() ?? "";
  const mpId = Number(rawId);

  if (!Number.isInteger(mpId) || mpId <= 0) {
    return NextResponse.json({ error: "Nieprawidłowe ID posła" }, { status: 400 });
  }

  try {
    const speeches = await scrapeMpSpeeches(mpId);
    return NextResponse.json(speeches);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nie udało się pobrać wystąpień Sejmu.";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
