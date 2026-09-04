"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

import ObradyTextCard, { ObradyTekstWiersze } from "@/components/obrady-text-card";

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

function sittingLabel(number: number, heading: string): string {
  if (number > 0) {
    return `${number}. posiedzenie Sejmu`;
  }

  return heading.split(/\s+w dni(?:ach|u)\s/)[0].trim() || "Posiedzenie Sejmu";
}

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
  today: _today,
  initialDate,
  initialTitle,
  initialSitting,
  initialAgendaTekst,
}: ObradyCalendarProps) {
  const [year, month] = initialDate.split("-").map(Number);
  const [cursor, setCursor] = useState({ year, month: month - 1 });
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [agendaTekst, setAgendaTekst] = useState(initialAgendaTekst);
  const [sitting, setSitting] = useState(initialSitting);
  const [title, setTitle] = useState(initialTitle);
  const [loading, setLoading] = useState(false);

  const sittingByDate = useMemo(() => {
    const map = new Map<string, SittingDay>();

    for (const day of sittingDays) {
      map.set(day.date, day);
    }

    return map;
  }, [sittingDays]);

  const cells = monthCells(cursor.year, cursor.month);
  const selectedSitting = sittingByDate.get(selectedDate);

  useEffect(() => {
    if (selectedDate === initialDate) {
      setAgendaTekst(initialAgendaTekst);
      setSitting(initialSitting);
      setTitle(initialTitle);
      setLoading(false);
      return;
    }

    const marker = sittingByDate.get(selectedDate);

    if (!marker) {
      setAgendaTekst(null);
      setSitting(null);
      setTitle(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setTitle(marker.title);
    setSitting(marker.number);

    fetch(`/api/obrady/agenda?date=${selectedDate}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = (await response.json()) as AgendaResponse;

        if (!cancelled) {
          setAgendaTekst(payload.agendaTekst ?? null);
          setSitting(payload.sitting ?? marker.number);
          setTitle(payload.title ?? marker.title);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAgendaTekst(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [selectedDate, initialDate, initialAgendaTekst, initialSitting, initialTitle, sittingByDate]);

  return (
    <section className="flex flex-col gap-6">
      <div>
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

            let dayClassName =
              "h-10 w-10 mx-auto flex items-center justify-center rounded-lg text-sm transition-all duration-200";

            if (sittingDay && selected) {
              dayClassName +=
                " bg-emerald-500 font-bold text-white shadow-lg shadow-emerald-500/20";
            } else if (sittingDay) {
              dayClassName +=
                " bg-emerald-500/15 font-semibold text-emerald-400 hover:bg-emerald-500/25";
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
                onClick={() => sittingDay && setSelectedDate(date)}
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

      <ObradyTextCard title="Porządek obrad">
        {selectedSitting ? (
          <div className="flex flex-col gap-2">
            <h3 className="text-base font-semibold leading-snug text-white">
              {sittingLabel(
                sitting ?? selectedSitting.number,
                title ?? selectedSitting.title,
              )}
            </h3>
            <p className="text-xs text-slate-400">{selectedDate}</p>

            {loading ? (
              <p className="mt-2 flex items-center gap-2 text-sm text-slate-300">
                <Loader2 size={16} className="animate-spin" aria-hidden />
                Wczytuję porządek obrad…
              </p>
            ) : agendaTekst ? (
              <ObradyTekstWiersze tekst={agendaTekst} />
            ) : (
              <p className="mt-1 text-sm leading-relaxed text-slate-300">
                Brak opublikowanego porządku obrad dla tego dnia.
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-slate-300">
            Tego dnia Sejm nie obraduje. Szmaragdowe dni to posiedzenia Sejmu.
          </p>
        )}
      </ObradyTextCard>
    </section>
  );
}
