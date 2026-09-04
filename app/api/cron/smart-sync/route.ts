import { NextResponse } from "next/server";

import { isAuthorizedCronRequest } from "@/lib/cron-auth";
import { runSmartSync } from "@/lib/smart-sync";

export const dynamic = "force-dynamic";
export const maxDuration = 180;

export async function GET(request: Request) {
  const authorized = await isAuthorizedCronRequest(request);

  if (!authorized) {
    return NextResponse.json(
      { success: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  const force = new URL(request.url).searchParams.get("force") === "true";

  try {
    const result = await runSmartSync({ force });

    return NextResponse.json(result, { status: result.success ? 200 : 502 });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nieznany błąd synchronizacji";

    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
