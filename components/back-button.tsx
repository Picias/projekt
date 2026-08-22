"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft } from "lucide-react";

type BackButtonProps = {
  href?: string;
  label?: string;
};

export default function BackButton({ href, label = "Wróć" }: BackButtonProps) {
  const router = useRouter();
  const className =
    "flex w-fit items-center gap-1 text-sm text-white/70 transition-colors hover:text-white";

  if (href) {
    return (
      <Link href={href} className={className}>
        <ChevronLeft size={18} aria-hidden />
        {label}
      </Link>
    );
  }

  return (
    <button type="button" onClick={() => router.back()} className={className}>
      <ChevronLeft size={18} aria-hidden />
      {label}
    </button>
  );
}
