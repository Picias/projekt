import { timingSafeEqual } from "node:crypto";

import { isAdminEmail } from "@/lib/admin";
import { createServerSupabase } from "@/lib/supabase-server";

function hasValidCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return false;
  }

  const header = request.headers.get("authorization");

  if (!header) {
    return false;
  }

  const expected = Buffer.from(`Bearer ${secret}`);
  const received = Buffer.from(header);

  return expected.length === received.length && timingSafeEqual(expected, received);
}

/**
 * Vercel Cron wysyła Authorization: Bearer ${CRON_SECRET}.
 * Przycisk w panelu admina nie może trzymać tego hasła w przeglądarce,
 * więc dopuszczamy też zalogowaną sesję z adresem z ADMIN_EMAIL.
 */
export async function isAuthorizedCronRequest(request: Request): Promise<boolean> {
  if (hasValidCronSecret(request)) {
    return true;
  }

  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return isAdminEmail(user?.email);
}
