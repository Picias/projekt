import Link from "next/link";
import { Suspense } from "react";
import { ChevronLeft, ChevronRight, Users } from "lucide-react";
import MpAvatar from "@/components/mp-avatar";
import { supabase } from "@/lib/supabase";
import { groupPoslowieByPartia, type Posel } from "@/lib/posel";

async function PoslowieList() {
  const { data } = await supabase
    .from("poslowie")
    .select("*")
    .order("imie_nazwisko");

  const poslowie = (data ?? []) as Posel[];

  if (poslowie.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-5 text-sm text-white/70">
        <p className="font-semibold text-white">Brak posłów w bazie</p>
        <p className="mt-2">
          Uruchom synchronizację pod adresem{" "}
          <Link href="/api/sync-mps" className="text-sejm-green-light hover:underline">
            /api/sync-mps
          </Link>
          .
        </p>
      </div>
    );
  }

  const grouped = groupPoslowieByPartia(poslowie);

  return (
    <div className="flex flex-col gap-5">
      {grouped.map(([partia, czlonkowie]) => (
        <section key={partia}>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-sejm-green-light">
              {partia}
            </h2>
            <span className="text-xs text-white/45">{czlonkowie.length}</span>
          </div>

          <ul className="flex flex-col gap-2">
            {czlonkowie.map((posel) => (
              <li key={posel.id}>
                <Link
                  href={`/poslowie/${posel.id}`}
                  className="flex items-center gap-3 rounded-2xl bg-white p-3 text-navy-900 shadow-md transition-shadow hover:shadow-lg"
                >
                  <MpAvatar
                    name={posel.imie_nazwisko}
                    photoUrl={posel.zdjecie_url}
                    size="sm"
                  />
                  <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                    {posel.imie_nazwisko}
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

function PoslowieListSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Ładowanie listy posłów">
      {[1, 2].map((section) => (
        <div key={section} className="space-y-2">
          <div className="h-4 w-24 animate-pulse rounded bg-white/10" />
          {[1, 2, 3].map((item) => (
            <div key={item} className="h-16 animate-pulse rounded-2xl bg-white/10" />
          ))}
        </div>
      ))}
    </div>
  );
}

export default function PoslowiePage() {
  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <Link
        href="/"
        className="flex w-fit items-center gap-1 text-sm text-white/70 transition-colors hover:text-white"
      >
        <ChevronLeft size={18} aria-hidden />
        Wróć
      </Link>

      <div className="flex items-center gap-3">
        <span className="flex size-11 items-center justify-center rounded-xl bg-sejm-green/15 text-sejm-green-light">
          <Users size={22} aria-hidden />
        </span>
        <div>
          <h1 className="text-2xl font-bold leading-tight">Posłowie</h1>
          <p className="text-sm text-white/60">X kadencja Sejmu RP</p>
        </div>
      </div>

      <Suspense fallback={<PoslowieListSkeleton />}>
        <PoslowieList />
      </Suspense>
    </div>
  );
}
