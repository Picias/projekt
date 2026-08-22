import { NextResponse } from "next/server";

import { htmlToPlainText, isAllowedSejmDocumentUrl } from "@/lib/sejm-document";

const FETCH_TIMEOUT_MS = 10_000;
const MAX_BYTES = 1_500_000;

function decodeBuffer(buffer: ArrayBuffer, contentType: string): string {
  const charsetMatch = /charset=([^;]+)/i.exec(contentType);
  const charset = charsetMatch?.[1]?.trim() || "utf-8";

  try {
    return new TextDecoder(charset).decode(buffer);
  } catch {
    return new TextDecoder("utf-8").decode(buffer);
  }
}

export async function GET(request: Request) {
  const rawUrl = new URL(request.url).searchParams.get("url")?.trim() ?? "";

  if (!rawUrl) {
    return NextResponse.json({ error: "Brak parametru url" }, { status: 400 });
  }

  const parsed = isAllowedSejmDocumentUrl(rawUrl);

  if (!parsed) {
    return NextResponse.json(
      { error: "Dozwolone są wyłącznie dokumenty z domen Sejmu RP." },
      { status: 400 },
    );
  }

  if (parsed.pathname.toLowerCase().endsWith(".pdf")) {
    return NextResponse.json(
      { error: "Ten adres wskazuje plik PDF, a nie treść HTML." },
      { status: 400 },
    );
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

  try {
    const response = await fetch(parsed.toString(), {
      headers: { Accept: "text/html,application/xhtml+xml,text/plain;q=0.9" },
      redirect: "follow",
      signal: controller.signal,
      next: { revalidate: 3600 },
    });

    const finalUrl = isAllowedSejmDocumentUrl(response.url);

    if (!finalUrl) {
      return NextResponse.json(
        { error: "Przekierowanie poza domeny Sejmu zostało zablokowane." },
        { status: 400 },
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: `Serwer Sejmu zwrócił status ${response.status}.` },
        { status: 502 },
      );
    }

    const contentLength = Number(response.headers.get("content-length"));

    if (Number.isFinite(contentLength) && contentLength > MAX_BYTES) {
      return NextResponse.json({ error: "Dokument jest zbyt duży." }, { status: 413 });
    }

    const buffer = await response.arrayBuffer();

    if (buffer.byteLength > MAX_BYTES) {
      return NextResponse.json({ error: "Dokument jest zbyt duży." }, { status: 413 });
    }

    const html = decodeBuffer(buffer, response.headers.get("content-type") ?? "");
    const text = htmlToPlainText(html);

    if (!text) {
      return NextResponse.json(
        { error: "Nie udało się odczytać tekstu z tego dokumentu." },
        { status: 422 },
      );
    }

    return NextResponse.json({ text });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";

    return NextResponse.json(
      {
        error: timedOut
          ? "Serwer Sejmu odpowiada zbyt wolno."
          : "Nie udało się pobrać dokumentu Sejmu.",
      },
      { status: 502 },
    );
  } finally {
    clearTimeout(timeoutId);
  }
}
