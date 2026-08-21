export type Profile = {
  id: string;
  imie: string | null;
  nazwisko: string | null;
  pseudonim: string | null;
  avatar_url: string | null;
  plec: string | null;
  rok_urodzenia: number | null;
  wyksztalcenie: string | null;
  wielkosc_miejscowosci: string | null;
  popierana_partia: string | null;
  pokaz_dane_osobowe: boolean;
  pokaz_plec: boolean;
  pokaz_wiek: boolean;
  pokaz_wyksztalcenie: boolean;
  pokaz_miejscowosc: boolean;
  pokaz_partie: boolean;
};

export type ProfileFormValues = {
  imie: string;
  nazwisko: string;
  pseudonim: string;
  avatar_url: string;
  plec: string;
  rok_urodzenia: string;
  wyksztalcenie: string;
  wielkosc_miejscowosci: string;
  popierana_partia: string;
  pokaz_dane_osobowe: boolean;
  pokaz_plec: boolean;
  pokaz_wiek: boolean;
  pokaz_wyksztalcenie: boolean;
  pokaz_miejscowosc: boolean;
  pokaz_partie: boolean;
};

export const PLEC_OPTIONS = ["Kobieta", "Mężczyzna", "Inna / Nie podaję"] as const;

export const WYKSZTALCENIE_OPTIONS = [
  "Podstawowe",
  "Gimnazjalne",
  "Zasadnicze zawodowe",
  "Średnie",
  "Policealne",
  "Wyższe (licencjat / inżynier)",
  "Wyższe (magister)",
  "Stopień naukowy (doktor lub wyżej)",
] as const;

export const MIEJSCOWOSC_OPTIONS = [
  "Wieś",
  "Miasto do 20 tys. mieszkańców",
  "Miasto 20–99 tys. mieszkańców",
  "Miasto 100–499 tys. mieszkańców",
  "Miasto 500 tys. i więcej",
] as const;

export const PARTIA_OPTIONS = [
  "Żadna / Niezdecydowany",
  "Koalicja Obywatelska (KO)",
  "Prawo i Sprawiedliwość (PiS)",
  "Trzecia Droga (Polska 2050 i PSL)",
  "Konfederacja",
  "Nowa Lewica",
  "Razem",
  "Rozwój Plus",
  "Inna partia / ugrupowanie",
] as const;

const PARTIA_LEGACY_MAP: Record<string, (typeof PARTIA_OPTIONS)[number]> = {
  "Koalicja Obywatelska": "Koalicja Obywatelska (KO)",
  "Prawo i Sprawiedliwość": "Prawo i Sprawiedliwość (PiS)",
  "Polska 2050": "Trzecia Droga (Polska 2050 i PSL)",
  "Polskie Stronnictwo Ludowe": "Trzecia Droga (Polska 2050 i PSL)",
};

function normalizePartia(value: string | null | undefined): string {
  if (!value) {
    return "";
  }

  if ((PARTIA_OPTIONS as readonly string[]).includes(value)) {
    return value;
  }

  return PARTIA_LEGACY_MAP[value] ?? value;
}

const CURRENT_YEAR = new Date().getFullYear();
const MIN_AGE = 18;
const MAX_AGE = 100;

export const ROCZNIK_OPTIONS: number[] = Array.from(
  { length: MAX_AGE - MIN_AGE + 1 },
  (_, index) => CURRENT_YEAR - MIN_AGE - index,
);

export const EMPTY_PROFILE_FORM: ProfileFormValues = {
  imie: "",
  nazwisko: "",
  pseudonim: "",
  avatar_url: "",
  plec: "",
  rok_urodzenia: "",
  wyksztalcenie: "",
  wielkosc_miejscowosci: "",
  popierana_partia: "",
  pokaz_dane_osobowe: false,
  pokaz_plec: false,
  pokaz_wiek: false,
  pokaz_wyksztalcenie: false,
  pokaz_miejscowosc: false,
  pokaz_partie: false,
};

export function isOnboardingComplete(profile: Profile | null): boolean {
  if (!profile) {
    return false;
  }

  return Boolean(
    profile.plec &&
      profile.rok_urodzenia &&
      profile.wyksztalcenie &&
      profile.wielkosc_miejscowosci &&
      profile.popierana_partia,
  );
}

export function profileToForm(profile: Profile | null): ProfileFormValues {
  if (!profile) {
    return { ...EMPTY_PROFILE_FORM };
  }

  return {
    imie: profile.imie ?? "",
    nazwisko: profile.nazwisko ?? "",
    pseudonim: profile.pseudonim ?? "",
    avatar_url: profile.avatar_url ?? "",
    plec: profile.plec ?? "",
    rok_urodzenia: profile.rok_urodzenia ? String(profile.rok_urodzenia) : "",
    wyksztalcenie: profile.wyksztalcenie ?? "",
    wielkosc_miejscowosci: profile.wielkosc_miejscowosci ?? "",
    popierana_partia: normalizePartia(profile.popierana_partia),
    pokaz_dane_osobowe: profile.pokaz_dane_osobowe ?? false,
    pokaz_plec: profile.pokaz_plec,
    pokaz_wiek: profile.pokaz_wiek,
    pokaz_wyksztalcenie: profile.pokaz_wyksztalcenie,
    pokaz_miejscowosc: profile.pokaz_miejscowosc,
    pokaz_partie: profile.pokaz_partie,
  };
}

export function emptyToNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function profileAvatarInitial(imie: string, pseudonim: string): string {
  const source = imie.trim() || pseudonim.trim();
  return source ? source.charAt(0).toLocaleUpperCase("pl") : "";
}

/**
 * Imię i nazwisko, gdy właściciel zgodził się je pokazać; w przeciwnym
 * razie pseudonim. Null, gdy nie ma nic, co wolno wyświetlić.
 */
export function profilePublicName(
  profile: Pick<Profile, "imie" | "nazwisko" | "pseudonim" | "pokaz_dane_osobowe">,
): string | null {
  if (profile.pokaz_dane_osobowe) {
    const fullName = [profile.imie, profile.nazwisko]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(" ");

    if (fullName) {
      return fullName;
    }
  }

  const nick = profile.pseudonim?.trim();
  return nick || null;
}

/**
 * Tylko ścieżki względne — inaczej parametr next z logowania byłby otwartym
 * przekierowaniem poza aplikację.
 */
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.includes("://")) {
    return "/";
  }

  return value;
}

export function loginHref(next?: string | null): string {
  const path = safeNextPath(next);

  if (path === "/") {
    return "/login";
  }

  return `/login?next=${encodeURIComponent(path)}`;
}
