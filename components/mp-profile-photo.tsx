"use client";

import { useState } from "react";
import { getInitials } from "@/lib/posel";

type MpProfilePhotoProps = {
  name: string;
  photoUrl: string | null;
  frameClassName?: string;
};

export default function MpProfilePhoto({
  name,
  photoUrl,
  frameClassName = "border-4 border-white/15",
}: MpProfilePhotoProps) {
  const [failed, setFailed] = useState(false);
  const showImage = Boolean(photoUrl) && !failed;

  return (
    <span
      className={`relative size-28 shrink-0 overflow-hidden rounded-full bg-navy-700 shadow-xl shadow-black/30 ${frameClassName} sm:size-32`}
    >
      {showImage ? (
        <img
          src={photoUrl ?? undefined}
          alt={name}
          className="size-full object-cover object-top"
          onError={() => setFailed(true)}
        />
      ) : (
        <span className="flex size-full items-center justify-center text-2xl font-bold text-white">
          {getInitials(name)}
        </span>
      )}
    </span>
  );
}
