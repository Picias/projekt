export type Ustawa = {
  id: number;
  numer_druku: string;
  tytul_oficjalny: string;
  autor: string | null;
  data_wplywu: string | null;
  etap_legislacyjny: string;
  pdf_url: string | null;
  tagi: string[] | null;
  opis_ludzki: string | null;
  kogo_dotyczy: string | null;
  co_zmienia: string | null;
  koszty_i_finansowanie: string | null;
  ai_w_skrocie: string | null;
  ai_kogo_dotyczy: string | null;
  ai_co_zmienia: string | null;
  ai_skad_pieniadze: string | null;
  liczba_obserwujacych: number;
};

export type UstawaAiSummary = Pick<
  Ustawa,
  "ai_w_skrocie" | "ai_kogo_dotyczy" | "ai_co_zmienia" | "ai_skad_pieniadze"
>;

/**
 * Podsumowanie z modelu jest kompletne dopiero po zapisie wszystkich czterech
 * pól — do tego czasu sekcja „Zrozum ustawę” pokazuje przycisk generowania.
 */
export function hasAiSummary(ustawa: UstawaAiSummary): boolean {
  return Boolean(
    ustawa.ai_w_skrocie ||
      ustawa.ai_kogo_dotyczy ||
      ustawa.ai_co_zmienia ||
      ustawa.ai_skad_pieniadze,
  );
}

export type StageKey =
  | "projekt"
  | "komisje"
  | "sejm"
  | "senat"
  | "prezydent"
  | "opublikowana";

export const LEGISLATIVE_STAGES: { key: StageKey; label: string; hint: string }[] = [
  { key: "projekt", label: "Projekt", hint: "Wpłynął do Sejmu" },
  { key: "komisje", label: "Komisje", hint: "Prace w komisjach" },
  { key: "sejm", label: "Sejm", hint: "Czytania i głosowanie" },
  { key: "senat", label: "Senat", hint: "Stanowisko Senatu" },
  { key: "prezydent", label: "Prezydent", hint: "Czeka na podpis" },
  { key: "opublikowana", label: "Dz.U.", hint: "Ogłoszona w Dzienniku Ustaw" },
];

const STAGE_KEYS = LEGISLATIVE_STAGES.map((stage) => stage.key);

/**
 * Etap zapisany w bazie może być kluczem kanonicznym albo oryginalną nazwą
 * etapu z API Sejmu (np. "III czytanie na posiedzeniu Sejmu").
 */
export function resolveStageKey(etap: string | null | undefined): StageKey {
  if (!etap) {
    return "projekt";
  }

  const value = etap.trim().toLowerCase();

  if ((STAGE_KEYS as string[]).includes(value)) {
    return value as StageKey;
  }

  if (value.includes("opublikow") || value.includes("ogłosz") || value.includes("dz.u.")) {
    return "opublikowana";
  }

  if (value.includes("prezydent") || value.includes("podpis") || value.includes("weto")) {
    return "prezydent";
  }

  if (value.includes("senat")) {
    return "senat";
  }

  // Nazwy etapów z API bywają mylące dla prostego dopasowania po słowie "Sejm":
  // "Projekt wpłynął do Sejmu" to dopiero wpływ druku, a nie prace w izbie.
  // Bez tego wyjątku każdy otwarty proces lądował na etapie "Sejm".
  if (
    value.startsWith("skierowanie") ||
    value.includes("wpłynął") ||
    value.includes("wpłynęło")
  ) {
    return "projekt";
  }

  if (value.includes("komisj")) {
    return "komisje";
  }

  // Samo skierowanie do czytania nie oznacza, że czytanie się odbyło.
  if (value.startsWith("skierowano")) {
    return "projekt";
  }

  if (value.includes("czytanie") || value.includes("głosowan") || value.includes("sejm")) {
    return "sejm";
  }

  return "projekt";
}

export function resolveStageIndex(etap: string | null | undefined): number {
  return STAGE_KEYS.indexOf(resolveStageKey(etap));
}

/**
 * Pierwsze głosowanie odbywa się dopiero na sali sejmowej, więc druki
 * z wcześniejszych etapów nie mają jeszcze żadnych głosów do pokazania.
 */
export function hasReachedVoting(etap: string | null | undefined): boolean {
  return resolveStageIndex(etap) >= STAGE_KEYS.indexOf("sejm");
}

export function getStageLabel(etap: string | null | undefined): string {
  const key = resolveStageKey(etap);
  return LEGISLATIVE_STAGES.find((stage) => stage.key === key)?.label ?? "Projekt";
}

const ustawaDateFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatUstawaDate(date: string | null | undefined): string {
  if (!date) {
    return "Brak danych";
  }

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return "Brak danych";
  }

  return ustawaDateFormatter.format(parsed);
}

const licznikFormatter = new Intl.NumberFormat("pl-PL");

export function formatLiczba(value: number): string {
  return licznikFormatter.format(value);
}

/**
 * Etykieta licznika obserwujących. Liczba pojedyncza wymaga innej formy
 * rzeczownika niż mnoga ("1 obserwujący" vs "1 204 obserwujących").
 */
export function formatObserwujacy(count: number): string {
  if (count <= 0) {
    return "Nikt jeszcze nie obserwuje";
  }

  if (count === 1) {
    return "1 obserwujący";
  }

  return `${formatLiczba(count)} obserwujących`;
}

/**
 * Oficjalne tytuły druków bywają bardzo długie — na listach pokazujemy skrót.
 */
export function shortenTitle(title: string, maxLength = 120): string {
  if (title.length <= maxLength) {
    return title;
  }

  return `${title.slice(0, maxLength).trimEnd()}…`;
}
