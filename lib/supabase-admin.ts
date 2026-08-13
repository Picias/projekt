import { createClient } from "@supabase/supabase-js";

// Klient z kluczem service_role omija RLS, więc wolno go tworzyć wyłącznie
// po stronie serwera (API routes, Server Components, Server Actions).
// Import w komponencie klienckim wysadziłby build z tym komunikatem.
if (typeof window !== "undefined") {
  throw new Error(
    "lib/supabase-admin.ts nie może być importowany w kodzie klienckim — " +
      "użyj trasy w app/api zamiast bezpośredniego zapytania do Supabase.",
  );
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  throw new Error("Brak zmiennej środowiskowej NEXT_PUBLIC_SUPABASE_URL.");
}

if (!serviceRoleKey) {
  throw new Error(
    "Brak zmiennej środowiskowej SUPABASE_SERVICE_ROLE_KEY — " +
      "bez niej zapytania do Supabase zwracają puste wyniki przez RLS.",
  );
}

export const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});
