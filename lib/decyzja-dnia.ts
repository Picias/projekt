import { todayIso } from "@/lib/posiedzenia";
import { htmlToPlainText } from "@/lib/sejm-document";
import { fetchProceedings, type SejmProceeding } from "@/lib/sejm-proceedings";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { hasAiSummary, isVetoStage, resolveStageKey, type StageKey, type Ustawa } from "@/lib/ustawa";

export type DecyzjaDniaUstawa = Pick<
  Ustawa,
  | "id"
  | "numer_druku"
  | "tytul_oficjalny"
  | "autor"
  | "etap_legislacyjny"
  | "tagi"
  | "data_wplywu"
  | "liczba_obserwujacych"
  | "ai_w_skrocie"
  | "ai_kogo_dotyczy"
  | "ai_co_zmienia"
  | "ai_skad_pieniadze"
>;

export type DecyzjaDniaPowod = "obrady-dzis" | "obrady-najblizsze" | "goracy-temat";

export type DecyzjaDnia = {
  ustawa: DecyzjaDniaUstawa;
  powod: DecyzjaDniaPowod;
  /** Dzień posiedzenia, na którego porządku jest druk (YYYY-MM-DD). */
  dataObrad: string | null;
  numerPosiedzenia: number | null;
};

const COLUMNS =
  "id, numer_druku, tytul_oficjalny, autor, etap_legislacyjny, tagi, data_wplywu, liczba_obserwujacych, ai_w_skrocie, ai_kogo_dotyczy, ai_co_zmienia, ai_skad_pieniadze";

// Im bliżej rozstrzygnięcia na sali plenarnej, tym bardziej druk nadaje się
// na „decyzję dnia” — obywatel może jeszcze realnie zareagować.
const STAGE_WEIGHT: Record<StageKey, number> = {
  projekt: 1,
  komisje: 2,
  sejm: 5,
  senat: 3,
  prezydent: 3,
  opublikowana: 0,
};

function score(ustawa: DecyzjaDniaUstawa): number {
  const stage = isVetoStage(ustawa.etap_legislacyjny)
    ? 2
    : STAGE_WEIGHT[resolveStageKey(ustawa.etap_legislacyjny)];
  const observers = Math.sqrt(Math.max(0, ustawa.liczba_obserwujacych ?? 0));
  const explained = hasAiSummary(ustawa) ? 3 : 0;

  return stage * 10 + observers + explained;
}

function pickBest(ustawy: DecyzjaDniaUstawa[]): DecyzjaDniaUstawa | null {
  return [...ustawy].sort((a, b) => score(b) - score(a))[0] ?? null;
}

/**
 * Porządek obrad z API Sejmu wymienia druki w nawiasach, np.
 * "(druki nr 1234 i 1290)". Pierwszy numer to zwykle projekt, a to on
 * jest kluczem w tabeli ustaw.
 */
export function extractPrintNumbers(agendaHtml: string): string[] {
  const text = htmlToPlainText(agendaHtml);
  const numbers = new Set<string>();

  const pattern =
    /druk\p{L}*\s+nr\s+(\d{1,5}(?:-[A-Z])?(?:\s*(?:,|i|oraz|–|-)\s*\d{1,5}(?:-[A-Z])?)*)/giu;

  for (const match of text.matchAll(pattern)) {
    for (const numer of match[1].match(/\d{1,5}/g) ?? []) {
      numbers.add(numer);
    }
  }

  return [...numbers];
}

function pickProceeding(
  proceedings: SejmProceeding[],
  today: string,
): { proceeding: SejmProceeding; date: string; today: boolean } | null {
  const current = proceedings.find((item) => item.dates.includes(today));

  if (current) {
    return { proceeding: current, date: today, today: true };
  }

  const upcoming = proceedings
    .map((item) => ({ item, next: item.dates.filter((date) => date > today).sort()[0] }))
    .filter((entry): entry is { item: SejmProceeding; next: string } => Boolean(entry.next))
    .sort((a, b) => a.next.localeCompare(b.next))[0];

  return upcoming ? { proceeding: upcoming.item, date: upcoming.next, today: false } : null;
}

async function fromAgenda(today: string): Promise<DecyzjaDnia | null> {
  const proceedings = await fetchProceedings().catch(() => [] as SejmProceeding[]);
  const picked = pickProceeding(proceedings, today);

  if (!picked?.proceeding.agenda) {
    return null;
  }

  const numery = extractPrintNumbers(picked.proceeding.agenda).slice(0, 80);

  if (numery.length === 0) {
    return null;
  }

  const { data, error } = await supabaseAdmin
    .from("ustawy")
    .select(COLUMNS)
    .in("numer_druku", numery);

  if (error || !data?.length) {
    return null;
  }

  const best = pickBest(data as DecyzjaDniaUstawa[]);

  return best
    ? {
        ustawa: best,
        powod: picked.today ? "obrady-dzis" : "obrady-najblizsze",
        dataObrad: picked.date,
        numerPosiedzenia: picked.proceeding.number || null,
      }
    : null;
}

async function fromHotTopics(): Promise<DecyzjaDnia | null> {
  const [popular, recent] = await Promise.all([
    supabaseAdmin
      .from("ustawy")
      .select(COLUMNS)
      .order("liczba_obserwujacych", { ascending: false })
      .limit(30),
    supabaseAdmin
      .from("ustawy")
      .select(COLUMNS)
      .order("data_wplywu", { ascending: false, nullsFirst: false })
      .limit(60),
  ]);

  const byId = new Map<number, DecyzjaDniaUstawa>();

  for (const row of [...(popular.data ?? []), ...(recent.data ?? [])] as DecyzjaDniaUstawa[]) {
    byId.set(row.id, row);
  }

  const candidates = [...byId.values()].filter(
    (ustawa) => resolveStageKey(ustawa.etap_legislacyjny) !== "opublikowana",
  );
  const best = pickBest(candidates);

  return best
    ? { ustawa: best, powod: "goracy-temat", dataObrad: null, numerPosiedzenia: null }
    : null;
}

/**
 * „Decyzja dnia” na ekran główny: najpierw druk z porządku obrad dzisiejszego
 * albo najbliższego posiedzenia, a gdy go nie znajdziemy — najgorętszy
 * projekt, który wciąż czeka na rozstrzygnięcie.
 */
export async function fetchDecyzjaDnia(): Promise<DecyzjaDnia | null> {
  const today = todayIso();

  try {
    return (await fromAgenda(today)) ?? (await fromHotTopics());
  } catch {
    return null;
  }
}
