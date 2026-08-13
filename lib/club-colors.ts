export type ClubTheme = {
  text: string;
  bg: string;
  border: string;
};

// Klucze mapy są jednocześnie etykietami klubów pokazywanymi w UI.
export const clubColors = {
  "Koalicja Obywatelska": {
    text: "text-orange-500",
    bg: "bg-orange-500/10",
    border: "border-orange-500/20",
  },
  "Prawo i Sprawiedliwość": {
    text: "text-blue-600",
    bg: "bg-blue-600/10",
    border: "border-blue-600/30",
  },
  "Rozwój Plus": {
    text: "text-sky-400",
    bg: "bg-sky-400/10",
    border: "border-sky-400/20",
  },
  "Polskie Stronnictwo Ludowe": {
    text: "text-green-500",
    bg: "bg-green-500/10",
    border: "border-green-500/20",
  },
  Lewica: {
    text: "text-red-500",
    bg: "bg-red-500/10",
    border: "border-red-500/20",
  },
  Konfederacja: {
    text: "text-indigo-300",
    bg: "bg-indigo-800/40",
    border: "border-indigo-700/50",
  },
  Centrum: {
    text: "text-teal-400",
    bg: "bg-teal-400/10",
    border: "border-teal-400/20",
  },
  "Polska 2050": {
    text: "text-yellow-400",
    bg: "bg-yellow-400/10",
    border: "border-yellow-400/20",
  },
  "Demokracja Bezpośrednia": {
    text: "text-cyan-400",
    bg: "bg-cyan-400/10",
    border: "border-cyan-400/20",
  },
  Razem: {
    text: "text-pink-500",
    bg: "bg-pink-500/10",
    border: "border-pink-500/20",
  },
  "Konfederacja Korony Polskiej": {
    text: "text-amber-700",
    bg: "bg-amber-700/10",
    border: "border-amber-700/30",
  },
  Niezrzeszeni: {
    text: "text-gray-400",
    bg: "bg-gray-500/10",
    border: "border-gray-500/20",
  },
} satisfies Record<string, ClubTheme>;

export type ClubName = keyof typeof clubColors;

const FALLBACK_CLUB: ClubName = "Niezrzeszeni";

type ClubMatcher = {
  club: ClubName;
  // Fragmenty pełnych nazw — dopasowanie bez rozróżniania wielkości liter.
  keywords: string[];
  // Skróty i identyfikatory klubów z API Sejmu — dopasowanie z zachowaniem
  // wielkości liter, żeby "KO" nie łapało "Konfederacji" ani "Korony".
  codes: string[];
};

// Kolejność ma znaczenie: wygrywa pierwsze dopasowanie, więc Konfederacja
// Korony Polskiej musi być sprawdzona przed samą Konfederacją.
const CLUB_MATCHERS: ClubMatcher[] = [
  {
    club: "Konfederacja Korony Polskiej",
    keywords: ["Korony Polskiej"],
    codes: ["Konfederacja_KP"],
  },
  { club: "Konfederacja", keywords: ["Konfederacja"], codes: [] },
  {
    club: "Koalicja Obywatelska",
    keywords: ["Koalicja Obywatelska"],
    codes: ["KO", "PO"],
  },
  {
    club: "Prawo i Sprawiedliwość",
    keywords: ["Prawo i Sprawiedliwość"],
    codes: ["PiS"],
  },
  { club: "Rozwój Plus", keywords: ["Rozwój Plus"], codes: ["RozwojPlus"] },
  {
    club: "Polskie Stronnictwo Ludowe",
    keywords: ["Polskie Stronnictwo Ludowe"],
    codes: ["PSL"],
  },
  { club: "Lewica", keywords: ["Lewica"], codes: [] },
  { club: "Centrum", keywords: ["Centrum"], codes: [] },
  { club: "Polska 2050", keywords: ["Polska 2050"], codes: ["Polska2050"] },
  {
    club: "Demokracja Bezpośrednia",
    keywords: ["Demokracja Bezpośrednia"],
    codes: ["Demokracja"],
  },
  { club: "Razem", keywords: ["Razem"], codes: [] },
  { club: "Niezrzeszeni", keywords: ["Niezrzeszeni"], codes: ["niez."] },
];

function matchClub(club: string): ClubName | null {
  const lowered = club.toLowerCase();

  for (const matcher of CLUB_MATCHERS) {
    const byKeyword = matcher.keywords.some((keyword) =>
      lowered.includes(keyword.toLowerCase()),
    );

    if (byKeyword || matcher.codes.some((code) => club.includes(code))) {
      return matcher.club;
    }
  }

  return null;
}

export function getClubTheme(club: string | null | undefined): ClubTheme {
  const raw = club?.trim();
  const matched = raw ? matchClub(raw) : null;

  return clubColors[matched ?? FALLBACK_CLUB];
}

// Baza trzyma to, co zwraca API Sejmu ("PiS", "PSL-TD"), więc na ekranie
// pokazujemy rozpoznaną nazwę klubu, a nieznane wartości zostawiamy bez zmian.
export function getClubLabel(club: string | null | undefined): string {
  const raw = club?.trim();

  if (!raw) {
    return "Brak klubu";
  }

  return matchClub(raw) ?? raw;
}

export function getClubPillClass(club: string | null | undefined): string {
  const theme = getClubTheme(club);

  return `${theme.text} ${theme.bg} ${theme.border}`;
}
