import * as cheerio from "cheerio";

import { formatMpApiId } from "@/lib/sejm-api";
import {
  createSejmHtmlSession,
  fetchSejmHtml,
  SEJM_SITE_BASE,
  SEJM_SITE_ORIGIN,
  type SejmHtmlSession,
} from "@/lib/sejm-html";
import type { ScrapedSpeech, ScrapedSpeechDetails } from "@/lib/sejm-speech-types";

export type { ScrapedSpeech, ScrapedSpeechDetails } from "@/lib/sejm-speech-types";

const SPEECH_PAGE_RE =
  /^(wypowiedz|transmisja|transmisje_arch|VideoFrame|posiedzenie)\.xsp(?:\?|$)/i;
const UNID_RE = /^[A-F0-9]{32}$/i;
const POLISH_DATE_RE = /^(\d{1,2})-(\d{1,2})-(\d{4})$/;
const EMBED_HOST_RE = /(sejm\.gov\.pl|sejm\.c\.blueonline\.tv|blueonline\.tv)/i;

function decodeEntities(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toIsoDate(label: string | null): string | null {
  if (!label) {
    return null;
  }

  const match = POLISH_DATE_RE.exec(label);

  if (!match) {
    return null;
  }

  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function parseInteger(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const parsed = Number.parseInt(value.replace(/[^\d-]/g, ""), 10);
  return Number.isInteger(parsed) ? parsed : null;
}

function normalizeSejmPath(href: string | undefined): string | null {
  if (!href) {
    return null;
  }

  const trimmed = href.trim();

  if (
    !trimmed ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("javascript:") ||
    trimmed.includes("://") ||
    trimmed.startsWith("//") ||
    trimmed.includes("..")
  ) {
    return null;
  }

  const withoutPrefix = trimmed.replace(/^\/+/, "").replace(/^Sejm10\.nsf\//i, "");

  if (!SPEECH_PAGE_RE.test(withoutPrefix)) {
    return null;
  }

  return withoutPrefix;
}

export function resolveSejmSpeechUrl(path: string): URL | null {
  const normalized = normalizeSejmPath(path.trim().replace(/^\//, ""));

  if (!normalized) {
    return null;
  }

  try {
    const url = new URL(normalized, `${SEJM_SITE_BASE}/`);

    if (url.origin !== "https://www.sejm.gov.pl") {
      return null;
    }

    if (!url.pathname.toLowerCase().includes("/sejm10.nsf/")) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

function absolutizeSejmUrl(src: string): string | null {
  const trimmed = src.trim();

  if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith("javascript:")) {
    return null;
  }

  try {
    if (trimmed.startsWith("//")) {
      return `https:${trimmed}`;
    }

    if (trimmed.startsWith("/")) {
      return `${SEJM_SITE_ORIGIN}${trimmed}`;
    }

    return new URL(trimmed, `${SEJM_SITE_BASE}/`).toString();
  } catch {
    return null;
  }
}

function isPreferredPlayerUrl(url: string): boolean {
  const lower = url.toLowerCase();
  return lower.includes("videoframe.xsp") || /blueonline\.tv/i.test(lower);
}

function isAllowedEmbedUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && EMBED_HOST_RE.test(parsed.hostname);
  } catch {
    return false;
  }
}

function pickIframeSrc($: cheerio.CheerioAPI): string | null {
  const candidates: string[] = [];

  $("iframe").each((_, element) => {
    const src = $(element).attr("src") || $(element).attr("data-src");
    const absolute = src ? absolutizeSejmUrl(src) : null;

    if (absolute && isAllowedEmbedUrl(absolute)) {
      candidates.push(absolute);
    }
  });

  return candidates.find(isPreferredPlayerUrl) ?? candidates[0] ?? null;
}

function parseVideoParams(html: string): { db?: string; unid?: string } | null {
  const unid = html.match(/"unid"\s*:\s*"([A-F0-9]{32})"/i)?.[1];
  const db = html.match(/"db"\s*:\s*"([^"]+)"/)?.[1];

  if (!unid && !db) {
    return null;
  }

  return { unid, db };
}

function videoFrameUrl(unid: string, db = "Wypowiedz"): string {
  return `${SEJM_SITE_BASE}/VideoFrame.xsp/${encodeURIComponent(db)}/${unid}`;
}

function sejmDateToMillis(value: string): number | null {
  const match = value
    .trim()
    .match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/);

  if (!match) {
    return null;
  }

  const asUtc = Date.parse(`${match[1]}T${match[2]}Z`);

  if (Number.isNaN(asUtc)) {
    return null;
  }

  const warsawStamp = new Date(asUtc).toLocaleString("sv-SE", {
    timeZone: "Europe/Warsaw",
  });
  const warsawAsUtc = Date.parse(warsawStamp.replace(" ", "T") + "Z");

  if (Number.isNaN(warsawAsUtc)) {
    return null;
  }

  return asUtc - (warsawAsUtc - asUtc);
}

function parsePlayerConfig(html: string): {
  unid?: string;
  camera?: string;
  start?: string;
  stop?: string;
} | null {
  const unid =
    html.match(/unid:\s*['"]([A-F0-9]{32})['"]/i)?.[1] ??
    html.match(/"unid"\s*:\s*"([A-F0-9]{32})"/i)?.[1];
  const camera =
    html.match(/cameras:\s*\[\s*['"]([^'"]+)['"]/)?.[1] ??
    html.match(/\/sejm\/(ENC\d+)\//i)?.[1];
  const timeShift = html.match(/timeShift:\s*\{([^}]+)\}/)?.[1] ?? "";
  const start =
    timeShift.match(/start:\s*"([^"]+)"/)?.[1] ??
    html.match(/"start"\s*:\s*"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})"/)?.[1];
  const stop =
    timeShift.match(/stop:\s*"([^"]+)"/)?.[1] ??
    html.match(/"stop"\s*:\s*"(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2})"/)?.[1];

  if (!unid && !start) {
    return null;
  }

  return { unid, camera, start, stop };
}

function buildHlsStreamUrl(
  unid: string,
  camera = "ENC01",
  start?: string,
  stop?: string,
): string {
  const url = new URL(
    `https://sejm.c.blueonline.tv/stream/${encodeURIComponent(camera)}/${unid}/playlist.m3u8`,
  );

  if (start) {
    const millis = sejmDateToMillis(start);
    if (millis) {
      url.searchParams.set("start", String(millis));
    }
  }

  if (stop) {
    const millis = sejmDateToMillis(stop);
    if (millis) {
      url.searchParams.set("stop", String(millis));
    }
  }

  return url.toString();
}

const HLS_HOST_RE =
  /^(sejm\.c\.blueonline\.tv|r\.e\.blueonline\.tv|(?:[\w-]+\.)?e\.blueonline\.tv|(?:[\w-]+\.)?dcs\.redcdn\.pl)$/i;

function isAllowedHlsUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" && HLS_HOST_RE.test(parsed.hostname);
  } catch {
    return false;
  }
}

async function resolveHlsPlaybackUrl(streamUrl: string): Promise<string> {
  try {
    const response = await fetch(streamUrl, {
      headers: {
        Accept: "application/vnd.apple.mpegurl,application/x-mpegURL,*/*",
      },
      redirect: "follow",
    });
    const playbackUrl = response.ok && isAllowedHlsUrl(response.url)
      ? response.url
      : streamUrl;

    await response.arrayBuffer();
    return playbackUrl;
  } catch {
    return streamUrl;
  }
}

async function resolveVideo(
  page$: cheerio.CheerioAPI,
  pageHtml: string,
  retransmissionHref: string | null,
  session: SejmHtmlSession,
): Promise<{ embedUrl: string | null; streamUrl: string | null }> {
  const embedUrl = await resolveEmbedUrl(
    page$,
    pageHtml,
    retransmissionHref,
    session,
  );
  let streamUrl: string | null = null;

  if (embedUrl?.toLowerCase().includes("videoframe.xsp")) {
    try {
      const playerHtml = await fetchSejmHtml(embedUrl, session);
      const config = parsePlayerConfig(playerHtml);
      const unid = config?.unid && UNID_RE.test(config.unid) ? config.unid : null;

      if (unid) {
        streamUrl = buildHlsStreamUrl(
          unid,
          config?.camera ?? "ENC01",
          config?.start,
          config?.stop,
        );
      }
    } catch {
      streamUrl = null;
    }
  }

  if (!streamUrl) {
    const config = parsePlayerConfig(pageHtml);
    const unidFromLink = (() => {
      if (!retransmissionHref) {
        return null;
      }

      try {
        const url = new URL(retransmissionHref, `${SEJM_SITE_BASE}/`);
        return url.searchParams.get("documentId") ?? url.searchParams.get("unid");
      } catch {
        return null;
      }
    })();
    const unid =
      (config?.unid && UNID_RE.test(config.unid) ? config.unid : null) ??
      (unidFromLink && UNID_RE.test(unidFromLink) ? unidFromLink : null);

    if (unid) {
      streamUrl = buildHlsStreamUrl(
        unid,
        config?.camera ?? "ENC01",
        config?.start,
        config?.stop,
      );
    }
  }

  if (streamUrl) {
    streamUrl = await resolveHlsPlaybackUrl(streamUrl);
  }

  return { embedUrl, streamUrl };
}

async function resolveEmbedUrl(
  page$: cheerio.CheerioAPI,
  pageHtml: string,
  retransmissionHref: string | null,
  session: SejmHtmlSession,
): Promise<string | null> {
  const fromSpeechPage = pickIframeSrc(page$);

  if (fromSpeechPage && isPreferredPlayerUrl(fromSpeechPage)) {
    return fromSpeechPage;
  }

  let retransmissionHtml: string | null = null;
  let retransmission$: cheerio.CheerioAPI | null = null;

  if (retransmissionHref) {
    try {
      const retransmissionUrl = new URL(retransmissionHref, `${SEJM_SITE_BASE}/`);

      if (retransmissionUrl.hostname.toLowerCase().endsWith("sejm.gov.pl")) {
        retransmissionHtml = await fetchSejmHtml(retransmissionUrl.toString(), session);
        retransmission$ = cheerio.load(retransmissionHtml);
      }
    } catch {
      retransmissionHtml = null;
    }
  }

  const fromRetransmission = retransmission$ ? pickIframeSrc(retransmission$) : null;

  if (fromRetransmission && isPreferredPlayerUrl(fromRetransmission)) {
    return fromRetransmission;
  }

  const params = parseVideoParams(retransmissionHtml ?? pageHtml);
  const unid = params?.unid?.trim();

  if (unid && UNID_RE.test(unid)) {
    return videoFrameUrl(unid, params?.db?.trim() || "Wypowiedz");
  }

  if (retransmissionHref) {
    try {
      const url = new URL(retransmissionHref, `${SEJM_SITE_BASE}/`);
      const documentId =
        url.searchParams.get("documentId") ?? url.searchParams.get("unid");

      if (documentId && UNID_RE.test(documentId)) {
        return videoFrameUrl(documentId);
      }
    } catch {
      // ignore malformed retransmission links
    }
  }

  return fromRetransmission ?? fromSpeechPage;
}

function parseSpeechRows($: cheerio.CheerioAPI): ScrapedSpeech[] {
  const table = $("table.lista-wyp, table.Wypowiedzi, table.table").first();
  const speeches: ScrapedSpeech[] = [];

  table.find("tbody tr").each((_, row) => {
    const cells = $(row).find("td");

    if (cells.length < 5) {
      return;
    }

    const sitting = parseInteger(decodeEntities(cells.eq(0).text()));
    const day = parseInteger(decodeEntities(cells.eq(1).text()));
    const dateLabel = decodeEntities(cells.eq(2).text()) || null;
    const agendaNumber = decodeEntities(cells.eq(3).text()) || null;
    const titleCell = cells.eq(4);
    const titleLink = titleCell.find("a[href]").first();
    const title = decodeEntities(titleLink.text() || titleCell.text());
    const path =
      normalizeSejmPath(titleLink.attr("href")) ??
      normalizeSejmPath($(row).find('a[href*="wypowiedz.xsp"]').first().attr("href"));
    const videoPath = normalizeSejmPath(
      $(row)
        .find(
          'a[href*="transmisja.xsp"], a[href*="transmisje_arch.xsp"], a[href*="VideoFrame.xsp"]',
        )
        .first()
        .attr("href"),
    );

    if (!path || !title) {
      return;
    }

    speeches.push({
      sitting,
      day,
      date: toIsoDate(dateLabel),
      dateLabel,
      agendaNumber,
      title,
      path,
      videoPath,
    });
  });

  return speeches;
}

function speechesListUrl(mpId: string, variant: "mp" | "generic"): string {
  if (variant === "mp") {
    return `${SEJM_SITE_BASE}/wypowiedzi.xsp?id=${encodeURIComponent(mpId)}&type=P&symbol=WYPOWIEDZI_POSLA`;
  }

  return `${SEJM_SITE_BASE}/wypowiedzi.xsp?id=${encodeURIComponent(mpId)}&type=A`;
}

export async function scrapeMpSpeeches(id: number): Promise<ScrapedSpeech[]> {
  const mpId = formatMpApiId(id);
  const session: SejmHtmlSession = { cookies: new Map() };
  const html = await fetchSejmHtml(speechesListUrl(mpId, "mp"), session);
  const speeches = parseSpeechRows(cheerio.load(html));

  if (speeches.length > 0) {
    return speeches;
  }

  const fallbackHtml = await fetchSejmHtml(speechesListUrl(mpId, "generic"), session);
  return parseSpeechRows(cheerio.load(fallbackHtml));
}

export async function scrapeSpeechDetails(
  path: string,
): Promise<ScrapedSpeechDetails> {
  const url = resolveSejmSpeechUrl(path);

  if (!url) {
    throw new Error("Nieprawidłowa ścieżka wystąpienia Sejmu.");
  }

  const session = createSejmHtmlSession();
  const html = await fetchSejmHtml(url.toString(), session);
  const $ = cheerio.load(html);
  const stenogram = $(".stenogram").first();
  const title =
    decodeEntities(stenogram.find("p.punkt-tytul").first().text()) ||
    decodeEntities($("h1 small").first().text()) ||
    null;
  const speaker =
    decodeEntities(stenogram.find("h2.mowca").first().text()).replace(/:$/, "") ||
    null;

  const paragraphs: string[] = [];

  stenogram.find("p").each((_, element) => {
    const node = $(element);

    if (node.hasClass("punkt-tytul")) {
      return;
    }

    const text = decodeEntities(node.text());

    if (text) {
      paragraphs.push(text);
    }
  });

  if (paragraphs.length === 0) {
    $("div#contentBody p").each((_, element) => {
      const node = $(element);

      if (node.hasClass("punkt-tytul") || node.hasClass("przebieg")) {
        return;
      }

      const text = decodeEntities(node.text());

      if (text) {
        paragraphs.push(text);
      }
    });
  }

  const retransmissionHref =
    $('a[href*="transmisja.xsp"], a[href*="transmisje_arch.xsp"]').first().attr(
      "href",
    ) ?? null;
  const retransmissionPath = normalizeSejmPath(retransmissionHref ?? undefined);
  const retransmissionUrl = retransmissionPath
    ? `${SEJM_SITE_BASE}/${retransmissionPath}`
    : retransmissionHref
      ? new URL(retransmissionHref, `${SEJM_SITE_BASE}/`).toString()
      : null;
  const { embedUrl, streamUrl } = await resolveVideo(
    $,
    html,
    retransmissionHref,
    session,
  );

  return {
    title,
    speaker,
    transcript: paragraphs.join("\n\n"),
    paragraphs,
    embedUrl,
    videoEmbedUrl: embedUrl,
    streamUrl,
    retransmissionUrl,
    sourceUrl: url.toString(),
  };
}
