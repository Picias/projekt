import Link from "next/link";
import { ChevronLeft, ScrollText, SearchX } from "lucide-react";

import UstawaCard from "@/components/ustawa-card";
import UstawyFilters from "@/components/ustawy-filters";
import WatchedUstawySection from "@/components/watched-ustawy-section";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { Ustawa } from "@/lib/ustawa";
import {
  AUTHOR_FILTERS,
  buildUstawyQuery,
  countActiveUstawyFilters,
  NAMED_AUTHORS,
  parseUstawyFilters,
  USTAWY_PAGE_SIZE,
  type UstawyFilters as Filters,
} from "@/lib/ustawa-filters";

// Lista zmienia się po każdej synchronizacji druków, a filtry siedzą
// w adresie URL, więc czytamy ją na żądanie.
export const dynamic = "force-dynamic";

type UstawaListItem = Pick<
  Ustawa,
  "id" | "numer_druku" | "tytul_oficjalny" | "autor" | "data_wplywu" | "etap_legislacyjny"
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
): Promise<{ ustawy: UstawaListItem[]; total: number }> {
  let query = supabaseAdmin
    .from("ustawy")
    .select(
      "id, numer_druku, tytul_oficjalny, autor, data_wplywu, etap_legislacyjny",
      { count: "exact" },
    );

  const phrase = escapeForFilter(filters.q);

  if (phrase) {
    query = query.or(
      `tytul_oficjalny.ilike."%${phrase}%",numer_druku.ilike."%${phrase}%"`,
    );
  }

  if (filters.etap) {
    query = query.eq("etap_legislacyjny", filters.etap);
  }

  const authorFilter = AUTHOR_FILTERS.find((filter) => filter.key === filters.autor);

  if (authorFilter && authorFilter.autorzy.length > 0) {
    query = query.in("autor", authorFilter.autorzy);
  } else if (authorFilter) {
    // "Inne" to dopełnienie nazwanych grup razem z drukami bez ustalonego autora.
    const named = NAMED_AUTHORS.map((autor) => `"${autor}"`).join(",");
    query = query.or(`autor.is.null,autor.not.in.(${named})`);
  }

  if (filters.tag) {
    query = query.contains("tagi", [filters.tag]);
  }

  const { data, count } = await query
    .order("data_wplywu", { ascending: false, nullsFirst: false })
    .limit(filters.limit);

  return { ustawy: (data ?? []) as UstawaListItem[], total: count ?? 0 };
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

export default async function UstawyPage({ searchParams }: UstawyPageProps) {
  const filters = parseUstawyFilters(await searchParams);
  const { ustawy, total } = await fetchUstawy(filters);

  const isBrowsing = Boolean(filters.q) || countActiveUstawyFilters(filters) > 0;
  const hasMore = ustawy.length < total;

  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <Link
        href="/"
        className="flex w-fit items-center gap-1 text-sm text-white/70 transition-colors hover:text-white"
      >
        <ChevronLeft size={18} aria-hidden />
        Wróć
      </Link>

      <header>
        <h1 className="text-3xl font-bold leading-tight">Śledzone ustawy</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/60">
          Projekty ustaw wyjaśnione prostym językiem — bez prawniczego żargonu.
        </p>
      </header>

      <UstawyFilters filters={filters} />

      {/* Skrót do własnej listy przeszkadzałby w przeglądaniu wyników, więc
          pokazujemy go tylko przy pustym wyszukiwaniu. */}
      {isBrowsing ? null : <WatchedUstawySection />}

      <section>
        <div className="mb-3 flex items-center gap-2">
          <ScrollText size={16} className="text-emerald-300" aria-hidden />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-white/70">
            {isBrowsing ? "Wyniki" : "Najnowsze druki"}
          </h2>
          <span className="ml-auto text-xs text-white/45" aria-live="polite">
            {formatUstawyCount(total)}
          </span>
        </div>

        {total === 0 ? (
          isBrowsing ? (
            <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-6 text-center">
              <SearchX size={26} className="mx-auto text-white/35" aria-hidden />
              <p className="mt-3 text-sm font-semibold">Brak wyników</p>
              <p className="mt-1 text-sm leading-relaxed text-white/55">
                Zmień frazę wyszukiwania lub zdejmij część filtrów.
              </p>
              <Link
                href="/ustawy"
                className="mt-4 inline-block rounded-xl bg-sejm-green px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-sejm-green-light"
              >
                Wyczyść wszystko
              </Link>
            </div>
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
                className="rounded-2xl border border-white/10 bg-white/5 py-3 text-center text-sm font-semibold text-white/75 transition-colors hover:border-white/25 hover:text-white"
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
