import { fetchSejmJson, SEJM_API_BASE, SEJM_TERM } from "@/lib/sejm-api";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { buildHumanSummary } from "@/lib/ustawa-human-summary";
import { resolveStageKey, type StageKey } from "@/lib/ustawa";

const DEFAULT_PRINT_LIMIT = 10;

type SejmPrint = {
  number?: string;
  title?: string;
  documentDate?: string;
  deliveryDate?: string;
  changeDate?: string;
};

type SejmProcessStage = {
  stageName?: string;
  children?: SejmProcessStage[];
};

type SejmProcessDetails = {
  passed?: boolean;
  displayAddress?: string;
  closureDate?: string;
  stages?: SejmProcessStage[];
};

type UstawaMetadataRow = {
  numer_druku: string;
  tytul_oficjalny: string;
  autor: string | null;
  data_wplywu: string | null;
  etap_legislacyjny: StageKey;
  zaktualizowano_at: string;
};

export type SyncUstawyResult = {
  status: "ok" | "error";
  synced: number;
  summariesGenerated: number;
  drukiFromApi: number;
  numery: string[];
  message?: string;
};

const AUTHOR_PREFIXES: { prefix: string; autor: string }[] = [
  { prefix: "rządowy", autor: "Rada Ministrów" },
  { prefix: "poselski", autor: "Grupa posłów" },
  { prefix: "obywatelski", autor: "Inicjatywa obywatelska" },
  { prefix: "senacki", autor: "Senat" },
  { prefix: "prezydencki", autor: "Prezydent RP" },
  { prefix: "komisyjny", autor: "Komisja sejmowa" },
];

export function resolveAutor(title: string): string | null {
  const normalized = title.trim().toLowerCase();

  for (const { prefix, autor } of AUTHOR_PREFIXES) {
    if (normalized.startsWith(prefix)) {
      return autor;
    }
  }

  if (normalized.includes("rady ministrów") || normalized.includes("rada ministrów")) {
    return "Rada Ministrów";
  }

  if (normalized.startsWith("sprawozdanie komisji") || normalized.startsWith("opinia komisji")) {
    return "Komisja sejmowa";
  }

  return null;
}

function collectStageNames(stages: SejmProcessStage[] | undefined): string[] {
  if (!stages || stages.length === 0) {
    return [];
  }

  const names: string[] = [];

  for (const stage of stages) {
    if (stage.stageName) {
      names.push(stage.stageName);
    }

    names.push(...collectStageNames(stage.children));
  }

  return names;
}

const STAGE_ORDER: StageKey[] = ["projekt", "komisje", "sejm", "senat", "prezydent"];

/**
 * Etap wyznaczamy z realnego procesu legislacyjnego: bierzemy najdalej
 * zaawansowany etap, jaki pojawił się w historii druku.
 */
async function resolveEtapLegislacyjny(printNumber: string): Promise<StageKey> {
  const process = await fetchSejmJson<SejmProcessDetails>(
    `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/processes/${encodeURIComponent(printNumber)}`,
    { revalidate: 0, timeoutMs: 10_000 },
  );

  if (!process) {
    return "projekt";
  }

  if (process.passed || process.displayAddress) {
    return "prezydent";
  }

  const stageNames = collectStageNames(process.stages);

  if (stageNames.length === 0) {
    return "projekt";
  }

  let furthest = 0;

  for (const name of stageNames) {
    const index = STAGE_ORDER.indexOf(resolveStageKey(name));

    if (index > furthest) {
      furthest = index;
    }
  }

  return STAGE_ORDER[furthest];
}

function printDate(print: SejmPrint): string {
  return print.deliveryDate ?? print.documentDate ?? print.changeDate ?? "";
}

