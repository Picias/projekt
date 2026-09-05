import type { Posel } from "@/lib/posel";
import { supabaseAdmin } from "@/lib/supabase-admin";
import type { SubscriptionTargetType, WatchedUstawaItem } from "@/lib/subscriptions";

export type SubscriptionRow = {
  target_type: SubscriptionTargetType;
  target_id: string;
};

export async function refreshLiczbaObserwujacych(
  ustawaId: number,
): Promise<number | null> {
  const { count, error } = await supabaseAdmin
    .from("obserwowane_ustawy")
    .select("user_id", { count: "exact", head: true })
    .eq("ustawa_id", ustawaId);

  if (error) {
    return null;
  }

  const liczba = count ?? 0;

  const { error: updateError } = await supabaseAdmin
    .from("ustawy")
    .update({ liczba_obserwujacych: liczba })
    .eq("id", ustawaId);

  return updateError ? null : liczba;
}

export async function readLiczbaObserwujacych(
  ustawaId: number,
): Promise<number | null> {
  const { data, error } = await supabaseAdmin
    .from("ustawy")
    .select("liczba_obserwujacych")
    .eq("id", ustawaId)
    .maybeSingle();

  if (error) {
    return null;
  }

  return (data?.liczba_obserwujacych as number | null) ?? 0;
}

/**
 * Stare tabele (obserwowani / obserwowane_ustawy) nadal karmią stronę główną
 * i licznik „gorących projektów”. Zapis do subscriptions idzie przez RLS,
 * a tu dogrywamy ten sam stan kluczem service_role.
 */
export async function syncLegacyWatch(
  userId: string,
  targetType: SubscriptionTargetType,
  targetId: string,
  watching: boolean,
): Promise<number | null> {
  const numericId = Number(targetId);

  if (!Number.isInteger(numericId) || numericId <= 0) {
    return null;
  }

  if (targetType === "posel") {
    if (watching) {
      await supabaseAdmin
        .from("obserwowani")
        .upsert(
          { user_id: userId, posel_id: numericId },
          { onConflict: "user_id,posel_id" },
        );
    } else {
      await supabaseAdmin
        .from("obserwowani")
        .delete()
        .eq("user_id", userId)
        .eq("posel_id", numericId);
    }

    return null;
  }

  if (watching) {
    await supabaseAdmin.from("obserwowane_ustawy").upsert(
      { user_id: userId, ustawa_id: numericId },
      { onConflict: "user_id,ustawa_id" },
    );
  } else {
    await supabaseAdmin
      .from("obserwowane_ustawy")
      .delete()
      .eq("user_id", userId)
      .eq("ustawa_id", numericId);
  }

  return refreshLiczbaObserwujacych(numericId);
}

export async function hydrateSubscriptions(rows: SubscriptionRow[]): Promise<{
  poslowie: Posel[];
  ustawy: WatchedUstawaItem[];
}> {
  const poselIds = [
    ...new Set(
      rows
        .filter((row) => row.target_type === "posel")
        .map((row) => Number(row.target_id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];
  const ustawaIds = [
    ...new Set(
      rows
        .filter((row) => row.target_type === "ustawa")
        .map((row) => Number(row.target_id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  ];

  const [poslowieResult, ustawyResult] = await Promise.all([
    poselIds.length > 0
      ? supabaseAdmin
          .from("poslowie")
          .select("id, imie_nazwisko, partia, zdjecie_url")
          .in("id", poselIds)
      : Promise.resolve({ data: [] as Posel[], error: null }),
    ustawaIds.length > 0
      ? supabaseAdmin
          .from("ustawy")
          .select(
            "id, numer_druku, tytul_oficjalny, autor, data_wplywu, etap_legislacyjny",
          )
          .in("id", ustawaIds)
          .order("data_wplywu", { ascending: false })
      : Promise.resolve({ data: [] as WatchedUstawaItem[], error: null }),
  ]);

  const poslowieById = new Map(
    ((poslowieResult.data ?? []) as Posel[]).map((posel) => [posel.id, posel]),
  );
  const ustawyById = new Map(
    ((ustawyResult.data ?? []) as WatchedUstawaItem[]).map((ustawa) => [
      ustawa.id,
      ustawa,
    ]),
  );

  const poslowie = poselIds.map(
    (id) =>
      poslowieById.get(id) ?? {
        id,
        imie_nazwisko: `Poseł nr ${id}`,
        partia: null,
        zdjecie_url: null,
      },
  );

  const ustawy = ustawaIds
    .map(
      (id) =>
        ustawyById.get(id) ?? {
          id,
          numer_druku: String(id),
          tytul_oficjalny: `Ustawa nr ${id}`,
          autor: null,
          data_wplywu: null,
          etap_legislacyjny: "projekt",
        },
    )
    .sort((a, b) => {
      const left = a.data_wplywu ?? "";
      const right = b.data_wplywu ?? "";
      return right.localeCompare(left);
    });

  return { poslowie, ustawy };
}
