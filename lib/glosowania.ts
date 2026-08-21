export const GLOSY_POSLA = ["ZA", "PRZECIW", "WSTRZYMAL_SIE", "NIEOBECNY"] as const;

export type GlosPosla = (typeof GLOSY_POSLA)[number];

export type Glosowanie = {
  id: number;
  ustawa_id: number;
  sitting: number;
  numer_glosowania: number;
  tytul: string;
  temat: string | null;
  data_glosowania: string | null;
  za: number;
  przeciw: number;
  wstrzymalo_sie: number;
  nieobecni: number;
};

export type GlosPoslaRow = {
  posel_id: number;
  klub: string | null;
  glos: GlosPosla;
};

export function isGlosPosla(value: unknown): value is GlosPosla {
  return typeof value === "string" && (GLOSY_POSLA as readonly string[]).includes(value);
}

/**
 * API Sejmu opisuje głos wartościami z enuma VoteValue. Trzy pierwsze mają
 * bezpośrednie odpowiedniki, a NO_VOTE (obecny, ale nie zagłosował) i ABSENT
 * (nieobecny) zlewamy w NIEOBECNY — na liście imiennej i tak pokazujemy je
 * tak samo. VOTE_VALID i PRESENT występują tylko w głosowaniach nad listami
 * i przy sprawdzaniu kworum, których nie wiążemy z drukami.
 */
export function mapVoteValue(vote: string | null | undefined): GlosPosla {
  switch (vote) {
    case "YES":
      return "ZA";
    case "NO":
      return "PRZECIW";
    case "ABSTAIN":
      return "WSTRZYMAL_SIE";
    default:
      return "NIEOBECNY";
  }
}

// Etykieta i akcent głosu w jednym miejscu, żeby lista imienna, sekcja
// obserwowanych posłów i kafelki podsumowania nie rozjechały się kolorami.
export const GLOS_INFO: Record<
  GlosPosla,
  { label: string; badge: string; akcent: string; pasek: string }
> = {
  ZA: {
    label: "Za",
    badge: "bg-emerald-400/15 text-emerald-300 ring-emerald-400/25",
    akcent: "text-emerald-300",
    pasek: "bg-emerald-400",
  },
  PRZECIW: {
    label: "Przeciw",
    badge: "bg-red-400/15 text-red-300 ring-red-400/25",
    akcent: "text-red-300",
    pasek: "bg-red-400",
  },
  WSTRZYMAL_SIE: {
    label: "Wstrzymał się",
    badge: "bg-amber-300/15 text-amber-200 ring-amber-300/25",
    akcent: "text-amber-200",
    pasek: "bg-amber-300",
  },
  NIEOBECNY: {
    label: "Nieobecny",
    badge: "bg-white/10 text-white/55 ring-white/15",
    akcent: "text-white/55",
    pasek: "bg-white/25",
  },
};

/**
 * Numery druków w tytułach głosowań pojawiają się w kilku wariantach:
 * "(druk nr 1234)", "(druki nr 2634, 2644 i 2644-A)", "druku nr 1234".
 * Wyciągamy wszystkie numery z takiego fragmentu, zachowując kolejność —
 * pierwszy pasujący do naszej bazy wskazuje ustawę.
 */
export function extractDrukNumbers(text: string | null | undefined): string[] {
  if (!text) {
    return [];
  }

  const numbers: string[] = [];
  const seen = new Set<string>();
  const fragmenty = text.matchAll(/druk(?:u|i|ach|ów|ami)?\s+nr\s*([0-9][0-9,\s\-A-Za-z]*)/gi);

  for (const fragment of fragmenty) {
    // Wewnątrz fragmentu numery rozdziela przecinek albo spójnik "i".
    for (const match of fragment[1].matchAll(/\d+(?:-[A-Za-z]+)?/g)) {
      const numer = match[0];

      if (!seen.has(numer)) {
        seen.add(numer);
        numbers.push(numer);
      }
    }
  }

  return numbers;
}

/**
 * Autopoprawki mają numer z literą ("2644-A"), a w tabeli ustawy trzymamy
 * druk macierzysty — dlatego obok pełnego numeru sprawdzamy też jego rdzeń.
 */
export function drukLookupKeys(numer: string): string[] {
  const rdzen = numer.split("-")[0];

  return rdzen === numer ? [numer] : [numer, rdzen];
}

const dataGlosowaniaFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  year: "numeric",
  hour: "2-digit",
  minute: "2-digit",
});

export function formatDataGlosowania(value: string | null | undefined): string {
  if (!value) {
    return "Brak daty";
  }

  const parsed = new Date(value);

  return Number.isNaN(parsed.getTime()) ? "Brak daty" : dataGlosowaniaFormatter.format(parsed);
}

export function policzGlosy(glosy: { glos: GlosPosla }[]): Record<GlosPosla, number> {
  const wynik: Record<GlosPosla, number> = {
    ZA: 0,
    PRZECIW: 0,
    WSTRZYMAL_SIE: 0,
    NIEOBECNY: 0,
  };

  for (const { glos } of glosy) {
    wynik[glos] += 1;
  }

  return wynik;
}
