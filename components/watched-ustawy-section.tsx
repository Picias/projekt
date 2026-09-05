"use client";

import { Bell } from "lucide-react";

import UstawaCard from "@/components/ustawa-card";
import { useWatchedUstawy } from "@/lib/use-watched-ustawy";

export default function WatchedUstawySection() {
  const { ustawy, loading } = useWatchedUstawy();

  return (
    <section>
      <div className="mb-3 flex items-center gap-2">
        <Bell size={16} className="text-emerald-300" aria-hidden />
        <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
          Śledzone przez Ciebie
        </h2>
      </div>

      {loading ? (
        <div className="h-24 animate-pulse rounded-2xl bg-white/10" aria-busy="true" />
      ) : ustawy.length > 0 ? (
        <div className="flex flex-col gap-3">
          {ustawy.map((ustawa) => (
            <UstawaCard key={ustawa.id} ustawa={ustawa} />
          ))}
        </div>
      ) : (
        <p className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-4 text-sm leading-relaxed text-white/55">
          Nie śledzisz jeszcze żadnej ustawy. Otwórz dowolny druk poniżej i kliknij
          dzwonek „Obserwuj”, aby dodać go tutaj.
        </p>
      )}
    </section>
  );
}
