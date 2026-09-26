"use client";

import Link from "next/link";
import { ChevronRight } from "lucide-react";

import { ImpactChips } from "@/components/impact-meter";
import SubscribeButton from "@/components/subscribe-button";
import { plainTitle, titleSizeClass } from "@/lib/legislative-title";
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
  > &
    Partial<Pick<Ustawa, "tagi">>;
};

export default function UstawaCard({ ustawa }: UstawaCardProps) {
  const activeIndex = resolveStageIndex(ustawa.etap_legislacyjny);
  const stageLabel = getStageLabel(ustawa.etap_legislacyjny);
  const title = shortenTitle(plainTitle(ustawa.tytul_oficjalny), 140);

  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/10 bg-linear-to-br from-white/10 to-white/[0.03] shadow-lg shadow-sejm-green/5 backdrop-blur-md transition-colors hover:border-emerald-300/25 hover:from-white/15">
      <SubscribeButton
        targetType="ustawa"
        targetId={ustawa.id}
        name={`druk ${ustawa.numer_druku}`}
        variant="icon"
        className="absolute right-2 top-2 z-10"
      />

      <Link href={`/ustawy/${ustawa.id}`} className="block rounded-2xl p-4 pr-14">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-white/70">
              <span className="font-bold text-emerald-300">Druk {ustawa.numer_druku}</span>
              <span aria-hidden>·</span>
              <span>{formatUstawaDate(ustawa.data_wplywu)}</span>
            </p>

            <h3 className={`mt-2 ${titleSizeClass(title, "compact")}`}>{title}</h3>

            <ImpactChips source={ustawa} className="mt-2.5" />

            <p className="mt-2 text-sm text-white/70">{ustawa.autor ?? "Autor nieokreślony"}</p>
          </div>

          <ChevronRight size={18} className="mt-1 shrink-0 text-white/50" aria-hidden />
        </div>

        <div className="mt-3 flex items-center gap-2">
          <div
            className="flex flex-1 items-center gap-1"
            role="img"
            aria-label={`Etap legislacyjny: ${stageLabel}, ${activeIndex + 1} z ${LEGISLATIVE_STAGES.length}`}
          >
            {LEGISLATIVE_STAGES.map((stage, index) => (
              <span
                key={stage.key}
                className={`h-1.5 flex-1 rounded-full ${
                  index < activeIndex
                    ? "bg-sejm-green/60"
                    : index === activeIndex
                      ? "bg-emerald-400"
                      : "bg-white/15"
                }`}
              />
            ))}
          </div>
          <span className="shrink-0 text-xs font-semibold text-emerald-300">{stageLabel}</span>
        </div>
      </Link>
    </article>
  );
}
