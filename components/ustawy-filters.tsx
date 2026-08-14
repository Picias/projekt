"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, SlidersHorizontal, X } from "lucide-react";

import {
  AUTHOR_FILTERS,
  buildUstawyQuery,
  countActiveUstawyFilters,
  STAGE_FILTERS,
  TAG_FILTERS,
  USTAWY_PAGE_SIZE,
  type UstawyFilters as Filters,
} from "@/lib/ustawa-filters";

type PillGroupProps = {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onSelect: (value: string) => void;
};

function PillGroup({ label, options, value, onSelect }: PillGroupProps) {
  return (
    <fieldset>
      <legend className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/45">
        {label}
      </legend>
      <div className="flex flex-wrap gap-2">
        {options.map((option) => {
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

const STAGE_OPTIONS = [
  { value: "", label: "Wszystkie" },
  ...STAGE_FILTERS.map((stage) => ({ value: stage.key, label: stage.label })),
];

const AUTHOR_OPTIONS = [
  { value: "", label: "Wszyscy" },
  ...AUTHOR_FILTERS.map((filter) => ({ value: filter.key, label: filter.label })),
];

const TAG_OPTIONS = [
  { value: "", label: "Wszystkie" },
  ...TAG_FILTERS.map((tag) => ({ value: tag, label: tag })),
];

export default function UstawyFilters({ filters }: { filters: Filters }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [query, setQuery] = useState(filters.q);
  const [urlQuery, setUrlQuery] = useState(filters.q);
  const [panelOpen, setPanelOpen] = useState(
    () => countActiveUstawyFilters(filters) > 0,
  );

  const { q, etap, autor, tag } = filters;
  const activeCount = countActiveUstawyFilters(filters);

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
      q,
      etap,
      autor,
      tag,
      limit: USTAWY_PAGE_SIZE,
      ...next,
    };

    startTransition(() => {
      router.replace(`/ustawy${buildUstawyQuery(merged)}`, { scroll: false });
    });
  }

  useEffect(() => {
    if (query === q) {
      return;
    }

    const timeout = setTimeout(() => {
      const merged: Filters = { q: query, etap, autor, tag, limit: USTAWY_PAGE_SIZE };

      startTransition(() => {
        router.replace(`/ustawy${buildUstawyQuery(merged)}`, { scroll: false });
      });
    }, 350);

    return () => clearTimeout(timeout);
  }, [query, q, etap, autor, tag, router]);

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

      {panelOpen ? (
        <div className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-navy-800/60 p-4">
          <PillGroup
            label="Etap"
            options={STAGE_OPTIONS}
            value={etap}
            onSelect={(value) => apply({ etap: value as Filters["etap"] })}
          />
          <PillGroup
            label="Wnioskodawca"
            options={AUTHOR_OPTIONS}
            value={autor}
            onSelect={(value) => apply({ autor: value })}
          />
          <PillGroup
            label="Tagi"
            options={TAG_OPTIONS}
            value={tag}
            onSelect={(value) => apply({ tag: value })}
          />

          <p className="text-[11px] leading-relaxed text-white/35">
            Tagi tematyczne będzie nadawać automatyczna analiza treści druku —
            dziś żaden druk nie ma jeszcze przypisanego tagu.
          </p>

          {activeCount > 0 ? (
            <button
              type="button"
              onClick={() => apply({ etap: "", autor: "", tag: "" })}
              className="w-fit text-xs font-semibold text-sejm-green-light transition-colors hover:text-white"
            >
              Wyczyść filtry
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
