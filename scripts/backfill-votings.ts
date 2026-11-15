/**
 * Jednorazowe zasilenie bazy głosami z całej 10. kadencji Sejmu, bez wniosków
 * proceduralnych. Skrypt stoi poza Next.js.
 *
 * Instalacja i uruchomienie z katalogu projektu:
 *   npm install -D tsx
 *   npx tsx scripts/backfill-votings.ts
 *
 * @supabase/supabase-js jest już w zależnościach, więc osobno potrzebny jest tylko tsx.
 * Adres i klucz biorą się z .env.local, a gdy tego pliku nie ma — z .env:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY albo, w drugiej kolejności, NEXT_PUBLIC_SUPABASE_ANON_KEY
 *
 * Zapis idzie do posel_glosowania. To tabela, z której liczą się statystyki posła.
 * glosowania trzyma jeden wiersz na głosowanie nad drukiem i wymaga ustawa_id,
 * więc nie pomieści głosu każdego posła. Upsert opiera się o istniejący klucz
 * (posel_id, sitting, numer_glosowania) — para z API Sejmu, która identyfikuje
 * głos posła tak samo jak id głosowania i id posła.
 *
 * Przerwany przebieg wznawia się tą samą komendą. Numery już zapisanych
 * głosowań siedzą w scripts/.backfill-votings-progress.json.
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const PROCEDURAL_KEYWORDS = [
  "przerw",
  "odroczeni",
  "wniosek formalny",
  "porządku dziennego",
  "sposób głosowania",
  "zamknięcie posiedzenia",
  "tajności głosowania",
];

const sleep = (ms: number) => new Promise((resolveSleep) => setTimeout(resolveSleep, ms));

const SEJM_API_BASE = "https://api.sejm.gov.pl";
const SEJM_TERM = 10;
const REQUEST_GAP_MS = 600;
const UPSERT_CHUNK = 400;
const PROGRESS_PATH = resolve(process.cwd(), "scripts/.backfill-votings-progress.json");

type SejmProceedingDay = {
  proceeding?: number;
  date?: string;
  votingsNum?: number;
};

type SejmVotingSummary = {
  sitting?: number;
  votingNumber?: number;
  title?: string;
  topic?: string;
  description?: string;
  date?: string;
};

type SejmVote = {
  MP?: number;
  club?: string;
  vote?: string;
};

type SejmVotingDetails = SejmVotingSummary & {
  yes?: number;
  no?: number;
  abstain?: number;
  majorityVotes?: number;
  votes?: SejmVote[];
};

type VoteRow = {
  posel_id: number;
  sitting: number;
  numer_glosowania: number;
  data: string;
  tytul: string | null;
  temat: string | null;
  opis: string | null;
  glos: string;
  wynik: string | null;
  glosy_za: number | null;
  glosy_przeciw: number | null;
  glosy_wstrzymal: number | null;
  linia_klubu: string | null;
  zgodnosc_klubowa: boolean | null;
};

const GRAY = "\x1b[90m";
const RESET = "\x1b[0m";

let lastRequestAt = 0;

function loadEnvFile(): void {
  const candidates = [resolve(process.cwd(), ".env.local"), resolve(process.cwd(), ".env")];

  for (const path of candidates) {
    if (!existsSync(path)) {
      continue;
    }

    const raw = readFileSync(path, "utf8").replace(/^\uFEFF/, "");

    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();

      if (!trimmed || trimmed.startsWith("#")) {
        continue;
      }

      const eq = trimmed.indexOf("=");

      if (eq === -1) {
        continue;
      }

      const key = trimmed.slice(0, eq).trim();
      const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");

      if (process.env[key] === undefined) {
        process.env[key] = value;
      }
    }

    return;
  }

  throw new Error("Brak pliku .env.local i .env z dostępem do Supabase.");
}

function requireEnv(name: string): string {
  const value = process.env[name]?.trim();

  if (!value) {
    throw new Error(`Brak zmiennej ${name}.`);
  }

  return value;
}

function votingKey(sitting: number, votingNumber: number): string {
  return `${sitting}/${votingNumber}`;
}

function loadProgress(): Set<string> {
  if (!existsSync(PROGRESS_PATH)) {
    return new Set();
  }

  try {
    const parsed: unknown = JSON.parse(readFileSync(PROGRESS_PATH, "utf8"));
    const done = (parsed as { done?: unknown }).done;

    if (!Array.isArray(done)) {
      return new Set();
    }

    return new Set(done.filter((item): item is string => typeof item === "string"));
  } catch {
    return new Set();
  }
}

function saveProgress(done: Set<string>): void {
  writeFileSync(PROGRESS_PATH, JSON.stringify({ done: [...done] }));
}

function isProcedural(voting: SejmVotingSummary): boolean {
  const haystack = `${voting.title ?? ""} ${voting.topic ?? ""}`.toLocaleLowerCase("pl");

  return PROCEDURAL_KEYWORDS.some((keyword) => haystack.includes(keyword));
}

function votingDate(value: string | undefined): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(value ?? "");

  return match?.[1] ?? null;
}

function outcomeOf(details: SejmVotingDetails): string {
  const yes = details.yes ?? 0;
  const no = details.no ?? 0;
  const majority = details.majorityVotes ?? Math.floor((yes + no) / 2) + 1;

  if (yes >= majority && yes > no) {
    return "passed";
  }

  if (no >= majority && no > yes) {
    return "rejected";
  }

  if (yes > no) {
    return "passed";
  }

  if (no > yes) {
    return "rejected";
  }

  return "inconclusive";
}

function clubLine(votes: SejmVote[], club: string | undefined): string | null {
  if (!club) {
    return null;
  }

  const tally = new Map<string, number>();

  for (const vote of votes) {
    if (vote.club !== club || !vote.vote) {
      continue;
    }

    if (vote.vote === "ABSENT" || vote.vote === "PRESENT" || vote.vote === "NO_VOTE") {
      continue;
    }

    tally.set(vote.vote, (tally.get(vote.vote) ?? 0) + 1);
  }

  let topVote: string | null = null;
  let topCount = 0;

  for (const [vote, count] of tally) {
    if (count > topCount) {
      topVote = vote;
      topCount = count;
    }
  }

  if (!topVote) {
    return null;
  }

  const tied = [...tally.values()].filter((count) => count === topCount).length;

  return tied > 1 ? null : topVote;
}

async function pace(): Promise<void> {
  if (lastRequestAt === 0) {
    return;
  }

  const wait = REQUEST_GAP_MS - (Date.now() - lastRequestAt);

  if (wait > 0) {
    await sleep(wait);
  }
}

async function sejmGet<T>(path: string): Promise<T | null> {
  const url = `${SEJM_API_BASE}${path}`;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    await pace();

    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(20_000),
      });
      lastRequestAt = Date.now();

      if (response.status === 404) {
        return null;
      }

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(`API Sejmu zwróciło ${response.status} dla ${path}`);
        await sleep(REQUEST_GAP_MS * attempt);
        continue;
      }

      if (!response.ok) {
        throw new Error(`API Sejmu zwróciło ${response.status} dla ${path}`);
      }

      return (await response.json()) as T;
    } catch (error) {
      lastRequestAt = Date.now();
      const current = error instanceof Error ? error : new Error(String(error));

      if (!/429|5\d\d|AbortError|TimeoutError|fetch failed|network/i.test(current.message + current.name)) {
        throw current;
      }

      lastError = current;
      await sleep(REQUEST_GAP_MS * attempt);
    }
  }

  throw lastError ?? new Error(`API Sejmu nie odpowiedziało dla ${path}`);
}

async function fetchSittingNumbers(): Promise<number[]> {
  const days = await sejmGet<SejmProceedingDay[]>(`/sejm/term${SEJM_TERM}/votings`);

  if (!days) {
    throw new Error("API Sejmu nie zwróciło listy dni głosowań.");
  }

  const numbers = new Set<number>();

  for (const day of days) {
    if (typeof day.proceeding === "number" && day.proceeding > 0 && (day.votingsNum ?? 0) > 0) {
      numbers.add(day.proceeding);
    }
  }

  return [...numbers].sort((a, b) => a - b);
}

async function fetchKnownPoselIds(supabase: SupabaseClient): Promise<Set<number>> {
  const ids = new Set<number>();
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from("poslowie")
      .select("id")
      .range(from, from + pageSize - 1);

    if (error) {
      throw new Error(error.message);
    }

    const rows = (data ?? []) as { id: number }[];

    for (const row of rows) {
      ids.add(Number(row.id));
    }

    if (rows.length < pageSize) {
      break;
    }
  }

  if (ids.size === 0) {
    throw new Error("Tabela poslowie jest pusta. Najpierw zsynchronizuj posłów.");
  }

  return ids;
}

function buildRows(
  details: SejmVotingDetails,
  summary: SejmVotingSummary,
  sitting: number,
  votingNumber: number,
  knownPoselIds: Set<number>,
): { rows: VoteRow[]; outside: number } {
  const data = votingDate(details.date ?? summary.date);

  if (!data) {
    throw new Error(`Głosowanie ${sitting}/${votingNumber} nie ma daty.`);
  }

  const votes = details.votes ?? [];
  const wynik = outcomeOf(details);
  const rows: VoteRow[] = [];
  let outside = 0;

  for (const vote of votes) {
    if (typeof vote.MP !== "number" || !vote.vote) {
      continue;
    }

    if (!knownPoselIds.has(vote.MP)) {
      outside += 1;
      continue;
    }

    const line = clubLine(votes, vote.club);
    const counted =
      vote.vote !== "ABSENT" && vote.vote !== "PRESENT" && vote.vote !== "NO_VOTE";

    rows.push({
      posel_id: vote.MP,
      sitting,
      numer_glosowania: votingNumber,
      data,
      tytul: details.title ?? summary.title ?? null,
      temat: details.topic ?? summary.topic ?? null,
      opis: details.description ?? summary.description ?? null,
      glos: vote.vote,
      wynik,
      glosy_za: details.yes ?? null,
      glosy_przeciw: details.no ?? null,
      glosy_wstrzymal: details.abstain ?? null,
      linia_klubu: line,
      zgodnosc_klubowa: line && counted ? vote.vote === line : null,
    });
  }

  return { rows, outside };
}

async function upsertRows(supabase: SupabaseClient, rows: VoteRow[]): Promise<void> {
  for (let start = 0; start < rows.length; start += UPSERT_CHUNK) {
    const chunk = rows.slice(start, start + UPSERT_CHUNK);
    const { error } = await supabase
      .from("posel_glosowania")
      .upsert(chunk, { onConflict: "posel_id,sitting,numer_glosowania" });

    if (error) {
      throw new Error(error.message);
    }
  }
}

async function main(): Promise<void> {
  loadEnvFile();

  const supabase = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    { auth: { persistSession: false, autoRefreshToken: false } },
  );

  const done = loadProgress();
  const knownPoselIds = await fetchKnownPoselIds(supabase);
  const sittings = await fetchSittingNumbers();

  console.log(
    `Kadencja ${SEJM_TERM}: ${sittings.length} posiedzeń z głosowaniami. ` +
      `W pliku postępu jest już ${done.size} głosowań. Posłów w bazie: ${knownPoselIds.size}.`,
  );

  let savedVotes = 0;
  let savedVotings = 0;
  let skippedProcedural = 0;

  for (let index = 0; index < sittings.length; index += 1) {
    const sitting = sittings[index];
    console.log(`Pobieram posiedzenie ${sitting}... (${index + 1}/${sittings.length})`);

    const list = await sejmGet<SejmVotingSummary[]>(
      `/sejm/term${SEJM_TERM}/votings/${sitting}`,
    );

    if (!list) {
      console.log(`Posiedzenie ${sitting} nie ma listy głosowań.`);
      continue;
    }

    const votings = list
      .filter(
        (voting): voting is SejmVotingSummary & { votingNumber: number } =>
          typeof voting.votingNumber === "number",
      )
      .sort((a, b) => a.votingNumber - b.votingNumber);

    for (const voting of votings) {
      const key = votingKey(sitting, voting.votingNumber);

      if (done.has(key)) {
        continue;
      }

      const title = voting.title?.trim() || voting.topic?.trim() || "bez tytułu";

      if (isProcedural(voting)) {
        skippedProcedural += 1;
        console.log(`${GRAY}[POMIJAM] Wniosek proceduralny: ${title}${RESET}`);
        done.add(key);
        saveProgress(done);
        continue;
      }

      const details = await sejmGet<SejmVotingDetails>(
        `/sejm/term${SEJM_TERM}/votings/${sitting}/${voting.votingNumber}`,
      );

      if (!details) {
        console.log(`Brak szczegółów głosowania ${sitting}/${voting.votingNumber}: ${title}`);
        continue;
      }

      const { rows, outside } = buildRows(details, voting, sitting, voting.votingNumber, knownPoselIds);

      if (rows.length === 0) {
        console.log(`Głosowanie ${sitting}/${voting.votingNumber} nie ma głosów posłów z bazy.`);
        done.add(key);
        saveProgress(done);
        continue;
      }

      await upsertRows(supabase, rows);
      savedVotes += rows.length;
      savedVotings += 1;
      done.add(key);
      saveProgress(done);

      const outsideNote = outside > 0 ? ` (pominięto ${outside} spoza tabeli poslowie)` : "";
      console.log(`Zapisano ${rows.length} głosów do bazy${outsideNote}`);
    }
  }

  console.log(
    `Koniec. Zapisane głosowania: ${savedVotings}. Głosy posłów: ${savedVotes}. ` +
      `Pominięte wnioski proceduralne: ${skippedProcedural}.`,
  );
}

process.on("SIGINT", () => {
  console.log("\nPrzerwano. Uruchom tę samą komendę, żeby wznowić od ostatniego zapisanego głosowania.");
  process.exit(130);
});

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);
  process.exit(1);
});
