"use client";

import Link from "next/link";
import { ChevronRight, Heart, TrendingUp } from "lucide-react";
import MpAvatar from "@/components/mp-avatar";

type MpCardProps = {
  id: number;
  name: string;
  party: string;
  photoUrl: string | null;
};

export default function MpCard({ id, name, party, photoUrl }: MpCardProps) {
  return (
    <Link
      href={`/poslowie/${id}`}
      className="block transition-transform hover:scale-[1.01]"
    >
      <article className="relative overflow-hidden rounded-2xl border border-sejm-green/25 bg-linear-to-br from-white to-sejm-green/5 p-4 text-navy-900 shadow-md ring-1 ring-sejm-green/10">
        <button
          type="button"
          aria-label={`Dodaj ${name} do ulubionych`}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
          }}
          className="absolute right-3 top-3 z-10 flex size-8 items-center justify-center rounded-full bg-white/80 text-slate-400 shadow-sm transition-colors hover:text-red-500"
        >
          <Heart size={16} strokeWidth={2} aria-hidden />
        </button>

        <div className="flex items-center gap-3 pr-8">
          <MpAvatar name={name} photoUrl={photoUrl} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold">{name}</p>
            <p className="truncate text-xs text-slate-500">{party}</p>
          </div>
          <ChevronRight size={16} className="shrink-0 text-slate-400" aria-hidden />
        </div>

        <div className="mt-3 flex items-center gap-1.5 rounded-lg bg-white/70 px-3 py-2">
          <TrendingUp size={14} className="shrink-0 text-sejm-green" aria-hidden />
          <span className="text-xs font-semibold text-navy-800">Poseł 10 kadencji</span>
          <span className="ml-auto text-[10px] font-medium text-sejm-green">Profil</span>
        </div>
      </article>
    </Link>
  );
}
