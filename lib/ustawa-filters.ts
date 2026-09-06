import {
  getStageLabel,
  isEarlyLegislativeStage,
  isVetoStage,
  resolveStageIndex,
} from "@/lib/ustawa";

export const USTAWY_PAGE_SIZE = 30;

/** Projekt leżący bez pierwszego czytania dłużej niż pół roku trafia do zamrażarki. */
export const USTAWY_FREEZER_DAYS = 180;

export const USTAWY_SPECIAL_FILTERS = ["zamrazarka", "zawetowane"] as const;

export type UstawySpecialFilter = (typeof USTAWY_SPECIAL_FILTERS)[number] | "";

export type UstawySortOrder = "desc" | "asc";

export type UstawyFilters = {
  q: string;
  etap: string;
  autor: string;
  tag: string;
  specjalne: UstawySpecialFilter;
  sort: UstawySortOrder;
  limit: number;
};

export const EMPTY_USTAWY_FILTERS: UstawyFilters = {
  q: "",
  etap: "",
  autor: "",
  tag: "",
  specjalne: "",
  sort: "desc",
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
  data_wplywu: string | null;
  tagi: string[] | null;
};

export type UstawyEmptyCopy = {
  title: string;
  description: string;
  tone: "default" | "zamrazarka" | "zawetowane";
};

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

function parseSpecialFilter(value: string): UstawySpecialFilter {
  return (USTAWY_SPECIAL_FILTERS as readonly string[]).includes(value)
    ? (value as Exclude<UstawySpecialFilter, "">)
    : "";
}

function parseSortOrder(value: string): UstawySortOrder {
  return value === "asc" ? "asc" : "desc";
}

/**
 * Data graniczna zamrażarki w formacie YYYY-MM-DD, żeby dało się porównać
 * z kolumną DATE w PostgREST przez `.lt('data_wplywu', cutoff)`.
 */
export function freezerCutoffIsoDate(now = new Date()): string {
  const cutoff = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - USTAWY_FREEZER_DAYS),
  );

  return cutoff.toISOString().slice(0, 10);
}

/**
 * Warunek PostgREST: brak nadanego biegu — wczesny etap projektu
 * albo nierozpatrzone weto / wniosek Prezydenta.
 */
export const USTAWY_FREEZER_STAGE_FILTER =
  'etap_legislacyjny.eq.projekt,etap_legislacyjny.ilike."%wpłyn%",etap_legislacyjny.ilike."%weto%"';

/**
 * Zamrażarka: wyłącznie bazowe projekty ustaw oraz przetrzymane wnioski
 * Prezydenta o ponowne rozpatrzenie. Reszta biurokracji odpada przez
 * wykluczenia i tę allowlistę — samo słowo "projekt" w tytule nie wystarcza.
 */
export const USTAWY_FREEZER_TITLE_FILTER =
  'tytul_oficjalny.ilike."%projekt ustawy%",tytul_oficjalny.ilike."%poselski projekt%",tytul_oficjalny.ilike."%wniosek prezydenta%",tytul_oficjalny.ilike."%ponowne rozpatrzenie%"';

export const USTAWY_FREEZER_TITLE_EXCLUDES = [
  "Uchwała Senatu w sprawie",
  "Sprawozdanie",
  "Informacja",
  "projekt uchwały",
  "Autopoprawka",
] as const;

/**
 * Zawetowane: oficjalna terminologia Sejmu i Prezydenta. Sprawdzamy etap
 * (status) i tytuł — "Wniosek Prezydenta o ponowne rozpatrzenie" nie musi
 * mieć słowa "weto". Te warunki nie łączą się z wykluczeniami zamrażarki.
 */
export const USTAWY_VETO_FILTER =
  'etap_legislacyjny.ilike."%weto%",etap_legislacyjny.ilike."%ponowne rozpatrzenie%",tytul_oficjalny.ilike."%ponowne rozpatrzenie%",tytul_oficjalny.ilike."%wniosek prezydenta%",tytul_oficjalny.ilike."%weto%"';

export function isVetoedDocument(row: Pick<UstawyFacetRow, "tytul_oficjalny" | "etap_legislacyjny">): boolean {
  const etap = row.etap_legislacyjny.toLowerCase();
  const title = row.tytul_oficjalny.toLowerCase();

  return (
    etap.includes("weto") ||
    etap.includes("ponowne rozpatrzenie") ||
    title.includes("ponowne rozpatrzenie") ||
    title.includes("wniosek prezydenta") ||
    title.includes("weto")
  );
}

