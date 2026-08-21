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

/**
 * Procenty liczone metodą największych reszt, żeby paski postępu zawsze
 * sumowały się do 100 — samo zaokrąglanie w górę potrafi dać 101%.
 */
export function toProcenty(wyniki: WynikiSondy): Record<TypGlosu, number> {
  const razem = sumaGlosow(wyniki);

  if (razem === 0) {
    return { ...PUSTE_WYNIKI };
  }

  const czesci = TYPY_GLOSU.map((typ) => {
    const dokladny = (wyniki[typ] * 100) / razem;
    const procent = Math.floor(dokladny);

    return { typ, procent, reszta: dokladny - procent };
  });

  let doRozdania = 100 - czesci.reduce((suma, czesc) => suma + czesc.procent, 0);

  for (const czesc of [...czesci].sort((a, b) => b.reszta - a.reszta)) {
    if (doRozdania <= 0) {
      break;
    }

    czesc.procent += 1;
    doRozdania -= 1;
  }

  return czesci.reduce(
    (acc, { typ, procent }) => ({ ...acc, [typ]: procent }),
    { ...PUSTE_WYNIKI },
  );
}

/**
 * Sonda rusza z pustą tabelą, więc pierwszy oddany głos dawałby zawsze 100%
 * w jednej kolumnie. Do czasu zebrania realnego ruchu doliczamy do wyników
 * stały rozkład demonstracyjny — wyliczony z identyfikatora druku, żeby nie
 * zmieniał się między odsłonami. Stąd badge „Wersja demo” nad sekcją.
 */
export function demoBaseline(ustawaId: number): WynikiSondy {
  const razem = 240 + ((ustawaId * 37) % 1361);
  const udzialZa = 35 + ((ustawaId * 13) % 41);
  const udzialWstrzymal = 5 + ((ustawaId * 7) % 11);

  const za = Math.round((razem * udzialZa) / 100);
  const wstrzymal = Math.round((razem * udzialWstrzymal) / 100);

  return {
    ZA: za,
    PRZECIW: razem - za - wstrzymal,
    WSTRZYMAL_SIE: wstrzymal,
  };
}
