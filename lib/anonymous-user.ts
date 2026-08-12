const STORAGE_KEY = "sejm-on-user-id";

export function getAnonymousUserId(): string {
  if (typeof window === "undefined") {
    return "";
  }

  const existing = localStorage.getItem(STORAGE_KEY);

  if (existing) {
    return existing;
  }

  const userId = crypto.randomUUID();
  localStorage.setItem(STORAGE_KEY, userId);
  return userId;
}
