"use client";

import { forwardRef, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Share2, User, Wallet } from "lucide-react";
import { getClubLabel } from "@/lib/club-colors";

export type ShareCardPosel = {
  type: "posel";
  name: string;
  photoUrl?: string | null;
  club?: string | null;
  attendancePercent?: number | null;
  loyaltyPercent?: number | null;
  /** Gdy brakuje prawdziwej frekwencji, karta oznacza liczbę jako szacunek. */
  attendanceEstimated?: boolean;
  /**
   * Placeholder pod przyszły odczyt głosu.
   * Docelowy adres ma kształt
   * https://api.sejm.gov.pl/sejm/term10/MP/{mpId}/votings/{sitting}/{date}.
   */
  mpId?: number | null;
  votingSitting?: number | null;
  votingDate?: string | null;
  voteLabel?: string | null;
};

export type ShareCardUstawa = {
  type: "ustawa";
  title: string;
  impactLabel: string;
  /** Kolejne obszary i tagi ustawy, obok głównej etykiety. */
  tags?: string[];
  /** Krótki opis z AI (`ai_w_skrocie`) albo ludzki skrót. */
  summary?: string | null;
  walletLabel: string;
  walletLevel?: "direct" | "indirect" | "unknown";
};

export type ShareCardProps = ShareCardPosel | ShareCardUstawa;

const CARD_SIZE = "pointer-events-none absolute -left-[9999px] top-0 h-[1080px] w-[1080px]";

function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return "—";
  }

  const rounded = Math.round(value * 10) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}%`;
}

function clip(text: string, max: number): string {
  const clean = text.replace(/\s+/g, " ").trim();
  if (clean.length <= max) {
    return clean;
  }

  return `${clean.slice(0, max - 1).trimEnd()}…`;
}

/** Adres głosu w API Sejmu. Pusty, dopóki nie znamy posiedzenia i daty. */
export function buildMpVotingUrl(
  mpId?: number | null,
  sitting?: number | null,
  date?: string | null,
): string | null {
  if (mpId == null || sitting == null || !date) {
    return null;
  }

  return `https://api.sejm.gov.pl/sejm/term10/MP/${mpId}/votings/${sitting}/${date}`;
}

function plainSummary(value: string | null | undefined): string {
  return (value ?? "").replace(/\*\*/g, "").replace(/\s+/g, " ").trim();
}

function verdictLine(voteLabel: string | null | undefined): string {
  const value = voteLabel?.trim();
  if (!value) {
    return "GŁOSOWAŁ(A): BRAK DANYCH";
  }

  const upper = value.toLocaleUpperCase("pl");
  return upper.startsWith("GŁOSOWAŁ") ? upper : `GŁOSOWAŁ(A): ${upper}`;
}

function shareTags(impactLabel: string, tags: string[] | undefined): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const tag of [impactLabel, ...(tags ?? [])]) {
    const clean = tag.replace(/\s+/g, " ").trim();
    const key = clean.toLocaleLowerCase("pl");
    if (!clean || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(clean);
  }

  return result.slice(0, 4);
}

function downloadShareFile(file: File) {
  const url = URL.createObjectURL(file);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function renderCardBlob(node: HTMLElement): Promise<Blob | null> {
  const { toBlob } = await import("html-to-image");
  const options = {
    cacheBust: true,
    pixelRatio: 1,
    backgroundColor: "#0b1b3d",
    // Kopia do obrazu nie może zostać przy -9999px. Przeglądarka wpisuje wtedy
    // obliczone `inset` (np. right: 9000px) i treść wypada poza kadr.
    style: {
      position: "relative" as const,
      inset: "auto",
      left: "0px",
      top: "0px",
      right: "auto",
      bottom: "auto",
      margin: "0px",
      transform: "none",
    },
  };

  try {
    return await toBlob(node, options);
  } catch {
    const images = [...node.querySelectorAll("img")];
    const sources = images.map((image) => image.getAttribute("src"));
    images.forEach((image) => image.removeAttribute("src"));

    try {
      return await toBlob(node, options);
    } finally {
      images.forEach((image, index) => {
        const source = sources[index];
        if (source) {
          image.setAttribute("src", source);
        }
      });
    }
  }
}

export async function handleShare(node: HTMLElement | null): Promise<void> {
  if (!node || typeof navigator === "undefined") {
    return;
  }

  const blob = await renderCardBlob(node);
  if (!blob) {
    return;
  }

  const file = new File([blob], "sejmon-share.png", { type: "image/png" });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        files: [file],
        title: "SejmON - Twój radar polityczny",
        text: "Zobacz to! Patrzę politykom na ręce w SejmON 👀",
      });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
    }
  }

  downloadShareFile(file);
}

const ShareCardGenerator = forwardRef<HTMLDivElement, ShareCardProps>(
  function ShareCardGenerator(props, ref) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
      setMounted(true);
    }, []);

    if (!mounted) {
      return null;
    }

    return createPortal(
      <div ref={ref} aria-hidden className={`${CARD_SIZE} overflow-hidden bg-navy-900 text-white`}>
        {props.type === "posel" ? <PoselCard {...props} /> : <UstawaCard {...props} />}
      </div>,
      document.body,
    );
  },
);

export default ShareCardGenerator;

function BrandBar() {
  return (
    <div className="flex w-full items-center justify-between border-t border-white/10 bg-black px-12 py-6">
      <span className="text-4xl font-black tracking-[0.22em] text-white">SEJMON</span>
      <span className="text-4xl font-black text-sejm-green-light">Sprawdź na sejmon.pl</span>
    </div>
  );
}

