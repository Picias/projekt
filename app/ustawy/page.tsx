import Link from "next/link";
import { Suspense } from "react";
import { ScrollText, SearchX, ShieldAlert, Snowflake } from "lucide-react";

import BackButton from "@/components/back-button";
import EmptyState from "@/components/EmptyState";
import UstawaCard from "@/components/ustawa-card";
import UstawyFilters, { UstawyFiltersFallback } from "@/components/ustawy-filters";
import WatchedUstawySection from "@/components/watched-ustawy-section";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Ustawa } from "@/lib/ustawa";
import {
  buildUstawyQuery,
  collectUstawyFilterOptions,
  countActiveUstawyFilters,
  freezerCutoffIsoDate,
  getUstawyEmptyCopy,
  parseUstawyFilters,
  printNumbersForArea,
  USTAWY_FREEZER_STAGE_FILTER,
  USTAWY_FREEZER_TITLE_EXCLUDES,
  USTAWY_FREEZER_TITLE_FILTER,
  USTAWY_PAGE_SIZE,
  USTAWY_VETO_FILTER,
  type UstawyFacetRow,
  type UstawyFilters as Filters,
} from "@/lib/ustawa-filters";

// Lista zmienia się po każdej synchronizacji druków, a filtry siedzą
// w adresie URL, więc czytamy ją na żądanie.
export const dynamic = "force-dynamic";

type UstawaListItem = Pick<
  Ustawa,
  "id" | "numer_druku" | "tytul_oficjalny" | "autor" | "data_wplywu" | "etap_legislacyjny" | "tagi"
>;

type UstawyPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * Fraza trafia do składni filtrów PostgREST, w której przecinki i nawiasy
 * rozdzielają warunki. Cudzysłów wokół wartości chroni zapytanie przed
 * rozjechaniem się na znakach interpunkcyjnych z tytułu druku.
 */
