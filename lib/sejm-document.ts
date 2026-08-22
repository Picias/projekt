import * as cheerio from "cheerio";

const ALLOWED_SEJM_HOSTS = new Set([
  "api.sejm.gov.pl",
  "orka.sejm.gov.pl",
  "orka2.sejm.gov.pl",
  "sejm.gov.pl",
  "www.sejm.gov.pl",
]);

const DANGEROUS_HTML_TAGS = "script, style, iframe, object, embed, form, link, meta, noscript";

export function isAllowedSejmDocumentUrl(value: string): URL | null {
  try {
    const url = new URL(value);

    if (url.protocol !== "https:") {
      return null;
    }

    if (url.username || url.password) {
      return null;
    }

    if (!ALLOWED_SEJM_HOSTS.has(url.hostname.toLowerCase())) {
      return null;
    }

    return url;
  } catch {
    return null;
  }
}

export function sanitizeSejmHtml(html: string): string {
  const $ = cheerio.load(html);

  $(DANGEROUS_HTML_TAGS).remove();
  $("head").remove();

  $("*").each((_, element) => {
    const attribs = (element as { attribs?: Record<string, string> }).attribs;

    if (!attribs) {
      return;
    }

    for (const name of Object.keys(attribs)) {
      const lower = name.toLowerCase();

      if (lower.startsWith("on") || lower === "style" || lower === "srcdoc") {
        $(element).removeAttr(name);
      }
    }
  });

  $("a").each((_, element) => {
    const href = $(element).attr("href")?.trim() ?? "";

    if (!href || href.startsWith("#")) {
      return;
    }

    const allowed = isAllowedSejmDocumentUrl(href);

    if (!allowed) {
      $(element).removeAttr("href");
      return;
    }

    $(element).attr("href", allowed.toString());
    $(element).attr("target", "_blank");
    $(element).attr("rel", "noopener noreferrer");
  });

  return ($("body").html() ?? "").trim();
}

export function htmlToPlainText(html: string): string {
  const withoutNoise = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h[1-6]|li|tr|blockquote|section|article)>/gi, "\n");

  const withoutTags = withoutNoise.replace(/<[^>]+>/g, " ");

  return decodeHtmlEntities(withoutTags)
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n[ \t]+/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&#x([0-9a-f]+);/gi, (_, hex: string) => {
      const code = Number.parseInt(hex, 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&#(\d+);/g, (_, dec: string) => {
      const code = Number.parseInt(dec, 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : "";
    })
    .replace(/&nbsp;/gi, " ")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&amp;/gi, "&");
}
