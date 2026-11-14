import { supabaseAdmin } from "@/lib/supabase-admin";
import type { ScrapedSpeech } from "@/lib/sejm-speech-types";

const BUCKET = "posel-wystapienia";

async function ensureBucket(): Promise<void> {
  const existing = await supabaseAdmin.storage.getBucket(BUCKET);

  if (!existing.error && existing.data) {
    return;
  }

  const created = await supabaseAdmin.storage.createBucket(BUCKET, { public: false });

  if (created.error && !/already exists/i.test(created.error.message)) {
    throw new Error(created.error.message);
  }
}

function isSpeechList(value: unknown): value is ScrapedSpeech[] {
  return Array.isArray(value);
}

export async function readStoredSpeeches(poselId: number): Promise<ScrapedSpeech[] | null> {
  const { data, error } = await supabaseAdmin.storage.from(BUCKET).download(`${poselId}.json`);

  if (error || !data) {
    return null;
  }

  try {
    const parsed: unknown = JSON.parse(await data.text());
    return isSpeechList(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export async function writeStoredSpeeches(
  poselId: number,
  speeches: ScrapedSpeech[],
): Promise<void> {
  await ensureBucket();

  const { error } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(`${poselId}.json`, JSON.stringify(speeches), {
      contentType: "application/json",
      upsert: true,
    });

  if (error) {
    throw new Error(error.message);
  }
}
