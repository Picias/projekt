"use client";

import { useEffect, useRef, useState } from "react";
import MpActivityTiles, {
  ATTENDANCE_PLACEHOLDER,
  CLUB_LOYALTY_PLACEHOLDER,
} from "@/components/mp-activity-tiles";
import { ShareButton } from "@/components/ShareCardGenerator";
import MpProfileTabs, {
  type MpProfileTabId,
} from "@/components/mp-profile-tabs";
import type { ClubTheme } from "@/lib/club-colors";
import { formatVoteLabel, type MpVote } from "@/lib/mp-stats";
import type { ScrapedSpeech } from "@/lib/sejm-speech-types";
import type { InterpellationItem } from "@/lib/sejm-voting";

type MpProfileDashboardProps = {
  poselId: number;
  interpellationCount: number | null;
  interpellationsApproximate: boolean;
  attendancePercent: number | null;
  clubTheme: ClubTheme;
  votes: MpVote[];
  sittings?: number[];
  votesSimulated: boolean;
  interpellations: InterpellationItem[];
  interpellationsHasMore: boolean;
  email: string | null;
  share?: {
    name: string;
    photoUrl: string | null;
    club: string | null;
  };
};

export default function MpProfileDashboard({
  poselId,
  interpellationCount,
  interpellationsApproximate,
  attendancePercent,
  clubTheme,
  votes,
  sittings,
  votesSimulated,
  interpellations,
  interpellationsHasMore,
  email,
  share,
}: MpProfileDashboardProps) {
  const [tab, setTab] = useState<MpProfileTabId>("votes");
  const [speeches, setSpeeches] = useState<ScrapedSpeech[] | null>(null);
  const [speechesError, setSpeechesError] = useState<string | null>(null);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadSpeeches() {
      setSpeeches(null);
      setSpeechesError(null);

      try {
        const response = await fetch(`/api/wystapienia?id=${poselId}`, {
          cache: "no-store",
        });
        const data = (await response.json()) as ScrapedSpeech[] | { error?: string };

        if (!response.ok || !Array.isArray(data)) {
          throw new Error(
            !Array.isArray(data) && data.error
              ? data.error
              : "Nie udało się wczytać wystąpień.",
          );
        }

        if (!cancelled) {
          setSpeeches(data);
        }
      } catch (error) {
        if (!cancelled) {
          setSpeechesError(
            error instanceof Error ? error.message : "Nie udało się wczytać wystąpień.",
          );
        }
      }
    }

    void loadSpeeches();

    return () => {
      cancelled = true;
    };
  }, [poselId]);

  function openTab(next: MpProfileTabId) {
    setTab(next);
    tabsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const speechesLoading = speeches === null && speechesError === null;
  const latestVote = votes[0];

  return (
    <div className="flex flex-col gap-6">
      {share ? (
        <ShareButton
          className="w-full"
          card={{
            type: "posel",
            name: share.name,
            photoUrl: share.photoUrl,
            club: share.club,
            attendancePercent: attendancePercent ?? ATTENDANCE_PLACEHOLDER,
            attendanceEstimated: attendancePercent === null,
            loyaltyPercent: CLUB_LOYALTY_PLACEHOLDER,
            mpId: poselId,
            votingSitting: latestVote?.sitting ?? null,
            votingDate: latestVote?.date ?? null,
            voteLabel: latestVote ? formatVoteLabel(latestVote.vote) : null,
          }}
        />
      ) : null}
      <MpActivityTiles
        speeches={speeches === null ? null : speeches.length}
        speechesLoading={speechesLoading}
        interpellations={interpellationCount}
        interpellationsApproximate={interpellationsApproximate}
        attendancePercent={attendancePercent}
        clubTheme={clubTheme}
        activeTab={tab}
        onSpeechesClick={() => openTab("speeches")}
        onInterpellationsClick={() => openTab("interpellations")}
      />
      <div ref={tabsRef}>
        <MpProfileTabs
          poselId={poselId}
          votes={votes}
          sittings={sittings}
          votesSimulated={votesSimulated}
          speeches={speeches}
          speechesError={speechesError}
          speechesLoading={speechesLoading}
          interpellations={interpellations}
          interpellationsHasMore={interpellationsHasMore}
          email={email}
          clubTheme={clubTheme}
          activeTab={tab}
          onTabChange={openTab}
        />
      </div>
    </div>
  );
}
