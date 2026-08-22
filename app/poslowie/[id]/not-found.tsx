import Link from "next/link";
import { ChevronLeft, UserRoundX } from "lucide-react";

export default function PoselNotFound() {
  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <Link
        href="/poslowie"
        className="flex w-fit items-center gap-1 text-sm text-white/70 transition-colors hover:text-white"
      >
        <ChevronLeft size={18} aria-hidden />
        Wróć do listy
      </Link>

      <section className="rounded-2xl border border-white/10 bg-navy-800/60 p-6 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-white/10 text-white/50">
          <UserRoundX size={26} aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-bold">Nie znaleziono posła</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          API Sejmu nie zwraca posła o podanym identyfikatorze w X kadencji.
        </p>
      </section>
    </div>
  );
}
