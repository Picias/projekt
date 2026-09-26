"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { ChevronDown, ChevronRight, MapPin } from "lucide-react";

import MpAvatar from "@/components/mp-avatar";
import SubscribeButton from "@/components/subscribe-button";
import { getClubLabel } from "@/lib/club-colors";
import type { MojOkregResponse, OkregOption, PoselOkregu } from "@/lib/moj-okreg";

// Wybór okręgu trzymamy w przeglądarce — działa bez konta i bez migracji
// tabeli profili, a obserwowanie posłów i tak zapisuje się na koncie.
const STORAGE_KEY = "sejmon:moj-okreg";

function readSavedOkreg(): number | null {
  try {
    const value = Number(window.localStorage.getItem(STORAGE_KEY));
    return Number.isInteger(value) && value > 0 ? value : null;
  } catch {
    return null;
  }
}

function saveOkreg(numer: number | null) {
  try {
    if (numer) {
      window.localStorage.setItem(STORAGE_KEY, String(numer));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Tryb prywatny bez localStorage — wybór działa do odświeżenia strony.
  }
}

async function fetchOkreg(numer: number | null): Promise<MojOkregResponse | null> {
  try {
    const response = await fetch(numer ? `/api/moj-okreg?numer=${numer}` : "/api/moj-okreg");
    return response.ok ? ((await response.json()) as MojOkregResponse) : null;
  } catch {
    return null;
  }
}

function PoselRow({ posel }: { posel: PoselOkregu }) {
  return (
    <li className="relative flex items-center gap-3 rounded-2xl border border-white/10 bg-linear-to-br from-white/10 to-white/[0.03] p-3 shadow-lg shadow-sejm-green/5">
      <Link
        href={`/poslowie/${posel.id}`}
        className="flex min-w-0 flex-1 items-center gap-3 rounded-xl"
      >
        <MpAvatar name={posel.imie_nazwisko} photoUrl={posel.zdjecie_url} size="sm" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-base font-semibold text-white">
            {posel.imie_nazwisko}
          </span>
          <span className="block truncate text-sm text-white/70">
            {getClubLabel(posel.partia)}
          </span>
        </span>
        <ChevronRight size={18} className="shrink-0 text-white/50" aria-hidden />
      </Link>
      <SubscribeButton
        targetType="posel"
        targetId={posel.id}
        name={posel.imie_nazwisko}
        variant="icon"
      />
    </li>
  );
}

export default function MojOkreg() {
  const selectId = useId();
  const [okregi, setOkregi] = useState<OkregOption[]>([]);
  const [numer, setNumer] = useState<number | null>(null);
  const [poslowie, setPoslowie] = useState<PoselOkregu[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingPoslowie, setLoadingPoslowie] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function init() {
      const saved = readSavedOkreg();
      const data = await fetchOkreg(saved);

      if (cancelled) {
        return;
      }

      setOkregi(data?.okregi ?? []);

      if (saved && data?.okregi.some((okreg) => okreg.numer === saved)) {
        setNumer(saved);
        setPoslowie(data.poslowie);
      }

      setLoading(false);
    }

    void init();

    return () => {
      cancelled = true;
    };
  }, []);

  async function handleChange(value: string) {
    const next = Number(value) || null;
    setNumer(next);
    saveOkreg(next);

    if (!next) {
      setPoslowie([]);
      return;
    }

    setLoadingPoslowie(true);
    const data = await fetchOkreg(next);
    setPoslowie(data?.poslowie ?? []);
    setLoadingPoslowie(false);
  }

  const selected = okregi.find((okreg) => okreg.numer === numer) ?? null;

  return (
    <section
      aria-labelledby="moj-okreg"
      className="flex flex-col gap-4 rounded-3xl border border-white/10 bg-linear-to-br from-white/10 via-navy-800/30 to-transparent p-5 shadow-lg shadow-sejm-green/5 backdrop-blur-md"
    >
      <div className="flex items-center gap-2">
        <MapPin size={20} className="text-emerald-300" aria-hidden />
        <h2 id="moj-okreg" className="text-lg font-bold">
          Moi przedstawiciele
        </h2>
      </div>

      <p className="text-sm leading-relaxed text-white/75">
        Wybierz swój okręg wyborczy, żeby zobaczyć posłów, na których mogłeś głosować — i
        obserwuj, jak głosują w Twoim imieniu.
      </p>

      {loading ? (
        <div className="h-14 animate-pulse rounded-2xl bg-white/10" aria-busy="true" />
      ) : okregi.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/25 bg-white/5 p-4 text-sm text-white/80">
          Lista okręgów jest chwilowo niedostępna. Znajdź swoich posłów w zakładce{" "}
          <Link href="/poslowie" className="font-semibold text-emerald-300 underline">
            Posłowie
          </Link>
          .
        </p>
      ) : (
        <>
          <label htmlFor={selectId} className="sr-only">
            Twój okręg wyborczy
          </label>
          <div className="relative">
            <select
              id={selectId}
              value={numer ?? ""}
              onChange={(event) => void handleChange(event.target.value)}
              className="min-h-14 w-full appearance-none rounded-2xl border border-white/20 bg-navy-800 py-3 pl-4 pr-11 text-base font-semibold text-white outline-none transition-colors hover:border-white/35 focus:border-emerald-400"
            >
              <option value="">Wybierz swój okręg (miasto)</option>
              {okregi.map((okreg) => (
                <option key={okreg.numer} value={okreg.numer}>
                  Okręg nr {okreg.numer} — {okreg.siedziba}
                </option>
              ))}
            </select>
            <ChevronDown
              size={20}
              aria-hidden
              className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-white/70"
            />
          </div>
          {!numer ? (
            <p className="text-sm text-white/70">
              Nie wiesz, który to okręg? Wybierz największe miasto w pobliżu — to siedziba
              Twojego okręgu.
            </p>
          ) : null}
        </>
      )}

      {numer ? (
        loadingPoslowie ? (
          <div className="flex flex-col gap-2" aria-busy="true" aria-label="Ładowanie posłów okręgu">
            {[1, 2, 3].map((item) => (
              <div key={item} className="h-16 animate-pulse rounded-2xl bg-white/10" />
            ))}
          </div>
        ) : (
          <div aria-live="polite">
            {selected ? (
              <p className="text-sm font-semibold text-white/85">
                {poslowie.length} {poslowie.length === 1 ? "poseł" : "posłów"} z okręgu{" "}
                {selected.siedziba}
              </p>
            ) : null}
            <p className="mb-2 text-sm text-white/70">
              Dzwonek dodaje posła do Twojego kanału „Obserwuję” poniżej.
            </p>
            <ul className="flex flex-col gap-2">
              {poslowie.map((posel) => (
                <PoselRow key={posel.id} posel={posel} />
              ))}
            </ul>
          </div>
        )
      ) : null}
    </section>
  );
}
