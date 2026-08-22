import { SEJM_FETCH_TIMEOUT_MS } from "@/lib/sejm-api";

export const SEJM_SITE_ORIGIN = "https://www.sejm.gov.pl";
export const SEJM_SITE_BASE = `${SEJM_SITE_ORIGIN}/Sejm10.nsf`;

const SEJM_BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

const MAX_REDIRECTS = 10;

export type SejmHtmlSession = {
  cookies: Map<string, string>;
};

function cookieHeader(cookies: Map<string, string>): string {
  return [...cookies.entries()].map(([name, value]) => `${name}=${value}`).join("; ");
}

function applySetCookie(headers: Headers, cookies: Map<string, string>) {
  const setCookie =
    typeof headers.getSetCookie === "function" ? headers.getSetCookie() : [];

  for (const header of setCookie) {
    const pair = header.split(";", 1)[0];
    const separator = pair.indexOf("=");

    if (separator <= 0) {
      continue;
    }

    cookies.set(pair.slice(0, separator).trim(), pair.slice(separator + 1).trim());
  }
}

export function createSejmHtmlSession(): SejmHtmlSession {
  return { cookies: new Map() };
}

export async function fetchSejmHtml(
  url: string,
  session: SejmHtmlSession = createSejmHtmlSession(),
  timeoutMs = SEJM_FETCH_TIMEOUT_MS,
): Promise<string> {
  let current = url;

  for (let hop = 0; hop < MAX_REDIRECTS; hop += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(current, {
        headers: {
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
          "Accept-Language": "pl,en;q=0.9",
          "User-Agent": SEJM_BROWSER_UA,
          Cookie: cookieHeader(session.cookies),
        },
        redirect: "manual",
        cache: "no-store",
        signal: controller.signal,
      });

      applySetCookie(response.headers, session.cookies);

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");

        if (!location) {
          throw new Error("Serwis Sejmu zwrócił przekierowanie bez adresu.");
        }

        current = new URL(location, current).toString();
        continue;
      }

      if (!response.ok) {
        throw new Error(`Serwer Sejmu zwrócił status ${response.status}.`);
      }

      return await response.text();
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("Serwer Sejmu odpowiada zbyt wolno.");
      }

      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  throw new Error("Zbyt wiele przekierowań serwisu Sejmu.");
}
