"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import { extractKeyEvents } from "@/components/obrady-text-card";

type SittingDay = {
  date: string;
  number: number;
  title: string;
};

type AgendaResponse = {
  sitting?: number | null;
  title?: string | null;
  agendaTekst?: string | null;
  error?: string;
};

type ObradyCalendarProps = {
  sittingDays: SittingDay[];
  today: string;
  initialDate: string;
  initialTitle: string | null;
  initialSitting: number | null;
  initialAgendaTekst: string | null;
};

const WEEKDAYS = ["PN", "WT", "ŚR", "CZ", "PT", "SO", "ND"];

const monthTitleFormatter = new Intl.DateTimeFormat("pl-PL", {
  month: "long",
  year: "numeric",
});

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

function toIso(year: number, month: number, day: number): string {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function shiftMonth(year: number, month: number, delta: number) {
  const date = new Date(year, month + delta, 1);
  return { year: date.getFullYear(), month: date.getMonth() };
}

function monthCells(year: number, month: number): string[] {
  const firstWeekday = new Date(year, month, 1).getDay();
  const mondayOffset = (firstWeekday + 6) % 7;
  const start = new Date(year, month, 1 - mondayOffset);

  return Array.from({ length: 42 }, (_, index) => {
    const cell = new Date(start);
    cell.setDate(start.getDate() + index);
    return toIso(cell.getFullYear(), cell.getMonth(), cell.getDate());
  });
}

export default function ObradyCalendar({
  sittingDays,
  today,
  initialDate,
  initialAgendaTekst,
}: ObradyCalendarProps) {
  const [year, month] = initialDate.split("-").map(Number);
  const [cursor, setCursor] = useState({ year, month: month - 1 });
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [agendaTekst, setAgendaTekst] = useState(initialAgendaTekst);
  const [loading, setLoading] = useState(false);
  const agendaRequest = useRef<AbortController | null>(null);

  const sittingByDate = useMemo(() => {
    const map = new Map<string, SittingDay>();

    for (const day of sittingDays) {
      map.set(day.date, day);
    }

    return map;
  }, [sittingDays]);

  useEffect(() => {
    return () => {
      agendaRequest.current?.abort();
    };
  }, []);

  function selectDate(date: string) {
    const marker = sittingByDate.get(date);

    if (!marker) {
      return;
    }

    agendaRequest.current?.abort();
    setSelectedDate(date);

    if (date === initialDate) {
      setAgendaTekst(initialAgendaTekst);
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    agendaRequest.current = controller;
    setLoading(true);

    fetch(`/api/obrady/agenda?date=${date}`, {
      cache: "no-store",
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as AgendaResponse;

        if (!controller.signal.aborted) {
          setAgendaTekst(payload.agendaTekst ?? null);
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || (error instanceof DOMException && error.name === "AbortError")) {
          return;
        }

        setAgendaTekst(null);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      });
  }

  const cells = monthCells(cursor.year, cursor.month);
  const selectedSitting = sittingByDate.get(selectedDate);
  const keyEvents = !loading && agendaTekst ? extractKeyEvents(agendaTekst) : [];

  return (
    <section className="flex flex-col gap-6">
      <div className="rounded-2xl border border-white/15 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setCursor((current) => shiftMonth(current.year, current.month, -1))}
            className="flex size-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10"
            aria-label="Poprzedni miesiąc"
          >
            <ChevronLeft size={18} aria-hidden />
          </button>
          <h2 className="text-sm font-semibold capitalize">
            {monthTitleFormatter.format(new Date(cursor.year, cursor.month, 1))}
          </h2>
          <button
            type="button"
            onClick={() => setCursor((current) => shiftMonth(current.year, current.month, 1))}
            className="flex size-9 items-center justify-center rounded-lg text-white/70 hover:bg-white/10"
            aria-label="Następny miesiąc"
          >
            <ChevronRight size={18} aria-hidden />
          </button>
        </div>

        <div className="grid grid-cols-7 text-center text-[10px] font-semibold uppercase tracking-wide text-slate-400">
          {WEEKDAYS.map((label) => (
            <span key={label} className="py-1">
              {label}
            </span>
          ))}
        </div>

        <div className="mt-1 grid grid-cols-7 gap-y-4">
          {cells.map((date) => {
            const inMonth = date.startsWith(`${cursor.year}-${pad(cursor.month + 1)}`);
            const sittingDay = sittingByDate.get(date);
            const selected = date === selectedDate;
            const isToday = date === today;

            let dayClassName =
              "h-10 w-10 mx-auto flex items-center justify-center rounded-lg text-sm transition-all duration-200";

            if (sittingDay && selected) {
              dayClassName +=
                " bg-emerald-500 font-bold text-white shadow-lg shadow-emerald-500/20";
            } else if (sittingDay) {
              dayClassName +=
                " bg-emerald-500/15 font-semibold text-emerald-400 hover:bg-emerald-500/25";
              if (isToday) {
                dayClassName += " ring-1 ring-white/50";
              }
            } else if (isToday) {
              dayClassName += ` font-semibold text-white ring-1 ring-white/30 hover:bg-slate-800 ${
                inMonth ? "" : "opacity-40"
              }`;
            } else {
              dayClassName += ` text-slate-300 hover:bg-slate-800 ${
                inMonth ? "" : "opacity-40"
              }`;
            }

            return (
              <button
                key={date}
                type="button"
                disabled={!sittingDay}
                onClick={() => selectDate(date)}
                aria-pressed={selected}
                aria-label={
                  sittingDay
                    ? `${date}, posiedzenie Sejmu`
                    : `${date}, brak posiedzenia`
                }
                className={dayClassName}
              >
                {Number(date.slice(-2))}
              </button>
            );
          })}
        </div>
      </div>

      {selectedSitting ? (
        <>
          <section className="rounded-2xl bg-navy-900 p-5 ring-1 ring-white/10">
            <h2 className="text-base font-semibold text-white">
              🔥 Najważniejsze na tym posiedzeniu
            </h2>
            {loading ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-white/60">
                <Loader2 size={16} className="animate-spin" aria-hidden />
                Wczytuję porządek obrad…
              </p>
            ) : keyEvents.length > 0 ? (
              <ul className="mt-4 space-y-4">
                {keyEvents.map((event, index) => (
                  <li
                    key={`${index}-${event.slice(0, 48)}`}
                    className="relative pl-5 text-sm leading-relaxed text-white/80 before:absolute before:left-0 before:top-2 before:h-2 before:w-2 before:rounded-full before:bg-sejm-green before:content-['']"
                  >
                    {event}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-white/50 text-sm mt-4">
                Brak kluczowych głosowań lub gorących tematów w obecnym harmonogramie.
              </p>
            )}
          </section>

          <section className="rounded-2xl bg-navy-900 p-5 ring-1 ring-white/10">
            <h2 className="text-base font-semibold text-white">
              Pełny, urzędowy porządek obrad
            </h2>
            {loading ? (
              <p className="mt-4 flex items-center gap-2 text-sm text-white/60">
                <Loader2 size={16} className="animate-spin" aria-hidden />
                Wczytuję porządek obrad…
              </p>
            ) : agendaTekst ? (
              <div
                className="text-white/70 text-sm leading-relaxed mt-4 [&>div]:mb-2"
                dangerouslySetInnerHTML={{ __html: agendaTekst }}
              />
            ) : (
              <p className="mt-4 text-sm leading-relaxed text-white/60">
                Brak opublikowanego porządku obrad dla tego dnia.
              </p>
            )}
          </section>
        </>
      ) : (
        <p className="text-sm leading-relaxed text-slate-300">
          Tego dnia Sejm nie obraduje. Szmaragdowe dni to posiedzenia Sejmu.
        </p>
      )}
    </section>
  );
}
