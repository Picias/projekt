import { NextResponse } from "next/server";

import { fetchCitizenVoteStats, upsertCitizenVote } from "@/lib/citizen-votes-db";
import {
  isTypGlosu,
  PUSTE_WYNIKI,
  type TypGlosu,
  type WynikiSondy,
} from "@/lib/glosy-obywateli";
import { getSessionUserId } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
};

const PRINT_NUM_MAX = 32;

export type CitizenVotesResponse = {
  wyniki: WynikiSondy;
  za: number;
  przeciw: number;
  wstrzymalSie: number;
  totalVotes: number;
  userVote: TypGlosu | null;
};

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: NO_STORE_HEADERS });
}

function parsePrintNum(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }

  const printNum = value.trim();

  if (!printNum || printNum.length > PRINT_NUM_MAX) {
    return null;
  }

  return printNum;
}

function toResponse(wyniki: WynikiSondy, userVote: TypGlosu | null): CitizenVotesResponse {
  return {
    wyniki,
    za: wyniki.ZA,
    przeciw: wyniki.PRZECIW,
    wstrzymalSie: wyniki.WSTRZYMAL_SIE,
    totalVotes: wyniki.ZA + wyniki.PRZECIW + wyniki.WSTRZYMAL_SIE,
    userVote,
  };
}

export async function GET(request: Request) {
  const printNum = parsePrintNum(new URL(request.url).searchParams.get("print_num"));

  if (!printNum) {
    return json({ error: "Wymagany parametr: print_num" }, 400);
  }

  try {
    const userId = await getSessionUserId();
    const { wyniki, userVote } = await fetchCitizenVoteStats(printNum, userId);
    return json(toResponse(wyniki, userVote));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Nie udało się pobrać wyników sondy.";
    return json({ error: message, ...toResponse(PUSTE_WYNIKI, null) }, 500);
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return json(
        { error: "Zaloguj się, aby zagłosować.", code: "UNAUTHENTICATED" },
        401,
      );
    }

    const body = (await request.json()) as {
      print_num?: unknown;
      vote_type?: unknown;
    };

    const printNum = parsePrintNum(body.print_num);
    const voteType = body.vote_type;

    if (!printNum || !isTypGlosu(voteType)) {
      return json({ error: "Wymagane pola: print_num, vote_type" }, 400);
    }

    await upsertCitizenVote(printNum, userId, voteType);
    const { wyniki, userVote } = await fetchCitizenVoteStats(printNum, userId);
    return json(toResponse(wyniki, userVote));
  } catch (error) {
    if (error instanceof SyntaxError) {
      return json({ error: "Nieprawidłowe żądanie" }, 400);
    }

    const message = error instanceof Error ? error.message : "Nieprawidłowe żądanie";

    if (message === "Nie znaleziono druku o podanym numerze.") {
      return json({ error: message }, 404);
    }

    return json({ error: message }, 500);
  }
}
