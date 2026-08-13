import Link from "next/link";
import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  Briefcase,
  Cake,
  ChevronLeft,
  GraduationCap,
  MapPin,
  Vote,
  type LucideIcon,
} from "lucide-react";
import {
  MpProfileStats,
  MpProfileStatsSkeleton,
} from "@/components/mp-profile-stats";
import WatchMpButton from "@/components/watch-mp-button";
import { getClubLabel, getClubTheme, type ClubTheme } from "@/lib/club-colors";
import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  calculateAge,
  formatAge,
  formatBirthDate,
  formatLiczbaGlosow,
  formatOkreg,
  resolvePoselName,
  toPoselProfil,
} from "@/lib/posel";

type PoselPageProps = {
  params: Promise<{ id: string }>;
};

function ProfilePhoto({
  name,
  photoUrl,
  frameClassName,
}: {
  name: string;
  photoUrl: string | null;
  frameClassName: string;
}) {
  const frame = `size-28 shrink-0 rounded-2xl border-2 ${frameClassName}`;

  if (photoUrl) {
    return <img src={photoUrl} alt={name} className={`${frame} object-cover object-top`} />;
  }

  const initials = name
    .trim()
    .split(/\s+/)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <span
      className={`${frame} flex items-center justify-center bg-navy-700 text-2xl font-bold text-white`}
    >
      {initials}
    </span>
  );
}

type InfoItem = {
  icon: LucideIcon;
  label: string;
  value: string | null;
  hint?: string | null;
};

function BasicInfo({ items, theme }: { items: InfoItem[]; theme: ClubTheme }) {
  const hasAnyValue = items.some((item) => item.value);

  return (
    <section className="rounded-2xl border border-white/10 bg-navy-800/60 p-5">
      <h2 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
        Informacje podstawowe
      </h2>

      <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {items.map(({ icon: Icon, label, value, hint }) => (
          <div
            key={label}
            className="flex items-start gap-3 rounded-xl bg-white/5 px-3 py-2.5"
          >
            <span
              className={`mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg ${theme.bg} ${theme.text}`}
            >
              <Icon size={16} aria-hidden />
            </span>
            <div className="min-w-0">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-white/45">
                {label}
              </dt>
              <dd
                className={`text-sm font-semibold ${value ? "text-white" : "text-white/35"}`}
              >
                {value ?? "Brak danych"}
              </dd>
              {value && hint ? (
                <p className="mt-0.5 text-[11px] text-white/40">{hint}</p>
              ) : null}
            </div>
          </div>
        ))}
      </dl>

      {!hasAnyValue ? (
        <p className="mt-4 text-xs leading-relaxed text-white/45">
          Dane profilowe pobiera{" "}
          <Link href="/api/sync-mps" className="text-sejm-green-light hover:underline">
            /api/sync-mps
          </Link>{" "}
          — jeśli po synchronizacji nadal są puste, uruchom migrację{" "}
          <code className="text-white/60">supabase/schema.sql</code>.
        </p>
      ) : null}
    </section>
  );
}

export default async function PoselPage({ params }: PoselPageProps) {
  const { id } = await params;
  const poselId = Number(id);

  if (!Number.isInteger(poselId)) {
    notFound();
  }

  const { data } = await supabaseAdmin
    .from("poslowie")
    .select("*")
    .eq("id", poselId)
    .maybeSingle();

  if (!data) {
    notFound();
  }

  const posel = toPoselProfil(data);
  const { imie, nazwisko } = resolvePoselName(posel);
  const theme = getClubTheme(posel.partia);
  const wiek = calculateAge(posel.data_urodzenia);

  const infoItems: InfoItem[] = [
    {
      icon: Cake,
      label: "Wiek",
      value: wiek === null ? null : formatAge(wiek),
      hint: posel.data_urodzenia ? `ur. ${formatBirthDate(posel.data_urodzenia)}` : null,
    },
    { icon: GraduationCap, label: "Wykształcenie", value: posel.wyksztalcenie },
    { icon: Briefcase, label: "Zawód", value: posel.zawod },
    {
      icon: MapPin,
      label: "Okręg wyborczy",
      value: formatOkreg(posel.okreg_wyborczy, posel.okreg_numer),
    },
    {
      icon: Vote,
      label: "Zdobyte głosy",
      value: formatLiczbaGlosow(posel.liczba_glosow),
    },
  ];

  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <Link
        href="/poslowie"
        className="flex w-fit items-center gap-1 text-sm text-white/70 transition-colors hover:text-white"
      >
        <ChevronLeft size={18} aria-hidden />
        Wróć do listy
      </Link>

      <section
        className={`relative overflow-hidden rounded-2xl border bg-linear-to-br from-navy-800 via-navy-800/90 to-transparent p-5 ${theme.border} ${theme.bg}`}
      >
        <WatchMpButton
          poselId={poselId}
          poselName={posel.imie_nazwisko}
          className="absolute right-4 top-4"
        />

        <div className="flex items-start gap-4 pr-12">
          <ProfilePhoto
            name={posel.imie_nazwisko}
            photoUrl={posel.zdjecie_url}
            frameClassName={theme.border}
          />
          <div className="min-w-0 pt-1">
            <p className="text-sm text-white/60">Poseł X kadencji</p>
            <h1 className="mt-1 text-2xl font-bold leading-tight">{imie}</h1>
            <p className="text-xl font-semibold text-white/90">{nazwisko}</p>
          </div>
        </div>

        <span
          className={`mt-4 inline-block rounded-full border px-3 py-1 text-xs font-semibold ${theme.text} ${theme.bg} ${theme.border}`}
        >
          {getClubLabel(posel.partia)}
        </span>
      </section>

      <BasicInfo items={infoItems} theme={theme} />

      <Suspense fallback={<MpProfileStatsSkeleton />}>
        <MpProfileStats poselId={poselId} clubName={posel.partia} clubTheme={theme} />
      </Suspense>
    </div>
  );
}
