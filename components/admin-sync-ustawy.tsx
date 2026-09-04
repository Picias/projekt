"use client";

import { useEffect, useState } from "react";
import { Loader2, RefreshCw } from "lucide-react";

type Toast = {
  ok: boolean;
  message: string;
};

type SyncResponse = {
  success?: boolean;
  message?: string;
};

export default function AdminSyncUstawy() {
  const [pending, setPending] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  async function handleSync() {
    setPending(true);

    try {
      // CRON_SECRET zostaje na serwerze — przeglądarka nie może go poznać.
      // Endpoint honoruje sesję administratora (ADMIN_EMAIL) albo nagłówek
      // Authorization: Bearer ${CRON_SECRET} (tak woła Vercel Cron).
      const response = await fetch("/api/cron/smart-sync?force=true", {
        method: "GET",
        credentials: "same-origin",
        cache: "no-store",
      });

      const payload = (await response.json()) as SyncResponse;
      const message =
        payload.message ??
        (response.ok ? "Zsynchronizowano głosowania i druki." : "Synchronizacja nie powiodła się.");

      setToast({ ok: Boolean(payload.success) && response.ok, message });
    } catch {
      setToast({
        ok: false,
        message: "Nie udało się połączyć z endpointem synchronizacji.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <section className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10">
        <h2 className="text-sm font-semibold">Panel administratora</h2>
        <p className="mt-1 text-xs leading-relaxed text-white/50">
          Wymusza Smart CRON (druki i głosowania), nawet gdy dziś nie ma obrad.
        </p>
        <button
          type="button"
          onClick={handleSync}
          disabled={pending}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-sejm-green px-4 py-3 text-sm font-semibold text-white hover:bg-sejm-green/85 disabled:opacity-60"
        >
          {pending ? (
            <Loader2 size={16} className="animate-spin" aria-hidden />
          ) : (
            <RefreshCw size={16} aria-hidden />
          )}
          {pending ? "Synchronizuję…" : "Wymuś synchronizację"}
        </button>
      </section>

      {toast ? (
        <div
          role="status"
          className="pointer-events-none fixed inset-x-0 bottom-24 z-50 mx-auto w-full max-w-md px-5"
        >
          <p
            className={`rounded-2xl px-4 py-3 text-sm font-semibold shadow-lg ${
              toast.ok ? "bg-sejm-green text-white" : "bg-red-600 text-white"
            }`}
          >
            {toast.message}
          </p>
        </div>
      ) : null}
    </>
  );
}
