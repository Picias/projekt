import { Suspense } from "react";
import { notFound } from "next/navigation";
import {
  Briefcase,
  Cake,
  GraduationCap,
  MapPin,
} from "lucide-react";
import BackButton from "@/components/back-button";
import MpProfileDashboard from "@/components/mp-profile-dashboard";
import MpProfilePhoto from "@/components/mp-profile-photo";
import WatchMpButton from "@/components/watch-mp-button";
import { getClubLabel, getClubTheme } from "@/lib/club-colors";
import { fetchMpProfileBundleFromDb } from "@/lib/mp-db";
import { isFormalVote } from "@/lib/mp-stats";
import {
  calculateAge,
  formatAge,
  formatBirthDate,
  formatOkreg,
  resolvePoselName,
  toPoselProfil,
  type PoselProfil,
} from "@/lib/posel";
import { supabaseAdmin } from "@/lib/supabase-admin";

type PoselPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

async function loadPosel(id: number): Promise<PoselProfil | null> {
  const { data, error } = await supabaseAdmin.from("poslowie").select("*").eq("id", id).maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (!data) {
    return null;
  }

  return toPoselProfil(data as Record<string, unknown>);
}

export async function generateMetadata({ params }: PoselPageProps) {
  const { id } = await params;
  const poselId = Number(id);

  if (!Number.isInteger(poselId) || poselId <= 0) {
    return { title: "Nie znaleziono posła — SEJM ON" };
  }

  try {
    const posel = await loadPosel(poselId);

    if (!posel) {
      return { title: "Nie znaleziono posła — SEJM ON" };
    }

    return {
      title: `${posel.imie_nazwisko} — SEJM ON`,
      description: `Profil posła ${posel.imie_nazwisko} (${getClubLabel(posel.partia)}), X kadencja Sejmu RP.`,
    };
  } catch {
    return { title: "Nie znaleziono posła — SEJM ON" };
  }
}

function HeroMeta({
  icon: Icon,
  children,
}: {
  icon: typeof Cake;
  children: string;
}) {
  return (
    <p className="flex items-center gap-2 text-xs text-white/60">
      <Icon size={13} className="shrink-0 text-white/35" aria-hidden />
      <span className="min-w-0 leading-snug">{children}</span>
    </p>
  );
}

function ProfileFetchError({ message }: { message: string }) {
  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <BackButton label="Wróć do listy" />
      <section className="rounded-2xl border border-red-400/25 bg-red-500/10 p-5 text-sm text-red-200">
        <p className="font-semibold text-red-100">Nie udało się wczytać profilu</p>
        <p className="mt-2">{message}</p>
      </section>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Ładowanie aktywności posła">
      <section>
        <div className="mb-3 h-3 w-36 animate-pulse rounded bg-white/10" />
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-28 animate-pulse rounded-2xl bg-white/10" />
          ))}
        </div>
      </section>
      <div className="h-11 animate-pulse rounded-2xl bg-white/10" />
      <div className="flex flex-col gap-2">
        {[1, 2, 3].map((item) => (
          <div key={item} className="h-20 animate-pulse rounded-2xl bg-white/10" />
        ))}
      </div>
    </div>
  );
}

async function MpAnalytics({ posel }: { posel: PoselProfil }) {
  const theme = getClubTheme(posel.partia);

  try {
    const bundle = await fetchMpProfileBundleFromDb(posel.id, posel.partia);
    const votes = (bundle?.stats.recentVotes ?? []).filter((vote) => !isFormalVote(vote));
    const interpellations = bundle?.interpellations ?? [];
    const sittings = [...new Set(votes.map((vote) => vote.sitting).filter(Boolean))].sort(
      (a, b) => b - a,
    );

    return (
      <MpProfileDashboard
        poselId={posel.id}
        interpellationCount={bundle?.stats.interpellationCount ?? null}
        interpellationsApproximate={bundle?.stats.interpellationApproximate ?? false}
        attendancePercent={bundle?.stats.attendancePercent ?? null}
        clubTheme={theme}
        votes={votes}
        sittings={sittings}
        votesSimulated={false}
        interpellations={interpellations}
        interpellationsHasMore={(bundle?.interpellationsTotal ?? 0) > interpellations.length}
        email={null}
        share={{
          name: posel.imie_nazwisko,
          photoUrl: posel.zdjecie_url,
          club: posel.partia,
        }}
      />
    );
  } catch {
    return (
      <MpProfileDashboard
        poselId={posel.id}
        interpellationCount={null}
        interpellationsApproximate={false}
        attendancePercent={null}
        clubTheme={theme}
        votes={[]}
        sittings={[]}
        votesSimulated={false}
        interpellations={[]}
        interpellationsHasMore={false}
        email={null}
        share={{
          name: posel.imie_nazwisko,
          photoUrl: posel.zdjecie_url,
          club: posel.partia,
        }}
      />
    );
  }
}

