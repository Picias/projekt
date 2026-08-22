"use client";

import { useEffect, useRef } from "react";
import type Hls from "hls.js";

type SejmHlsPlayerProps = {
  src: string;
  title?: string;
  onError?: () => void;
};

const PLAYBACK_TIMEOUT_MS = 12_000;

export default function SejmHlsPlayer({ src, title, onError }: SejmHlsPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    const video = videoRef.current;

    if (!video) {
      return;
    }

    const element = video;
    let cancelled = false;
    let hls: Hls | null = null;
    let timeoutId = 0;

    const fail = () => {
      if (!cancelled) {
        onErrorRef.current?.();
      }
    };

    const markReady = () => {
      window.clearTimeout(timeoutId);
    };

    const onVideoError = () => {
      fail();
    };

    element.addEventListener("loadeddata", markReady);
    element.addEventListener("error", onVideoError);

    timeoutId = window.setTimeout(() => {
      if (element.readyState < HTMLMediaElement.HAVE_CURRENT_DATA) {
        fail();
      }
    }, PLAYBACK_TIMEOUT_MS);

    async function attach() {
      try {
        const { default: Hls } = await import("hls.js");

        if (cancelled) {
          return;
        }

        if (Hls.isSupported()) {
          const instance = new Hls({
            enableWorker: false,
            lowLatencyMode: false,
          });
          hls = instance;
          instance.on(Hls.Events.ERROR, (_event, data) => {
            if (data.fatal) {
              fail();
            }
          });
          instance.loadSource(src);
          instance.attachMedia(element);
          return;
        }

        if (element.canPlayType("application/vnd.apple.mpegurl")) {
          element.src = src;
          return;
        }

        fail();
      } catch {
        fail();
      }
    }

    void attach();

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      video.removeEventListener("loadeddata", markReady);
      video.removeEventListener("error", onVideoError);
      hls?.destroy();
      video.removeAttribute("src");
      video.load();
    };
  }, [src]);

  return (
    <video
      ref={videoRef}
      controls
      playsInline
      preload="auto"
      title={title ?? "Retransmisja wystąpienia z Sejmu"}
      className="aspect-video w-full rounded-xl border-0 bg-black overflow-hidden"
    />
  );
}
