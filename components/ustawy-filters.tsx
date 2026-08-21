"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";

import {
  buildUstawyQuery,
  countActiveUstawyFilters,
  EMPTY_USTAWY_FILTERS,
  hasActiveUstawyFilters,
  parseUstawySearchParams,
  USTAWY_PAGE_SIZE,
  type UstawyFilterOption,
  type UstawyFilterOptions,
  type UstawyFilters as Filters,
} from "@/lib/ustawa-filters";

type PillGroupProps = {
  label: string;
  allLabel?: string;
  options: UstawyFilterOption[];
  value: string;
  onSelect: (value: string) => void;
};

function PillGroup({
  label,
  allLabel = "Wszystkie",
  options,
  value,
  onSelect,
}: PillGroupProps) {
  const pills = [{ value: "", label: allLabel }, ...options];

  return (
    <fieldset>
      <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
        {label}
      </legend>
      <div className="flex flex-wrap gap-2">
        {pills.map((option) => {
          const isActive = option.value === value;

          return (
            <button
              key={option.value || "all"}
              type="button"
              aria-pressed={isActive}
              onClick={() => onSelect(option.value)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                isActive
                  ? "border-sejm-green/40 bg-sejm-green/20 text-sejm-green-light"
                  : "border-white/10 bg-white/5 text-white/60 hover:border-white/25 hover:text-white"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

export function UstawyFiltersFallback() {
  return (
    <div className="flex items-center gap-2" aria-hidden>
      <div className="h-12 flex-1 animate-pulse rounded-2xl bg-white/10" />
      <div className="size-12 shrink-0 animate-pulse rounded-2xl bg-white/10" />
    </div>
  );
}

export default function UstawyFilters({ options }: { options: UstawyFilterOptions }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = parseUstawySearchParams(searchParams);
  const { q, etap, autor, tag } = filters;

  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(q);
  const [urlQuery, setUrlQuery] = useState(q);
  const [panelOpen, setPanelOpen] = useState(() => countActiveUstawyFilters(filters) > 0);

  const activeCount = countActiveUstawyFilters(filters);
  const canClear = hasActiveUstawyFilters({ ...filters, q: query.trim() });

  // Adres URL jest źródłem prawdy, więc gdy zmieni się poza polem tekstowym
  // (cofnięcie w historii, wyczyszczenie filtrów), pole podąża za nim.
  if (q !== urlQuery) {
    setUrlQuery(q);
    setQuery(q);
  }

  function apply(next: Partial<Filters>) {
    // Każda zmiana filtra wraca do pierwszej porcji wyników — inaczej
    // rozwinięta lista sugerowałaby, że nowy filtr zwrócił więcej trafień.
    const merged: Filters = {
      q: query,
      etap,
      autor,
      tag,
      limit: USTAWY_PAGE_SIZE,
      ...next,
    };

    startTransition(() => {
      router.replace(`${pathname}${buildUstawyQuery(merged)}`, { scroll: false });
    });
  }

  function clearFilters() {
    setQuery("");
    startTransition(() => {
      router.replace(pathname, { scroll: false });
    });
  }

  useEffect(() => {
    if (query === q) {
      return;
    }

    const timeout = setTimeout(() => {
      const merged: Filters = {
        ...EMPTY_USTAWY_FILTERS,
        q: query,
        etap,
        autor,
        tag,
      };

      startTransition(() => {
        router.replace(`${pathname}${buildUstawyQuery(merged)}`, { scroll: false });
      });
    }, 350);

    return () => clearTimeout(timeout);
  }, [query, q, etap, autor, tag, pathname, router]);

  return (
    <div className={`flex flex-col gap-3 ${isPending ? "opacity-70" : ""}`}>
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
            placeholder="Szukaj po tytule lub numerze druku"
            aria-label="Szukaj ustawy po tytule lub numerze druku"
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
            panelOpen || activeCount > 0
              ? "border-sejm-green/40 bg-sejm-green/15 text-sejm-green-light"
              : "border-white/10 bg-white/5 text-white/70 hover:border-white/20 hover:text-white"
          }`}
        >
          <SlidersHorizontal size={18} aria-hidden />
          {activeCount > 0 ? (
            <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-sejm-green text-[10px] font-bold text-white">
              {activeCount}
            </span>
          ) : null}
        </button>
      </div>

      {canClear ? (
        <button
          type="button"
          onClick={clearFilters}
          className="flex w-fit items-center gap-1 rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-semibold text-white/55 transition-colors hover:border-white/25 hover:text-white"
        >
          <X size={12} aria-hidden />
          Wyczyść filtry
        </button>
      ) : null}

      {panelOpen ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-navy-800/60 p-4">
          <PillGroup
            label="Etap"
            options={options.etapy}
            value={etap}
            onSelect={(value) => apply({ etap: value })}
          />
          <PillGroup
            label="Wnioskodawca"
            allLabel="Wszyscy"
            options={options.autorzy}
            value={autor}
            onSelect={(value) => apply({ autor: value })}
          />
          {options.tagi.length > 0 ? (
            <PillGroup
              label="Tagi"
              options={options.tagi}
              value={tag}
              onSelect={(value) => apply({ tag: value })}
            />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
