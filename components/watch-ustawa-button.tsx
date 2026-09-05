"use client";

import { useState } from "react";
import { Eye } from "lucide-react";

import SubscribeButton from "@/components/subscribe-button";
import { formatObserwujacy } from "@/lib/ustawa";

type WatchUstawaButtonProps = {
  ustawaId: number;
  numerDruku: string;
  liczbaObserwujacych: number;
  className?: string;
};

export default function WatchUstawaButton({
  ustawaId,
  numerDruku,
  liczbaObserwujacych,
  className = "",
}: WatchUstawaButtonProps) {
  const [obserwujacy, setObserwujacy] = useState(liczbaObserwujacych);

  return (
    <div className={`flex flex-col gap-2 ${className}`}>
      <SubscribeButton
        targetType="ustawa"
        targetId={ustawaId}
        name={`druk ${numerDruku}`}
        variant="full"
        onCountChange={setObserwujacy}
      />

      <p
        aria-live="polite"
        className="flex items-center justify-center gap-1.5 text-xs font-medium text-white/50"
      >
        <Eye size={13} className="text-emerald-300/70" aria-hidden />
        {formatObserwujacy(obserwujacy)}
      </p>
    </div>
  );
}
