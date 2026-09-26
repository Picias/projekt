import type { Posel } from "@/lib/posel";
import type { Ustawa } from "@/lib/ustawa";

export const SUBSCRIPTION_TARGET_TYPES = ["posel", "ustawa"] as const;

/** Zdarzenie okna, po którym sekcje „Obserwuję” ponownie pobierają listy. */
export const SUBSCRIPTIONS_CHANGED_EVENT = "sejmon:subscriptions-changed";

export type SubscriptionTargetType = (typeof SUBSCRIPTION_TARGET_TYPES)[number];

export type WatchedUstawaItem = Pick<
  Ustawa,
  "id" | "numer_druku" | "tytul_oficjalny" | "autor" | "data_wplywu" | "etap_legislacyjny"
>;

export type SubscriptionListResponse = {
  zalogowany: boolean;
  poslowie: Posel[];
  ustawy: WatchedUstawaItem[];
};

export function isSubscriptionTargetType(
  value: unknown,
): value is SubscriptionTargetType {
  return (
    value === "posel" ||
    value === "ustawa"
  );
}

export function parseTargetId(value: unknown): string | null {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return String(value);
  }

  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return value.trim();
  }

  return null;
}
