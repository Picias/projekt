import Link from "next/link";
import { Suspense } from "react";
import { Users } from "lucide-react";
import BackButton from "@/components/back-button";
import PoslowieBrowser from "@/components/poslowie-browser";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { sortPoslowieByNazwisko, toPoselProfil } from "@/lib/posel";

// Lista zmienia się po synchronizacji /api/sync-mps, więc czytamy ją na żądanie.
export const dynamic = "force-dynamic";

async function PoslowieList() {
  const { data, error } = await supabaseAdmin.from("poslowie").select("*");

  // Bez tego rozróżnienia błąd zapytania wygląda tak samo jak pusta baza.
  if (error) {
    return (
      <div className="rounded-2xl border border-red-400/25 bg-red-500/10 p-5 text-sm text-red-200">
        <p className="font-semibold text-red-100">Nie udało się pobrać listy posłów</p>
        <p className="mt-2">{error.message}</p>
      </div>
    );
  }

  // Sortujemy w aplikacji, bo klucz to nazwisko z osobnej kolumny, a nie
  // imie_nazwisko, po którym potrafi sortować Postgres.
  const poslowie = sortPoslowieByNazwisko((data ?? []).map(toPoselProfil));

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

  return <PoslowieBrowser poslowie={poslowie} />;
}

function PoslowieListSkeleton() {
  return (
    <div className="flex flex-col gap-5" aria-busy="true" aria-label="Ładowanie listy posłów">
      <div className="flex gap-2">
        <div className="h-12 flex-1 animate-pulse rounded-2xl bg-white/10" />
        <div className="size-12 animate-pulse rounded-2xl bg-white/10" />
      </div>
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
      <BackButton />

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
