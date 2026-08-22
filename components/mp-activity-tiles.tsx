import {
  FileText,
  LoaderCircle,
  Mic,
  ShieldCheck,
  UserCheck,
  type LucideIcon,
} from "lucide-react";
import type { ClubTheme } from "@/lib/club-colors";
import { formatInterpellationCount } from "@/lib/mp-stats";

export const ATTENDANCE_PLACEHOLDER = 98.5;
export const CLUB_LOYALTY_PLACEHOLDER = 95;

type MpActivityTilesProps = {
  speeches: number | null;
  speechesLoading?: boolean;
  interpellations: number | null;
  interpellationsApproximate?: boolean;
  attendancePercent: number | null;
  clubLoyaltyPercent?: number;
  clubTheme: ClubTheme;
  activeTab?: "speeches" | "interpellations" | string;
  onSpeechesClick?: () => void;
  onInterpellationsClick?: () => void;
};

function Tile({
  icon: Icon,
  label,
  value,
  hint,
  themeClass,
  progress,
  progressClassName,
  onClick,
  active,
  loading,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
  themeClass: string;
  progress?: number | null;
  progressClassName?: string;
  onClick?: () => void;
  active?: boolean;
  loading?: boolean;
}) {
  const content = (
    <>
      <div className={`flex items-center gap-2 ${themeClass}`}>
        <span className="flex size-8 items-center justify-center rounded-lg bg-white/10">
          <Icon size={16} aria-hidden />
        </span>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/55">
          {label}
        </p>
      </div>
      {loading ? (
        <div
          className="mt-3 flex h-8 items-center gap-2"
          aria-busy="true"
          aria-label={`Ładowanie: ${label}`}
        >
          <span className="h-7 w-14 animate-pulse rounded-md bg-white/15" />
          <LoaderCircle size={14} className="animate-spin text-white/35" aria-hidden />
        </div>
      ) : (
        <p className="mt-3 text-2xl font-bold tabular-nums tracking-tight">{value}</p>
      )}
      <p className="mt-0.5 text-[11px] leading-snug text-white/45">{hint}</p>
      {progress !== null && progress !== undefined ? (
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuenow={Math.round(progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={label}
        >
          <div
            className={`h-full rounded-full transition-all ${progressClassName ?? "bg-sejm-green"}`}
            style={{ width: `${Math.min(Math.max(progress, 0), 100)}%` }}
          />
        </div>
      ) : null}
    </>
  );

  const className = `rounded-2xl border bg-navy-800/80 p-4 text-left shadow-lg shadow-black/10 ${
    active ? "border-white/25 bg-white/8" : "border-white/10"
  } ${onClick ? "transition-colors hover:bg-white/8" : ""}`;

  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={active} className={className}>
        {content}
      </button>
    );
  }

  return <article className={className}>{content}</article>;
}

export default function MpActivityTiles({
  speeches,
  speechesLoading = false,
  interpellations,
  interpellationsApproximate = false,
  attendancePercent,
  clubLoyaltyPercent = CLUB_LOYALTY_PLACEHOLDER,
  clubTheme,
  activeTab,
  onSpeechesClick,
  onInterpellationsClick,
}: MpActivityTilesProps) {
  const attendance = attendancePercent ?? ATTENDANCE_PLACEHOLDER;
  const attendanceIsReal = attendancePercent !== null;

  return (
    <section>
      <h2 className="mb-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
        Statystyki aktywności
      </h2>
      <div className="grid grid-cols-2 gap-3">
        <Tile
          icon={Mic}
          label="Wystąpienia"
          value={speeches === null ? "—" : String(speeches)}
          hint="z trybuny sejmowej"
          themeClass={clubTheme.text}
          onClick={onSpeechesClick}
          active={activeTab === "speeches"}
          loading={speechesLoading}
        />
        <Tile
          icon={FileText}
          label="Interpelacje"
          value={formatInterpellationCount(
            interpellations,
            interpellationsApproximate,
          )}
          hint="w X kadencji"
          themeClass="text-sky-300"
          onClick={onInterpellationsClick}
          active={activeTab === "interpellations"}
        />
        <Tile
          icon={UserCheck}
          label="Frekwencja"
          value={`${Number.isInteger(attendance) ? attendance : attendance.toFixed(1)}%`}
          hint={
            attendanceIsReal
              ? "udział w głosowaniach"
              : "szacunek · dane w przygotowaniu"
          }
          themeClass="text-sejm-green-light"
          progress={attendance}
          progressClassName="bg-sejm-green"
        />
        <Tile
          icon={ShieldCheck}
          label="Lojalność klubowa"
          value={`${clubLoyaltyPercent}%`}
          hint="głosuje z klubem"
          themeClass="text-amber-300"
          progress={clubLoyaltyPercent}
          progressClassName="bg-amber-400"
        />
      </div>
    </section>
  );
}
