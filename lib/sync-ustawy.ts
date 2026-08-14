import {
  fetchSejmJson,
  mapWithConcurrency,
  SEJM_API_BASE,
  SEJM_TERM,
} from "@/lib/sejm-api";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { buildHumanSummary } from "@/lib/ustawa-human-summary";
import { resolveStageKey, type StageKey } from "@/lib/ustawa";

// API Sejmu przyjmuje limit i offset tylko na liście procesów legislacyjnych —
// endpoint /prints zwraca całą kadencję jednym strzałem i nie da się go stronicować.
const PROCESS_PAGE_SIZE = 200;
const MAX_PROCESS_PAGES = 50;
const BILL_DOCUMENT_TYPE = "projekt ustawy";

// Etap wynika ze szczegółów procesu, więc dla druków bez rozstrzygnięcia trzeba
// dobić po jednym zapytaniu na druk. Kadencja X to ok. 900 projektów, co przy tej
// równoległości mieści się w kilkunastu sekundach.
const PROCESS_DETAIL_CONCURRENCY = 12;
const UPSERT_CHUNK_SIZE = 200;

type SejmProcessHeader = {
  number?: string;
  title?: string;
  documentDate?: string;
  processStartDate?: string;
  changeDate?: string;
  comments?: string;
  description?: string;
  passed?: boolean;
  displayAddress?: string;
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

type SejmPrint = {
  number?: string;
  deliveryDate?: string;
  documentDate?: string;
  attachments?: string[];
};

type PrintInfo = {
  deliveryDate: string | null;
  pdfUrl: string | null;
};

type UstawaMetadataRow = {
  numer_druku: string;
  tytul_oficjalny: string;
  autor: string | null;
  data_wplywu: string | null;
  etap_legislacyjny: StageKey;
  pdf_url: string | null;
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

const AUTHOR_KEYWORDS: { keywords: string[]; autor: string }[] = [
  // Prezydent idzie pierwszy, bo jego druki nie mają własnego przymiotnika —
  // API opisuje je jako "Przedstawiony przez Prezydenta Rzeczypospolitej Polskiej
  // projekt ustawy...", więc rozpoznaje je dopiero samo słowo "Prezydent".
  { keywords: ["prezydent"], autor: "Prezydent RP" },
  { keywords: ["rządow", "rady ministrów", "rada ministrów"], autor: "Rada Ministrów" },
  { keywords: ["poselski"], autor: "Grupa posłów" },
  { keywords: ["obywatelski"], autor: "Inicjatywa obywatelska" },
  { keywords: ["senacki"], autor: "Senat" },
  { keywords: ["komisyjny", "komisji"], autor: "Komisja sejmowa" },
];

/**
 * Tytuł druku ma stały układ "<wnioskodawca> projekt ustawy o ...". Szukanie
 * słów kluczowych w całym tytule myliło wnioskodawcę z przedmiotem regulacji
 * (np. "ustawa o wynagrodzeniu Prezydenta RP"), dlatego przycinamy tytuł do
 * członu opisującego autora.
 */
function authorSegment(title: string): string {
  const normalized = title.trim().toLowerCase();
  const match = normalized.match(/projekt\s+(ustawy|uchwały)/);

  return match && match.index && match.index > 0
    ? normalized.slice(0, match.index)
    : normalized;
}

export function resolveAutor(title: string, comments?: string | null): string | null {
  const segment = authorSegment(title);

  for (const { keywords, autor } of AUTHOR_KEYWORDS) {
    if (keywords.some((keyword) => segment.includes(keyword))) {
      return autor;
    }
  }

  // Druki wniesione w poprzedniej kadencji miewają wnioskodawcę wyłącznie
  // w komentarzu procesu.
  const note = comments?.toLowerCase() ?? "";

  if (note.includes("prezydent")) {
    return "Prezydent RP";
  }

  if (note.includes("obywatelsk")) {
    return "Inicjatywa obywatelska";
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

const STAGE_ORDER: StageKey[] = [
  "projekt",
  "komisje",
  "sejm",
  "senat",
  "prezydent",
  "opublikowana",
];

/**
 * Etap wyznaczamy z realnego procesu legislacyjnego: bierzemy najdalej
 * zaawansowany etap, jaki pojawił się w historii druku.
 */
async function resolveEtapLegislacyjny(process: SejmProcessHeader): Promise<StageKey> {
  // Adres publikacji w Dzienniku Ustaw kończy proces, a flaga passed oznacza
  // uchwalenie — obie informacje są już w nagłówku, więc oszczędzają zapytanie.
  if (process.displayAddress) {
    return "opublikowana";
  }

  if (process.passed) {
    return "prezydent";
  }

  const details = await fetchSejmJson<SejmProcessDetails>(
    `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/processes/${encodeURIComponent(process.number!)}`,
    { revalidate: 0, timeoutMs: 10_000 },
  );

  if (!details) {
    return "projekt";
  }

  if (details.displayAddress) {
    return "opublikowana";
  }

  if (details.passed) {
    return "prezydent";
  }

  let furthest = 0;

  for (const name of collectStageNames(details.stages)) {
    const index = STAGE_ORDER.indexOf(resolveStageKey(name));

    if (index > furthest) {
      furthest = index;
    }
  }

  return STAGE_ORDER[furthest];
}

/**
 * Lista procesów jest stronicowana — czytamy kolejne strony, aż API zwróci
 * mniej pozycji niż wynosi rozmiar strony.
 */
async function fetchAllBillProcesses(): Promise<SejmProcessHeader[]> {
  const all: SejmProcessHeader[] = [];
  const seen = new Set<string>();

  for (let page = 0; page < MAX_PROCESS_PAGES; page += 1) {
    const params = new URLSearchParams({
      documentType: BILL_DOCUMENT_TYPE,
      limit: String(PROCESS_PAGE_SIZE),
      offset: String(page * PROCESS_PAGE_SIZE),
    });

    const batch = await fetchSejmJson<SejmProcessHeader[]>(
      `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/processes?${params}`,
      { revalidate: 0, timeoutMs: 20_000 },
    );

    if (!batch || batch.length === 0) {
      break;
    }

    for (const process of batch) {
      if (process.number && process.title && !seen.has(process.number)) {
        seen.add(process.number);
        all.push(process);
      }
    }

    if (batch.length < PROCESS_PAGE_SIZE) {
      break;
    }
  }

  return all;
}

function pickPdfAttachment(print: SejmPrint): string | null {
  const attachments = print.attachments ?? [];
  const pdfs = attachments.filter((name) => name.toLowerCase().endsWith(".pdf"));

  if (pdfs.length === 0) {
    return null;
  }

  // Druk bywa rozbity na uzasadnienie i załączniki — plik nazwany numerem druku
  // to treść właściwa, więc ma pierwszeństwo przed resztą.
  return pdfs.find((name) => name === `${print.number}.pdf`) ?? pdfs[0];
}

async function fetchPrintIndex(): Promise<Map<string, PrintInfo>> {
  const prints = await fetchSejmJson<SejmPrint[]>(
    `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/prints`,
    { revalidate: 0, timeoutMs: 30_000 },
  );

  const index = new Map<string, PrintInfo>();

  for (const print of prints ?? []) {
    if (!print.number) {
      continue;
    }

    const attachment = pickPdfAttachment(print);

    index.set(print.number, {
      deliveryDate: print.deliveryDate ?? print.documentDate ?? null,
      pdfUrl: attachment
        ? `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/prints/${encodeURIComponent(print.number)}/${encodeURIComponent(attachment)}`
        : null,
    });
  }

  return index;
}

function processDate(process: SejmProcessHeader): string {
  return process.documentDate ?? process.processStartDate ?? process.changeDate ?? "";
}

async function upsertInChunks<T extends { numer_druku: string }>(
  rows: T[],
): Promise<string | null> {
  for (let start = 0; start < rows.length; start += UPSERT_CHUNK_SIZE) {
    const { error } = await supabaseAdmin
      .from("ustawy")
      .upsert(rows.slice(start, start + UPSERT_CHUNK_SIZE), {
        onConflict: "numer_druku",
      });

    if (error) {
      return error.message;
    }
  }

  return null;
}

export async function syncUstawy(options: {
  limit?: number;
  refreshSummaries?: boolean;
}): Promise<SyncUstawyResult> {
  const processes = await fetchAllBillProcesses();

  if (processes.length === 0) {
    return {
      status: "error",
      synced: 0,
      summariesGenerated: 0,
      drukiFromApi: 0,
      numery: [],
      message: "API Sejmu nie zwróciło listy procesów legislacyjnych",
    };
  }

  const sorted = [...processes].sort((a, b) =>
    processDate(b).localeCompare(processDate(a)),
  );

  const selected = options.limit ? sorted.slice(0, options.limit) : sorted;
  const numery = selected.map((process) => process.number!);

  const printIndex = await fetchPrintIndex();

  // Podsumowania są kosztowne do wygenerowania i z czasem będą pochodzić
  // z modelu, więc raz opisanych druków nie nadpisujemy bez wyraźnej prośby.
  const { data: existing, error: existingError } = await supabaseAdmin
    .from("ustawy")
    .select("numer_druku, opis_ludzki")
    .not("opis_ludzki", "is", null)
    .range(0, 9999);

  if (existingError) {
    return {
      status: "error",
      synced: 0,
      summariesGenerated: 0,
      drukiFromApi: processes.length,
      numery: [],
      message: existingError.message,
    };
  }

  const alreadyDescribed = new Set(
    (existing ?? []).map((row) => (row as { numer_druku: string }).numer_druku),
  );

  const timestamp = new Date().toISOString();

  const rows = await mapWithConcurrency(
    selected,
    PROCESS_DETAIL_CONCURRENCY,
    async (process) => {
      const numerDruku = process.number!;
      const tytul = process.title!.trim();
      const autor = resolveAutor(tytul, process.comments);
      const print = printIndex.get(numerDruku);

      const row: UstawaMetadataRow = {
        numer_druku: numerDruku,
        tytul_oficjalny: tytul,
        autor,
        data_wplywu:
          print?.deliveryDate ??
          process.processStartDate ??
          process.documentDate ??
          null,
        etap_legislacyjny: await resolveEtapLegislacyjny(process),
        pdf_url: print?.pdfUrl ?? null,
        zaktualizowano_at: timestamp,
      };

      const keepExistingSummary =
        alreadyDescribed.has(numerDruku) && !options.refreshSummaries;

      return keepExistingSummary
        ? row
        : { ...row, ...buildHumanSummary({ title: tytul, autor }) };
    },
  );

  // Kolumny tagi celowo nie ma w zapisie — wypełni ją warstwa AI, a wysłanie
  // pustej tablicy kasowałoby jej wynik przy każdej synchronizacji.
  const withSummary = rows.filter((row) => "opis_ludzki" in row);
  const metadataOnly = rows.filter((row) => !("opis_ludzki" in row));
  const summariesGenerated = withSummary.length;

  const summaryError = await upsertInChunks(withSummary);

  if (summaryError) {
    return {
      status: "error",
      synced: 0,
      summariesGenerated: 0,
      drukiFromApi: processes.length,
      numery,
      message: summaryError,
    };
  }

  const metadataError = await upsertInChunks(metadataOnly);

  if (metadataError) {
    return {
      status: "error",
      synced: withSummary.length,
      summariesGenerated,
      drukiFromApi: processes.length,
      numery,
      message: metadataError,
    };
  }

  return {
    status: "ok",
    synced: rows.length,
    summariesGenerated,
    drukiFromApi: processes.length,
    numery,
  };
}