function selectNewestPrints(prints: SejmPrint[], limit: number): SejmPrint[] {
  const usable = prints.filter((print) => print.number && print.title);

  const sorted = [...usable].sort((a, b) => printDate(b).localeCompare(printDate(a)));

  // Moduł dotyczy ustaw, więc projekty ustaw mają pierwszeństwo nad
  // opiniami i sprawozdaniami. Brakującą liczbę uzupełniamy pozostałymi drukami.
  const bills = sorted.filter((print) =>
    print.title!.toLowerCase().includes("projekt ustawy"),
  );

  if (bills.length >= limit) {
    return bills.slice(0, limit);
  }

  const rest = sorted.filter((print) => !bills.includes(print));

  return [...bills, ...rest].slice(0, limit);
}

export async function syncUstawy(options: {
  limit?: number;
  refreshSummaries?: boolean;
}): Promise<SyncUstawyResult> {
  const limit = options.limit ?? DEFAULT_PRINT_LIMIT;

  const prints = await fetchSejmJson<SejmPrint[]>(
    `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/prints?sort=-documentDate`,
    { revalidate: 0, timeoutMs: 20_000 },
  );

  if (!prints || prints.length === 0) {
    return {
      status: "error",
      synced: 0,
      summariesGenerated: 0,
      drukiFromApi: 0,
      numery: [],
      message: "API Sejmu nie zwróciło listy druków",
    };
  }

  const selected = selectNewestPrints(prints, limit);

  if (selected.length === 0) {
    return {
      status: "error",
      synced: 0,
      summariesGenerated: 0,
      drukiFromApi: prints.length,
      numery: [],
      message: "Brak druków spełniających kryteria",
    };
  }

  const numery = selected.map((print) => print.number!);

  const { data: existing } = await supabaseAdmin
    .from("ustawy")
    .select("numer_druku, opis_ludzki")
    .in("numer_druku", numery);

  const alreadyDescribed = new Set(
    (existing ?? [])
      .filter((row) => Boolean((row as { opis_ludzki: string | null }).opis_ludzki))
      .map((row) => (row as { numer_druku: string }).numer_druku),
  );

  const timestamp = new Date().toISOString();
  const metadataOnly: UstawaMetadataRow[] = [];
  const withSummary: (UstawaMetadataRow & {
    opis_ludzki: string;
    kogo_dotyczy: string;
    co_zmienia: string;
    koszty_i_finansowanie: string;
  })[] = [];

  for (const print of selected) {
    const numerDruku = print.number!;
    const tytul = print.title!.trim();
    const autor = resolveAutor(tytul);

    const row: UstawaMetadataRow = {
      numer_druku: numerDruku,
      tytul_oficjalny: tytul,
      autor,
      data_wplywu: print.deliveryDate ?? print.documentDate ?? null,
      etap_legislacyjny: await resolveEtapLegislacyjny(numerDruku),
      zaktualizowano_at: timestamp,
    };

    const keepExistingSummary =
      alreadyDescribed.has(numerDruku) && !options.refreshSummaries;

    if (keepExistingSummary) {
      metadataOnly.push(row);
      continue;
    }

    withSummary.push({ ...row, ...buildHumanSummary({ title: tytul, autor }) });
  }

  let synced = 0;

  if (withSummary.length > 0) {
    const { error } = await supabaseAdmin
      .from("ustawy")
      .upsert(withSummary, { onConflict: "numer_druku" });

    if (error) {
      return {
        status: "error",
        synced: 0,
        summariesGenerated: 0,
        drukiFromApi: prints.length,
        numery,
        message: error.message,
      };
    }

    synced += withSummary.length;
  }

  if (metadataOnly.length > 0) {
    const { error } = await supabaseAdmin
      .from("ustawy")
      .upsert(metadataOnly, { onConflict: "numer_druku" });

    if (error) {
      return {
        status: "error",
        synced,
        summariesGenerated: withSummary.length,
        drukiFromApi: prints.length,
        numery,
        message: error.message,
      };
    }

    synced += metadataOnly.length;
  }

  return {
    status: "ok",
    synced,
    summariesGenerated: withSummary.length,
    drukiFromApi: prints.length,
    numery,
  };
}
