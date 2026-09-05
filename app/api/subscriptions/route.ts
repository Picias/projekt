import { NextResponse } from "next/server";

import {
  hydrateSubscriptions,
  readLiczbaObserwujacych,
  syncLegacyWatch,
  type SubscriptionRow,
} from "@/lib/subscriptions-db";
import {
  isSubscriptionTargetType,
  parseTargetId,
  type SubscriptionTargetType,
} from "@/lib/subscriptions";
import { getSessionUserId, createServerSupabase } from "@/lib/supabase-server";

export const dynamic = "force-dynamic";

type TargetPayload = {
  targetType: SubscriptionTargetType;
  targetId: string;
};

function readTargetFromSearch(request: Request): TargetPayload | null {
  const { searchParams } = new URL(request.url);
  const targetType = searchParams.get("target_type");
  const targetId = parseTargetId(searchParams.get("target_id"));

  if (!isSubscriptionTargetType(targetType) || !targetId) {
    return null;
  }

  return { targetType, targetId };
}

async function readTargetFromBody(request: Request): Promise<TargetPayload | null> {
  const body = (await request.json()) as {
    target_type?: unknown;
    target_id?: unknown;
  };

  const targetId = parseTargetId(body.target_id);

  if (!isSubscriptionTargetType(body.target_type) || !targetId) {
    return null;
  }

  return { targetType: body.target_type, targetId };
}

async function liczbaForTarget(
  targetType: SubscriptionTargetType,
  targetId: string,
): Promise<number | null> {
  if (targetType !== "ustawa") {
    return null;
  }

  return readLiczbaObserwujacych(Number(targetId));
}

export async function GET(request: Request) {
  const target = readTargetFromSearch(request);
  const userId = await getSessionUserId();

  if (target) {
    if (!userId) {
      return NextResponse.json({
        subscribed: false,
        zalogowany: false,
        liczba_obserwujacych: await liczbaForTarget(target.targetType, target.targetId),
      });
    }

    const supabase = await createServerSupabase();
    const { data, error } = await supabase
      .from("subscriptions")
      .select("id")
      .eq("target_type", target.targetType)
      .eq("target_id", target.targetId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      subscribed: Boolean(data),
      zalogowany: true,
      liczba_obserwujacych: await liczbaForTarget(target.targetType, target.targetId),
    });
  }

  if (!userId) {
    return NextResponse.json({
      zalogowany: false,
      poslowie: [],
      ustawy: [],
    });
  }

  const supabase = await createServerSupabase();
  const { data, error } = await supabase
    .from("subscriptions")
    .select("target_type, target_id")
    .order("created_at", { ascending: false });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const rows = ((data ?? []) as SubscriptionRow[]).filter(
    (row): row is SubscriptionRow =>
      isSubscriptionTargetType(row.target_type) && Boolean(row.target_id),
  );

  try {
    const { poslowie, ustawy } = await hydrateSubscriptions(rows);
    return NextResponse.json({ zalogowany: true, poslowie, ustawy });
  } catch (hydrateError) {
    const message =
      hydrateError instanceof Error
        ? hydrateError.message
        : "Nie udało się pobrać listy obserwowanych.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Zaloguj się, aby obserwować.", code: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }

    const target = await readTargetFromBody(request);

    if (!target) {
      return NextResponse.json(
        { error: "Wymagane pola: target_type, target_id" },
        { status: 400 },
      );
    }

    const supabase = await createServerSupabase();
    const { error } = await supabase.from("subscriptions").insert({
      user_id: userId,
      target_type: target.targetType,
      target_id: target.targetId,
    });

    if (error && error.code !== "23505") {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const liczba_obserwujacych = await syncLegacyWatch(
      userId,
      target.targetType,
      target.targetId,
      true,
    );

    return NextResponse.json({
      subscribed: true,
      liczba_obserwujacych,
    });
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie" }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  try {
    const userId = await getSessionUserId();

    if (!userId) {
      return NextResponse.json(
        { error: "Zaloguj się, aby zmienić obserwowane.", code: "UNAUTHENTICATED" },
        { status: 401 },
      );
    }

    const target =
      readTargetFromSearch(request) ?? (await readTargetFromBody(request));

    if (!target) {
      return NextResponse.json(
        { error: "Wymagane pola: target_type, target_id" },
        { status: 400 },
      );
    }

    const supabase = await createServerSupabase();
    const { error } = await supabase
      .from("subscriptions")
      .delete()
      .eq("target_type", target.targetType)
      .eq("target_id", target.targetId);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const liczba_obserwujacych = await syncLegacyWatch(
      userId,
      target.targetType,
      target.targetId,
      false,
    );

    return NextResponse.json({
      subscribed: false,
      liczba_obserwujacych,
    });
  } catch {
    return NextResponse.json({ error: "Nieprawidłowe żądanie" }, { status: 400 });
  }
}
