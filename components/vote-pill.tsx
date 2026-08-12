import { formatVoteLabel, getVoteBadgeClass } from "@/lib/mp-stats";

type VotePillProps = {
  vote: string;
};

export default function VotePill({ vote }: VotePillProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-wide ${getVoteBadgeClass(vote)}`}
    >
      {formatVoteLabel(vote)}
    </span>
  );
}
