export type Posel = {
  id: number;
  imie_nazwisko: string;
  partia: string | null;
  zdjecie_url: string | null;
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

export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);

  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  }

  return name.slice(0, 2).toUpperCase();
}

export function groupPoslowieByPartia(poslowie: Posel[]): [string, Posel[]][] {
  const groups = new Map<string, Posel[]>();

  for (const posel of poslowie) {
    const partia = posel.partia?.trim() || "Brak klubu";
    const existing = groups.get(partia);

    if (existing) {
      existing.push(posel);
    } else {
      groups.set(partia, [posel]);
    }
  }

  return [...groups.entries()].sort(([a], [b]) => {
    if (a === "Brak klubu") return 1;
    if (b === "Brak klubu") return -1;
    return a.localeCompare(b, "pl");
  });
}
