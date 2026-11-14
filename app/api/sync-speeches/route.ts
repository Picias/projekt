import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { scrapeMpSpeeches, withPlayableStreams } from "@/lib/sejm-speeches";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { writeStoredSpeeches } from "@/lib/speeches-store";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const authorized = await isAuthorizedCronRequest(request);

  if (!authorized) {
    return NextResponse.json({ status: "error", message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const onlyId = Number(url.searchParams.get("id") ?? "");
  const offset = Math.max(0, Number(url.searchParams.get("offset") ?? "0") || 0);
  const limit = Math.min(40, Math.max(1, Number(url.searchParams.get("limit") ?? "15") || 15));

  let query = supabaseAdmin.from("poslowie").select("id").order("id", { ascending: true });

  if (Number.isInteger(onlyId) && onlyId > 0) {
    query = query.eq("id", onlyId);
  } else {
    query = query.range(offset, offset + limit - 1);
  }

  const { data, error } = await query;

  if (error) {
    return NextResponse.json({ status: "error", message: error.message }, { status: 500 });
  }

  const ids = (data ?? []).map((row) => row.id as number);
  let saved = 0;
  let empty = 0;

  for (const id of ids) {
    try {
      const scraped = await scrapeMpSpeeches(id);

      if (scraped.length === 0) {
        empty += 1;
        continue;
      }

      const speeches = await withPlayableStreams(scraped);
      await writeStoredSpeeches(id, speeches);
      saved += 1;
    } catch {
      empty += 1;
    }
  }

  const done = ids.length < limit;

  return NextResponse.json({
    status: "ok",
    offset,
    scanned: ids.length,
    saved,
    empty,
    next: done ? null : offset + ids.length,
  });
}