function PoselCard({
  name,
  photoUrl,
  club,
  attendancePercent,
  loyaltyPercent,
  attendanceEstimated = false,
  mpId,
  votingSitting,
  votingDate,
  voteLabel,
}: ShareCardPosel) {
  const [photoFailed, setPhotoFailed] = useState(false);
  const voteUrl = buildMpVotingUrl(mpId, votingSitting, votingDate);
  const photoSrc = photoUrl?.trim() || "";
  const showPhoto = photoSrc.length > 0 && !photoFailed;
  const clubName = club?.trim() ? getClubLabel(club) : "";

  return (
    <div className="flex h-full flex-col bg-navy-950">
      <div className="h-6 w-full bg-sejm-green" />
      <div className="flex flex-1 flex-col items-center px-12 pt-10">
        {showPhoto ? (
          // Zwykły img: html-to-image czyta piksele węzła, a src pochodzi z bazy.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoSrc}
            alt=""
            crossOrigin="anonymous"
            onError={() => setPhotoFailed(true)}
            className="h-48 w-48 rounded-full border-8 border-white object-cover shadow-2xl"
          />
        ) : (
          <div className="flex h-48 w-48 items-center justify-center rounded-full border-8 border-white bg-navy-800 shadow-2xl">
            <User size={112} strokeWidth={2.25} className="text-white" aria-hidden />
          </div>
        )}

        <h2 className="mt-6 max-w-[920px] text-center text-6xl font-black leading-none tracking-tight text-white">
          {name}
        </h2>

        {clubName ? (
          <p className="mt-6 rounded-full bg-white px-8 py-3 text-4xl font-black uppercase tracking-wide text-navy-950">
            {clubName}
          </p>
        ) : null}

        <div className="mt-8 grid w-full grid-cols-2 gap-6">
          <Stat
            label="Frekwencja"
            value={formatPercent(attendancePercent)}
            hint={attendanceEstimated ? "szacunek" : "udział w głosowaniach"}
          />
          <Stat label="Lojalność" value={formatPercent(loyaltyPercent)} hint="głosuje z klubem" />
        </div>

        <div
          data-vote-api={voteUrl ?? ""}
          className="mb-8 mt-8 flex w-full flex-1 flex-col items-center justify-center rounded-xl bg-red-600 p-6 text-center text-white"
        >
          <p className="text-3xl font-bold">Ostatnie kontrowersyjne głosowanie:</p>
          <p className="mt-3 text-5xl font-black uppercase leading-none">{verdictLine(voteLabel)}</p>
        </div>
      </div>

      <BrandBar />
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className="rounded-2xl bg-white p-6 text-center text-navy-950">
      <p className="text-3xl font-black uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-6xl font-black tabular-nums leading-none">{value}</p>
      <p className="mt-3 text-2xl font-semibold text-navy-950/60">{hint}</p>
    </div>
  );
}

function UstawaCard({
  title,
  impactLabel,
  tags,
  summary,
  walletLabel,
  walletLevel = "unknown",
}: ShareCardUstawa) {
  const summaryText = plainSummary(summary);
  const pills = shareTags(impactLabel, tags);
  const walletHitsPocket = walletLevel === "direct";
  const walletSafe = walletLevel === "indirect";
  const walletTone = walletHitsPocket
    ? "bg-orange-500 text-black"
    : walletSafe
      ? "bg-sejm-green text-white"
      : "bg-red-500 text-white";

  return (
    <div className="flex h-full flex-col bg-navy-950">
      <div className={`h-6 w-full ${walletHitsPocket ? "bg-orange-500" : walletSafe ? "bg-sejm-green" : "bg-red-500"}`} />
      <div className="flex flex-1 flex-col px-12 pt-12">
        <h2 className="text-6xl font-black leading-tight tracking-tight text-white">
          {clip(title, 110)}
        </h2>

        <ul className="mt-8 flex flex-wrap gap-4">
          {pills.map((tag) => (
            <li
              key={tag}
              className="rounded-full bg-black px-6 py-3 text-3xl font-black uppercase tracking-wide text-yellow-300"
            >
              {tag}
            </li>
          ))}
        </ul>

        {summaryText ? (
          <p className="mt-8 line-clamp-3 text-4xl leading-relaxed text-white/80">{summaryText}</p>
        ) : null}

        <div className={`mb-8 mt-8 flex flex-1 items-center gap-8 rounded-3xl p-12 ${walletTone}`}>
          <Wallet size={88} strokeWidth={2.5} className="shrink-0" aria-hidden />
          <p className="text-4xl font-black uppercase leading-tight">
            Skutki dla portfela: {walletLabel}
          </p>
        </div>
      </div>

      <BrandBar />
    </div>
  );
}

export function ShareButton({
  card,
  className = "",
}: {
  card: ShareCardProps;
  className?: string;
}) {
  const [node, setNode] = useState<HTMLDivElement | null>(null);
  const [busy, setBusy] = useState(false);
  const label = card.type === "posel" ? "Udostępnij posła" : "Udostępnij ustawę";

  return (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void handleShare(node).finally(() => setBusy(false));
        }}
        className={`inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-sm font-semibold text-navy-900 disabled:opacity-60 ${className}`}
      >
        <Share2 size={16} aria-hidden />
        {busy ? "Przygotowuję kartę…" : label}
      </button>
      <ShareCardGenerator ref={setNode} {...card} />
    </>
  );
}
