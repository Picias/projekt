import { NextResponse } from "next/server";

import {
  fetchProceedings,
  findProceedingForDate,
} from "@/lib/sejm-proceedings";

export const dynamic = "force-dynamic";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: Request) {
  const date = new URL(request.url).searchParams.get("date")?.trim() ?? "";

  if (!DATE_PATTERN.test(date)) {
    return NextResponse.json({ error: "Nieprawidłowa data" }, { status: 400 });
  }

  const proceeding = findProceedingForDate(await fetchProceedings(), date);

  if (!proceeding) {
    return NextResponse.json({
      date,
      sitting: null,
      title: null,
      agendaTekst: null,
    });
  }

  return NextResponse.json({
    date,
    sitting: proceeding.number,
    title: proceeding.title,
    agendaTekst: proceeding.agenda,
  });
}
