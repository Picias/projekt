import BackButton from "@/components/back-button";
import ObradyCalendar from "@/components/obrady-calendar";
import ObradyLive from "@/components/obrady-live";
import ObradyTextCard, { ObradyTekstWiersze } from "@/components/obrady-text-card";
import { todayIso } from "@/lib/posiedzenia";
import {
  fetchCurrentProceeding,
  fetchProceedings,
  fetchTodayVideos,
  findProceedingForDate,
  isLiveSitting,
  pickInitialCalendarDate,
  pickPlenaryVideo,
  toSittingDays,
} from "@/lib/sejm-proceedings";

export const dynamic = "force-dynamic";

export default async function ObradyPage() {
  const today = todayIso();
  const [proceedings, current, videos] = await Promise.all([
    fetchProceedings(),
    fetchCurrentProceeding(),
    fetchTodayVideos(),
  ]);

  const live = isLiveSitting(current, today);
  const sittingDays = toSittingDays(proceedings);
  const initialDate = pickInitialCalendarDate(today, sittingDays);
  const selectedProceeding = findProceedingForDate(proceedings, initialDate);
  const plenary = live ? pickPlenaryVideo(videos) : null;
  const currentAffairsTekst = live ? current?.currentAffairs ?? null : null;

  return (
    <div className="flex flex-col gap-8 px-5 py-5">
      <BackButton />

      <header>
        <h1 className="text-3xl font-bold leading-tight">Obrady</h1>
        <p className="mt-2 text-sm leading-relaxed text-white/60">
          Kalendarz posiedzeń Sejmu RP i porządek obrad. W dni plenarne — transmisja na
          żywo.
        </p>
      </header>

      {live && current ? (
        <>
          <ObradyLive
            iframeSrc={plenary?.playerLinkIFrame ?? null}
            hlsSrc={plenary?.videoLink ?? null}
          />
          {currentAffairsTekst ? (
            <ObradyTextCard title="Teraz w porządku">
              <ObradyTekstWiersze tekst={currentAffairsTekst} />
            </ObradyTextCard>
          ) : null}
        </>
      ) : null}

      {proceedings.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-white/20 bg-white/5 p-5">
          <p className="text-sm font-semibold">Nie udało się pobrać kalendarza</p>
          <p className="mt-1 text-sm leading-relaxed text-white/55">
            API Sejmu nie zwróciło listy posiedzeń. Spróbuj odświeżyć stronę za chwilę.
          </p>
        </div>
      ) : (
        <ObradyCalendar
          sittingDays={sittingDays}
          today={today}
          initialDate={initialDate}
          initialTitle={selectedProceeding?.title ?? null}
          initialSitting={selectedProceeding?.number ?? null}
          initialAgendaTekst={selectedProceeding?.agenda ?? null}
        />
      )}
    </div>
  );
}
