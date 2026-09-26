import {
  Baby,
  Briefcase,
  Bus,
  Flag,
  GraduationCap,
  HeartPulse,
  Hourglass,
  House,
  Landmark,
  Leaf,
  Receipt,
  Scale,
  Shield,
  Smartphone,
  Wallet,
  Wheat,
  Zap,
  type LucideIcon,
} from "lucide-react";

import {
  buildImpactSummary,
  detectImpactAreas,
  getWalletImpact,
  type ImpactAreaKey,
  type ImpactSource,
  type ImpactSummary,
  type LawProximity,
} from "@/lib/impact";
import type { Ustawa } from "@/lib/ustawa";

export const IMPACT_AREA_ICONS: Record<ImpactAreaKey, LucideIcon> = {
  podatki: Receipt,
  zdrowie: HeartPulse,
  edukacja: GraduationCap,
  praca: Briefcase,
  rodzina: Baby,
  mieszkanie: House,
  energia: Zap,
  transport: Bus,
  rolnictwo: Wheat,
  srodowisko: Leaf,
  wolnosci: Scale,
  bezpieczenstwo: Shield,
  samorzad: Landmark,
  cyfryzacja: Smartphone,
  panstwo: Flag,
};

const AREA_ACCENTS: Record<ImpactAreaKey, string> = {
  podatki: "text-amber-300",
  zdrowie: "text-rose-300",
  edukacja: "text-sky-300",
  praca: "text-orange-300",
  rodzina: "text-pink-300",
  mieszkanie: "text-violet-300",
  energia: "text-yellow-300",
  transport: "text-cyan-300",
  rolnictwo: "text-lime-300",
  srodowisko: "text-emerald-300",
  wolnosci: "text-indigo-200",
  bezpieczenstwo: "text-slate-200",
  samorzad: "text-teal-300",
  cyfryzacja: "text-blue-300",
  panstwo: "text-stone-200",
};

const PROXIMITY_COLORS: Record<LawProximity["level"], string> = {
  0: "bg-red-400",
  1: "bg-sky-400",
  2: "bg-amber-300",
  3: "bg-emerald-400",
};

/**
 * Kompaktowa wersja wskaźnika na karty list: obszary życia + znacznik
 * portfela. Ma odpowiedzieć „czego to dotyczy?” w jednym spojrzeniu.
 */
export function ImpactChips({
  source,
  limit = 2,
  className = "",
}: {
  source: ImpactSource;
  limit?: number;
  className?: string;
}) {
  const areas = detectImpactAreas(source, limit);

  if (areas.length === 0) {
    return null;
  }

  const wallet = getWalletImpact(areas);

  return (
    <ul
      className={`flex flex-wrap items-center gap-2 ${className}`}
      aria-label="Czego dotyczy ten projekt"
    >
      {areas.map((area) => {
        const Icon = IMPACT_AREA_ICONS[area.key];

        return (
          <li
            key={area.key}
            className="inline-flex max-w-full min-w-0 items-center gap-1.5 overflow-hidden rounded-full bg-white/10 px-2.5 py-1 text-xs font-semibold text-white ring-1 ring-white/15"
          >
            <Icon size={14} className={`shrink-0 ${AREA_ACCENTS[area.key]}`} aria-hidden />
            <span className="min-w-0 truncate">{area.label}</span>
          </li>
        );
      })}
      {wallet.level === "direct" ? (
        <li className="inline-flex items-center gap-1.5 rounded-full bg-amber-300/15 px-2.5 py-1 text-xs font-semibold text-amber-100 ring-1 ring-amber-300/30">
          <Wallet size={14} className="shrink-0 text-amber-300" aria-hidden />
          Twój portfel
        </li>
      ) : null}
    </ul>
  );
}

function ProximityBar({ level, label }: { level: LawProximity["level"]; label: string }) {
  const filled = level === 0 ? 1 : level;

  return (
    <div className="flex items-center gap-1" role="img" aria-label={`Etap: ${label}`}>
      {[1, 2, 3].map((step) => (
        <span
          key={step}
          className={`h-2 w-8 rounded-full ${step <= filled ? PROXIMITY_COLORS[level] : "bg-white/15"}`}
        />
      ))}
    </div>
  );
}

