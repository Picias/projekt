import { isVetoStage, resolveStageKey, type Ustawa } from "@/lib/ustawa";

/**
 * „Impact Meter” — odpowiedź na pytanie obywatela: czego ten projekt dotyczy
 * w moim codziennym życiu, czy sięga do mojego portfela i jak blisko jest
 * wejścia w życie. Wszystko liczymy deterministycznie z danych druku, żeby
 * wskaźnik działał także dla projektów bez podsumowania AI.
 */

export const IMPACT_AREA_KEYS = [
  "podatki",
  "zdrowie",
  "edukacja",
  "praca",
  "rodzina",
  "mieszkanie",
  "energia",
  "transport",
  "rolnictwo",
  "srodowisko",
  "wolnosci",
  "bezpieczenstwo",
  "samorzad",
  "cyfryzacja",
  "panstwo",
] as const;

/** Jedyny obszar, który nie jest dopasowaniem z tekstu — dostaje go projekt bez żadnej kategorii. */
export const FALLBACK_IMPACT_AREA_KEY: ImpactAreaKey = "panstwo";

export const MATCHABLE_IMPACT_AREA_KEYS = IMPACT_AREA_KEYS.filter(
  (key) => key !== FALLBACK_IMPACT_AREA_KEY,
);

export type ImpactAreaKey = (typeof IMPACT_AREA_KEYS)[number];

export type ImpactArea = {
  key: ImpactAreaKey;
  label: string;
  /** Jedno zdanie „co to znaczy dla mnie”, pokazywane przy tagu w szczegółach druku. */
  everyday: string;
  /** Obszar, w którym zmiany zwykle przekładają się na domowy budżet. */
  wallet: boolean;
  /** Fragmenty wyrażeń regularnych dopasowywane od początku słowa. */
  patterns: string[];
};

const L = "a-ząćęłńóśźż";

