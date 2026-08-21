import { getStageLabel, resolveStageIndex } from "@/lib/ustawa";

export const USTAWY_PAGE_SIZE = 30;

export type UstawyFilters = {
  q: string;
  etap: string;
  autor: string;
  tag: string;
  limit: number;
};

export const EMPTY_USTAWY_FILTERS: UstawyFilters = {
  q: "",
  etap: "",
  autor: "",
  tag: "",
  limit: USTAWY_PAGE_SIZE,
};

export type UstawyFilterOption = { value: string; label: string };

export type UstawyFilterOptions = {
  etapy: UstawyFilterOption[];
  autorzy: UstawyFilterOption[];
  tagi: UstawyFilterOption[];
};

export type UstawyFacetRow = {
  numer_druku: string;
  tytul_oficjalny: string;
  autor: string | null;
  etap_legislacyjny: string;
  tagi: string[] | null;
};

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function parseUstawyFilters(params: RawSearchParams): UstawyFilters {
  const limit = Number(firstValue(params.limit));

  return {
    q: firstValue(params.q).slice(0, 120),
    etap: firstValue(params.etap).slice(0, 120),
    autor: firstValue(params.autor).slice(0, 120),
    tag: firstValue(params.tag).slice(0, 80),
    limit:
      Number.isInteger(limit) && limit >= USTAWY_PAGE_SIZE && limit <= 600
        ? limit
        : USTAWY_PAGE_SIZE,
  };
}

export function parseUstawySearchParams(params: {
  get: (key: string) => string | null;
}): UstawyFilters {
  return parseUstawyFilters({
    q: params.get("q") ?? undefined,
    etap: params.get("etap") ?? undefined,
    autor: params.get("autor") ?? undefined,
    tag: params.get("tag") ?? undefined,
    limit: params.get("limit") ?? undefined,
  });
}

/**
 * Filtry żyją w adresie URL, więc wynik da się zalinkować i odświeżyć.
 * Wartości domyślnych nie zapisujemy, żeby "czyste" wejście na listę
 * zostawiało adres /ustawy bez ogona parametrów.
 */
export function buildUstawyQuery(filters: UstawyFilters): string {
  const params = new URLSearchParams();

  if (filters.q) {
    params.set("q", filters.q);
  }

  if (filters.etap) {
    params.set("etap", filters.etap);
  }

  if (filters.autor) {
    params.set("autor", filters.autor);
  }

  if (filters.tag) {
    params.set("tag", filters.tag);
  }

  if (filters.limit !== USTAWY_PAGE_SIZE) {
    params.set("limit", String(filters.limit));
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function countActiveUstawyFilters(filters: UstawyFilters): number {
  return [filters.etap, filters.autor, filters.tag].filter(Boolean).length;
}

export function hasActiveUstawyFilters(filters: UstawyFilters): boolean {
  return Boolean(filters.q) || countActiveUstawyFilters(filters) > 0;
}

function matchesSearch(row: UstawyFacetRow, query: string): boolean {
  const phrase = query.trim().toLowerCase();

  if (!phrase) {
    return true;
  }

  return (
    row.tytul_oficjalny.toLowerCase().includes(phrase) ||
    row.numer_druku.toLowerCase().includes(phrase)
  );
}

function matchesFacetFilters(
  row: UstawyFacetRow,
  filters: UstawyFilters,
  skip?: "etap" | "autor" | "tag",
): boolean {
  if (skip !== "etap" && filters.etap && row.etap_legislacyjny !== filters.etap) {
    return false;
  }

  if (skip !== "autor" && filters.autor && (row.autor ?? "") !== filters.autor) {
    return false;
  }

  if (skip !== "tag" && filters.tag && !(row.tagi ?? []).includes(filters.tag)) {
    return false;
  }

  return true;
}

function sortOptions(
  values: Iterable<string>,
  selected: string,
  compare: (a: string, b: string) => number,
  label: (value: string) => string,
): UstawyFilterOption[] {
  const unique = new Set(values);

  if (selected) {
    unique.add(selected);
  }

  return [...unique]
    .sort(compare)
    .map((value) => ({ value, label: label(value) }));
}

/**
 * Opcje każdego filtra zawężamy pozostałymi filtrami i frazą, żeby nie
 * proponować kombinacji bez ani jednej ustawy. Aktualnie wybrana wartość
 * zostaje na liście, inaczej aktywny filtr znikałby przy pustym wyniku.
 */
export function collectUstawyFilterOptions(
  rows: UstawyFacetRow[],
  filters: UstawyFilters,
): UstawyFilterOptions {
  const etapy = new Set<string>();
  const autorzy = new Set<string>();
  const tagi = new Set<string>();

  for (const row of rows) {
    if (!matchesSearch(row, filters.q)) {
      continue;
    }

    if (matchesFacetFilters(row, filters, "etap") && row.etap_legislacyjny) {
      etapy.add(row.etap_legislacyjny);
    }

    if (matchesFacetFilters(row, filters, "autor") && row.autor) {
      autorzy.add(row.autor);
    }

    if (matchesFacetFilters(row, filters, "tag")) {
      for (const tag of row.tagi ?? []) {
        if (tag) {
          tagi.add(tag);
        }
      }
    }
  }

  return {
    etapy: sortOptions(
      etapy,
      filters.etap,
      (a, b) => resolveStageIndex(a) - resolveStageIndex(b) || a.localeCompare(b, "pl"),
      getStageLabel,
    ),
    autorzy: sortOptions(
      autorzy,
      filters.autor,
      (a, b) => a.localeCompare(b, "pl"),
      (value) => value,
    ),
    tagi: sortOptions(
      tagi,
      filters.tag,
      (a, b) => a.localeCompare(b, "pl"),
      (value) => value,
    ),
  };
}
