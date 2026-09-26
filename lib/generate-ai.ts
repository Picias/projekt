import OpenAI, { APIError } from "openai";
import { getData } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

import { IMPACT_AREAS, MATCHABLE_IMPACT_AREA_KEYS, isImpactAreaKey } from "@/lib/impact";
import { fetchSejmJson, SEJM_API_BASE, SEJM_TERM } from "@/lib/sejm-api";

if (typeof globalThis.DOMMatrix === "undefined") {
  // @ts-ignore
  globalThis.DOMMatrix = class DOMMatrix {} as any;
}

export const PDF_TEXT_LIMIT = 100_000;
export const PRIMARY_MODEL = "gpt-5.6-luna";
export const FALLBACK_MODEL = "gpt-4o-mini";

const SYSTEM_PROMPT =
  "Jesteś ekspertem, który tłumaczy ustawy na język zwykłego człowieka. Przeanalizuj oryginalny tekst projektu (szczególnie Uzasadnienie i tabele OSR). " +
  "Odpowiedz wyłącznie JSON-em z polami: w_skrocie, kogo_dotyczy, co_zmienia, skad_pieniadze, obszary. " +
  "Twarde zasady dla pól w_skrocie, kogo_dotyczy, co_zmienia i skad_pieniadze: " +
  "1) Maksymalnie 3 punkty na sekcję, każdy w osobnej linii zaczynającej się od „• ”. Żadnych wstępów, akapitów ani czwartego punktu. " +
  "2) Każdy punkt to jedno krótkie zdanie prostym językiem, bez urzędniczego żargonu (bez słów takich jak „nowelizacja”, „przepisy przejściowe”, „podmiot”, „OSR”). " +
  "3) W każdym punkcie pogrub markdownem ** ** dokładnie 2–3 kluczowe słowa albo jedną najważniejszą frazę, np. „Podatek spadnie o **2 punkty procentowe** dla **osób zarabiających najmniej**.”. " +
  "4) Konkretne kwoty, progi i terminy wstawiaj do skad_pieniadze; jeśli dokument ich nie podaje, napisz wprost, że koszt nie jest podany. " +
  `Pole obszary to tablica od 1 do 3 kluczy z listy: ${MATCHABLE_IMPACT_AREA_KEYS.join(", ")} — obszary codziennego życia, na które projekt wpływa najmocniej. ` +
  "Oto tekst:";

type SejmPrint = {
  number?: string;
  attachments?: string[];
};

export type AiSummaryFields = {
  ai_w_skrocie: string;
  ai_kogo_dotyczy: string;
  ai_co_zmienia: string;
  ai_skad_pieniadze: string;
};

export type AiSummaryResult = {
  summary: AiSummaryFields;
  /** Etykiety obszarów życia (IMPACT_AREAS) do zapisu w kolumnie tagi. */
  tagi: string[];
};

export class GenerateAiError extends Error {
  status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "GenerateAiError";
    this.status = status;
  }
}

function firstPdfAttachment(print: SejmPrint): string | null {
  const attachments = print.attachments ?? [];
  return attachments.find((name) => name.toLowerCase().endsWith(".pdf")) ?? null;
}

export async function fetchPrintPdfUrl(numerDruku: string): Promise<string> {
  const print = await fetchSejmJson<SejmPrint>(
    `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/prints/${encodeURIComponent(numerDruku)}`,
    { revalidate: 0, timeoutMs: 15_000 },
  );

  if (!print) {
    throw new GenerateAiError(
      "Nie udało się pobrać danych druku z API Sejmu.",
      502,
    );
  }

  const attachment = firstPdfAttachment(print);

  if (!attachment) {
    throw new GenerateAiError(
      "API Sejmu nie udostępnia załącznika PDF dla tego druku.",
      404,
    );
  }

  return `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/prints/${encodeURIComponent(numerDruku)}/${encodeURIComponent(attachment)}`;
}