export const IMPACT_AREAS: Record<ImpactAreaKey, ImpactArea> = {
  podatki: {
    key: "podatki",
    label: "Podatki i opłaty",
    everyday: "Może zmienić to, ile płacisz państwu — w podatkach, opłatach lub cenach.",
    wallet: true,
    patterns: ["podat", "pit", "cit", "vat", "akcyz", "danin", "opłat", "skarbow", "celn", "cło", "ceł", "ulg"],
  },
  zdrowie: {
    key: "zdrowie",
    label: "Zdrowie",
    everyday: "Dotyczy leczenia, kolejek do lekarzy, leków lub opieki w szpitalu.",
    wallet: false,
    patterns: ["zdrow", "pacjent", "lecz", "szpital", "lek", "refundac", "medycz", "ratownic", "farmaceut", "aptek", "psychiatr", "chorob", "chory", "chorych", "chorzy"],
  },
  edukacja: {
    key: "edukacja",
    label: "Edukacja",
    everyday: "Dotyczy szkół, przedszkoli, studiów lub pracy nauczycieli.",
    wallet: false,
    patterns: ["oświat", "szkoł", "szkol", "edukac", "uczni", "uczeń", "student", "nauczyciel", "uczel", "przedszkol", "kształc", "szkolnictw"],
  },
  praca: {
    key: "praca",
    label: "Praca i emerytury",
    everyday: "Może wpłynąć na Twoją pensję, umowę o pracę, emeryturę lub rentę.",
    wallet: true,
    patterns: [
      "prac",
      "wynagrodz",
      "zatrudni",
      "emeryt",
      "rent",
      "zasił",
      "urlop",
      "bezroboci",
      "płac",
      `ubezpiecze[${L}]* społeczn`,
      `związk[${L}]* zawodow`,
    ],
  },
  rodzina: {
    key: "rodzina",
    label: "Rodzina i opieka",
    everyday: "Dotyczy dzieci, rodziców, seniorów lub osób z niepełnosprawnościami.",
    wallet: true,
    patterns: [
      "rodzin",
      "dziec",
      "macierzyń",
      "rodzicielsk",
      "alimen",
      "piecz",
      "senior",
      "niepełnospraw",
      "opiekun",
      "żłob",
      `świadcze[${L}]* wychowawcz`,
    ],
  },
  mieszkanie: {
    key: "mieszkanie",
    label: "Mieszkanie",
    everyday: "Może zmienić koszty najmu, kredytu, budowy domu lub zasady w bloku.",
    wallet: true,
    patterns: ["mieszka", "lokator", "najm", "budowl", "budown", "nieruchomo", "czynsz", "spółdziel", "deweloper", "hipote", `planowani[${L}]* przestrzenn`],
  },
  energia: {
    key: "energia",
    label: "Energia i rachunki",
    everyday: "Może wpłynąć na Twoje rachunki za prąd, gaz, ogrzewanie lub paliwo.",
    wallet: true,
    patterns: ["energ", "prąd", "gaz", "ciepł", "paliw", "węgl", "elektroenerget", "taryf", "odnawialn", "jądrow", "atomow"],
  },
  transport: {
    key: "transport",
    label: "Transport i drogi",
    everyday: "Dotyczy kierowców, pasażerów komunikacji, dróg lub kolei.",
    wallet: false,
    patterns: ["transport", "drogow", `drog[${L}]* publiczn`, "autostrad", "kolej", "pojazd", "kierow", "lotnic", "lotnisk", "żeglug", "przewoz", "przewóz", "rower", "parking"],
  },
  rolnictwo: {
    key: "rolnictwo",
    label: "Rolnictwo i żywność",
    everyday: "Dotyczy rolników, cen i jakości żywności lub obszarów wiejskich.",
    wallet: false,
    patterns: ["roln", "wsi", "wieś", "żywno", "hodowl", "weterynar", "leśn", "las", "łowiec", "nawoz", `gospodarstw[${L}]* roln`],
  },
  srodowisko: {
    key: "srodowisko",
    label: "Środowisko",
    everyday: "Dotyczy powietrza, wody, odpadów, klimatu lub ochrony przyrody.",
    wallet: false,
    patterns: ["środowisk", "klimat", "emisj", "odpad", "recykl", "przyrod", "wód", "wod", "powietrz", "smog", `ochron[${L}]* zwierząt`, "zwierz"],
  },
  wolnosci: {
    key: "wolnosci",
    label: "Prawa i wolności obywatelskie",
    everyday: "Dotyczy Twoich praw — sądów, wyborów, wolności słowa lub równego traktowania.",
    wallet: false,
    patterns: ["karn", "sąd", "sędzi", "prokurat", "trybunał", "konstytuc", "wolnoś", "zgromadze", "wybor", "referend", "dyskrymin", "prasow", "medi", "religi", "wyznani", "aborc", "ciąż", `rzeczni[${L}]* praw`, `związk[${L}]* partnersk`, "cywiln"],
  },
  bezpieczenstwo: {
    key: "bezpieczenstwo",
    label: "Bezpieczeństwo",
    everyday: "Dotyczy wojska, policji, granic lub ochrony ludności w kryzysie.",
    wallet: false,
    patterns: ["obron", "wojsk", "policj", "bezpieczeń", "granic", "straż", "kryzys", "cudzoziem", "broń", "broni", "służb", "żołnier", `ochron[${L}]* ludności`],
  },
  samorzad: {
    key: "samorzad",
    label: "Twoja gmina",
    everyday: "Dotyczy tego, jak działa Twoja gmina, powiat lub województwo.",
    wallet: false,
    patterns: ["samorząd", "gmin", "powiat", "wojewódz", "sołe", "metropol"],
  },
  cyfryzacja: {
    key: "cyfryzacja",
    label: "Sprawy cyfrowe",
    everyday: "Dotyczy e-usług, internetu, Twoich danych osobowych lub sztucznej inteligencji.",
    wallet: false,
    patterns: ["cyfr", "informatyz", "internet", "telekomunik", "elektroniczn", "mobywatel", `dan[${L}]* osobow`, `sztuczn[${L}]* inteligenc`],
  },
  panstwo: {
    key: "panstwo",
    label: "Sprawy państwowe",
    everyday: "Dotyczy organizacji państwa, urzędów albo przepisów, które nie wpadają w żaden konkretny obszar codziennego życia.",
    wallet: false,
    patterns: [],
  },
};

// Granica słowa liczona po polskich literach — \b w JS zna tylko ASCII,
// przez co "lek" trafiałby w "elektroniczny".
const AREA_REGEX: Partial<Record<ImpactAreaKey, RegExp>> = Object.fromEntries(
  MATCHABLE_IMPACT_AREA_KEYS.flatMap((key) => {
    const patterns = IMPACT_AREAS[key].patterns;

    if (patterns.length === 0) {
      return [];
    }

    return [[key, new RegExp(`(?:^|[^\\p{L}])(?:${patterns.join("|")})`, "giu")]];
  }),
);

// Człon z wnioskodawcą ("Obywatelski projekt ustawy") nie mówi nic o temacie.
const AUTHOR_PREFIX =
  /^.*?projekt\s+(?:ustawy|uchwały)\s+/i;

function countMatches(text: string, key: ImpactAreaKey): number {
  const regex = AREA_REGEX[key];

  if (!regex) {
    return 0;
  }

  regex.lastIndex = 0;
  return text.match(regex)?.length ?? 0;
}

function tagToAreaKey(tag: string): ImpactAreaKey | null {
  const value = tag.trim().toLowerCase();

  for (const key of IMPACT_AREA_KEYS) {
    if (value === key || value === IMPACT_AREAS[key].label.toLowerCase()) {
      return key;
    }
  }

  return null;
}

export type ImpactSource = Pick<Ustawa, "tytul_oficjalny"> &
  Partial<Pick<Ustawa, "tagi" | "ai_w_skrocie" | "ai_kogo_dotyczy" | "ai_co_zmienia">>;

const MAX_AREAS = 3;

