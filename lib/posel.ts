import { getClubLabel } from "@/lib/club-colors";

export type Posel = {
  id: number;
  imie_nazwisko: string;
  partia: string | null;
  zdjecie_url: string | null;
};

// Dane z API Sejmu zapisywane przez /api/sync-mps. Wszystko jest opcjonalne,
// bo dla części posłów API nie podaje np. zawodu.
export type PoselProfil = Posel & {
  nazwisko: string | null;
  data_urodzenia: string | null;
  wyksztalcenie: string | null;
  zawod: string | null;
  okreg_wyborczy: string | null;
  okreg_numer: number | null;
  liczba_glosow: number | null;
};

export function splitPoselName(fullName: string): { imie: string; nazwisko: string } {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);

  if (parts.length === 0) {
    return { imie: "", nazwisko: "" };
  }

  if (parts.length === 1) {
    return { imie: parts[0], nazwisko: "" };
  }

  return {
    imie: parts[0],
    nazwisko: parts.slice(1).join(" "),
  };
}

// Nazwiska z API są wiarygodniejsze od dzielenia imie_nazwisko po spacjach:
// "Anna Maria Żukowska" to imiona "Anna Maria" i nazwisko "Żukowska", a
// "Szymon Szynkowski vel Sęk" ma nazwisko dwuczłonowe. Gdy kolumna nazwisko
// jest pusta (baza przed synchronizacją), wracamy do prostego podziału.
export function resolvePoselName(posel: {
  imie_nazwisko: string;
  nazwisko?: string | null;
}): { imie: string; nazwisko: string } {
  const fullName = posel.imie_nazwisko.trim();
  const nazwisko = posel.nazwisko?.trim();

  if (nazwisko && fullName.toLowerCase().endsWith(nazwisko.toLowerCase())) {
    return {
      imie: fullName.slice(0, fullName.length - nazwisko.length).trim(),
      nazwisko: fullName.slice(fullName.length - nazwisko.length),
    };
  }

  if (nazwisko) {
    return { imie: fullName.replace(nazwisko, "").trim(), nazwisko };
  }

  return splitPoselName(fullName);
}

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

function readText(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function readInteger(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

// Wiersz z Supabase czytamy przez select("*"), żeby lista posłów działała także
// przed migracją dodającą kolumny profilowe. Mapowanie odsiewa nadmiarowe
// kolumny, bo cały wynik trafia potem do komponentu klienckiego.
export function toPoselProfil(row: Record<string, unknown>): PoselProfil {
  return {
    id: Number(row.id),
    imie_nazwisko: readText(row.imie_nazwisko) ?? "",
    partia: readText(row.partia),
    zdjecie_url: readText(row.zdjecie_url),
    nazwisko: readText(row.nazwisko),
    data_urodzenia: readText(row.data_urodzenia),
    wyksztalcenie: readText(row.wyksztalcenie),
    zawod: readText(row.zawod),
    okreg_wyborczy: readText(row.okreg_wyborczy),
    okreg_numer: readInteger(row.okreg_numer),
    liczba_glosow: readInteger(row.liczba_glosow),
  };
}

export function calculateAge(
  birthDate: string | null | undefined,
  today: Date = new Date(),
): number | null {
  if (!birthDate) {
    return null;
  }

  const birth = new Date(`${birthDate.slice(0, 10)}T12:00:00`);

  if (Number.isNaN(birth.getTime())) {
    return null;
  }

  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();

  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age -= 1;
  }

  return age >= 0 && age < 130 ? age : null;
}

export function formatAge(age: number): string {
  const lastTwo = age % 100;
  const last = age % 10;
  const plural = last >= 2 && last <= 4 && (lastTwo < 12 || lastTwo > 14) ? "lata" : "lat";

  return `${age} ${plural}`;
}

const birthDateFormatter = new Intl.DateTimeFormat("pl-PL", {
  day: "numeric",
  month: "long",
  year: "numeric",
});

export function formatBirthDate(birthDate: string): string {
  return birthDateFormatter.format(new Date(`${birthDate.slice(0, 10)}T12:00:00`));
}

export function formatOkreg(
  okreg: string | null | undefined,
  numer: number | null | undefined,
): string | null {
  if (numer && okreg) {
    return `Okręg nr ${numer} — ${okreg}`;
  }

  if (numer) {
    return `Okręg nr ${numer}`;
  }

  return okreg ?? null;
}

const votesFormatter = new Intl.NumberFormat("pl-PL");

export function formatLiczbaGlosow(votes: number | null | undefined): string | null {
  if (votes === null || votes === undefined) {
    return null;
  }

  return votesFormatter.format(votes);
}

// "ł" nie rozkłada się przez NFD, więc podmieniamy je ręcznie — bez tego
// wyszukiwanie "malecki" nie znajdzie "Małecki".
export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("ł", "l")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function sortPoslowieByNazwisko<
  T extends { imie_nazwisko: string; nazwisko?: string | null },
>(poslowie: T[]): T[] {
  return poslowie
    .map((posel) => ({ posel, name: resolvePoselName(posel) }))
    .sort(
      (a, b) =>
        a.name.nazwisko.localeCompare(b.name.nazwisko, "pl") ||
        a.name.imie.localeCompare(b.name.imie, "pl"),
    )
    .map((entry) => entry.posel);
}

export function groupPoslowieByKlub<T extends Posel>(poslowie: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>();

  for (const posel of poslowie) {
    const klub = getClubLabel(posel.partia);
    const existing = groups.get(klub);

    if (existing) {
      existing.push(posel);
    } else {
      groups.set(klub, [posel]);
    }
  }

  return [...groups.entries()].sort(([a], [b]) => {
    if (a === "Brak klubu") return 1;
    if (b === "Brak klubu") return -1;
    return a.localeCompare(b, "pl");
  });
}
