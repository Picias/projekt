"use client";

import { useState } from "react";

import SejmHlsPlayer from "@/components/sejm-hls-player";

type ObradyLiveProps = {
  iframeSrc: string | null;
  hlsSrc: string | null;
};

const playerFrameClassName =
  "aspect-video w-full overflow-hidden rounded-none border-0 bg-black";

export default function ObradyLive({ iframeSrc, hlsSrc }: ObradyLiveProps) {
  const [hlsFailed, setHlsFailed] = useState(false);
  const showHls = Boolean(hlsSrc) && !hlsFailed;
  const showIframe = Boolean(iframeSrc) && !showHls;

  return (
    <section className="overflow-hidden rounded-2xl border border-white/10 bg-navy-800">
      <div className="flex items-center gap-2 px-4 py-2.5">
        <span className="h-2 w-2 shrink-0 animate-pulse rounded-full bg-red-500" aria-hidden />
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
          Sejm obraduje na żywo
        </p>
      </div>

      {showHls && hlsSrc ? (
        <SejmHlsPlayer
          src={hlsSrc}
          title="Transmisja obrad Sejmu"
          className={playerFrameClassName}
          onError={() => setHlsFailed(true)}
        />
      ) : showIframe && iframeSrc ? (
        <iframe
          src={iframeSrc}
          title="Oficjalny player Sejmu — transmisja na żywo"
          allow="autoplay; fullscreen; picture-in-picture"
          allowFullScreen
          referrerPolicy="no-referrer-when-downgrade"
          className={playerFrameClassName}
        />
      ) : (
        <div className="flex aspect-video w-full items-center justify-center bg-black px-6">
          <p className="text-center text-sm text-white/50">
            Transmisja wideo jest chwilowo niedostępna.
          </p>
        </div>
      )}
    </section>
  );
}
