import Link from "next/link";
import { ChevronRight } from "lucide-react";

import {
  formatUstawaDate,
  getStageLabel,
  LEGISLATIVE_STAGES,
  resolveStageIndex,
  shortenTitle,
  type Ustawa,
} from "@/lib/ustawa";

type UstawaCardProps = {
  ustawa: Pick<
    Ustawa,
    "id" | "numer_druku" | "tytul_oficjalny" | "autor" | "data_wplywu" | "etap_legislacyjny"
  >;
};

export default function UstawaCard({ ustawa }: UstawaCardProps) {
  const activeIndex = resolveStageIndex(ustawa.etap_legislacyjny);

  return (
    <Link
      href={`/ustawy/${ustawa.id}`}
      className="block rounded-2xl bg-white/5 p-4 ring-1 ring-white/10 transition-colors hover:bg-white/8 hover:ring-emerald-400/30"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-emerald-400/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-300">
              Druk {ustawa.numer_druku}
            </span>
            <span className="text-[10px] font-medium text-white/40">
              {formatUstawaDate(ustawa.data_wplywu)}
            </span>
          </div>

          <p className="mt-2 line-clamp-3 text-sm font-medium leading-snug">
            {shortenTitle(ustawa.tytul_oficjalny, 160)}
          </p>

          <p className="mt-1 text-xs text-white/45">{ustawa.autor ?? "Autor nieokreślony"}</p>
        </div>

        <ChevronRight size={16} className="mt-1 shrink-0 text-white/30" aria-hidden />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <div
          className="flex flex-1 items-center gap-1"
          role="img"
          aria-label={`Etap legislacyjny: ${getStageLabel(ustawa.etap_legislacyjny)}`}
        >
          {LEGISLATIVE_STAGES.map((stage, index) => (
            <span
              key={stage.key}
              className={`h-1.5 flex-1 rounded-full ${
                index < activeIndex
                  ? "bg-sejm-green/50"
                  : index === activeIndex
                    ? "bg-emerald-400"
                    : "bg-white/10"
              }`}
            />
          ))}
        </div>
        <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide text-emerald-300/80">
          {getStageLabel(ustawa.etap_legislacyjny)}
        </span>
      </div>
    </Link>
  );
}
