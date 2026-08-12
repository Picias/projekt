import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import {
  MpProfileStats,
  MpProfileStatsSkeleton,
} from "@/components/mp-profile-stats";
import WatchMpButton from "@/components/watch-mp-button";
import { supabase } from "@/lib/supabase";
import { splitPoselName, type Posel } from "@/lib/posel";

type PoselPageProps = {
  params: Promise<{ id: string }>;
};

function ProfilePhoto({ name, photoUrl }: { name: string; photoUrl: string | null }) {
  if (photoUrl) {
    return (
      <img
        src={photoUrl}
        alt={name}
        className="size-28 shrink-0 rounded-2xl object-cover object-top ring-2 ring-sejm-green/40"
      />
    );
  }

  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span className="flex size-28 shrink-0 items-center justify-center rounded-2xl bg-navy-700 text-2xl font-bold text-white ring-2 ring-sejm-green/40">
      {initials}
    </span>
  );
}

export default async function PoselPage({ params }: PoselPageProps) {
  const { id } = await params;
  const poselId = Number(id);

  if (!Number.isInteger(poselId)) {
    notFound();
  }

  const { data } = await supabase
    .from("poslowie")
    .select("*")
    .eq("id", poselId)
    .maybeSingle();

  const posel = data as Posel | null;

  if (!posel) {
    notFound();
  }

  const { imie, nazwisko } = splitPoselName(posel.imie_nazwisko);

  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <Link
        href="/poslowie"
        className="flex w-fit items-center gap-1 text-sm text-white/70 transition-colors hover:text-white"
      >
        <ChevronLeft size={18} aria-hidden />
        Wróć do listy
      </Link>

      <section className="relative overflow-hidden rounded-2xl border border-sejm-green/20 bg-linear-to-br from-navy-800 via-navy-800 to-sejm-green/10 p-5 ring-1 ring-sejm-green/15">
        <WatchMpButton
          poselId={poselId}
          poselName={posel.imie_nazwisko}
          className="absolute right-4 top-4"
        />

        <div className="flex items-start gap-4 pr-12">
          <ProfilePhoto name={posel.imie_nazwisko} photoUrl={posel.zdjecie_url} />
          <div className="min-w-0 pt-1">
            <p className="text-sm text-white/60">Poseł X kadencji</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight">{imie}</h1>
            <p className="text-xl font-semibold text-white/90">{nazwisko}</p>
            <span className="mt-3 inline-block rounded-full bg-sejm-green/20 px-3 py-1 text-xs font-semibold text-sejm-green-light">
              {posel.partia ?? "Brak klubu"}
            </span>
          </div>
        </div>
      </section>

      <Suspense fallback={<MpProfileStatsSkeleton />}>
        <MpProfileStats poselId={poselId} clubName={posel.partia} />
      </Suspense>
    </div>
  );
}
