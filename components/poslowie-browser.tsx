"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Search,
  SearchX,
  SlidersHorizontal,
  X,
} from "lucide-react";
import MpAvatar from "@/components/mp-avatar";
import { getClubLabel, getClubTheme } from "@/lib/club-colors";
import { formatOkreg, groupPoslowieByKlub, type PoselProfil } from "@/lib/posel";
import {
  collectFilterOptions,
  EMPTY_FILTERS,
  FILTER_LABELS,
  FILTER_ORDER,
  filterPoslowie,
  type FilterKey,
  type Filters,
} from "@/lib/posel-filters";

type FilterSelectProps = {
  filterKey: FilterKey;
  value: string;
  options: string[];
  onChange: (key: FilterKey, value: string) => void;
};

function FilterSelect({ filterKey, value, options, onChange }: FilterSelectProps) {
  const label = FILTER_LABELS[filterKey];

  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
        {label}
      </span>
      <span className="relative">
        <select
          value={value}
          onChange={(event) => onChange(filterKey, event.target.value)}
          aria-label={label}
          className="w-full appearance-none rounded-xl border border-white/10 bg-navy-900 py-2.5 pl-3 pr-9 text-sm font-medium text-white outline-none transition-colors hover:border-white/20 focus:border-sejm-green/50"
        >
          <option value="">Wszystkie</option>
          {options.map((option) => (
            <option key={option} value={option}>
              {option}
            </option>
          ))}
        </select>
        <ChevronDown
          size={16}
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-white/40"
        />
      </span>
    </label>
  );
}

function PoselRow({ posel }: { posel: PoselProfil }) {
  const theme = getClubTheme(posel.partia);
  const okreg = formatOkreg(posel.okreg_wyborczy, posel.okreg_numer);

  return (
    <Link
      href={`/poslowie/${posel.id}`}
      className={`flex items-center gap-3 rounded-2xl border bg-navy-800/60 p-3 transition-colors hover:border-white/30 hover:bg-navy-800 ${theme.border}`}
    >
      <MpAvatar
        name={posel.imie_nazwisko}
        photoUrl={posel.zdjecie_url}
        size="sm"
        frameClassName={`border-2 ${theme.border}`}
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-semibold text-white">
          {posel.imie_nazwisko}
        </span>
        <span className="block truncate text-xs text-white/45">
          {okreg ?? getClubLabel(posel.partia)}
        </span>
      </span>
      <ChevronRight size={16} className="shrink-0 text-white/35" aria-hidden />
    </Link>
  );
}

export default function PoslowieBrowser({ poslowie }: { poslowie: PoselProfil[] }) {
  const [query, setQuery] = useState("");
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [panelOpen, setPanelOpen] = useState(false);

  const activeFilters = FILTER_ORDER.filter((key) => filters[key]);

  const filtered = useMemo(
    () => filterPoslowie(poslowie, query, filters),
    [poslowie, query, filters],
  );

  const options = useMemo(
    () => collectFilterOptions(poslowie, query, filters),
    [poslowie, query, filters],
  );

  const grouped = useMemo(() => groupPoslowieByKlub(filtered), [filtered]);

  function handleFilterChange(key: FilterKey, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function resetAll() {
    setFilters(EMPTY_FILTERS);
    setQuery("");
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search
            size={17}
            aria-hidden
            className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Szukaj posła po imieniu i nazwisku"
            aria-label="Szukaj posła po imieniu i nazwisku"
            className="w-full rounded-2xl border border-white/10 bg-white/5 py-3 pl-10 pr-10 text-sm text-white outline-none transition-colors placeholder:text-white/35 hover:border-white/20 focus:border-sejm-green/50 focus:bg-white/10 [&::-webkit-search-cancel-button]:hidden"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Wyczyść wyszukiwanie"
              className="absolute right-2.5 top-1/2 flex size-7 -translate-y-1/2 items-center justify-center rounded-full text-white/45 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={15} aria-hidden />
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={() => setPanelOpen((open) => !open)}
          aria-expanded={panelOpen}
          aria-label="Filtry"
          className={`relative flex size-12 shrink-0 items-center justify-center rounded-2xl border transition-colors ${
            panelOpen || activeFilters.length > 0
              ? "border-sejm-green/40 bg-sejm-green/15 text-sejm-green-light"
              : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white"
          }`}
        >
          <SlidersHorizontal size={18} aria-hidden />
          {activeFilters.length > 0 ? (
            <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-sejm-green text-[10px] font-bold text-white">
              {activeFilters.length}
            </span>
          ) : null}
        </button>
      </div>

      {panelOpen ? (
        <div className="rounded-2xl border border-white/10 bg-navy-800/60 p-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {FILTER_ORDER.map((key) => (
              <FilterSelect
                key={key}
                filterKey={key}
                value={filters[key]}
                options={options[key]}
                onChange={handleFilterChange}
              />
            ))}
          </div>

          {activeFilters.length > 0 ? (
            <button
              type="button"
              onClick={() => setFilters(EMPTY_FILTERS)}
              className="mt-3 text-xs font-semibold text-sejm-green-light transition-colors hover:text-white"
            >
              Wyczyść filtry
            </button>
          ) : null}
        </div>
      ) : null}

      {activeFilters.length > 0 ? (
        <ul className="flex flex-wrap gap-2">
          {activeFilters.map((key) => (
            <li key={key}>
              <button
                type="button"
                onClick={() => handleFilterChange(key, "")}
                className="flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 py-1.5 pl-3 pr-2 text-xs font-medium text-white/80 transition-colors hover:border-white/30 hover:text-white"
              >
                <span className="text-white/45">{FILTER_LABELS[key]}:</span>
                {filters[key]}
                <X size={13} aria-hidden />
                <span className="sr-only">Usuń filtr</span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}

      <p className="text-xs text-white/45" aria-live="polite">
        {filtered.length === poslowie.length
          ? `${poslowie.length} posłów`
          : `Znaleziono ${filtered.length} z ${poslowie.length} posłów`}
      </p>

      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-6 text-center">
          <SearchX size={26} className="mx-auto text-white/35" aria-hidden />
          <p className="mt-3 text-sm font-semibold text-white">Brak wyników</p>
          <p className="mt-1 text-sm text-white/55">
            Zmień frazę wyszukiwania lub zdejmij część filtrów.
          </p>
          <button
            type="button"
            onClick={resetAll}
            className="mt-4 rounded-xl bg-sejm-green px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-sejm-green-light"
          >
            Wyczyść wszystko
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {grouped.map(([klub, czlonkowie]) => {
            const theme = getClubTheme(klub);

            return (
              <section key={klub}>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h2
                    className={`min-w-0 truncate text-sm font-semibold uppercase tracking-wide ${theme.text}`}
                  >
                    {klub}
                  </h2>
                  <span
                    className={`shrink-0 rounded-full border px-2 py-0.5 text-xs font-semibold ${theme.text} ${theme.bg} ${theme.border}`}
                  >
                    {czlonkowie.length}
                  </span>
                </div>

                <ul className="flex flex-col gap-2">
                  {czlonkowie.map((posel) => (
                    <li key={posel.id}>
                      <PoselRow posel={posel} />
                    </li>
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
