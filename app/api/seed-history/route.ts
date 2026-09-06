import { NextResponse } from "next/server";

import { drukLookupKeys, extractDrukNumbers } from "@/lib/glosowania";
import { fetchSejmJson, SEJM_API_BASE, SEJM_TERM } from "@/lib/sejm-api";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { resolveAutor } from "@/lib/sync-ustawy";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const PRINTS_URL = `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/prints`;
const PROCEEDINGS_URL = `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/proceedings`;
const CHUNK_SIZE = 100;
const REQUEST_DELAY_MS = 200;

type SejmPrint = {
  number?: string;
  title?: string;
  deliveryDate?: string;
  documentDate?: string;
  attachments?: string[];
};

type SejmProceeding = {
  number?: number;
};

type SejmVoting = {
  sitting?: number;
  votingNumber?: number;
  title?: string;
  topic?: string;
  description?: string;
  date?: string;
  yes?: number;
  no?: number;
  abstain?: number;
  notParticipating?: number;
};

type UstawaRow = {
  numer_druku: string;
  tytul_oficjalny: string;
  autor: string | null;
  data_wplywu: string | null;
  pdf_url: string | null;
  zaktualizowano_at: string;
};

type GlosowanieRow = {
  ustawa_id: number;
  sitting: number;
  numer_glosowania: number;
  tytul: string;
  temat: string | null;
  data_glosowania: string | null;
  za: number;
  przeciw: number;
  wstrzymalo_sie: number;
  nieobecni: number;
  zaktualizowano_at: string;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function chunksOf<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];

  for (let start = 0; start < items.length; start += size) {
    chunks.push(items.slice(start, start + size));
  }

  return chunks;
}

function pickPdfUrl(print: SejmPrint): string | null {
  const pdfs = (print.attachments ?? []).filter((name) => name.toLowerCase().endsWith(".pdf"));

  if (!print.number || pdfs.length === 0) {
    return null;
  }

  const file = pdfs.find((name) => name === `${print.number}.pdf`) ?? pdfs[0];

  return `${PRINTS_URL}/${encodeURIComponent(print.number)}/${encodeURIComponent(file)}`;
}

function matchUstawaId(voting: SejmVoting, drukIndex: Map<string, number>): number | null {
  const text = [voting.title, voting.description, voting.topic].filter(Boolean).join(" ");

  for (const numer of extractDrukNumbers(text)) {
    for (const key of drukLookupKeys(numer)) {
      const ustawaId = drukIndex.get(key);

      if (ustawaId !== undefined) {
        return ustawaId;
      }
    }
  }

  return null;
}

async function upsertChunks<T>(
  table: "ustawy" | "glosowania",
  rows: T[],
  onConflict: string,
): Promise<number> {
  let saved = 0;

  for (const chunk of chunksOf(rows, CHUNK_SIZE)) {
    const { error } = await supabaseAdmin.from(table).upsert(chunk, { onConflict });

    if (error) {
      throw new Error(`${table}: ${error.message}`);
    }

    saved += chunk.length;
  }

  return saved;
}

async function fetchDrukIndex(): Promise<Map<string, number>> {
  const { data, error } = await supabaseAdmin.from("ustawy").select("id, numer_druku").range(0, 9999);

  if (error) {
    throw new Error(error.message);
  }

  const index = new Map<string, number>();

  for (const row of data ?? []) {
    index.set(String(row.numer_druku), Number(row.id));
  }

  return index;
}

