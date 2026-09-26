"use client";

import Link from "next/link";
import { BellRing, LogIn } from "lucide-react";

import HomeWatchedUstawy from "@/components/home-watched-ustawy";
import WatchedMpsSection from "@/components/watched-mps-section";
import { loginHref } from "@/lib/profile";
import { useAuthUser } from "@/lib/use-auth-user";

/**
 * Spersonalizowany kanał „Obserwuję”: posłowie i ustawy, które obywatel
 * śledzi. Gość zamiast dwóch pustych list widzi jedno zaproszenie.
 */
export default function MojKanal() {
  const user = useAuthUser();

  return (
    <section
      aria-labelledby="obserwuje"
      className="flex flex-col gap-5 rounded-3xl border border-white/10 bg-linear-to-br from-white/10 via-navy-800/40 to-sejm-green/10 p-5 shadow-lg shadow-sejm-green/5 backdrop-blur-md"
    >
      <div className="flex items-center gap-2">
        <BellRing size={20} className="text-emerald-300" aria-hidden />
        <h2 id="obserwuje" className="text-lg font-bold">
          Obserwuję
        </h2>
      </div>

      {user === undefined ? (
        <div className="h-32 animate-pulse rounded-2xl bg-white/10" aria-busy="true" />
      ) : user === null ? (
        <div className="rounded-2xl border border-white/10 bg-navy-950/30 p-5 shadow-lg shadow-navy-950/20">
          <p className="text-base font-semibold text-white">Twój własny kanał wiadomości z Sejmu</p>
          <p className="mt-1 text-sm leading-relaxed text-white/80">
            Załóż darmowe konto, a zbierzemy tu posłów z Twojego okręgu i ustawy, które Cię
            obchodzą — bez szukania po całej aplikacji.
          </p>
          <Link
            href={loginHref("/")}
            className="mt-4 flex min-h-12 items-center justify-center gap-2 rounded-xl bg-green-700 px-4 py-3 text-base font-bold text-white transition-colors hover:bg-green-800"
          >
            <LogIn size={18} aria-hidden />
            Zaloguj się lub załóż konto
          </Link>
        </div>
      ) : (
        <>
          <WatchedMpsSection />
          <HomeWatchedUstawy />
        </>
      )}
    </section>
  );
}
