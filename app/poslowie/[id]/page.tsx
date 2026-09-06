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
import { fetchSittingNumbers } from "@/lib/glosowania-db";
import {
  fetchMpProfileStats,
  fetchMpVotesFromRecentSittings,
  isFormalVote,
} from "@/lib/mp-stats";
import {
  calculateAge,
  formatAge,
  formatBirthDate,
  formatOkreg,
} from "@/lib/posel";
import { fetchSejmMp, type SejmMpProfile } from "@/lib/sejm-mp";
import { fetchInterpellationsList } from "@/lib/sejm-voting";

type PoselPageProps = {
  params: Promise<{ id: string }>;
};

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PoselPageProps) {
  const { id } = await params;
  const poselId = Number(id);

  if (!Number.isInteger(poselId) || poselId <= 0) {
    return { title: "Nie znaleziono posła — SEJM ON" };
  }

  const result = await fetchSejmMp(poselId);

  if (result.status !== "ok") {
    return { title: "Nie znaleziono posła — SEJM ON" };
  }

  return {
    title: `${result.mp.firstLastName} — SEJM ON`,
    description: `Profil posła ${result.mp.firstLastName} (${getClubLabel(result.mp.club)}), X kadencja Sejmu RP.`,
  };
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

async function MpAnalytics({ mp }: { mp: SejmMpProfile }) {
  const theme = getClubTheme(mp.club);
  const [stats, interpellations, votes, sittingNumbers] = await Promise.all([
    fetchMpProfileStats(mp.id),
    fetchInterpellationsList(mp.id),
    fetchMpVotesFromRecentSittings(mp.id),
    fetchSittingNumbers().catch(() => [] as number[]),
  ]);
  // Drugi przesiew na wszelki wypadek: kworum, wnioski formalne, proceduralne.
  const substantiveVotes = votes.filter((vote) => !isFormalVote(vote));
  const sittings = [
    ...new Set([
      ...sittingNumbers,
      ...substantiveVotes.map((vote) => vote.sitting).filter(Boolean),
    ]),
  ].sort((a, b) => b - a);
  const interpellationCount =
    mp.numberOfInterpellations ??
    interpellations.total ??
    stats.interpellationCount ??
    (interpellations.hasMore ? null : interpellations.items.length);

  return (
    <MpProfileDashboard
      poselId={mp.id}
      interpellationCount={interpellationCount}
      interpellationsApproximate={
        mp.numberOfInterpellations == null &&
        interpellations.total == null &&
        stats.interpellationApproximate
      }
      attendancePercent={stats.attendancePercent}
      clubTheme={theme}
      votes={substantiveVotes}
      sittings={sittings}
      votesSimulated={false}
      interpellations={interpellations.items}
      interpellationsHasMore={interpellations.hasMore}
      email={mp.email}
    />
  );
}

export default async function PoselPage({ params }: PoselPageProps) {
  const { id } = await params;
  const poselId = Number(id);

  if (!Number.isInteger(poselId) || poselId <= 0) {
    notFound();
  }

  const result = await fetchSejmMp(poselId);

  if (result.status === "not_found") {
    notFound();
  }

  if (result.status === "error") {
    return <ProfileFetchError message={result.message} />;
  }

  const mp = result.mp;
  const theme = getClubTheme(mp.club);
  const wiek = calculateAge(mp.birthDate);
  const okreg = formatOkreg(mp.districtName, mp.districtNum);
  const clubChip = mp.club?.trim() || getClubLabel(mp.club);

  const ageLine =
    wiek !== null
      ? `${formatAge(wiek)}${mp.birthDate ? ` · ur. ${formatBirthDate(mp.birthDate)}` : ""}`
      : mp.birthDate
        ? `ur. ${formatBirthDate(mp.birthDate)}`
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
          poselId={mp.id}
          poselName={mp.firstLastName}
          className="absolute right-4 top-4 z-10"
        />

        <div className="relative flex items-start gap-4 pr-28">
          <MpProfilePhoto
            name={mp.firstLastName}
            photoUrl={mp.photoUrl}
            frameClassName={`border-4 ${theme.border}`}
          />

          <div className="min-w-0 pt-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-white/45">
              Poseł X kadencji
              {mp.active ? null : " · mandat wygasł"}
            </p>
            <h1 className="mt-1 text-2xl font-bold leading-tight sm:text-3xl">
              {mp.lastName ? (
                <>
                  <span className="block text-lg font-medium text-white/80">
                    {mp.firstName}
                  </span>
                  {mp.lastName}
                </>
              ) : (
                mp.firstLastName
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
          {mp.profession ? (
            <HeroMeta icon={Briefcase}>{mp.profession}</HeroMeta>
          ) : null}
          {mp.educationLevel ? (
            <HeroMeta icon={GraduationCap}>{mp.educationLevel}</HeroMeta>
          ) : null}
        </div>
      </section>

      <Suspense fallback={<AnalyticsSkeleton />}>
        <MpAnalytics mp={mp} />
      </Suspense>
    </div>
  );
}
