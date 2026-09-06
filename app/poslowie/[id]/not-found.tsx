import { UserRoundX } from "lucide-react";
import BackButton from "@/components/back-button";

export default function PoselNotFound() {
  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <BackButton label="Wróć do listy" />

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
