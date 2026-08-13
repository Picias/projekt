import { fetchMpProfileBundleFromDb } from "@/lib/mp-db";
import { createEmptyMpProfileStats } from "@/lib/mp-stats";
import MpProfileInteractive from "@/components/mp-profile-interactive";
import type { ClubTheme } from "@/lib/club-colors";

export function MpProfileStatsSkeleton() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Ładowanie statystyk posła">
      <section>
        <div className="mb-3 h-4 w-24 animate-pulse rounded bg-white/10" />
        <div className="grid grid-cols-2 gap-3">
          <div className="h-28 animate-pulse rounded-2xl bg-white/10" />
          <div className="h-28 animate-pulse rounded-2xl bg-white/10" />
        </div>
      </section>

      <section>
        <div className="mb-3 flex items-center gap-2">
          <div className="size-4 animate-pulse rounded bg-white/10" />
          <div className="h-4 w-40 animate-pulse rounded bg-white/10" />
        </div>
        <div className="flex flex-col gap-2">
          {[1, 2, 3, 4].map((item) => (
            <div key={item} className="h-20 animate-pulse rounded-2xl bg-white/10" />
          ))}
        </div>
      </section>
    </div>
  );
}

type MpProfileStatsProps = {
  poselId: number;
  clubName: string | null;
  clubTheme: ClubTheme;
};

export async function MpProfileStats({
  poselId,
  clubName,
  clubTheme,
}: MpProfileStatsProps) {
  try {
    const bundle = await fetchMpProfileBundleFromDb(poselId, clubName);

    return (
      <MpProfileInteractive
        poselId={poselId}
        stats={bundle.stats}
        comparison={bundle.comparison}
        interpellations={bundle.interpellations}
        interpellationsTotal={bundle.interpellationsTotal}
        voteDetails={bundle.voteDetails}
        clubTheme={clubTheme}
      />
    );
  } catch {
    const stats = createEmptyMpProfileStats(
      "Nie udało się odczytać statystyk z bazy. Upewnij się, że tabele Supabase są utworzone i zsynchronizowane.",
    );

    return (
      <MpProfileInteractive
        poselId={poselId}
        stats={stats}
        comparison={{
          mp: null,
          club: null,
          clubName,
          sejm: null,
          partial: true,
          fallbackMessage: stats.fallbackMessage,
        }}
        interpellations={[]}
        interpellationsTotal={0}
        voteDetails={{}}
        clubTheme={clubTheme}
      />
    );
  }
}
