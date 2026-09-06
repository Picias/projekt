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
      className="flex w-fit items-center gap-1 text-sm text-white/70 transition-colors hover:text-white"
    >
      <ChevronLeft size={18} aria-hidden />
      {label}
    </button>
  );
}
