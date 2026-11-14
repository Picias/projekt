"use client";

import { useEffect, useState } from "react";
import { ExternalLink } from "lucide-react";
import SejmHlsPlayer from "@/components/sejm-hls-player";
import {
  sejmRecordingUrl,
  trustedStreamUrl,
  type ScrapedSpeechDetails,
} from "@/lib/sejm-speech-types";

type SpeechViewerProps = {
  path: string;
  videoPath?: string | null;
  streamUrl?: string | null;
};

function VideoFallback({ href }: { href: string | null }) {
  return (
    <section className="flex aspect-video w-full flex-col items-center justify-center gap-4 overflow-hidden rounded-xl bg-black px-6 text-center">
      <p className="text-sm font-medium text-white/80">
        Wideo wymaga otwarcia w bezpiecznym oknie
      </p>
      {href ? (
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-semibold text-white ring-1 ring-white/20 transition-colors hover:bg-white/15"
        >
          Otwórz retransmisję
          <ExternalLink size={14} aria-hidden />
        </a>
      ) : null}
    </section>
  );
}

export default function SpeechViewer({
  path,
  videoPath = null,
  streamUrl: storedStreamUrl = null,
}: SpeechViewerProps) {
  const [details, setDetails] = useState<ScrapedSpeechDetails | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [storedFailed, setStoredFailed] = useState(false);
  const [detailsFailed, setDetailsFailed] = useState(false);
  const storedStream = trustedStreamUrl(storedStreamUrl);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);
      setDetails(null);
      setStoredFailed(false);
      setDetailsFailed(false);

      try {
        const response = await fetch(
          `/api/scrape-speech-details?path=${encodeURIComponent(path)}`,
          { cache: "no-store" },
        );
        const data = (await response.json()) as ScrapedSpeechDetails & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(data.error ?? "Nie udało się wczytać wystąpienia.");
        }

        if (!cancelled) {
          setDetails(data);
        }
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Nie udało się wczytać wystąpienia.",
          );
        }
      }
    }

    void load();

    return () => {
      cancelled = true;
    };
  }, [path]);

  const detailedStream = detailsFailed ? null : trustedStreamUrl(details?.streamUrl);
  const stored = storedFailed ? null : storedStream;
  const streamUrl = stored ?? detailedStream;
  const openUrl =
    details?.retransmissionUrl ?? details?.sourceUrl ?? sejmRecordingUrl(videoPath);

  if (error && !streamUrl && !details) {
    return (
      <div className="flex flex-col gap-5">
        <VideoFallback href={openUrl} />
        <section className="rounded-2xl border border-red-400/25 bg-red-500/10 p-5 text-sm text-red-200">
          <p className="font-semibold text-red-100">Nie udało się wczytać stenogramu</p>
          <p className="mt-2">{error}</p>
        </section>
      </div>
    );
  }

  if (!details && !streamUrl) {
    return (
      <div className="flex flex-col gap-4" aria-busy="true" aria-label="Ładowanie wystąpienia">
        <div className="aspect-video animate-pulse rounded-xl bg-white/10" />
        <div className="h-6 w-2/3 animate-pulse rounded bg-white/10" />
        <div className="h-40 animate-pulse rounded-2xl bg-white/10" />
      </div>
    );
  }

  return (
    <article className="flex flex-col gap-5">
      <header>
        {details?.speaker ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
            {details.speaker}
          </p>
        ) : null}
        <h1 className="mt-2 text-2xl font-bold leading-snug">
          {details?.title?.trim() || "Wystąpienie poselskie"}
        </h1>
      </header>

      {streamUrl ? (
        <section className="overflow-hidden rounded-xl bg-black">
          <SejmHlsPlayer
            key={streamUrl}
            src={streamUrl}
            title="Retransmisja wystąpienia z Sejmu"
            onError={() => {
              if (stored) {
                setStoredFailed(true);
                return;
              }
              setDetailsFailed(true);
            }}
          />
        </section>
      ) : (
        <VideoFallback href={openUrl} />
      )}

      <section className="rounded-3xl border border-white/10 bg-navy-800/70 p-5">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
          Stenogram
        </h2>
        {error ? (
          <p className="mt-4 text-sm leading-relaxed text-white/55">{error}</p>
        ) : !details ? (
          <p className="mt-4 text-sm leading-relaxed text-white/55">Wczytuję stenogram…</p>
        ) : details.paragraphs.length === 0 ? (
          <p className="mt-4 text-sm leading-relaxed text-white/55">
            Brak tekstu wystąpienia na stronie Sejmu.
          </p>
        ) : (
          <div className="mt-4 flex flex-col gap-4 text-sm leading-relaxed text-white/80">
            {details.paragraphs.map((paragraph, index) => (
              <p key={`${index}-${paragraph.slice(0, 24)}`}>{paragraph}</p>
            ))}
          </div>
        )}
      </section>
    </article>
  );
}
