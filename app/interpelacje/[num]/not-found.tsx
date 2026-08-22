import Link from "next/link";
import { ChevronLeft, FileText } from "lucide-react";

export default function InterpellationNotFound() {
  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <Link
        href="/poslowie"
        className="flex w-fit items-center gap-1 text-sm text-white/70 transition-colors hover:text-white"
      >
        <ChevronLeft size={18} aria-hidden />
        Wróć
      </Link>

      <section className="rounded-2xl border border-white/10 bg-navy-800/60 p-6 text-center">
        <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-white/10 text-white/50">
          <FileText size={26} aria-hidden />
        </span>
        <h1 className="mt-4 text-xl font-bold">Nie znaleziono interpelacji</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/55">
          API Sejmu nie zwraca interpelacji o podanym numerze.
        </p>
      </section>
    </div>
  );
}
