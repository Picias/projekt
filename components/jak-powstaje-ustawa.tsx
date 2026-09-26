import { GraduationCap } from "lucide-react";

import { LEGISLATIVE_STAGES, type StageKey } from "@/lib/ustawa";

const PLAIN_STEPS: Record<StageKey, string> = {
  projekt:
    "Ktoś zgłasza pomysł na nowe prawo: rząd, grupa posłów, Senat, Prezydent albo 100 tys. obywateli.",
  komisje:
    "Mniejsze grupy posłów (komisje) czytają projekt, słuchają ekspertów i poprawiają szczegóły.",
  sejm: "Wszyscy posłowie dyskutują na sali i głosują. Większość decyduje, czy ustawa przechodzi dalej.",
  senat: "Senatorowie mają 30 dni, by przyjąć ustawę, poprawić ją albo odrzucić.",
  prezydent: "Prezydent podpisuje ustawę, kieruje ją do Trybunału albo ją wetuje.",
  opublikowana:
    "Ustawa trafia do Dziennika Ustaw i zaczyna obowiązywać — zwykle po kilku tygodniach.",
};

export default function JakPowstajeUstawa() {
  return (
    <details className="group rounded-3xl border border-white/10 bg-linear-to-br from-white/10 to-transparent p-5 shadow-lg shadow-navy-950/20">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-3 marker:hidden">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sky-400/15 text-sky-300">
          <GraduationCap size={20} aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-bold text-white">Jak powstaje ustawa?</span>
          <span className="block text-sm text-white/70">6 kroków w minutę</span>
        </span>
        <span
          className="text-xl text-white/70 transition-transform group-open:rotate-90"
          aria-hidden
        >
          ›
        </span>
      </summary>

      <ol className="mt-4 flex flex-col gap-3">
        {LEGISLATIVE_STAGES.map((stage, index) => (
          <li key={stage.key} className="flex gap-3">
            <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-emerald-400/20 text-sm font-bold text-emerald-200">
              {index + 1}
            </span>
            <p className="text-sm leading-relaxed text-white/85">
              <span className="font-semibold text-white">{stage.label}.</span>{" "}
              {PLAIN_STEPS[stage.key]}
            </p>
          </li>
        ))}
      </ol>
    </details>
  );
}
