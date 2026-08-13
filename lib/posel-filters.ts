import { getClubLabel } from "@/lib/club-colors";
import { normalizeSearchText, type PoselProfil } from "@/lib/posel";

export type FilterKey = "klub" | "okreg" | "wyksztalcenie" | "zawod";

export type Filters = Record<FilterKey, string>;

export const FILTER_ORDER: FilterKey[] = ["klub", "okreg", "wyksztalcenie", "zawod"];

export const FILTER_LABELS: Record<FilterKey, string> = {
  klub: "Klub / partia",
  okreg: "Okręg wyborczy",
  wyksztalcenie: "Wykształcenie",
  zawod: "Zawód",
};

export const EMPTY_FILTERS: Filters = {
  klub: "",
  okreg: "",
  wyksztalcenie: "",
  zawod: "",
};

export function getFilterValue(posel: PoselProfil, key: FilterKey): string | null {
  switch (key) {
    case "klub":
      return getClubLabel(posel.partia);
    case "okreg":
      return posel.okreg_wyborczy;
    case "wyksztalcenie":
      return posel.wyksztalcenie;
    case "zawod":
      return posel.zawod;
  }
}

export function matchesQuery(posel: PoselProfil, query: string): boolean {
  const normalized = normalizeSearchText(query).trim();

  if (!normalized) {
    return true;
  }

  const name = normalizeSearchText(posel.imie_nazwisko);

  // Każdy fragment osobno, więc "kowalski anna" działa jak "anna kowalski".
  return normalized
    .split(/\s+/)
    .every((token) => name.includes(token));
}

// skip pozwala policzyć dostępne opcje jednego filtra bez zawężania go samym sobą.
export function matchesFilters(
  posel: PoselProfil,
  filters: Filters,
  skip?: FilterKey,
): boolean {
  return FILTER_ORDER.every((key) => {
    if (key === skip || !filters[key]) {
      return true;
    }

    return getFilterValue(posel, key) === filters[key];
  });
}

export function filterPoslowie(
  poslowie: PoselProfil[],
  query: string,
  filters: Filters,
): PoselProfil[] {
  return poslowie.filter(
    (posel) => matchesQuery(posel, query) && matchesFilters(posel, filters),
  );
}

// Opcje każdego filtra zawężamy pozostałymi filtrami i frazą, żeby nie
// proponować kombinacji, które nie mają ani jednego posła. Aktualnie wybrana
// wartość zostaje na liście, inaczej select pokazywałby "Wszystkie" przy
// aktywnym filtrze.
export function collectFilterOptions(
  poslowie: PoselProfil[],
  query: string,
  filters: Filters,
): Record<FilterKey, string[]> {
  const options = {} as Record<FilterKey, string[]>;

  for (const key of FILTER_ORDER) {
    const values = new Set<string>();

    for (const posel of poslowie) {
      if (!matchesQuery(posel, query) || !matchesFilters(posel, filters, key)) {
        continue;
      }

      const value = getFilterValue(posel, key);

      if (value) {
        values.add(value);
      }
    }

    if (filters[key]) {
      values.add(filters[key]);
    }

    options[key] = [...values].sort((a, b) => a.localeCompare(b, "pl"));
  }

  return options;
}

export function countActiveFilters(filters: Filters): number {
  return FILTER_ORDER.filter((key) => filters[key]).length;
}
