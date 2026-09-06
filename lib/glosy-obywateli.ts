export const TYPY_GLOSU = ["ZA", "PRZECIW", "WSTRZYMAL_SIE"] as const;

export type TypGlosu = (typeof TYPY_GLOSU)[number];

/** Liczba głosów obywateli w rozbiciu na opcje — tak, jak zwraca je API. */
export type WynikiSondy = Record<TypGlosu, number>;

export const PUSTE_WYNIKI: WynikiSondy = {
  ZA: 0,
  PRZECIW: 0,
  WSTRZYMAL_SIE: 0,
};

export function isTypGlosu(value: unknown): value is TypGlosu {
  return typeof value === "string" && (TYPY_GLOSU as readonly string[]).includes(value);
}

export function sumaGlosow(wyniki: WynikiSondy): number {
  return TYPY_GLOSU.reduce((suma, typ) => suma + wyniki[typ], 0);
}

/** Procenty z Math.round — przy zerze głosów każdy pasek zostaje na 0%. */
export function toProcenty(wyniki: WynikiSondy): Record<TypGlosu, number> {
  const razem = sumaGlosow(wyniki);

  if (razem === 0) {
    return { ...PUSTE_WYNIKI };
  }

  return TYPY_GLOSU.reduce(
    (acc, typ) => ({ ...acc, [typ]: Math.round((wyniki[typ] / razem) * 100) }),
    { ...PUSTE_WYNIKI },
  );
}

export function wynikiZGlosow(glosy: Iterable<string>): WynikiSondy {
  const wyniki = { ...PUSTE_WYNIKI };

  for (const glos of glosy) {
    if (isTypGlosu(glos)) {
      wyniki[glos] += 1;
    }
  }

  return wyniki;
}
