import { supabaseAdmin } from "@/lib/supabase-admin";
import {
  isTypGlosu,
  PUSTE_WYNIKI,
  wynikiZGlosow,
  type TypGlosu,
  type WynikiSondy,
} from "@/lib/glosy-obywateli";

let citizenVotesTable: boolean | undefined;
let lastTableProbe = 0;
const TABLE_PROBE_MS = 60_000;

async function hasCitizenVotesTable(): Promise<boolean> {
  if (citizenVotesTable === true) {
    return true;
  }

  if (citizenVotesTable === false && Date.now() - lastTableProbe < TABLE_PROBE_MS) {
    return false;
  }

  lastTableProbe = Date.now();
  const { error } = await supabaseAdmin.from("citizen_votes").select("id").limit(1);
  citizenVotesTable = !error;
  return citizenVotesTable;
}

async function resolveUstawaId(printNum: string): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("ustawy")
    .select("id")
    .eq("numer_druku", printNum)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  if (data?.id) {
    return data.id as number;
  }

  const asId = Number(printNum);

  if (!Number.isInteger(asId) || asId <= 0) {
    return null;
  }

  const { data: byId, error: idError } = await supabaseAdmin
    .from("ustawy")
    .select("id")
    .eq("id", asId)
    .maybeSingle();

  if (idError) {
    throw new Error(idError.message);
  }

  return (byId?.id as number | undefined) ?? null;
}

export async function fetchCitizenVoteStats(
  printNum: string,
  userId: string | null,
): Promise<{ wyniki: WynikiSondy; userVote: TypGlosu | null }> {
  if (await hasCitizenVotesTable()) {
    const [{ data, error }, userVote] = await Promise.all([
      supabaseAdmin.from("citizen_votes").select("vote_type").eq("print_num", printNum),
      userId ? fetchCitizenUserVote(printNum, userId) : Promise.resolve(null),
    ]);

    if (error) {
      throw new Error(error.message);
    }

    return {
      wyniki: wynikiZGlosow((data ?? []).map((row) => row.vote_type as string)),
      userVote,
    };
  }

  const ustawaId = await resolveUstawaId(printNum);

  if (ustawaId === null) {
    return { wyniki: { ...PUSTE_WYNIKI }, userVote: null };
  }

  const [{ data, error }, userVote] = await Promise.all([
    supabaseAdmin.from("glosy_obywateli").select("typ_glosu").eq("ustawa_id", ustawaId),
    userId ? fetchLegacyUserVote(ustawaId, userId) : Promise.resolve(null),
  ]);

  if (error) {
    throw new Error(error.message);
  }

  return {
    wyniki: wynikiZGlosow((data ?? []).map((row) => row.typ_glosu as string)),
    userVote,
  };
}

async function fetchCitizenUserVote(printNum: string, userId: string): Promise<TypGlosu | null> {
  const { data, error } = await supabaseAdmin
    .from("citizen_votes")
    .select("vote_type")
    .eq("print_num", printNum)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return isTypGlosu(data?.vote_type) ? data.vote_type : null;
}

async function fetchLegacyUserVote(ustawaId: number, userId: string): Promise<TypGlosu | null> {
  const { data, error } = await supabaseAdmin
    .from("glosy_obywateli")
    .select("typ_glosu")
    .eq("ustawa_id", ustawaId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return isTypGlosu(data?.typ_glosu) ? data.typ_glosu : null;
}

export async function upsertCitizenVote(
  printNum: string,
  userId: string,
  voteType: TypGlosu,
): Promise<void> {
  if (await hasCitizenVotesTable()) {
    const { error } = await supabaseAdmin.from("citizen_votes").upsert(
      {
        user_id: userId,
        print_num: printNum,
        vote_type: voteType,
        created_at: new Date().toISOString(),
      },
      { onConflict: "user_id,print_num" },
    );

    if (error) {
      throw new Error(error.message);
    }

    return;
  }

  const ustawaId = await resolveUstawaId(printNum);

  if (ustawaId === null) {
    throw new Error("Nie znaleziono druku o podanym numerze.");
  }

  const { error } = await supabaseAdmin.from("glosy_obywateli").upsert(
    {
      ustawa_id: ustawaId,
      user_id: userId,
      typ_glosu: voteType,
      oddano_at: new Date().toISOString(),
    },
    { onConflict: "ustawa_id,user_id" },
  );

  if (error) {
    throw new Error(error.message);
  }
}