/**
 * Obszary życia, których dotyczy druk — najmocniejsze dopasowania pierwsze.
 * Tagi zapisane przez warstwę AI mają pierwszeństwo, tytuł waży więcej niż
 * treść streszczenia, a samo streszczenie musi trafić co najmniej dwa razy,
 * żeby pojedyncze słowo nie doklejało przypadkowego obszaru.
 * Projekt bez żadnego dopasowania dostaje obszar „Sprawy państwowe”.
 */
export function detectImpactAreas(source: ImpactSource, limit = MAX_AREAS): ImpactArea[] {
  const scores = new Map<ImpactAreaKey, number>();
  const title = source.tytul_oficjalny.replace(AUTHOR_PREFIX, "").toLowerCase();
  const summary = [source.ai_w_skrocie, source.ai_kogo_dotyczy, source.ai_co_zmienia]
    .filter(Boolean)
    .join("\n")
    .toLowerCase();

  for (const tag of source.tagi ?? []) {
    const key = tagToAreaKey(tag);

    if (key && key !== FALLBACK_IMPACT_AREA_KEY) {
      scores.set(key, (scores.get(key) ?? 0) + 10);
    }
  }

  for (const key of MATCHABLE_IMPACT_AREA_KEYS) {
    const titleHits = countMatches(title, key);
    const summaryHits = summary ? countMatches(summary, key) : 0;
    const score = titleHits * 3 + (summaryHits >= 2 ? summaryHits : 0);

    if (score > 0) {
      scores.set(key, (scores.get(key) ?? 0) + score);
    }
  }

  const areas = [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || IMPACT_AREA_KEYS.indexOf(a[0]) - IMPACT_AREA_KEYS.indexOf(b[0]))
    .slice(0, limit)
    .map(([key]) => IMPACT_AREAS[key]);

  if (areas.length > 0 || limit <= 0) {
    return areas;
  }

  return [IMPACT_AREAS[FALLBACK_IMPACT_AREA_KEY]];
}

export function matchesImpactArea(source: ImpactSource, key: ImpactAreaKey): boolean {
  return detectImpactAreas(source, IMPACT_AREA_KEYS.length).some((area) => area.key === key);
}

export function isImpactAreaKey(value: unknown): value is ImpactAreaKey {
  return typeof value === "string" && (IMPACT_AREA_KEYS as readonly string[]).includes(value);
}

export type WalletImpact = {
  level: "direct" | "indirect" | "unknown";
  label: string;
};

export function getWalletImpact(areas: ImpactArea[]): WalletImpact {
  const substantive = areas.filter((area) => area.key !== FALLBACK_IMPACT_AREA_KEY);

  if (substantive.some((area) => area.wallet)) {
    return { level: "direct", label: "Może zmienić Twoje wydatki lub dochody" };
  }

  if (substantive.length > 0) {
    return { level: "indirect", label: "Nie widać bezpośredniego wpływu na portfel" };
  }

  return { level: "unknown", label: "Za mało danych, by ocenić wpływ na portfel" };
}

export type LawProximity = {
  /** 0 — zatrzymana, 1 — daleko, 2 — blisko, 3 — obowiązuje lub za chwilę. */
  level: 0 | 1 | 2 | 3;
  label: string;
  hint: string;
};

/** Jak blisko projekt jest realnej zmiany w życiu obywatela. */
export function getLawProximity(etap: string | null | undefined): LawProximity {
  if (isVetoStage(etap)) {
    return {
      level: 0,
      label: "Zatrzymana",
      hint: "Prezydent zawetował ustawę. Sejm może jeszcze odrzucić weto.",
    };
  }

  switch (resolveStageKey(etap)) {
    case "projekt":
      return {
        level: 1,
        label: "Jeszcze daleko",
        hint: "To na razie propozycja — posłowie nie zaczęli nad nią pracować.",
      };
    case "komisje":
      return {
        level: 1,
        label: "Jeszcze daleko",
        hint: "Posłowie w komisjach dopracowują szczegóły projektu.",
      };
    case "sejm":
      return {
        level: 2,
        label: "Blisko",
        hint: "Sejm czyta i głosuje projekt — to dobry moment, by zabrać głos.",
      };
    case "senat":
      return {
        level: 2,
        label: "Blisko",
        hint: "Sejm już uchwalił ustawę, teraz sprawdza ją Senat.",
      };
    case "prezydent":
      return {
        level: 3,
        label: "Bardzo blisko",
        hint: "Ustawa czeka na podpis Prezydenta.",
      };
    case "opublikowana":
      return {
        level: 3,
        label: "Już obowiązuje",
        hint: "Ustawa została ogłoszona — obowiązuje lub wkrótce wejdzie w życie.",
      };
  }
}

export type ImpactSummary = {
  areas: ImpactArea[];
  wallet: WalletImpact;
  proximity: LawProximity;
};

export function buildImpactSummary(
  source: ImpactSource & Pick<Ustawa, "etap_legislacyjny">,
): ImpactSummary {
  const areas = detectImpactAreas(source);

  return {
    areas,
    wallet: getWalletImpact(areas),
    proximity: getLawProximity(source.etap_legislacyjny),
  };
}
