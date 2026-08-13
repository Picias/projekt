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
    <article className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-5 ring-1 ring-white/10">
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/45">
          <ScrollText size={18} aria-hidden />
        </span>
        <p className="text-sm leading-relaxed text-white/60">
          Nie śledzisz jeszcze żadnych ustaw. Przejdź do zakładki{" "}
          <Link href="/ustawy" className="font-medium text-emerald-300 hover:underline">
            Ustawy
          </Link>
          , aby znaleźć projekty, które Cię interesują.
        </p>
      </div>
    </article>
  );
}

export default function HomeWatchedUstawy() {
  const { ustawy, loading } = useWatchedUstawy();

  return (
    <section>
      <div className="flex items-baseline justify-between">
        <div className="flex items-center gap-2">
          <ScrollText size={18} className="text-emerald-300" aria-hidden />
          <h2 className="text-lg font-semibold">Śledzone ustawy</h2>
        </div>
        {ustawy.length > 0 ? (
          <Link
            href="/ustawy"
            className="text-xs font-medium text-emerald-300 hover:underline"
          >
            Zobacz wszystkie
          </Link>
        ) : null}
      </div>

      <div className="mt-3 flex flex-col gap-3">
        {loading ? <HomeWatchedUstawySkeleton /> : null}
        {!loading && ustawy.length === 0 ? <HomeWatchedUstawyEmpty /> : null}
        {!loading
          ? ustawy.map((ustawa) => <UstawaCard key={ustawa.id} ustawa={ustawa} />)
          : null}
      </div>
    </section>
  );
}
