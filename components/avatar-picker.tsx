"use client";

import { useRef, useState } from "react";
import { Camera, Loader2, UserRound } from "lucide-react";

import { profileAvatarInitial } from "@/lib/profile";
import { createBrowserSupabase } from "@/lib/supabase-browser";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

type AvatarPickerProps = {
  userId: string;
  avatarUrl: string;
  imie: string;
  pseudonim: string;
  disabled?: boolean;
  onUrlChange: (url: string) => void;
  onError: (message: string | null) => void;
  onBusyChange?: (busy: boolean) => void;
};

function imageExtension(file: File): string {
  const fromType = file.type.split("/")[1]?.toLowerCase();
  const normalizedType = fromType === "jpeg" ? "jpg" : fromType;

  if (
    normalizedType === "jpg" ||
    normalizedType === "png" ||
    normalizedType === "webp" ||
    normalizedType === "gif" ||
    normalizedType === "heic" ||
    normalizedType === "heif"
  ) {
    return normalizedType;
  }

  const fromName = file.name.split(".").pop()?.toLowerCase();
  const normalizedName = fromName === "jpeg" ? "jpg" : fromName;

  if (
    normalizedName === "jpg" ||
    normalizedName === "png" ||
    normalizedName === "webp" ||
    normalizedName === "gif" ||
    normalizedName === "heic" ||
    normalizedName === "heif"
  ) {
    return normalizedName;
  }

  return "jpg";
}

function mapUploadError(message: string): string {
  const lower = message.toLowerCase();

  if (lower.includes("bucket") || lower.includes("not found")) {
    return "Brak bucketa avatars. Uruchom supabase/schema.sql w edytorze SQL.";
  }

  if (lower.includes("row-level security") || lower.includes("policy") || lower.includes("unauthorized")) {
    return "Brak uprawnień do wgrania zdjęcia. Uruchom supabase/schema.sql w edytorze SQL.";
  }

  return "Nie udało się wgrać zdjęcia. Spróbuj ponownie.";
}

export default function AvatarPicker({
  userId,
  avatarUrl,
  imie,
  pseudonim,
  disabled,
  onUrlChange,
  onError,
  onBusyChange,
}: AvatarPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const initial = profileAvatarInitial(imie, pseudonim);

  function setBusy(busy: boolean) {
    setUploading(busy);
    onBusyChange?.(busy);
  }

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    if (!file.type.startsWith("image/") && file.type !== "") {
      onError("Wybierz plik graficzny.");
      return;
    }

    if (file.size > MAX_AVATAR_BYTES) {
      onError("Zdjęcie może mieć maksymalnie 5 MB.");
      return;
    }

    setBusy(true);
    onError(null);

    try {
      const path = `${userId}-${Date.now()}.${imageExtension(file)}`;
      const supabase = createBrowserSupabase();
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: file.type || "image/jpeg",
      });

      if (uploadError) {
        onError(mapUploadError(uploadError.message));
        return;
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      onUrlChange(data.publicUrl);
    } catch {
      onError("Nie udało się wgrać zdjęcia. Spróbuj ponownie.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
        aria-label="Wgraj zdjęcie profilowe"
        aria-busy={uploading}
        className="group relative size-[100px] overflow-hidden rounded-full bg-navy-800 ring-2 ring-sejm-green/30 transition-colors hover:ring-sejm-green/55 focus-visible:outline-none focus-visible:ring-emerald-400/70 disabled:opacity-70"
      >
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="size-full object-cover" />
        ) : initial ? (
          <span className="flex size-full items-center justify-center text-3xl font-bold text-white">
            {initial}
          </span>
        ) : (
          <span className="flex size-full items-center justify-center text-white/55">
            <UserRound size={40} strokeWidth={1.6} aria-hidden />
          </span>
        )}

        <span className="absolute inset-x-0 bottom-0 flex h-7 items-center justify-center bg-navy-950/70 text-white/80 transition-colors group-hover:bg-navy-950/80">
          <Camera size={14} aria-hidden />
        </span>

        {uploading ? (
          <span className="absolute inset-0 flex items-center justify-center bg-navy-950/75">
            <Loader2 size={22} className="animate-spin text-sejm-green-light" aria-hidden />
            <span className="sr-only">Wgrywanie zdjęcia</span>
          </span>
        ) : null}
      </button>

      <p className="text-xs text-white/40">Kliknij, aby wgrać zdjęcie</p>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="sr-only"
        tabIndex={-1}
        onChange={handleFileChange}
      />
    </div>
  );
}
