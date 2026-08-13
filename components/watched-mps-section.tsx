"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Heart, Users } from "lucide-react";
import MpCard from "@/components/mp-card";
import { getAnonymousUserId } from "@/lib/anonymous-user";
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
    <article className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-5 ring-1 ring-white/10">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/45">
          <Heart size={18} aria-hidden />
        </span>
        <div>
          <p className="text-sm font-semibold text-white/90">
            Nie obserwujesz jeszcze nikogo
          </p>
          <p className="mt-1 text-sm leading-relaxed text-white/55">
            Przejdź do zakładki{" "}
            <Link href="/poslowie" className="font-medium text-sejm-green-light hover:underline">
              Posłowie
            </Link>{" "}
            i kliknij serduszko przy profilu, który chcesz śledzić.
          </p>
        </div>
      </div>
    </article>
  );
}

export default function WatchedMpsSection() {
  const [poslowie, setPoslowie] = useState<Posel[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadWatchedMps() {
      const userId = getAnonymousUserId();

      if (!userId) {
        if (!cancelled) {
          setPoslowie([]);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await fetch(
          `/api/obserwowani?user_id=${encodeURIComponent(userId)}`,
        );

        if (!response.ok) {
          throw new Error("Nie udało się pobrać obserwowanych posłów.");
        }

        const data = (await response.json()) as { poslowie?: Posel[] };

        if (!cancelled) {
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
  }, []);

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <Users size={18} className="text-sejm-green-light" aria-hidden />
          <h2 className="text-lg font-semibold">Moi posłowie</h2>
        </div>
        {poslowie && poslowie.length > 0 ? (
          <Link
            href="/poslowie"
            className="text-xs font-medium text-sejm-green-light hover:underline"
          >
            Zobacz wszystkich
          </Link>
        ) : null}
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {loading ? <WatchedMpsSkeleton /> : null}
        {!loading && error ? (
          <p className="rounded-2xl bg-red-500/10 p-4 text-sm text-red-300 ring-1 ring-red-400/20">
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
    </section>
  );
}
