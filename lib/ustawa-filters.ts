import type { StageKey } from "@/lib/ustawa";

export const USTAWY_PAGE_SIZE = 30;

export type StageFilter = { key: StageKey; label: string };

/**
 * Skrót przez etapy, na których druk jest już przedmiotem realnej decyzji.
 * Wcześniejsze etapy ("projekt", "komisje") mieszczą się w opcji "Wszystkie".
 */
export const STAGE_FILTERS: StageFilter[] = [
  { key: "sejm", label: "Sejm" },
  { key: "senat", label: "Senat" },
  { key: "prezydent", label: "Prezydent" },
  { key: "opublikowana", label: "Opublikowane" },
];

export type AuthorFilter = { key: string; label: string; autorzy: string[] };

/**
 * Wnioskodawcę trzymamy w bazie jako pełną nazwę z API Sejmu, a filtr operuje
 * na kilku czytelnych grupach. "Inne" to dopełnienie zbioru poniższych nazw
 * razem z drukami, dla których autora nie udało się ustalić.
 */
export const AUTHOR_FILTERS: AuthorFilter[] = [
  { key: "rzad", label: "Rząd", autorzy: ["Rada Ministrów"] },
  { key: "poslowie", label: "Posłowie", autorzy: ["Grupa posłów"] },
  { key: "prezydent", label: "Prezydent", autorzy: ["Prezydent RP"] },
  { key: "obywatele", label: "Obywatele", autorzy: ["Inicjatywa obywatelska"] },
  { key: "inne", label: "Inne", autorzy: [] },
];

export const NAMED_AUTHORS = AUTHOR_FILTERS.flatMap((filter) => filter.autorzy);

// Placeholder do czasu, aż tagi zacznie nadawać model — kolumna tagi jest pusta,
// więc wybranie któregokolwiek z nich zwróci na razie zero wyników.
export const TAG_FILTERS = ["Edukacja", "Zdrowie", "Gospodarka", "Podatki"];

export type UstawyFilters = {
  q: string;
  etap: StageKey | "";
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

type RawSearchParams = Record<string, string | string[] | undefined>;

function firstValue(value: string | string[] | undefined): string {
  return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
}

export function parseUstawyFilters(params: RawSearchParams): UstawyFilters {
  const etap = firstValue(params.etap);
  const autor = firstValue(params.autor);
  const tag = firstValue(params.tag);
  const limit = Number(firstValue(params.limit));

  return {
    q: firstValue(params.q).slice(0, 120),
    etap: STAGE_FILTERS.some((stage) => stage.key === etap) ? (etap as StageKey) : "",
    autor: AUTHOR_FILTERS.some((filter) => filter.key === autor) ? autor : "",
    tag: TAG_FILTERS.includes(tag) ? tag : "",
    limit:
      Number.isInteger(limit) && limit >= USTAWY_PAGE_SIZE && limit <= 600
        ? limit
        : USTAWY_PAGE_SIZE,
  };
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
