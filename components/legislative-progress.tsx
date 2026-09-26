import { Check } from "lucide-react";

import { LEGISLATIVE_STAGES, resolveStageIndex } from "@/lib/ustawa";

type LegislativeProgressProps = {
  etap: string | null;
};

export default function LegislativeProgress({ etap }: LegislativeProgressProps) {
  const activeIndex = resolveStageIndex(etap);
  const activeStage = LEGISLATIVE_STAGES[activeIndex];
  const progressPercent = (activeIndex / (LEGISLATIVE_STAGES.length - 1)) * 100;

  return (
    <div
      role="group"
      aria-label={`Etap legislacyjny: ${activeStage.label}`}
      className="rounded-2xl bg-white/5 p-5 ring-1 ring-white/10"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h3 className="text-base font-bold text-white">Droga ustawy</h3>
        <span className="text-xs font-semibold text-emerald-300">
          {activeIndex + 1} z {LEGISLATIVE_STAGES.length}
        </span>
      </div>

      <div className="relative mt-6">
        <div className="absolute inset-x-0 top-3.5 h-1 rounded-full bg-white/10" aria-hidden />
        <div
          className="absolute left-0 top-3.5 h-1 rounded-full bg-linear-to-r from-sejm-green to-emerald-400 transition-all"
          style={{ width: `${progressPercent}%` }}
          aria-hidden
        />

        <ol className="relative flex justify-between">
          {LEGISLATIVE_STAGES.map((stage, index) => {
            const isDone = index < activeIndex;
            const isActive = index === activeIndex;

            return (
              <li
                key={stage.key}
                className="flex flex-1 flex-col items-center gap-2 text-center"
                aria-current={isActive ? "step" : undefined}
              >
                <span
                  className={`flex size-8 items-center justify-center rounded-full text-[11px] font-bold transition-colors ${
                    isDone
                      ? "bg-sejm-green text-white"
                      : isActive
                        ? "bg-emerald-400 text-navy-950 ring-4 ring-emerald-400/25"
                        : "bg-navy-700 text-white/40 ring-1 ring-white/10"
                  }`}
                >
                  {isDone ? <Check size={14} strokeWidth={3} aria-hidden /> : index + 1}
                </span>
                <span
                  className={`text-xs font-semibold leading-tight ${
                    isActive
                      ? "text-emerald-300"
                      : isDone
                        ? "text-white/80"
                        : "text-white/60"
                  }`}
                >
                  {stage.label}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      <p className="mt-5 rounded-xl bg-emerald-400/10 px-3 py-2 text-xs leading-relaxed text-emerald-100 ring-1 ring-emerald-400/20">
        Obecny etap: <span className="font-semibold">{activeStage.label}</span> —{" "}
        {activeStage.hint}.
      </p>
    </div>
  );
}