export async function GET() {
  try {
    console.log("Seed historii: pobieram druki X kadencji…");

    const prints = await fetchSejmJson<SejmPrint[]>(PRINTS_URL, {
      revalidate: 0,
      timeoutMs: 60_000,
    });

    if (!prints || prints.length === 0) {
      return NextResponse.json(
        { status: "error", message: "API Sejmu nie zwróciło listy druków." },
        { status: 502 },
      );
    }

    const now = new Date().toISOString();
    const ustawaRows: UstawaRow[] = [];

    for (const print of prints) {
      const numer = print.number?.trim();
      const tytul = print.title?.trim();

      if (!numer || !tytul) {
        continue;
      }

      ustawaRows.push({
        numer_druku: numer,
        tytul_oficjalny: tytul,
        autor: resolveAutor(tytul),
        data_wplywu: print.deliveryDate ?? print.documentDate ?? null,
        pdf_url: pickPdfUrl(print),
        zaktualizowano_at: now,
      });
    }

    console.log(`Seed historii: zapisuję ${ustawaRows.length} druków w paczkach po ${CHUNK_SIZE}…`);
    const ustawyZapisane = await upsertChunks("ustawy", ustawaRows, "numer_druku");
    console.log(`Seed historii: zapisano ${ustawyZapisane} ustaw.`);

    const proceedings = await fetchSejmJson<SejmProceeding[]>(PROCEEDINGS_URL, {
      revalidate: 0,
      timeoutMs: 30_000,
    });

    if (!proceedings || proceedings.length === 0) {
      return NextResponse.json(
        {
          status: "error",
          message: "API Sejmu nie zwróciło listy posiedzeń.",
          ustawy: ustawyZapisane,
          glosowania: 0,
        },
        { status: 502 },
      );
    }

    const sittingNumbers = [
      ...new Set(
        proceedings
          .map((item) => item.number)
          .filter((number): number is number => typeof number === "number" && number > 0),
      ),
    ].sort((a, b) => a - b);

    const drukIndex = await fetchDrukIndex();
    const glosowanieRows: GlosowanieRow[] = [];
    let glosowaniaZApi = 0;

    for (const [index, sitting] of sittingNumbers.entries()) {
      const votings = await fetchSejmJson<SejmVoting[]>(
        `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/votings/${sitting}`,
        { revalidate: 0, timeoutMs: 20_000 },
      );

      const lista = votings ?? [];
      glosowaniaZApi += lista.length;
      console.log(`Pobrano posiedzenie nr ${sitting} (${lista.length} głosowań).`);

      for (const voting of lista) {
        const votingNumber = voting.votingNumber;
        const sittingNumber = voting.sitting ?? sitting;

        if (typeof votingNumber !== "number") {
          continue;
        }

        const ustawaId = matchUstawaId(voting, drukIndex);

        if (ustawaId === null) {
          continue;
        }

        glosowanieRows.push({
          ustawa_id: ustawaId,
          sitting: sittingNumber,
          numer_glosowania: votingNumber,
          tytul: voting.title?.trim() || "Głosowanie",
          temat: voting.topic ?? voting.description ?? null,
          data_glosowania: voting.date ?? null,
          za: voting.yes ?? 0,
          przeciw: voting.no ?? 0,
          wstrzymalo_sie: voting.abstain ?? 0,
          nieobecni: voting.notParticipating ?? 0,
          zaktualizowano_at: now,
        });
      }

      if (index < sittingNumbers.length - 1) {
        await sleep(REQUEST_DELAY_MS);
      }
    }

    console.log(
      `Seed historii: zapisuję ${glosowanieRows.length} głosowań powiązanych z drukami (z ${glosowaniaZApi} z API)…`,
    );
    const glosowaniaZapisane = await upsertChunks(
      "glosowania",
      glosowanieRows,
      "sitting,numer_glosowania",
    );
    console.log(`Seed historii: zapisano ${glosowaniaZapisane} głosowań.`);

    return NextResponse.json({
      status: "ok",
      ustawy: ustawyZapisane,
      glosowania: glosowaniaZapisane,
      posiedzenia: sittingNumbers.length,
      glosowaniaZApi,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Nie udało się zaimportować historii.";
    console.error("Seed historii:", message);

    return NextResponse.json({ status: "error", message, ustawy: 0, glosowania: 0 }, { status: 500 });
  }
}
