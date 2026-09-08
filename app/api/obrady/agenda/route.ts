import { NextResponse } from "next/server";

import {
  fetchProceedings,
  findProceedingForDate,
} from "@/lib/sejm-proceedings";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date")?.trim() ?? "";

  if (!DATE_PATTERN.test(date)) {
    return json({ error: "Nieprawidłowa data" }, 400);
  }

  const proceeding = findProceedingForDate(await fetchProceedings(), date);

  if (!proceeding) {
    return json({
      date,
      sitting: null,
      title: null,
      agendaTekst: null,
    });
  }

  return json({
    date,
    sitting: proceeding.number,
    title: proceeding.title,
    agendaTekst: proceeding.agenda,
  });
}
