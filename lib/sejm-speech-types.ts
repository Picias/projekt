export type ScrapedSpeech = {
  sitting: number | null;
  day: number | null;
  date: string | null;
  dateLabel: string | null;
  agendaNumber: string | null;
  title: string;
  path: string;
  videoPath: string | null;
  /** Gotowy adres HLS zapisany przy synchronizacji. Bez niego hosting nie ma czego puścić. */
  streamUrl?: string | null;
};

export type ScrapedSpeechDetails = {
  title: string | null;
  speaker: string | null;
  transcript: string;
  paragraphs: string[];
  embedUrl: string | null;
  videoEmbedUrl: string | null;
  streamUrl: string | null;
  retransmissionUrl: string | null;
  sourceUrl: string;
};

const SEJM_SITE_BASE = "https://www.sejm.gov.pl/Sejm10.nsf";

const HLS_HOST_RE =
  /^(sejm\.c\.blueonline\.tv|r\.e\.blueonline\.tv|(?:[\w-]+\.)?e\.blueonline\.tv|(?:[\w-]+\.)?dcs\.redcdn\.pl)$/i;

/** Zostawia tylko playlistę HLS z hostów Sejmu. Resztę wyrzuca, żeby link nie stał się otwartym odtwarzaczem. */
export function trustedStreamUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();

  if (!trimmed) {
    return null;
  }

  try {
    const url = new URL(trimmed);

    if (url.protocol !== "https:" || !HLS_HOST_RE.test(url.hostname)) {
      return null;
    }

    if (!url.pathname.endsWith(".m3u8")) {
      return null;
    }

    return url.toString();
  } catch {
    return null;
  }
}

export function speechWatchHref(
  path: string,
  fromPath?: string,
  videoPath?: string | null,
  streamUrl?: string | null,
): string {
  const params = new URLSearchParams({ path });

  if (fromPath && fromPath.startsWith("/") && !fromPath.startsWith("//")) {
    params.set("from", fromPath);
  }

  if (videoPath) {
    params.set("video", videoPath);
  }

  const stream = trustedStreamUrl(streamUrl);

  if (stream) {
    params.set("stream", stream);
  }

  return `/wystapienia?${params.toString()}`;
}

/** Pełny adres retransmisji na sejm.gov.pl, gdy znamy ścieżkę z listy wypowiedzi. */
export function sejmRecordingUrl(videoPath: string | null | undefined): string | null {
  const trimmed = videoPath?.trim();

  if (!trimmed || trimmed.startsWith("javascript:")) {
    return null;
  }

  if (trimmed.startsWith("https://") || trimmed.startsWith("http://")) {
    return trimmed;
  }

  return `${SEJM_SITE_BASE}/${trimmed.replace(/^\/+/, "")}`;
}