type ImpactMeterProps = {
  ustawa: ImpactSource & Pick<Ustawa, "etap_legislacyjny">;
  headingLevel?: "h2" | "h3";
  summary?: ImpactSummary;
};

/**
 * Pełny wskaźnik wpływu: trzy odpowiedzi, których szuka obywatel —
 * czego dotyczy, czy sięga do portfela i kiedy go to dotknie.
 */
export default function ImpactMeter({
  ustawa,
  headingLevel = "h2",
  summary,
}: ImpactMeterProps) {
  const { areas, wallet, proximity } = summary ?? buildImpactSummary(ustawa);
  const Heading = headingLevel;
  const leading = areas[0];

  return (
    <section
      aria-labelledby="impact-meter"
      className="rounded-3xl border border-white/15 bg-navy-800 p-5 shadow-lg shadow-navy-950/40"
    >
      <Heading id="impact-meter" className="text-lg font-bold leading-tight">
        Jak to wpłynie na Twoje życie?
      </Heading>

      <div className="mt-4 flex flex-col gap-4">
        <div>
          <p className="text-sm font-semibold text-white/75">Czego dotyczy</p>
          <div className="mt-2">
            {areas.length > 0 ? (
              <>
                <ul className="flex flex-wrap items-center gap-2">
                  {areas.map((area) => {
                    const Icon = IMPACT_AREA_ICONS[area.key];

                    return (
                      <li
                        key={area.key}
                        className="inline-flex min-h-10 max-w-full min-w-0 items-center gap-2 overflow-hidden rounded-full bg-white/10 px-3.5 py-1.5 text-sm font-semibold text-white ring-1 ring-white/15"
                      >
                        <Icon
                          size={17}
                          className={`shrink-0 ${AREA_ACCENTS[area.key]}`}
                          aria-hidden
                        />
                        <span className="min-w-0 truncate">{area.label}</span>
                      </li>
                    );
                  })}
                </ul>
                {leading ? (
                  <p className="mt-2 text-sm leading-relaxed text-white/80">{leading.everyday}</p>
                ) : null}
              </>
            ) : (
              <p className="text-sm leading-relaxed text-white/75">
                Projekt porządkuje przepisy techniczne — nie rozpoznaliśmy konkretnego obszaru
                codziennego życia. Sprawdź streszczenie poniżej.
              </p>
            )}
          </div>
        </div>

        <div className="flex items-start gap-3 border-t border-white/10 pt-4">
          <span
            className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${
              wallet.level === "direct"
                ? "bg-amber-300/15 text-amber-300"
                : "bg-white/10 text-white/70"
            }`}
          >
            <Wallet size={20} aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white/75">Twój portfel</p>
            <p
              className={`mt-0.5 text-base font-semibold leading-snug ${
                wallet.level === "direct" ? "text-amber-100" : "text-white"
              }`}
            >
              {wallet.label}
            </p>
          </div>
        </div>

        <div className="flex items-start gap-3 border-t border-white/10 pt-4">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10 text-white/70">
            <Hourglass size={20} aria-hidden />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-white/75">Kiedy Cię dotknie</p>
            <div className="mt-1">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
                <span className="text-base font-semibold text-white">{proximity.label}</span>
                <ProximityBar level={proximity.level} label={proximity.label} />
              </div>
              <p className="mt-1 text-sm leading-relaxed text-white/80">{proximity.hint}</p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/** Wersja do karty „Decyzji dnia” — bez nagłówka sekcji. */
export function ImpactStrip({
  ustawa,
}: {
  ustawa: ImpactSource & Pick<Ustawa, "etap_legislacyjny">;
}) {
  const { proximity } = buildImpactSummary(ustawa);

  return (
    <div className="flex flex-col gap-3">
      <ImpactChips source={ustawa} limit={3} />
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
        <span className="inline-flex items-center gap-1.5 font-semibold text-white">
          <Hourglass size={15} className="text-white/70" aria-hidden />
          {proximity.label}
        </span>
        <ProximityBar level={proximity.level} label={proximity.label} />
      </div>
      <p className="text-sm leading-relaxed text-white/80">{proximity.hint}</p>
    </div>
  );
}
