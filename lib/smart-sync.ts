import { todayIso } from "@/lib/posiedzenia";
import { fetchSejmJson, SEJM_API_BASE, SEJM_TERM } from "@/lib/sejm-api";
import { syncUstawy, type SyncUstawyResult } from "@/lib/sync-ustawy";
import { syncVotings, type SyncVotingsResult } from "@/lib/sync-votings";

// Smart CRON odpala się często, więc nie przerabiamy całej kadencji —
// bierzemy najnowsze druki i głosowania bieżącego posiedzenia.
const SMART_USTAWY_LIMIT = 40;
const SMART_VOTINGS_LIMIT = 120;

type CurrentProceeding = {
  number?: number;
  dates?: string[];
  current?: boolean;
  title?: string;
};

export type SmartSyncResult = {
  success: boolean;
  message: string;
  skipped?: boolean;
  forced?: boolean;
  sittingDay?: boolean;
  sitting?: number | null;
  today?: string;
  ustawy?: Pick<SyncUstawyResult, "status" | "synced" | "message">;
  glosowania?: Pick<
    SyncVotingsResult,
    "status" | "zapisanychGlosowan" | "glosowanZApi" | "message"
  >;
};

export async function runSmartSync(options: { force?: boolean } = {}): Promise<SmartSyncResult> {
  const today = todayIso();
  const force = Boolean(options.force);

  const proceeding = await fetchSejmJson<CurrentProceeding>(
    `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/proceedings/current`,
    { revalidate: 0, timeoutMs: 10_000 },
  );

  const dates = proceeding?.dates ?? [];
  const sittingDay = dates.includes(today);
  const sitting =
    typeof proceeding?.number === "number" && proceeding.number > 0
      ? proceeding.number
      : null;

  if (!sittingDay && !force) {
    return {
      success: true,
      skipped: true,
      sittingDay: false,
      sitting,
      today,
      message: "Brak posiedzenia. Pominięto synchronizację.",
    };
  }

  const ustawy = await syncUstawy({ limit: SMART_USTAWY_LIMIT });
  const glosowania = sitting
    ? await syncVotings({ sitting, maxVotings: SMART_VOTINGS_LIMIT })
    : await syncVotings({ sittings: 1, maxVotings: SMART_VOTINGS_LIMIT });

  const ustawyFailed = ustawy.status === "error";
  const votingsFailed = glosowania.status === "error";

  if (ustawyFailed || votingsFailed) {
    const parts = [ustawy.message, glosowania.message].filter(Boolean);

    return {
      success: false,
      forced: force,
      sittingDay,
      sitting,
      today,
      message: parts.join(" ") || "Synchronizacja nie powiodła się",
      ustawy: summarizeUstawy(ustawy),
      glosowania: summarizeVotings(glosowania),
    };
  }

  return {
    success: true,
    forced: force,
    sittingDay,
    sitting,
    today,
    message: "Zsynchronizowano najnowsze głosowania i druki z dzisiejszego posiedzenia.",
    ustawy: summarizeUstawy(ustawy),
    glosowania: summarizeVotings(glosowania),
  };
}

function summarizeUstawy(result: SyncUstawyResult) {
  return {
    status: result.status,
    synced: result.synced,
    message: result.message,
  };
}

function summarizeVotings(result: SyncVotingsResult) {
  return {
    status: result.status,
    zapisanychGlosowan: result.zapisanychGlosowan,
    glosowanZApi: result.glosowanZApi,
    message: result.message,
  };
}