function isPresidentialReconsiderationTitle(title: string): boolean {
  const value = title.toLowerCase();

  return value.includes("wniosek prezydenta") || value.includes("ponowne rozpatrzenie");
}

export function isFreezerEligibleTitle(title: string): boolean {
  const value = title.toLowerCase();

  if (USTAWY_FREEZER_TITLE_EXCLUDES.some((keyword) => value.includes(keyword.toLowerCase()))) {
    return false;
  }

  return (
    value.includes("projekt ustawy") ||
    value.includes("poselski projekt") ||
    isPresidentialReconsiderationTitle(title)
  );
}

export function parseUstawyFilters(params: RawSearchParams): UstawyFilters {
  const limit = Number(firstValue(params.limit));

  return {
    q: firstValue(params.q).slice(0, 120),
    etap: firstValue(params.etap).slice(0, 120),
    autor: firstValue(params.autor).slice(0, 120),
    tag: firstValue(params.tag).slice(0, 80),
    specjalne: parseSpecialFilter(firstValue(params.specjalne).slice(0, 40)),
    sort: parseSortOrder(firstValue(params.sort)),
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
    specjalne: params.get("specjalne") ?? undefined,
    sort: params.get("sort") ?? undefined,
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

  if (filters.specjalne) {
    params.set("specjalne", filters.specjalne);
  }

  if (filters.sort === "asc") {
    params.set("sort", "asc");
  }

  if (filters.limit !== USTAWY_PAGE_SIZE) {
    params.set("limit", String(filters.limit));
  }

  const query = params.toString();
  return query ? `?${query}` : "";
}

export function countActiveUstawyFilters(filters: UstawyFilters): number {
  return [filters.etap, filters.autor, filters.tag, filters.specjalne].filter(Boolean).length;
}

export function countUstawyFacetFilters(filters: UstawyFilters): number {
  return [filters.etap, filters.autor, filters.tag].filter(Boolean).length;
}

export function hasActiveUstawyFilters(filters: UstawyFilters): boolean {
  return Boolean(filters.q) || countActiveUstawyFilters(filters) > 0;
}

export function getUstawyEmptyCopy(filters: UstawyFilters): UstawyEmptyCopy {
  if (filters.specjalne === "zamrazarka") {
    return {
      title: "Brak ustaw w zamrażarce",
      description:
        "Wygląda na to, że Marszałek Sejmu pracuje na pełnych obrotach i żaden projekt nie czeka w kolejce.",
      tone: "zamrazarka",
    };
  }

  if (filters.specjalne === "zawetowane") {
    return {
      title: "Brak zawetowanych ustaw",
      description:
        "Prezydent nie zawetował w tej kadencji żadnego z wyświetlanych projektów.",
      tone: "zawetowane",
    };
  }

  return {
    title: "Brak wyników",
    description: "Zmień frazę wyszukiwania lub zdejmij część filtrów.",
    tone: "default",
  };
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

function isInFreezer(row: UstawyFacetRow, cutoff: string): boolean {
  if (!row.data_wplywu || row.data_wplywu >= cutoff) {
    return false;
  }

  if (!isFreezerEligibleTitle(row.tytul_oficjalny)) {
    return false;
  }

  const stalledVeto =
    isPresidentialReconsiderationTitle(row.tytul_oficjalny) ||
    isVetoStage(row.etap_legislacyjny);

  return isEarlyLegislativeStage(row.etap_legislacyjny) || stalledVeto;
}

function matchesSpecialFilter(row: UstawyFacetRow, filters: UstawyFilters): boolean {
  if (filters.specjalne === "zamrazarka") {
    return isInFreezer(row, freezerCutoffIsoDate());
  }

  if (filters.specjalne === "zawetowane") {
    return isVetoedDocument(row);
  }

  return true;
}

function matchesFacetFilters(
  row: UstawyFacetRow,
  filters: UstawyFilters,
  skip?: "etap" | "autor" | "tag",
): boolean {
  if (!matchesSpecialFilter(row, filters)) {
    return false;
  }

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