async function downloadPdf(pdfUrl: string): Promise<Uint8Array> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 45_000);

  try {
    const response = await fetch(pdfUrl, {
      headers: { Accept: "application/pdf" },
      cache: "no-store",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new GenerateAiError(
        `Nie udało się pobrać pliku PDF z serwera Sejmu (${response.status}).`,
        502,
      );
    }

    return new Uint8Array(await response.arrayBuffer());
  } catch (error) {
    if (error instanceof GenerateAiError) {
      throw error;
    }

    const timedOut = error instanceof Error && error.name === "AbortError";
    throw new GenerateAiError(
      timedOut
        ? "Pobieranie PDF z serwera Sejmu przekroczyło limit czasu."
        : "Nie udało się pobrać pliku PDF z serwera Sejmu.",
      502,
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function extractPdfText(pdfBytes: Uint8Array): Promise<string> {
  // Worker pdf.js jako dane w pamięci — bez szukania zewnętrznych plików .mjs na Vercelu.
  // @ts-ignore
  PDFParse.setWorker(getData());

  const parser = new PDFParse({ data: pdfBytes });

  try {
    const result = await parser.getText();
    const text = result.text.replace(/\u0000/g, "").trim();

    if (!text) {
      throw new GenerateAiError(
        "Nie udało się odczytać tekstu z PDF — plik może być skanem bez warstwy tekstowej.",
        422,
      );
    }

    return text.slice(0, PDF_TEXT_LIMIT);
  } finally {
    await parser.destroy();
  }
}

function fieldToText(value: unknown): string {
  if (typeof value === "string") {
    return value.trim();
  }

  if (Array.isArray(value)) {
    return value
      .map((item) => (typeof item === "string" ? item.trim() : ""))
      .filter(Boolean)
      .slice(0, 3)
      .map((item) => (item.startsWith("•") || item.startsWith("-") ? item : `• ${item}`))
      .join("\n");
  }

  return "";
}

function parseAreaTags(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const keys = value
    .map((item) => (typeof item === "string" ? item.trim().toLowerCase() : ""))
    .filter(isImpactAreaKey);

  return [...new Set(keys)].slice(0, 3).map((key) => IMPACT_AREAS[key].label);
}

function parseSummaryJson(raw: string): AiSummaryResult {
  const stripped = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "");

  const start = stripped.indexOf("{");
  const end = stripped.lastIndexOf("}");

  if (start === -1 || end === -1 || end <= start) {
    throw new GenerateAiError("Model nie zwrócił poprawnego JSON-a.", 502);
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(stripped.slice(start, end + 1));
  } catch {
    throw new GenerateAiError("Model nie zwrócił poprawnego JSON-a.", 502);
  }

  if (!parsed || typeof parsed !== "object") {
    throw new GenerateAiError("Model nie zwrócił poprawnego JSON-a.", 502);
  }

  const data = parsed as Record<string, unknown>;
  const summary: AiSummaryFields = {
    ai_w_skrocie: fieldToText(data.w_skrocie),
    ai_kogo_dotyczy: fieldToText(data.kogo_dotyczy),
    ai_co_zmienia: fieldToText(data.co_zmienia),
    ai_skad_pieniadze: fieldToText(data.skad_pieniadze),
  };

  if (
    !summary.ai_w_skrocie &&
    !summary.ai_kogo_dotyczy &&
    !summary.ai_co_zmienia &&
    !summary.ai_skad_pieniadze
  ) {
    throw new GenerateAiError("Model zwrócił pustą odpowiedź.", 502);
  }

  return { summary, tagi: parseAreaTags(data.obszary) };
}

function isMissingModelError(error: unknown): boolean {
  if (error instanceof APIError) {
    return error.status === 404 || error.code === "model_not_found";
  }

  return error instanceof Error && /model/i.test(error.message) && /not found|does not exist/i.test(error.message);
}

async function requestSummary(model: string, documentText: string) {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  return openai.chat.completions.create({
    model,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `${SYSTEM_PROMPT}\n\n${documentText}`,
      },
    ],
  });
}

export async function summarizeBillText(documentText: string): Promise<AiSummaryResult> {
  if (!process.env.OPENAI_API_KEY) {
    throw new GenerateAiError("Brak zmiennej środowiskowej OPENAI_API_KEY.", 500);
  }

  let completion;

  try {
    completion = await requestSummary(PRIMARY_MODEL, documentText);
  } catch (error) {
    if (!isMissingModelError(error)) {
      const message =
        error instanceof APIError
          ? error.message
          : "Nie udało się połączyć z API OpenAI.";
      throw new GenerateAiError(message, error instanceof APIError ? error.status || 502 : 502);
    }

    try {
      completion = await requestSummary(FALLBACK_MODEL, documentText);
    } catch (fallbackError) {
      const message =
        fallbackError instanceof APIError
          ? fallbackError.message
          : "Nie udało się połączyć z API OpenAI.";
      throw new GenerateAiError(
        message,
        fallbackError instanceof APIError ? fallbackError.status || 502 : 502,
      );
    }
  }

  const raw = completion.choices[0]?.message?.content;

  if (!raw) {
    throw new GenerateAiError("Model nie zwrócił treści podsumowania.", 502);
  }

  return parseSummaryJson(raw);
}

export async function generateAiSummaryFromSejm(numerDruku: string): Promise<AiSummaryResult> {
  const pdfUrl = await fetchPrintPdfUrl(numerDruku);
  const pdfBytes = await downloadPdf(pdfUrl);
  const documentText = await extractPdfText(pdfBytes);
  return summarizeBillText(documentText);
}
