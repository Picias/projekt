"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, LoaderCircle } from "lucide-react";

type SejmDocumentPanelProps = {
  url: string | null;
  label: string;
  defaultOpen?: boolean;
  emptyMessage?: string;
};

export default function SejmDocumentPanel({
  url,
  label,
  defaultOpen = false,
  emptyMessage = "Brak treści HTML w API Sejmu.",
}: SejmDocumentPanelProps) {
  const [open, setOpen] = useState(defaultOpen);
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!url || text) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/fetch-document?url=${encodeURIComponent(url)}`,
      );
      const data = (await response.json()) as { text?: string; error?: string };

      if (!response.ok || !data.text) {
        setError(data.error ?? "Nie udało się wczytać treści.");
        return;
      }

      setText(data.text);
    } catch {
      setError("Nie udało się wczytać treści.");
    } finally {
      setLoading(false);
    }
  }, [text, url]);

  useEffect(() => {
    if (open) {
      void load();
    }
  }, [load, open]);

  if (!url) {
    return <p className="text-[11px] leading-relaxed text-white/40">{emptyMessage}</p>;
  }

  return (
    <div className="mt-3">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 rounded-xl bg-white/5 px-3 py-2 text-left text-[11px] font-semibold text-sejm-green-light ring-1 ring-white/10 transition-colors hover:bg-white/8"
      >
        {open ? "Ukryj treść" : label}
        <ChevronDown
          size={14}
          className={`shrink-0 transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>

      {open ? (
        <div className="mt-2 rounded-xl border border-white/10 bg-navy-950/50 p-3">
          {loading ? (
            <p className="flex items-center gap-2 text-xs text-white/55">
              <LoaderCircle size={14} className="animate-spin" aria-hidden />
              Pobieranie treści z Sejmu…
            </p>
          ) : null}
          {error ? <p className="text-xs text-red-300">{error}</p> : null}
          {text ? (
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-white/75">
              {text}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
