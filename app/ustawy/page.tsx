import Link from "next/link";
import { ChevronLeft, ScrollText } from "lucide-react";

import UstawaCard from "@/components/ustawa-card";
import WatchedUstawySection from "@/components/watched-ustawy-section";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Ustawa } from "@/lib/ustawa";

// Lista zmienia się po każdej synchronizacji druków, więc czytamy ją na żądanie.
export const dynamic = "force-dynamic";

type UstawaListItem = Pick<
  Ustawa,
  "id" | "numer_druku" | "tytul_oficjalny" | "autor" | "data_wplywu" | "etap_legislacyjny"
>;

async function fetchUstawy(): Promise<UstawaListItem[]> {
  const { data } = await supabaseAdmin
    .from("ustawy")
    .select("id, numer_druku, tytul_oficjalny, autor, data_wplywu, etap_legislacyjny")
    .order("data_wplywu", { ascending: false })
    .limit(30);

  return (data ?? []) as UstawaListItem[];
}

export default async function UstawyPage() {
  const ustawy = await fetchUstawy();

  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <Link
        href="/"
        className="flex w-fit items-center gap-1 text-sm text-white/70 transition-colors hover:text-white"
      >
        <ChevronLeft size={18} aria-hidden />
        Wróć
      </Link>

      <header>
        <h1 className="text-3xl font-bold leading-tight">Śledzone ustawy</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/60">
          Projekty ustaw wyjaśnione prostym językiem — bez prawniczego żargonu.
        </p>
      </header>

      <WatchedUstawySection />

      <section>
        <div className="mb-3 flex items-center gap-2">
          <ScrollText size={16} className="text-emerald-300" aria-hidden />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
            Najnowsze druki
          </h2>
        </div>

        {ustawy.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-5">
            <p className="text-sm font-semibold">Brak ustaw w bazie</p>
            <p className="mt-1 text-sm leading-relaxed text-white/55">
              Uruchom synchronizację pod adresem{" "}
              <Link href="/api/sync-ustawy" className="text-emerald-300 hover:underline">
                /api/sync-ustawy
              </Link>
              , aby pobrać najnowsze druki z API Sejmu.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {ustawy.map((ustawa) => (
              <UstawaCard key={ustawa.id} ustawa={ustawa} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
