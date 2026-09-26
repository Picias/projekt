"use client";

import Link from "next/link";
import { ScrollText } from "lucide-react";

import UstawaCard from "@/components/ustawa-card";
import { useWatchedUstawy } from "@/lib/use-watched-ustawy";

function HomeWatchedUstawySkeleton() {
  return (
    <div
      className="flex flex-col gap-3"
      aria-busy="true"
      aria-label="Ładowanie śledzonych ustaw"
    >
      {[1, 2].map((item) => (
        <div key={item} className="h-28 animate-pulse rounded-2xl bg-white/10" />
      ))}
    </div>
  );
}

function HomeWatchedUstawyEmpty() {
  return (
    <p className="rounded-2xl border border-dashed border-white/25 bg-white/5 p-4 text-sm leading-relaxed text-white/80">
      Nie śledzisz jeszcze żadnej ustawy. Kliknij dzwonek przy projekcie na liście{" "}
      <Link href="/ustawy" className="font-semibold text-emerald-300 underline">
        Ustawy
      </Link>
      , a zobaczysz tu, na jakim jest etapie.
    </p>
  );
}

export default function HomeWatchedUstawy() {
  const { ustawy, loading } = useWatchedUstawy();

  return (
    <div>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <ScrollText size={18} className="text-emerald-300" aria-hidden />
          <h3 className="text-base font-bold">Ustawy</h3>
        </div>
        {ustawy.length > 0 ? (
          <Link
            href="/ustawy"
            className="flex min-h-11 items-center text-sm font-semibold text-emerald-300 hover:underline"
          >
            Wszystkie ustawy
          </Link>
        ) : null}
      </div>

      <div className="mt-3 flex flex-col gap-4">
        {loading ? <HomeWatchedUstawySkeleton /> : null}
        {!loading && ustawy.length === 0 ? <HomeWatchedUstawyEmpty /> : null}
        {!loading
          ? ustawy.map((ustawa) => <UstawaCard key={ustawa.id} ustawa={ustawa} />)
          : null}
      </div>
    </div>
  );
}
