"use client";

import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

type BackButtonProps = {
  label?: string;
};

export default function BackButton({ label = "Wróć" }: BackButtonProps) {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="-ml-2 flex min-h-11 w-fit items-center gap-1 rounded-xl px-2 text-sm font-medium text-white/80 transition-colors hover:text-white"
    >
      <ChevronLeft size={18} aria-hidden />
      {label}
    </button>
  );
}
