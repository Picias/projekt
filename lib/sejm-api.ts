export const SEJM_TERM = 10;
export const SEJM_API_BASE = "https://api.sejm.gov.pl";
export const SEJM_FETCH_TIMEOUT_MS = 8_000;
export const SEJM_DEFAULT_LIST_LIMIT = 20;
export const SEJM_RECENT_VOTES_LIMIT = 10;
export const SEJM_RECENT_VOTING_DAYS = 3;

export type SejmMpBrief = {
  id: number;
  club?: string;
  active?: boolean;
};

export type SejmFetchResult<T> = {
  data: T | null;
  timedOut: boolean;
  failed: boolean;
};

type FetchSejmOptions = {
  revalidate?: number;
  timeoutMs?: number;
};

export async function fetchSejmJson<T>(
  url: string,
  revalidateOrOptions: number | FetchSejmOptions = 3600,
): Promise<T | null> {
  const options =
    typeof revalidateOrOptions === "number"
      ? { revalidate: revalidateOrOptions, timeoutMs: SEJM_FETCH_TIMEOUT_MS }
      : {
          revalidate: revalidateOrOptions.revalidate ?? 3600,
          timeoutMs: revalidateOrOptions.timeoutMs ?? SEJM_FETCH_TIMEOUT_MS,
        };

  const result = await fetchSejmJsonSafe<T>(url, options);
  return result.data;
}

export async function fetchSejmJsonSafe<T>(
  url: string,
  options: FetchSejmOptions = {},
): Promise<SejmFetchResult<T>> {
  const timeoutMs = options.timeoutMs ?? SEJM_FETCH_TIMEOUT_MS;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      next: { revalidate: options.revalidate ?? 3600 },
      signal: controller.signal,
    });

    if (!response.ok) {
      return { data: null, timedOut: false, failed: true };
    }

    return {
      data: (await response.json()) as T,
      timedOut: false,
      failed: false,
    };
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "AbortError";
    return { data: null, timedOut, failed: true };
  } finally {
    clearTimeout(timeoutId);
  }
}

export function formatMpApiId(id: number): string {
  return String(id).padStart(3, "0");
}

export async function fetchAllMps(): Promise<SejmMpBrief[]> {
  const data = await fetchSejmJson<SejmMpBrief[]>(
    `${SEJM_API_BASE}/sejm/term${SEJM_TERM}/MP`,
    86400,
  );
  return data ?? [];
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  fallback: T,
): Promise<{ value: T; timedOut: boolean }> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  try {
    const timeoutPromise = new Promise<{ value: T; timedOut: boolean }>((resolve) => {
      timeoutId = setTimeout(() => resolve({ value: fallback, timedOut: true }), timeoutMs);
    });

    const result = await Promise.race([
      promise.then((value) => ({ value, timedOut: false })),
      timeoutPromise,
    ]);

    return result;
  } finally {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
  }
}

export async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );

  await Promise.all(workers);
  return results;
}
