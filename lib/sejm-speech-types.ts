export type ScrapedSpeech = {
  sitting: number | null;
  day: number | null;
  date: string | null;
  dateLabel: string | null;
  agendaNumber: string | null;
  title: string;
  path: string;
  videoPath: string | null;
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

export function speechWatchHref(path: string, fromPath?: string): string {
  const params = new URLSearchParams({ path });

  if (fromPath && fromPath.startsWith("/") && !fromPath.startsWith("//")) {
    params.set("from", fromPath);
  }

  return `/wystapienia?${params.toString()}`;
}
