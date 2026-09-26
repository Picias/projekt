"use client";

import Link from "next/link";
import { ChevronRight, Vote } from "lucide-react";
import MpAvatar from "@/components/mp-avatar";
import SubscribeButton from "@/components/subscribe-button";

type MpCardProps = {
  id: number;
  name: string;
  party: string;
  photoUrl: string | null;
};

export default function MpCard({ id, name, party, photoUrl }: MpCardProps) {
  return (
    <article className="relative overflow-hidden rounded-2xl border border-white/40 bg-linear-to-br from-white via-white to-emerald-50 text-navy-900 shadow-lg shadow-sejm-green/10">
      <SubscribeButton
        targetType="posel"
        targetId={id}
        name={name}
        variant="icon"
        className="absolute right-2 top-2 z-10"
      />

      <Link href={`/poslowie/${id}`} className="block rounded-2xl p-4 pr-14">
        <div className="flex items-center gap-3">
          <MpAvatar name={name} photoUrl={photoUrl} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-bold">{name}</p>
            <p className="truncate text-sm text-slate-600">{party}</p>
          </div>
        </div>

        <span className="mt-3 flex items-center gap-1.5 rounded-lg bg-white px-3 py-2 text-sm font-semibold text-green-800 ring-1 ring-emerald-200">
          <Vote size={16} className="shrink-0" aria-hidden />
          Zobacz, jak głosuje
          <ChevronRight size={16} className="ml-auto shrink-0 text-slate-500" aria-hidden />
        </span>
      </Link>
    </article>
  );
}
