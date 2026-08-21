"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";

import MpAvatar from "@/components/mp-avatar";
import { getClubLabel, getClubTheme } from "@/lib/club-colors";
import { GLOS_INFO, GLOSY_POSLA, type GlosPosla } from "@/lib/glosowania";
import type { GlosPoslaZProfilem } from "@/lib/glosowania-db";
import { normalizeSearchText, sortPoslowieByNazwisko } from "@/lib/posel";

type GlosowanieListaProps = {
  glosy: GlosPoslaZProfilem[];
};

export default function GlosowanieLista({ glosy }: GlosowanieListaProps) {
  const [szukaj, setSzukaj] = useState("");
  const [klub, setKlub] = useState<string | null>(null);
  const [glos, setGlos] = useState<GlosPosla | null>(null);

  // Kluby bierzemy z samych wyników — skład Sejmu zmienia się w kadencji,
  // a filtr ma pokazywać tylko te kluby, które w tym głosowaniu wystąpiły.
  const kluby = useMemo(() => {
    const liczniki = new Map<string, number>();

    for (const wpis of glosy) {
      const label = getClubLabel(wpis.klub);
      liczniki.set(label, (liczniki.get(label) ?? 0) + 1);
    }

    return [...liczniki.entries()].sort(
      ([aLabel, aCount], [bLabel, bCount]) => bCount - aCount || aLabel.localeCompare(bLabel, "pl"),
    );
  }, [glosy]);

  const widoczne = useMemo(() => {
    const fraza = normalizeSearchText(szukaj.trim());

    const przefiltrowane = glosy.filter((wpis) => {
      if (glos && wpis.glos !== glos) {
        return false;
      }

      if (klub && getClubLabel(wpis.klub) !== klub) {
        return false;
      }

      return fraza === "" || normalizeSearchText(wpis.imie_nazwisko).includes(fraza);
    });

    return sortPoslowieByNazwisko(przefiltrowane);
  }, [glosy, szukaj, klub, glos]);

  const filtryAktywne = szukaj.trim() !== "" || klub !== null || glos !== null;

  return (
    <div className="flex flex-col gap-4">
      <div className="relative">
        <Search
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/35"
          aria-hidden
        />
        <input
          type="search"
          value={szukaj}
          onChange={(event) => setSzukaj(event.target.value)}
          placeholder="Szukaj posła po nazwisku"
          aria-label="Szukaj posła po nazwisku"
          className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-10 pr-3 text-sm text-white placeholder:text-white/35 focus:border-emerald-400/40 focus:outline-none focus:ring-1 focus:ring-emerald-400/30"
        />
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
          <SlidersHorizontal size={12} aria-hidden />
          Oddany głos
        </div>

        <div className="flex flex-wrap gap-2">
          {GLOSY_POSLA.map((wartosc) => {
            const info = GLOS_INFO[wartosc];
            const wybrany = glos === wartosc;

            return (
              <button
                key={wartosc}
                type="button"
                onClick={() => setGlos(wybrany ? null : wartosc)}
                aria-pressed={wybrany}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold ring-1 transition-colors ${
                  wybrany ? info.badge : "bg-white/5 text-white/55 ring-white/10 hover:bg-white/10"
                }`}
              >
                {info.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-2.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
          <SlidersHorizontal size={12} aria-hidden />
          Klub parlamentarny
        </div>

        <div className="flex flex-wrap gap-2">
          {kluby.map(([nazwa, liczba]) => {
            const theme = getClubTheme(nazwa);
            const wybrany = klub === nazwa;

            return (
              <button
                key={nazwa}
                type="button"
                onClick={() => setKlub(wybrany ? null : nazwa)}
                aria-pressed={wybrany}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  wybrany
                    ? `${theme.bg} ${theme.text} ${theme.border}`
                    : "border-white/10 bg-white/5 text-white/55 hover:bg-white/10"
                }`}
              >
                {nazwa}
                <span className="ml-1.5 text-[10px] font-medium opacity-60">{liczba}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center justify-between gap-3 border-t border-white/10 pt-3">
        <p className="text-xs font-medium text-white/45">
          Pokazano <span className="font-bold text-white/75">{widoczne.length}</span> z{" "}
          {glosy.length} posłów
        </p>

        {filtryAktywne ? (
          <button
            type="button"
            onClick={() => {
              setSzukaj("");
              setKlub(null);
              setGlos(null);
            }}
            className="flex items-center gap-1 text-xs font-semibold text-emerald-300 hover:underline"
          >
            <X size={12} aria-hidden />
            Wyczyść filtry
          </button>
        ) : null}
      </div>

      {widoczne.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-5 text-center text-sm leading-relaxed text-white/55">
          Żaden poseł nie pasuje do wybranych filtrów.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {widoczne.map((wpis) => {
            const theme = getClubTheme(wpis.klub);
            const info = GLOS_INFO[wpis.glos];

            return (
              <li key={wpis.posel_id}>
                <Link
                  href={`/poslowie/${wpis.posel_id}`}
                  className={`flex items-center gap-3 rounded-2xl border bg-navy-800/60 p-3 transition-colors hover:border-white/30 hover:bg-navy-800 ${theme.border}`}
                >
                  <MpAvatar
                    name={wpis.imie_nazwisko}
                    photoUrl={wpis.zdjecie_url}
                    size="sm"
                    frameClassName={`border-2 ${theme.border}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-white">
                      {wpis.imie_nazwisko}
                    </span>
                    <span className={`block truncate text-xs ${theme.text}`}>
                      {getClubLabel(wpis.klub)}
                    </span>
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${info.badge}`}
                  >
                    {info.label}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
