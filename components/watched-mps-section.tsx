"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Users } from "lucide-react";
import MpCard from "@/components/mp-card";
import { useAuthUser } from "@/lib/use-auth-user";
import { useSubscriptionsVersion } from "@/lib/use-watched-ustawy";
import type { Posel } from "@/lib/posel";

function WatchedMpsSkeleton() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Ładowanie obserwowanych posłów">
      {[1, 2].map((item) => (
        <article
          key={item}
          className="h-28 animate-pulse rounded-2xl bg-white/10"
        />
      ))}
    </div>
  );
}

function WatchedMpsEmpty() {
  return (
    <p className="rounded-2xl border border-dashed border-white/25 bg-white/5 p-4 text-sm leading-relaxed text-white/80">
      Nie obserwujesz jeszcze żadnego posła. Wybierz swój okręg powyżej albo przejdź do
      zakładki{" "}
      <Link href="/poslowie" className="font-semibold text-emerald-300 underline">
        Posłowie
      </Link>{" "}
      i kliknij dzwonek przy profilu.
    </p>
  );
}

export default function WatchedMpsSection() {
  const user = useAuthUser();
  const version = useSubscriptionsVersion();
  const [poslowie, setPoslowie] = useState<Posel[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWatchedMps() {
      if (user === undefined) {
        return;
      }

      if (!user) {
        if (!cancelled) {
          setPoslowie([]);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await fetch("/api/obserwowani", { cache: "no-store" });

        if (!response.ok) {
          throw new Error("Nie udało się pobrać obserwowanych posłów.");
        }

        const data = (await response.json()) as { poslowie?: Posel[] };

        if (!cancelled) {
          setError(null);
          setPoslowie(data.poslowie ?? []);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Wystąpił błąd podczas ładowania.",
          );
          setPoslowie([]);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    loadWatchedMps();

    return () => {
      cancelled = true;
    };
  }, [user, version]);

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-emerald-300" aria-hidden />
          <h3 className="text-base font-bold">Posłowie</h3>
        </div>
        {poslowie && poslowie.length > 0 ? (
          <Link
            href="/poslowie"
            className="flex min-h-11 items-center text-sm font-semibold text-emerald-300 hover:underline"
          >
            Wszyscy posłowie
          </Link>
        ) : null}
      </div>

      <div className="mt-3 flex flex-col gap-4">
        {loading ? <WatchedMpsSkeleton /> : null}
        {!loading && error ? (
          <p role="alert" className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-100 ring-1 ring-red-400/30">
            {error}
          </p>
        ) : null}
        {!loading && !error && poslowie?.length === 0 ? <WatchedMpsEmpty /> : null}
        {!loading && !error && poslowie && poslowie.length > 0
          ? poslowie.map((posel) => (
              <MpCard
                key={posel.id}
                id={posel.id}
                name={posel.imie_nazwisko}
                party={posel.partia ?? "Brak klubu"}
                photoUrl={posel.zdjecie_url ?? null}
              />
            ))
          : null}
      </div>
    </div>
  );
}
