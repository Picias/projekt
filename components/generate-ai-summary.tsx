"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";

type GenerateAiSummaryProps = {
  numerDruku: string;
};

export default function GenerateAiSummary({ numerDruku }: GenerateAiSummaryProps) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate() {
    if (loading) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/generate-ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ numer_druku: numerDruku }),
      });

      const data = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(data.error ?? "Nie udało się wygenerować podsumowania.");
        setLoading(false);
        return;
      }

      router.refresh();
    } catch {
      setError("Nie udało się połączyć z serwerem. Spróbuj ponownie.");
      setLoading(false);
    }
  }

  return (
    <div className="rounded-2xl border border-emerald-400/20 bg-linear-to-br from-navy-800 via-navy-800 to-emerald-500/10 p-6 text-center shadow-lg ring-1 ring-emerald-400/10">
      <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-emerald-400/15 text-emerald-300">
        {loading ? (
          <Loader2 size={22} className="animate-spin" aria-hidden />
        ) : (
          <Sparkles size={22} strokeWidth={1.9} aria-hidden />
        )}
      </span>

      {loading ? (
        <p
          aria-live="polite"
          className="mt-4 text-sm font-medium leading-relaxed text-white/80"
        >
          Czytanie dokumentu i analiza prawnicza...
        </p>
      ) : (
        <>
          <p className="mt-4 text-sm leading-relaxed text-white/65">
            Model przeczyta oryginalny PDF z Sejmu — Uzasadnienie i tabele OSR — i
            przetłumaczy ustawę na zwykły język.
          </p>

          <button
            type="button"
            onClick={handleGenerate}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-sejm-green px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-sejm-green/85"
          >
            ✨ Wygeneruj podsumowanie AI
          </button>
        </>
      )}

      {error ? (
        <p role="alert" className="mt-4 text-sm leading-relaxed text-red-300">
          {error}
        </p>
      ) : null}
    </div>
  );
}
