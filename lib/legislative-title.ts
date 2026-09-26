/**
 * Oficjalne tytuły druków zaczynają się od formułek, które nic nie mówią
 * zwykłemu czytelnikowi ("Rządowy projekt ustawy o zmianie ustawy o ...").
 * Tu zamieniamy je na krótszy nagłówek w języku potocznym. Pełny tytuł
 * zostaje dostępny w szczegółach druku — wiążący jest zawsze oficjalny.
 */

const AUTHOR_AND_KIND =
  /^(?:(?:rządowy|poselski|senacki|obywatelski|komisyjny|prezydencki|przedstawiony\s+przez\s+prezydenta\s+rzeczypospolitej\s+polskiej)\s+)?projekt\s+ustawy\s+/i;

const REWRITES: [RegExp, string][] = [
  [/^o\s+zmianie\s+niektórych\s+ustaw\s+/i, "Zmiany w kilku ustawach "],
  [/^o\s+zmianie\s+ustawy\s*[–—-]\s*/i, "Zmiany w prawie: "],
  [/^o\s+zmianie\s+ustawy\s+o\s+/i, "Zmiany w ustawie o "],
  [/^o\s+zmianie\s+ustaw\s+/i, "Zmiany w ustawach "],
  [/^o\s+/i, "Ustawa o "],
];

function capitalize(value: string): string {
  return value ? value.charAt(0).toLocaleUpperCase("pl") + value.slice(1) : value;
}

export function plainTitle(officialTitle: string): string {
  const normalized = officialTitle.replace(/\s+/g, " ").trim();
  const withoutKind = normalized.replace(AUTHOR_AND_KIND, "");

  // Bez formułki "projekt ustawy" to inny rodzaj druku (sprawozdanie,
  // wniosek, uchwała) — takiego tytułu nie przerabiamy.
  if (withoutKind === normalized) {
    return normalized;
  }

  let result = withoutKind;

  for (const [pattern, replacement] of REWRITES) {
    if (pattern.test(result)) {
      result = result.replace(pattern, replacement);
      break;
    }
  }

  result = result
    .replace(/\s+oraz\s+niektórych\s+innych\s+ustaw\s*$/i, " (i kilku innych ustawach)")
    .replace(/\s+oraz\s+niektórych\s+innych\s+ustaw\b/i, " i kilku innych ustawach");

  return capitalize(result.trim()) || normalized;
}

export type TitleScale = "hero" | "card" | "compact";

/**
 * Długi tytuł w dużym kroju zajmuje cały ekran telefonu i zniechęca do
 * czytania, więc rozmiar maleje wraz z liczbą znaków. Klasy korzystają
 * z clamp() w globals.css, więc skalują się też z szerokością ekranu.
 */
export function titleSizeClass(title: string, scale: TitleScale): string {
  const length = title.length;
  const tier = length <= 70 ? "l" : length <= 140 ? "m" : "s";

  return `legislative-title legislative-title--${scale}-${tier}`;
}