export default async function PoselPage({ params }: PoselPageProps) {
  const { id } = await params;
  const poselId = Number(id);

  if (!Number.isInteger(poselId) || poselId <= 0) {
    notFound();
  }

  let posel: PoselProfil | null;

  try {
    posel = await loadPosel(poselId);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nie udało się odczytać profilu z bazy.";

    return <ProfileFetchError message={message} />;
  }

  if (!posel) {
    notFound();
  }

  const theme = getClubTheme(posel.partia);
  const { imie, nazwisko } = resolvePoselName(posel);
  const wiek = calculateAge(posel.data_urodzenia);
  const okreg = formatOkreg(posel.okreg_wyborczy, posel.okreg_numer);
  const clubChip = posel.partia?.trim() || getClubLabel(posel.partia);

  const ageLine =
    wiek !== null
      ? `${formatAge(wiek)}${posel.data_urodzenia ? ` · ur. ${formatBirthDate(posel.data_urodzenia)}` : ""}`
      : posel.data_urodzenia
        ? `ur. ${formatBirthDate(posel.data_urodzenia)}`
        : null;

  return (
    <div className="flex flex-col gap-6 px-5 py-5">
      <BackButton label="Wróć do listy" />

      <section
        className={`relative overflow-hidden rounded-3xl border bg-linear-to-br from-navy-800 via-navy-800/90 to-transparent p-5 ${theme.border}`}
      >
        <span
          aria-hidden
          className={`pointer-events-none absolute -right-16 -top-16 size-48 rounded-full blur-3xl ${theme.bg}`}
        />

        <WatchMpButton
          poselId={posel.id}
          poselName={posel.imie_nazwisko}
          className="absolute right-4 top-4 z-10"
        />

        <div className="relative flex items-start gap-4 pr-28">
          <MpProfilePhoto
            name={posel.imie_nazwisko}
            photoUrl={posel.zdjecie_url}
            frameClassName={`border-4 ${theme.border}`}
          />

          <div className="min-w-0 pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
              Poseł X kadencji
            </p>
            <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-3xl">
              {nazwisko ? (
                <>
                  <span className="block text-lg font-medium text-white/80">{imie}</span>
                  {nazwisko}
                </>
              ) : (
                posel.imie_nazwisko
              )}
            </h1>

            <div className="mt-3 flex flex-wrap gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${theme.text} ${theme.bg} ${theme.border}`}
              >
                {clubChip}
              </span>
              {okreg ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                  <MapPin size={12} aria-hidden />
                  {okreg}
                </span>
              ) : null}
            </div>
          </div>
        </div>

        <div className="relative mt-5 flex flex-col gap-2 border-t border-white/10 pt-4">
          {ageLine ? <HeroMeta icon={Cake}>{ageLine}</HeroMeta> : null}
          {posel.zawod ? <HeroMeta icon={Briefcase}>{posel.zawod}</HeroMeta> : null}
          {posel.wyksztalcenie ? (
            <HeroMeta icon={GraduationCap}>{posel.wyksztalcenie}</HeroMeta>
          ) : null}
        </div>
      </section>

      <Suspense fallback={<AnalyticsSkeleton />}>
        <MpAnalytics posel={posel} />
      </Suspense>
    </div>
  );
}