function escapeForFilter(value: string): string {
  return value.replace(/["\\]/g, " ").trim();
}

async function fetchUstawy(
  filters: Filters,
  areaPrintNumbers: string[] | null,
): Promise<{ ustawy: UstawaListItem[]; total: number }> {
  if (areaPrintNumbers && areaPrintNumbers.length === 0) {
    return { ustawy: [], total: 0 };
  }

  let query = supabaseAdmin
    .from("ustawy")
    .select(
      "id, numer_druku, tytul_oficjalny, autor, data_wplywu, etap_legislacyjny, tagi",
      { count: "exact" },
    );

  if (areaPrintNumbers) {
    query = query.in("numer_druku", areaPrintNumbers);
  }

  const phrase = escapeForFilter(filters.q);

  if (phrase) {
    query = query.or(
      `tytul_oficjalny.ilike."%${phrase}%",numer_druku.ilike."%${phrase}%"`,
    );
  }

  if (filters.etap) {
    query = query.eq("etap_legislacyjny", filters.etap);
  }

  if (filters.specjalne === "zamrazarka") {
    query = query
      .or(USTAWY_FREEZER_STAGE_FILTER)
      .or(USTAWY_FREEZER_TITLE_FILTER)
      .lt("data_wplywu", freezerCutoffIsoDate());

    for (const keyword of USTAWY_FREEZER_TITLE_EXCLUDES) {
      query = query.not("tytul_oficjalny", "ilike", `%${keyword}%`);
    }
  } else if (filters.specjalne === "zawetowane") {
    // Wyłącznie weto — bez wykluczeń zamrażarki, żeby "Wniosek Prezydenta
    // o ponowne rozpatrzenie" nie odpadał przez słowo "wniosek".
    query = query.or(USTAWY_VETO_FILTER);
  }

  if (filters.autor) {
    query = query.eq("autor", filters.autor);
  }

  if (filters.tag) {
    query = query.contains("tagi", [filters.tag]);
  }

  const { data, count } = await query
    .order("data_wplywu", { ascending: filters.sort === "asc", nullsFirst: false })
    .limit(filters.limit);

  return { ustawy: (data ?? []) as UstawaListItem[], total: count ?? 0 };
}

/**
 * Facety filtrów biorą unikalne etapy i autorów z całej tabeli, a nie z
 * aktualnej strony wyników — inaczej "Pokaż więcej" zmieniałoby dostępne opcje.
 */
async function fetchUstawyFacets(): Promise<UstawyFacetRow[]> {
  const { data } = await supabaseAdmin
    .from("ustawy")
    .select("numer_druku, tytul_oficjalny, autor, etap_legislacyjny, data_wplywu, tagi")
    .limit(8000);

  return (data ?? []) as UstawyFacetRow[];
}

function emptyStatePresentation(filters: Filters) {
  const copy = getUstawyEmptyCopy(filters);

  if (copy.tone === "zamrazarka") {
    return { ...copy, icon: Snowflake, iconClassName: "text-cyan-400/30" };
  }

  if (copy.tone === "zawetowane") {
    return { ...copy, icon: ShieldAlert, iconClassName: "text-red-400/30" };
  }

  return { ...copy, icon: SearchX, iconClassName: "text-emerald-400/25" };
}

function formatUstawyCount(total: number): string {
  if (total === 1) {
    return "1 ustawa";
  }

  const rest = total % 10;
  const teens = total % 100;
  const plural = rest >= 2 && rest <= 4 && (teens < 12 || teens > 14);

  return `${total} ${plural ? "ustawy" : "ustaw"}`;
}

function UstawyEmptyResults({ filters }: { filters: Filters }) {
  const { title, description, icon, iconClassName } = emptyStatePresentation(filters);

  return (
    <div className="rounded-2xl border border-dashed border-white/20 bg-white/5">
      <EmptyState
        icon={icon}
        iconClassName={iconClassName}
        title={title}
        description={description}
      />
      <div className="flex justify-center pb-6">
        <Link
          href="/ustawy"
          className="flex min-h-11 items-center rounded-xl bg-green-700 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-green-800"
        >
          Wyczyść wszystko
        </Link>
      </div>
    </div>
  );
}

export default async function UstawyPage({ searchParams }: UstawyPageProps) {
  const filters = parseUstawyFilters(await searchParams);

  // Obszar życia wymaga listy numerów z facetów, więc tylko wtedy zapytania
  // idą po kolei — bez niego oba lecą równolegle.
  let facetRows: UstawyFacetRow[];
  let result: { ustawy: UstawaListItem[]; total: number };

  if (filters.obszar) {
    facetRows = await fetchUstawyFacets();
    result = await fetchUstawy(filters, printNumbersForArea(facetRows, filters.obszar));
  } else {
    [result, facetRows] = await Promise.all([fetchUstawy(filters, null), fetchUstawyFacets()]);
  }

  const { ustawy, total } = result;
  const filterOptions = collectUstawyFilterOptions(facetRows, filters);

  const isBrowsing =
    Boolean(filters.q) || Boolean(filters.obszar) || countActiveUstawyFilters(filters) > 0;
  const hasMore = ustawy.length < total;

  return (
    <div className="flex w-full max-w-full flex-col gap-6 overflow-x-hidden px-5 py-5">
      <BackButton />

      <header>
        <h1 className="text-3xl font-bold leading-tight">Ustawy</h1>
        <p className="mt-2 text-base leading-relaxed text-white/80">
          Nowe prawo wyjaśnione po ludzku. Wybierz temat, który Cię dotyczy, i sprawdź, co
          się zmieni.
        </p>
      </header>

      <Suspense fallback={<UstawyFiltersFallback />}>
        <UstawyFilters options={filterOptions} />
      </Suspense>

      {/* Skrót do własnej listy przeszkadzałby w przeglądaniu wyników, więc
          pokazujemy go tylko przy pustym wyszukiwaniu. */}
      {isBrowsing ? null : <WatchedUstawySection />}

      <section>
        <div className="mb-3 flex items-center gap-2">
          <ScrollText size={16} className="text-emerald-300" aria-hidden />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
            {isBrowsing
              ? "Wyniki"
              : filters.sort === "asc"
                ? "Najstarsze druki"
                : "Najnowsze druki"}
          </h2>
          <span className="ml-auto text-sm text-white/75" aria-live="polite">
            {formatUstawyCount(total)}
          </span>
        </div>

        {total === 0 ? (
          isBrowsing ? (
            <UstawyEmptyResults filters={filters} />
          ) : (
            <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-5">
              <p className="text-sm font-semibold">Brak ustaw w bazie</p>
              <p className="mt-1 text-sm leading-relaxed text-white/55">
                Uruchom synchronizację pod adresem{" "}
                <Link href="/api/sync-ustawy" className="text-emerald-300 hover:underline">
                  /api/sync-ustawy
                </Link>
                , aby pobrać najnowsze druki z API Sejmu.
              </p>
            </div>
          )
        ) : (
          <div className="flex flex-col gap-3">
            {ustawy.map((ustawa) => (
              <UstawaCard key={ustawa.id} ustawa={ustawa} />
            ))}

            {hasMore ? (
              <Link
                href={`/ustawy${buildUstawyQuery({
                  ...filters,
                  limit: filters.limit + USTAWY_PAGE_SIZE,
                })}`}
                scroll={false}
                className="flex min-h-12 items-center justify-center rounded-2xl border border-white/20 bg-white/5 py-3 text-center text-base font-semibold text-white transition-colors hover:border-white/35 hover:bg-white/10"
              >
                Pokaż więcej ({total - ustawy.length})
              </Link>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
